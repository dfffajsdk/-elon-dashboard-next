
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkRange() {
    const { data, error } = await supabase
        .from('cached_tweets')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1);

    const { data: latest, error: e2 } = await supabase
        .from('cached_tweets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

    if (data && data.length) {
        console.log('Earliest tweet:', new Date(data[0].created_at * 1000).toISOString());
    }
    if (latest && latest.length) {
        console.log('Latest tweet:', new Date(latest[0].created_at * 1000).toISOString());
    }

    // Count total
    const { count } = await supabase.from('cached_tweets').select('*', { count: 'exact', head: true });
    console.log('Total tweets:', count);
}

checkRange();
