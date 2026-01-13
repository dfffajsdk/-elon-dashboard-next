"""Check ALL data in cached_heatmap and look for 2026-10 entries."""
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv('.env.local')

s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

print("🔍 FULL DATABASE CHECK")
print("="*60)

# Total count
r = s.from_('cached_heatmap').select('*', count='exact').execute()
print(f"\nTotal entries: {r.count}")

# Check for ANY entry with 2026-10 in the date
print("\n✅ LATEST 10 entries (most recent dates):")
r2 = s.from_('cached_heatmap').select('id,date_str,date_normalized,hour').order('date_normalized', desc=True).limit(10).execute()
for x in r2.data:
    flag = "⚠️ WRONG!" if "2026-10" in x['date_normalized'] or "2026-11" in x['date_normalized'] else ""
    print(f"   {x['date_normalized']} ({x['date_str']}) {x['hour']} {flag}")

# Look specifically for October data
print("\n📅 Entries containing 'Oct' in date_str:")
r3 = s.from_('cached_heatmap').select('id,date_str,date_normalized,hour').eq('date_str', 'Oct 31').limit(10).execute()
for x in r3.data:
    flag = "⚠️ WRONG!" if "2026" in x['date_normalized'] else "✅ CORRECT"
    print(f"   {x['date_normalized']} ({x['date_str']}) {x['hour']} {flag}")

# Get unique date_normalized values containing 2026-1
print("\n🔍 Checking for future dates (2026-02 onwards):")
# Get all entries and check manually
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

# Count by year-month
from collections import Counter
year_months = Counter([d[:7] for d in all_entries])
print("   Year-Month distribution:")
for ym in sorted(year_months.keys()):
    count = year_months[ym]
    flag = "⚠️" if ym >= "2026-02" else ""
    print(f"   {ym}: {count} entries {flag}")
