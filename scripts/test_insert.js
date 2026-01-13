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

async function test() {
    const id = "TEST_ROW_" + Date.now();
    const ts = 1767912092;
    console.log(`Inserting test row ${id} with created_at: ${ts}`);

    const { error } = await supabase.from('cached_tweets').insert({
        id: id,
        text: "TEST TWEET",
        created_at: ts,
        period_start: 1766509200
    });

    if (error) {
        console.error("Insert error:", error);
    } else {
        console.log("Insert success.");

        // Read it back
        const { data, error: err2 } = await supabase.from('cached_tweets').select('*').eq('id', id);
        if (data && data[0]) {
            console.log("Read back:", JSON.stringify(data[0], null, 2));
        } else {
            console.error("Read error:", err2);
        }
    }
}

test();
