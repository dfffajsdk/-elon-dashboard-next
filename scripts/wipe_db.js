const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envData = {};
envContent.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) envData[key.trim()] = val.trim();
});

const supabase = createClient(envData['SUPABASE_URL'], envData['SUPABASE_SERVICE_KEY']);

async function wipe() {
    console.log("🔥 STARTING AGGRESSIVE DATABASE CLEANUP...");

    // 1. Check current counts
    const { count: tPre } = await supabase.from('cached_tweets').select('*', { count: 'exact', head: true });

    console.log(`Current status:`);
    console.log(`- Tweets: ${tPre} rows`);

    if (tPre === 0) {
        console.log("ℹ️ No tweets to clear.");
    } else {
        console.log(`🧹 Clearing all tweets...`);

        // Strategy A: Delete all by non-matching ID
        await supabase.from('cached_tweets').delete().neq('id', 'some_random_id_that_never_exists');

        // Strategy B: Explicitly target 0 timestamps (the ghosts)
        await supabase.from('cached_tweets').delete().eq('created_at', 0);

        // Strategy C: Target everything with IDs
        await supabase.from('cached_tweets').delete().like('id', '%');

        console.log("✅ Cleanup operations complete.");
    }

    // Verify
    const { count: tPost } = await supabase.from('cached_tweets').select('*', { count: 'exact', head: true });

    console.log(`\nFINAL RESULT:`);
    console.log(`- Tweets: ${tPost} (Should be 0)`);

    if (tPost === 0) {
        console.log("✅ DATABASE CLEANUP SUCCESSFUL.");
    } else {
        console.error("❌ SOME TWEETS REMAIN.");
    }
}

wipe();
