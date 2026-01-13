const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envData = {};
envContent.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) envData[key.trim()] = val.trim();
});

const SUPABASE_URL = envData['SUPABASE_URL'];
const SUPABASE_KEY = envData['SUPABASE_SERVICE_KEY'];
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getNormalizedDate(dateStr) {
    // "Jan 08" -> "2026-01-08"
    // "Dec 25" -> "2025-12-25"
    const [mon, day] = dateStr.split(' ');
    let year = 2026;
    if (mon === 'Dec' || mon === 'Nov' || mon === 'Oct') year = 2025;

    const months = {
        "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06",
        "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
    };
    return `${year}-${months[mon]}-${day.padStart(2, '0')}`;
}

async function restore() {
    console.log("🔥 FULL DATABASE RESTORE STARTED...");

    // 1. CLEAR DATABASE
    // 1. CLEAR DATABASE - AGGRESSIVE
    console.log("🧹 Wiping existing data (Aggressive Mode)...");

    // Strategy 1: String IDs (Tweets)
    await supabase.from('cached_tweets').delete().like('id', '%');
    // Heatmap (likely numeric ID)
    await supabase.from('cached_heatmap').delete().gte('id', 0);

    // Strategy 2: Numeric Check (catch stragglers)
    await supabase.from('cached_tweets').delete().gte('period_start', -9999999999);

    // Strategy 3: Zero ID specifically
    await supabase.from('cached_tweets').delete().eq('id', '0');

    // Strategy 4: Zero Timestamp (The persistent ghosts)
    const { count: zDel } = await supabase.from('cached_tweets').delete().eq('created_at', 0).select('*', { count: 'exact', head: true });
    console.log(`🧹 Wiped ${zDel} zero-timestamp rows.`);

    // Verify
    const { count: check } = await supabase.from('cached_tweets').select('*', { count: 'exact', head: true });
    if (check > 0) {
        console.error(`❌ CRITICAL: Could not wipe ${check} rows. Manual intervention needed.`);
    } else {
        console.log("✅ Database verified EMPTY (0 rows).");
    }

    // 2. RESTORE TWEETS (From tweets.json)
    const tweetsPath = path.join(__dirname, '../public/cache/tweets.json');
    if (fs.existsSync(tweetsPath)) {
        const json = JSON.parse(fs.readFileSync(tweetsPath, 'utf8'));
        const tweets = json.data || json;
        console.log(`📦 Found ${tweets.length} tweets in tweets.json`);

        let batch = [];
        const ref_start = 1766509200; // Tue Dec 23 2025
        let count = 0;

        // count valid timestamps
        let validTS = 0;
        let zeroTS = 0;
        for (const t of tweets) {
            if (t.timestr > 0) validTS++;
            else zeroTS++;
        }
        console.log(`Audit: Valid TS: ${validTS}, Zero/Missing TS: ${zeroTS}`);

        for (const t of tweets) {
            // ts must be number
            const ts = parseInt(t.timestr);
            const text = t.msg || '';
            const id = (t.xid && t.xid !== "None") ? t.xid : t.baseid;

            if (!ts) continue;

            // Period Calc
            const diff = ts - ref_start;
            const weeks = Math.floor(diff / (7 * 24 * 3600));
            const p_start = ref_start + (weeks * 7 * 24 * 3600);

            // Deduce is_reply
            let is_reply = false;
            // Check 'action' field (huifu = reply)
            if (t.action === 'huifu') is_reply = true;
            // Fallback to text patterns
            else if (text.trim().startsWith('@')) is_reply = true;
            else if (text.includes('**Reply**')) is_reply = true;
            else if (text.startsWith('RT @')) is_reply = false; // Explicitly false for RT

            // If 'msg' contains the verbose "**Reply** from Elon...", that's a reply too.
            // We trust 'action' mostly if available.

            batch.push({
                id: id,
                text: text,
                msg: text,
                created_at: Number(ts), // Force Number
                is_reply: is_reply,
                period_start: p_start,
                // raw_data: t, // REMOVED to avoid size/serialization issues
                cached_at: new Date().toISOString()
            });

            if (count === 0) {
                console.log("DEBUG: First batch[0].created_at:", batch[0].created_at, typeof batch[0].created_at);
                console.log("DEBUG: Full Item:", JSON.stringify(batch[0], null, 2));
            }

            if (batch.length >= 100) {
                await supabase.from('cached_tweets').upsert(batch);
                batch = [];
                process.stdout.write('T');
            }
            count++;
        }
        if (batch.length > 0) await supabase.from('cached_tweets').upsert(batch);
        console.log(`\n✅ Restored ${count} tweets.`);
    }

    // 3. RESTORE HEATMAP (From tweet_status.json)
    const statusPath = path.join(__dirname, '../public/cache/tweet_status.json');
    if (fs.existsSync(statusPath)) {
        const json = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
        const posts = json.data?.posts || json.posts;

        if (posts && Array.isArray(posts)) {
            console.log(`📦 Found ${posts.length} days of heatmap data.`);

            let hBatch = [];
            let hCount = 0;

            for (const dayObj of posts) {
                const dateStr = dayObj.date; // "Jan 08"
                if (!dateStr) continue;

                const dateNorm = getNormalizedDate(dateStr);

                // Iterate hours
                for (const key of Object.keys(dayObj)) {
                    if (key === 'date') continue; // skip date field
                    if (!key.includes(':')) continue; // skip non-time keys

                    // key is "00:00", val is {tweet:1, reply:0}
                    const val = dayObj[key];

                    hBatch.push({
                        date_str: dateStr,
                        date_normalized: dateNorm,
                        hour: key,
                        tweet_count: val.tweet || 0,
                        reply_count: val.reply || 0
                    });

                    if (hBatch.length >= 100) {
                        await supabase.from('cached_heatmap').upsert(hBatch, { on_conflict: 'date_normalized,hour' });
                        hBatch = [];
                        process.stdout.write('H');
                    }
                    hCount++;
                }
            }
            if (hBatch.length > 0) await supabase.from('cached_heatmap').upsert(hBatch, { on_conflict: 'date_normalized,hour' });
            console.log(`\n✅ Restored ${hCount} hourly heatmap slots from cache.`);
        }
    } else {
        console.log("⚠️ tweet_status.json not found, heatmap might be incomplete.");
    }

    console.log("\n🎉 FULL RESTORE COMPLETE.");
}

restore();
