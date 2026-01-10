/**
 * Import cached tweets to Supabase
 * Run: node scripts/import_to_supabase.js
 * 
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
 */

const fs = require('fs');
const path = require('path');

// Load environment from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
    process.exit(1);
}

async function importData() {
    const dataPath = path.join(__dirname, 'import_data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    console.log(`Importing ${data.tweets.length} tweets...`);
    console.log(`Period start: ${data.count.period_start}`);
    console.log(`Total count: ${data.count.count}`);

    // Import count first
    console.log('\n1. Importing count...');
    const countResponse = await fetch(`${SUPABASE_URL}/rest/v1/cached_counts`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
            period_start: data.count.period_start,
            count: data.count.count,
            mt_count: data.count.count,
            updated_at: new Date().toISOString()
        })
    });

    if (!countResponse.ok) {
        const err = await countResponse.text();
        console.error('Count import failed:', err);
    } else {
        console.log('✅ Count imported successfully');
    }

    // Import tweets in batches of 50
    console.log('\n2. Importing tweets in batches...');
    const batchSize = 50;
    let imported = 0;

    for (let i = 0; i < data.tweets.length; i += batchSize) {
        const batch = data.tweets.slice(i, i + batchSize).map(t => ({
            id: t.id,
            period_start: t.period_start,
            text: t.text?.substring(0, 1000) || '',
            msg: t.msg?.substring(0, 1000) || '',
            created_at: t.created_at,
            is_reply: t.is_reply,
            raw_data: t.raw_data,
            cached_at: new Date().toISOString()
        }));

        const response = await fetch(`${SUPABASE_URL}/rest/v1/cached_tweets`, {
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
            console.error(`Batch ${i / batchSize + 1} failed:`, err);
        } else {
            imported += batch.length;
            process.stdout.write(`\rImported: ${imported}/${data.tweets.length}`);
        }
    }

    console.log('\n\n✅ Import complete!');
    console.log(`Total tweets imported: ${imported}`);
}

importData().catch(console.error);
