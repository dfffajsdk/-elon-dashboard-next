/**
 * Clear memory_documents and cached_counts tables
 * Run this before re-generating historical data
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function clearTable(tableName) {
    // Delete all rows - use different filters for different tables
    const filter = tableName === 'memory_documents' ? 'id=not.is.null' : 'period_start=gt.0';
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?${filter}`, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal'
        }
    });

    if (!response.ok) {
        const err = await response.text();
        console.error(`Failed to clear ${tableName}:`, err);
        return false;
    }
    return true;
}

async function main() {
    console.log('🗑️ Clearing old data...');

    // Clear memory_documents
    const memoryCleared = await clearTable('memory_documents');
    if (memoryCleared) {
        console.log('  ✅ memory_documents cleared');
    }

    // Clear cached_counts
    const countsCleared = await clearTable('cached_counts');
    if (countsCleared) {
        console.log('  ✅ cached_counts cleared');
    }

    console.log('\n✅ Done! Now run: node scripts/generate_memory.js');
}

main().catch(console.error);
