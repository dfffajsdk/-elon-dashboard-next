const fs = require('fs');
const path = require('path');

const heatmapPath = 'd:\\polymarket\\elon-dashboard-next\\public\\cache\\tweet_status.json';

const content = fs.readFileSync(heatmapPath, 'utf-8');
const data = JSON.parse(content);

// Period: Jan 2 12:00 ET to Jan 9 12:00 ET
// This is tricky with heatmap daily data (aggregated by UTC day usually, or ET day?)
// The original file structure is `posts: [{ date: "Jan 02", "12": { tweet: 1... } }]`
// Usually "date" is like "Jan 02".
// Let's iterate and sum up for Jan 02 (after 12:00) through Jan 09 (before 12:00).
// Assuming data is ET based on previous observations.

let totalTweets = 0;
let totalReplies = 0;

console.log('Analyzing Heatmap Data (Period: Jan 2 12:00 - Jan 9 12:00)');

const posts = data.data ? data.data.posts : data.posts;

posts.forEach(day => {
    // day.date is "Jan 02"
    if (!day.date) return;

    // Simple filter for the week
    const dayNum = parseInt(day.date.split(' ')[1]);
    const month = day.date.split(' ')[0];

    // We only care about Jan 02 - Jan 09
    if (month !== 'Jan') return;
    if (dayNum < 2 || dayNum > 9) return;

    // Check hourly
    // Keys are "00", "01"... "23"
    Object.keys(day).forEach(key => {
        if (key === 'date') return;
        const hour = parseInt(key);

        // Time logic:
        // Jan 02: >= 12
        // Jan 03-08: All
        // Jan 09: < 12

        let include = false;
        if (dayNum === 2) {
            if (hour >= 12) include = true;
        } else if (dayNum === 9) {
            if (hour < 12) include = true;
        } else {
            include = true;
        }

        if (include) {
            const entry = day[key];
            const tweets = entry.tweet || 0;
            const replies = entry.reply || 0;
            totalTweets += tweets;
            totalReplies += replies;
        }
    });
});

console.log(`Total Tweets (Heatmap): ${totalTweets}`);
console.log(`Total Replies (Heatmap): ${totalReplies}`);
console.log(`Non-Replies: ${totalTweets} - ${totalReplies} = ${totalTweets - totalReplies}`);
