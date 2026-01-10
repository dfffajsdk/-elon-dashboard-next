const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkJan9Period() {
    console.log('Checking Jan 9 Period (InMemory Check - FIXED YEAR)...');

    // Jan 2, 2026 12:00 PM ET = Jan 2, 17:00 UTC
    // Jan 9, 2026 12:00 PM ET = Jan 9, 17:00 UTC

    const startTs = Math.floor(new Date('2026-01-02T17:00:00Z').getTime() / 1000);
    const endTs = Math.floor(new Date('2026-01-09T17:00:00Z').getTime() / 1000);

    console.log(`Filter range: ${startTs} to ${endTs}`);
    console.log(`Date range: ${new Date(startTs * 1000).toISOString()} to ${new Date(endTs * 1000).toISOString()}`);

    // Fetch ALL tweets locally to filter
    const { data: allTweets, error } = await supabase
        .from('cached_tweets')
        .select('*');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Total tweets in DB: ${allTweets.length}`);

    // Filter manually
    const periodTweets = allTweets.filter(t => t.created_at >= startTs && t.created_at < endTs);

    console.log(`\nTweets in Period [${startTs} - ${endTs}]: ${periodTweets.length}`);

    // Analyze breakdown
    let replies = 0;
    let retweets = 0;
    let quotes = 0;
    let original = 0;

    periodTweets.forEach(t => {
        const text = (t.msg || t.text || '').trim();
        const isReply = t.is_reply || text.startsWith('@'); // Simplistic check

        if (isReply) {
            replies++;
        } else if (text.startsWith('RT @')) {
            retweets++;
        } else {
            original++;
        }
    });

    console.log(`\n--- Breakdown (Period Count: ${periodTweets.length}) ---`);
    console.log(`Replies: ${replies}`);
    console.log(`Non-Replies: ${periodTweets.length - replies}`);
    console.log(`  - Retweets: ${retweets}`);
    console.log(`  - Original: ${original}`);

    console.log(`\nTotal - Replies = ${periodTweets.length - replies}`);

    if (periodTweets.length - replies === 570) console.log('✅ MATCH: 570 = Non-Reply Tweets');
    else if (periodTweets.length === 570) console.log('✅ MATCH: 570 = Total Tweets');
    else console.log('❌ 570 does not match standard counts.');
}

checkJan9Period();
