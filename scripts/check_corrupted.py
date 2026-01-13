"""Check for corrupted date entries in database."""
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv('.env.local')

s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

# Check for entries with 2026-10 or 2026-11 (should not exist)
print("Checking for corrupted entries (future dates)...")

# Get total count
r = s.from_('cached_heatmap').select('*', count='exact').execute()
print(f"\nTotal entries in cached_heatmap: {r.count}")

# Check for entries with year 2026 but month > current month (Jan = 1)
# These would be "future" dates that shouldn't exist
r2 = s.from_('cached_heatmap').select('id,date_str,date_normalized,hour').gte('date_normalized', '2026-02-01').limit(20).execute()
print(f"\nEntries with date >= 2026-02-01 (should be 0):")
for x in r2.data:
    print(f"  ID {x['id']}: {x['date_normalized']} ({x['date_str']}) {x['hour']}")

# Check for correct 2025 entries
r3 = s.from_('cached_heatmap').select('id,date_str,date_normalized,hour').gte('date_normalized', '2025-07-01').lt('date_normalized', '2025-08-01').limit(5).execute()
print(f"\nSample 2025-07 entries (should exist):")
for x in r3.data:
    print(f"  ID {x['id']}: {x['date_normalized']} ({x['date_str']}) {x['hour']}")

# Check for 2025-10 entries (October 2025)
r4 = s.from_('cached_heatmap').select('id,date_str,date_normalized,hour').gte('date_normalized', '2025-10-01').lt('date_normalized', '2025-11-01').limit(5).execute()
print(f"\nSample 2025-10 entries (should exist for October):")
for x in r4.data:
    print(f"  ID {x['id']}: {x['date_normalized']} ({x['date_str']}) {x['hour']}")
