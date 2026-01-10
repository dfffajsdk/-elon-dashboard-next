/**
 * Merge and import ALL tweets from multiple data sources
 * Combines unique tweets by ID to get the most complete dataset
 */

const fs = require('fs');
const path = require('path');

// All data sources
const DATA_SOURCES = [
    { path: path.join(__dirname, '..', '..', 'elon_max_data.json'), name: 'elon_max_data' },
    { path: path.join(__dirname, '..', '..', 'elon_one_year.json'), name: 'elon_one_year' },
    { path: path.join(__dirname, '..', 'public', 'cache', 'tweets.json'), name: 'tweets.json' },
    { path: path.join(__dirname, '..', '..', 'elontweets_complete.json'), name: 'elontweets_complete' },
    { path: path.join(__dirname, '..', '..', 'elon_all_data.json'), name: 'elon_all_data' },
];

// Map to store unique tweets by ID
const tweetsMap = new Map();

console.log('=== Merging tweets from all sources ===\n');

for (const source of DATA_SOURCES) {
    try {
        if (!fs.existsSync(source.path)) {
            console.log(`[SKIP] ${source.name}: file not found`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(source.path, 'utf-8'));
        const tweets = data.tweets || data.data || [];

        let added = 0;
        for (const tweet of tweets) {
            const id = tweet.baseid || tweet.tgid || tweet.id;
            const timestamp = tweet.timestr || tweet.timestamp;

            if (!id || !timestamp) continue;

            // Only add if we don't have this ID, or if this one is newer
            if (!tweetsMap.has(id)) {
                tweetsMap.set(id, {
                    id,
                    msg: tweet.msg || tweet.text || tweet.content || '',
                    created_at: timestamp,
                    is_reply: tweet.action === 'huifu',
                    raw_data: tweet
                });
                added++;
            }
        }

        console.log(`[OK] ${source.name}: ${tweets.length} total, ${added} new unique`);
    } catch (e) {
        console.log(`[ERROR] ${source.name}: ${e.message}`);
    }
}

const allTweets = Array.from(tweetsMap.values());
console.log(`\n=== Total unique tweets: ${allTweets.length} ===`);

// Find date range
const timestamps = allTweets.map(t => t.created_at).filter(Boolean);
if (timestamps.length > 0) {
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    console.log(`Date range: ${new Date(minTs * 1000).toISOString()} to ${new Date(maxTs * 1000).toISOString()}`);
}

// Output as JSON for API import
const outputPath = path.join(__dirname, 'import_data.json');
fs.writeFileSync(outputPath, JSON.stringify({
    count: { period_start: 0, count: allTweets.length },
    tweets: allTweets.map(t => ({
        id: t.id,
        period_start: 0,
        text: t.msg,
        msg: t.msg,
        created_at: t.created_at,
        is_reply: t.is_reply,
        raw_data: t.raw_data
    }))
}, null, 2));

console.log(`\nExported to: ${outputPath}`);
console.log('\nRun: node scripts/import_to_supabase.js');
