const fs = require('fs');
const path = require('path');

const filePath = 'd:\\polymarket\\elon-dashboard-next\\public\\cache\\tweets.json';

if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    let tweets = json.tweets || json.data || [];

    // Filter by Jan 2 17:00 UTC - Jan 9 17:00 UTC
    const START_TS = 1767373200;
    const END_TS = 1767978000;

    const periodTweets = tweets.filter(t => {
        let ts = t.timestamp || t.created_at;
        if (!ts && t.timestr) ts = parseInt(t.timestr);
        if (typeof ts === 'string') ts = parseInt(ts);
        return ts >= START_TS && ts < END_TS;
    });

    console.log(`\n=== Analysis of tweets.json (Period) ===`);
    console.log(`Total Rows: ${periodTweets.length}`);

    const uniqueIds = new Set();
    periodTweets.forEach(t => {
        const id = t.id || t.baseid || t.xid;
        if (id) uniqueIds.add(id);
    });

    console.log(`Unique IDs: ${uniqueIds.size}`);
    console.log(`Duplicates: ${periodTweets.length - uniqueIds.size}`);
} else {
    console.log('File not found');
}
