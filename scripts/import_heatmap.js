/**
 * Import heatmap data (hourly stats) into Supabase
 * Data source: tweet_status.json containing per-hour tweet/reply counts
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

// Read tweet_status.json
const dataPath = path.join(__dirname, '..', 'public', 'cache', 'tweet_status.json');

if (!fs.existsSync(dataPath)) {
    console.error('tweet_status.json not found at:', dataPath);
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const posts = data.data?.posts || [];

console.log(`Found ${posts.length} days of heatmap data`);

// Parse date string to normalized date
function parseDate(dateStr) {
    // dateStr is like "Jan 08", "Dec 25"
    const months = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    const parts = dateStr.split(' ');
    const month = months[parts[0]];
    const day = parts[1].padStart(2, '0');

    // Determine year based on month
    const year = ['Nov', 'Dec'].includes(parts[0]) ? '2025' : '2026';

    return `${year}-${month}-${day}`;
}

// Transform data to rows
const rows = [];
for (const dayData of posts) {
    const dateStr = dayData.date;
    if (!dateStr) continue;

    const dateNormalized = parseDate(dateStr);

    // Extract hourly data
    for (const [key, value] of Object.entries(dayData)) {
        if (key === 'date') continue;

        const hour = key; // e.g., "00:00", "13:00"
        const tweetCount = value.tweet || 0;
        const replyCount = value.reply || 0;

        rows.push({
            date_str: dateStr,
            date_normalized: dateNormalized,
            hour: hour,
            tweet_count: tweetCount,
            reply_count: replyCount
        });
    }
}

console.log(`Prepared ${rows.length} hourly records`);
console.log(`Date range: ${rows[rows.length - 1]?.date_normalized} to ${rows[0]?.date_normalized}`);

async function importData() {
    console.log('\nImporting to Supabase...');

    // Import in batches of 100
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const response = await fetch(`${SUPABASE_URL}/rest/v1/cached_heatmap?on_conflict=date_normalized,hour`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(batch)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, err);
        } else {
            imported += batch.length;
            process.stdout.write(`\rImported: ${imported}/${rows.length}`);
        }
    }

    console.log('\n\n✅ Heatmap data import complete!');
    console.log(`Total records imported: ${imported}`);
}

importData().catch(console.error);
