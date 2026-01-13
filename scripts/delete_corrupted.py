"""Delete ALL future-dated entries and verify."""
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv('.env.local')

s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

print("🗑️ DELETING CORRUPTED ENTRIES")
print("="*60)

# Get count of corrupted entries first
print("\n1. Counting corrupted entries (date_normalized >= 2026-02-01)...")
# We need to iterate and count manually
all_entries = []
offset = 0
while True:
    r = s.from_('cached_heatmap').select('id,date_normalized').range(offset, offset+999).execute()
    if not r.data:
        break
    all_entries.extend(r.data)
    if len(r.data) < 1000:
        break
    offset += 1000

corrupted_ids = [e['id'] for e in all_entries if e['date_normalized'] >= '2026-02-01']
print(f"   Found {len(corrupted_ids)} corrupted entries to delete")

# Delete in batches
print("\n2. Deleting corrupted entries...")
batch_size = 50
for i in range(0, len(corrupted_ids), batch_size):
    batch = corrupted_ids[i:i+batch_size]
    for id in batch:
        try:
            s.from_('cached_heatmap').delete().eq('id', id).execute()
        except Exception as e:
            print(f"   Error deleting ID {id}: {e}")
    print(f"   Deleted {min(i+batch_size, len(corrupted_ids))}/{len(corrupted_ids)}...")

print("   ✅ Deletion complete")

# Verify
print("\n3. Verification:")
# Recount
all_entries = []
offset = 0
while True:
    r = s.from_('cached_heatmap').select('date_normalized').range(offset, offset+999).execute()
    if not r.data:
        break
    all_entries.extend([x['date_normalized'] for x in r.data])
    if len(r.data) < 1000:
        break
    offset += 1000

from collections import Counter
year_months = Counter([d[:7] for d in all_entries])
print("   Year-Month distribution after cleanup:")
for ym in sorted(year_months.keys()):
    count = year_months[ym]
    flag = "⚠️ STILL WRONG!" if ym >= "2026-02" else "✅"
    print(f"   {ym}: {count} entries {flag}")

print(f"\n   Total entries: {len(all_entries)}")
