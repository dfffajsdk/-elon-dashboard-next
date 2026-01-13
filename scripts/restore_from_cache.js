require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function getMonDay(date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = months[date.getUTCMonth()]; // Use UTC to be consistent with crawler
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${m} ${d}`;
}

async function restore() {
    console.log("📦 Restoring from public/cache/ backup files...");

    const tweetsPath = path.join(__dirname, '../public/cache/tweets.json');
    if (!fs.existsSync(tweetsPath)) {
        console.log("❌ tweets.json not found.");
        return;
    }

    const tweets = JSON.parse(fs.readFileSync(tweetsPath, 'utf8'));
    console.log(`Found ${tweets.length} tweets in backup.`);

    // 1. Restore Tweets
    let batch = [];
    const ref_start = 1766509200; // Tue Dec 23 2025

    for (const t of tweets) {
        if (!t.created_at) continue;

        const diff = t.created_at - ref_start;
        const weeks = Math.floor(diff / (7 * 24 * 3600));
        const p_start = ref_start + (weeks * 7 * 24 * 3600);

        batch.push({
            id: t.id,
            text: t.text || t.msg || '',
            msg: t.text || t.msg || '',
            created_at: t.created_at,
            is_reply: t.is_reply || false,
            period_start: p_start,
            raw_data: t,
            cached_at: new Date().toISOString()
        });

        if (batch.length >= 100) {
            const { error } = await supabase.from('cached_tweets').upsert(batch).execute();
            if (error) console.error("Upsert error:", error);
            batch = [];
            process.stdout.write('.');
        }
    }
    if (batch.length > 0) {
        await supabase.from('cached_tweets').upsert(batch).execute();
    }
    console.log("\n✅ Tweets table restored.");

    // 2. Rebuild Heatmap
    console.log("🔄 Rebuilding heatmap...");
    const heatmap = {};

    // We can use the 'tweets' array taking from file directly to speed up
    for (const t of tweets) {
        if (!t.created_at) continue;
        // logic: ts - 5h (ET conversion from UTC?)
        // The crawler does: datetime.fromtimestamp(ts - 5*3600, tz=timezone.utc)
        // JS: new Date((ts - 5*3600)*1000)

        const d = new Date((t.created_at - 5 * 3600) * 1000);
        const date_norm = d.toISOString().split('T')[0]; // YYYY-MM-DD
        const hour = d.toISOString().split('T')[1].substring(0, 2) + ":00";
        const date_str = getMonDay(d);

        const key = `${date_norm}|${hour}`;
        if (!heatmap[key]) {
            heatmap[key] = {
                date_normalized: date_norm,
                hour: hour,
                date_str: date_str,
                tweet_count: 0,
                reply_count: 0
            };
        }
        if (t.is_reply) heatmap[key].reply_count++;
        else heatmap[key].tweet_count++;
    }

    const rows = Object.values(heatmap);
    console.log(`Saving ${rows.length} heatmap slots...`);

    for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from('cached_heatmap').upsert(rows.slice(i, i + 100), { on_conflict: 'date_normalized,hour' }).execute();
        if (error) console.error("Heatmap error:", error);
    }
    console.log("✅ Heatmap data restored.");
}

restore().catch(console.error);
