
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const soup = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkCount() {
    const { count, error } = await soup.from('cached_heatmap').select('*', { count: 'exact', head: true });
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Total rows in cached_heatmap:', count);
    }
}

checkCount();
