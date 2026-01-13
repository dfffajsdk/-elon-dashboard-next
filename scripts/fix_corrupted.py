"""Delete all corrupted entries with future dates and verify."""
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv('.env.local')

s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

# Delete all entries with dates >= 2026-02-01 (future dates that shouldn't exist)
print("🗑️ Deleting corrupted entries (dates >= 2026-02-01)...")
try:
    r = s.from_('cached_heatmap').delete().gte('date_normalized', '2026-02-01').execute()
    print(f"✅ Deleted corrupted heatmap entries")
except Exception as e:
    print(f"Error: {e}")

# Verify remaining data
print("\n📊 Verifying remaining data...")

# Get date range
r1 = s.from_('cached_heatmap').select('date_normalized').order('date_normalized', desc=False).limit(1).execute()
r2 = s.from_('cached_heatmap').select('date_normalized').order('date_normalized', desc=True).limit(1).execute()

if r1.data and r2.data:
    print(f"Date range: {r1.data[0]['date_normalized']} to {r2.data[0]['date_normalized']}")

# Get total count
r3 = s.from_('cached_heatmap').select('*', count='exact').execute()
print(f"Total entries: {r3.count}")

# Show sample of latest dates
r4 = s.from_('cached_heatmap').select('date_str,date_normalized').order('date_normalized', desc=True).limit(5).execute()
print("\nLatest 5 dates:")
for x in r4.data:
    print(f"  {x['date_normalized']} ({x['date_str']})")
