const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Analyze Local File
const jsonPath = path.join(__dirname, '../public/cache/tweets.json');
const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const tweets = json.data || json;

let minTs = Infinity;
let maxTs = 0;
tweets.forEach(t => {
    const ts = parseInt(t.timestr || t.timestamp || 0);
    if (ts > 0) {
        if (ts < minTs) minTs = ts;
        if (ts > maxTs) maxTs = ts;
    }
});

console.log('--- Local File Analysis ---');
console.log(`Total Items: ${tweets.length}`);
console.log(`First Item "jishu": ${tweets[0].jishu}`);
console.log(`Last Item "jishu": ${tweets[tweets.length - 1].jishu}`);
console.log(`Date Range: ${new Date(minTs * 1000).toISOString()} TO ${new Date(maxTs * 1000).toISOString()}`);

// 2. Analyze DB
const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) env[k.trim()] = v.trim();
});

const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_KEY']);

async function checkDB() {
    const { count } = await supabase.from('cached_tweets').select('*', { count: 'exact', head: true });
    console.log('\n--- Database Analysis ---');
    console.log(`Total Rows in DB: ${count}`);

    if (count !== tweets.length) {
        console.log('MISMATCH DETECTED: DB has extra rows.');
    }
}

checkDB();
