/**
 * Rebuild heatmap data (hourly stats) from cached_tweets table
 * This uses the actual message timestamp to determine the date/hour in ET.
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function rebuildHeatmap() {
    console.log('Fetching all tweets from cached_tweets...');

    let tweets = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('cached_tweets')
            .select('id, created_at, is_reply')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching tweets:', error);
            break;
        }

        if (!data || data.length === 0) break;

        tweets = tweets.concat(data);
        page++;

        process.stdout.write(`\rFetched ${tweets.length} tweets...`);
    }
    console.log('\nFinished fetching.');

    console.log(`Processing ${tweets.length} tweets...`);

    // Aggregation map: date_str -> hour -> { tweet: count, reply: count }
    // date_str example: "Jan 13"
    // We also need date_normalized for sorting: "2026-01-13"
    const stats = {};

    // Formatter for ET
    // We need: Month, Day, Hour, Year
    const etFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short', // "Jan"
        day: '2-digit', // "13"
        hour: 'numeric', // "0" to "23" or "12 PM" - actually better to use hour12: false
        year: 'numeric',
        hour12: false
    });

    let processedCount = 0;

    for (const tweet of tweets) {
        if (!tweet.created_at) continue;

        // created_at is seconds in DB
        const dateObj = new Date(tweet.created_at * 1000);

        // Format to parts
        const parts = etFormatter.formatToParts(dateObj);

        // Extract parts
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        const year = parts.find(p => p.type === 'year').value;
        const hourStr = parts.find(p => p.type === 'hour').value;

        const hour = parseInt(hourStr); // 0-23

        const dateStr = `${month} ${day}`; // "Jan 13"

        // Normalized date for sorting: YYYY-MM-DD
        // We need month index
        const monthIndex = "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(month) / 3 + 1;
        const monthNum = String(Math.floor(monthIndex)).padStart(2, '0');
        const dateNormalized = `${year}-${monthNum}-${day}`;

        const now = new Date();
        if (dateObj > now) {
            console.warn(`⚠️ Skipping future tweet! ID: ${tweet.id}, Timestamp: ${tweet.created_at}, Parsed: ${dateObj.toISOString()}`);
            continue;
        }

        // Key for stats
        const key = dateNormalized;

        if (!stats[key]) {
            stats[key] = {
                date_str: dateStr,
                date_normalized: dateNormalized,
                hours: {}
            };
        }

        if (!stats[key].hours[hour]) {
            stats[key].hours[hour] = { tweet: 0, reply: 0 };
        }

        if (tweet.is_reply) {
            stats[key].hours[hour].reply++;
        } else {
            stats[key].hours[hour].tweet++;
        }

        processedCount++;
    }

    console.log(`Aggregated stats for ${Object.keys(stats).length} days.`);

    // Prepare rows for insertion
    const rows = [];

    for (const [dateNorm, dayData] of Object.entries(stats)) {
        for (const [hour, counts] of Object.entries(dayData.hours)) {
            rows.push({
                date_str: dayData.date_str,
                date_normalized: dateNorm,
                hour: String(hour), // The API expects string like "0", "13", wait. import_heatmap used "00:00" format?
                // Let's check previous code.
                // Previous code: hour = key; // e.g. "00:00"
                // But database expects integer or formatted?
                // ActivityHeatmap.tsx: const hour = parseInt(key.split(':')[0]);
                // AND: if (count > 0) data[dateStr][hour] = { count };
                // BUT: database.ts: dateGroups[row.date_str][row.hour]
                // Let's verify what row.hour is.
                // In database.ts: row.hour seems to be what is stored.
                // If I store "0", parseInt is 0. If I store "00:00", parseInt is 0.
                // Let's stick to simple integer string "0", "13" OR match previous "00:00".
                // The previous JSON had "00:00".
                // I'll format as "HH:00" to be safe and consistent with previous JSON format.
                tweet_count: counts.tweet,
                reply_count: counts.reply
            });
        }
    }

    // Correction: Format hour as "HH:00"
    rows.forEach(r => {
        const h = parseInt(r.hour);
        r.hour = `${String(h).padStart(2, '0')}:00`;
    });

    console.log(`Prepared ${rows.length} heatmap rows.`);

    if (rows.length === 0) {
        console.log('No rows to insert.');
        return;
    }

    console.log('Clearing old heatmap data...');
    // We can just wipe it
    await supabase.from('cached_heatmap').delete().neq('date_normalized', '1970-01-01');

    console.log('Inserting new heatmap data...');

    // Batch insert
    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error: insertError } = await supabase
            .from('cached_heatmap')
            .insert(batch);

        if (insertError) {
            console.error('Insert error:', insertError);
        } else {
            process.stdout.write(`\rInserted ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
        }
    }

    console.log('\n✅ Rebuild complete.');
}

rebuildHeatmap().catch(console.error);
