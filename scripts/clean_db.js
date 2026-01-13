require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function clean() {
    console.log("🧹 Cleaning invalid rows (created_at = 0)...");

    // Delete rows where created_at is 0 or null
    // Also delete where period_start is 0
    const { error: e1 } = await supabase
        .from('cached_tweets')
        .delete()
        .or('created_at.eq.0,period_start.eq.0');

    if (e1) console.error("Error cleaning tweets:", e1);
    else console.log("✅ Cleaned bad cached_tweets.");

    // Also clean heatmap to be safe
    const { error: e2 } = await supabase
        .from('cached_heatmap')
        .delete()
        .neq('date_normalized', '1970-01-01'); // Delete all rows (valid date comparison) 
    // No, let's just delete obviously wrong ones or all.
    // Actually, let's wipe heatmap completely so rebuild_heatmap() fills it fresh.

    if (e2) console.error("Error cleaning heatmap:", e2);
    else console.log("✅ Wiped cached_heatmap for fresh rebuild.");
}

clean();
