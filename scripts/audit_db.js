require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function audit() {
    console.log("🔍 Auditing cached_tweets...");

    // Get total count
    const { count, error: countErr } = await supabase
        .from('cached_tweets')
        .select('*', { count: 'exact', head: true });

    if (countErr) {
        console.error("Error getting count:", countErr);
        return;
    }

    console.log(`Total rows: ${count}`);

    // Get samples
    const { data, error: dataErr } = await supabase
        .from('cached_tweets')
        .select('id, created_at, cached_at')
        .order('cached_at', { ascending: false })
        .limit(10);

    if (dataErr) {
        console.error("Error getting samples:", dataErr);
        return;
    }

    console.log("Latest 10 rows:");
    data.forEach(row => {
        console.log(`- ID: ${row.id}, created_at: ${row.created_at}, cached_at: ${row.cached_at}`);
    });
}

audit();
