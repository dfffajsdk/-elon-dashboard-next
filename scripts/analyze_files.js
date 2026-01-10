const fs = require('fs');
const path = require('path');

// Target Period: Jan 2 12:00 ET - Jan 9 12:00 ET (2026)
// UTC: 2026-01-02 17:00 -> 2026-01-09 17:00
const START_TS = 1767373200;
const END_TS = 1767978000;

console.log(`Checking Period: Jan 2 17:00 UTC (${START_TS}) - Jan 9 17:00 UTC (${END_TS})`);

const files = [
    'd:\\polymarket\\elon_max_data.json',
    'd:\\polymarket\\elon_all_data.json',
    'd:\\polymarket\\elontweets_complete.json',
    'd:\\polymarket\\elon-dashboard-next\\public\\cache\\tweets.json',
    'd:\\polymarket\\antigravity-dashboard\\public\\cache\\tweets.json'
];

files.forEach(f => analyzeFile(f));

function analyzeFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`\n[Skip] File not found: ${filePath}`);
        return;
    }

    const name = path.basename(filePath);
    let tweets = [];
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(content);
        if (Array.isArray(json)) tweets = json;
        else if (json.data) tweets = json.data;
        else if (json.tweets) tweets = json.tweets;
    } catch (e) {
        console.error(`[Skip] Error parsing ${name}:`, e.message);
        return;
    }

    // Filter by timestamp
    const periodTweets = tweets.filter(t => {
        let ts = t.timestamp || t.created_at;
        // Some files might use 'timestr' (seconds)
        if (!ts && t.timestr) ts = parseInt(t.timestr);
        // Sometimes timestamps are strings
        if (typeof ts === 'string') ts = parseInt(ts);

        return ts >= START_TS && ts < END_TS;
    });

    if (periodTweets.length === 0) {
        console.log(`\n=== ${name} ===`);
        console.log(`  Total in file: ${tweets.length}`);
        console.log(`  In Period: 0`);
        // Check date range of file
        const timestamps = tweets.map(t => parseInt(t.timestamp || t.timestr || t.created_at || 0)).filter(t => t > 0);
        if (timestamps.length > 0) {
            const min = Math.min(...timestamps);
            const max = Math.max(...timestamps);
            console.log(`  Range: ${new Date(min * 1000).toISOString()} to ${new Date(max * 1000).toISOString()}`);
        }
        return;
    }

    let replies = 0;
    let retweets = 0;
    let original = 0;

    periodTweets.forEach(t => {
        const text = (t.msg || t.text || t.content || '').trim();
        let isReply = false;
        if (t.is_reply === true || t.action === 'huifu') isReply = true;
        else if (text.startsWith('@')) isReply = true;

        if (isReply) replies++;
        else if (text.startsWith('RT @')) retweets++;
        else original++;
    });

    const nonReplies = periodTweets.length - replies;

    console.log(`\n=== ${name} ===`);
    console.log(`  Total in Period: ${periodTweets.length}`);
    console.log(`  Replies: ${replies}`);
    console.log(`  Non-Replies: ${nonReplies} (Tweets: ${original}, Retweets: ${retweets})`);

    if (nonReplies === 570) console.log('  ✅ MATCH: 570 Non-Replies found!');
    else if (periodTweets.length === 570) console.log('  ✅ MATCH: 570 Total Tweets found!');
}
