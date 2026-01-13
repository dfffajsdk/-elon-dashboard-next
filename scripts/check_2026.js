
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    console.log('Checking 2026...');
    const start2026 = 1767225600; // Jan 1 2026
    const { count, error } = await supabase
        .from('cached_tweets')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start2026);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Tweets >= 2026-01-01:', count);
    }
}

check();
