/**
 * Script to import tweets.json into Supabase
 * Uses the more recent cached data from public/cache/tweets.json
 */

const fs = require('fs');
const path = require('path');

// Read the tweets.json file (more recent)
const dataPath = path.join(__dirname, '..', 'public', 'cache', 'tweets.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

const tweets = data.data || [];
console.log(`Found ${tweets.length} tweets to import`);

// Find the date range
const timestamps = tweets.map(t => t.timestr).filter(t => t);
const minTs = Math.min(...timestamps);
const maxTs = Math.max(...timestamps);
console.log(`Date range: ${new Date(minTs * 1000).toISOString()} to ${new Date(maxTs * 1000).toISOString()}`);

// Transform to the format needed for Supabase
const transformedTweets = tweets.map(tweet => ({
    id: tweet.baseid || tweet.tgid,
    period_start: 1735833600, // Jan 2, 2026 12:00 PM ET (jan9 period)
    text: tweet.msg || '',
    msg: tweet.msg || '',
    created_at: tweet.timestr,
    is_reply: tweet.action === 'huifu',
    raw_data: tweet
}));

// Count non-reply tweets (jishu > 0)
const countNonReply = tweets.filter(t => t.jishu > 0).length;
console.log(`Non-reply tweets: ${countNonReply}`);
console.log(`Total tweets (including replies): ${tweets.length}`);

// Output as JSON for API import
const outputPath = path.join(__dirname, 'import_data.json');
fs.writeFileSync(outputPath, JSON.stringify({
    count: { period_start: 1735833600, count: tweets.length },
    tweets: transformedTweets
}, null, 2));

console.log(`\nExported ${transformedTweets.length} tweets to: ${outputPath}`);
