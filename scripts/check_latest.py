"""Check latest dates in database."""
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv('.env.local')

s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

# Check heatmap
r = s.from_('cached_heatmap').select('date_str,date_normalized').order('date_normalized', desc=True).limit(10).execute()
print("Latest dates in cached_heatmap:")
for x in r.data:
    print(f"  {x['date_normalized']} ({x['date_str']})")

# Check tweets
r2 = s.from_('cached_tweets').select('id,created_at').order('created_at', desc=True).limit(5).execute()
print("\nLatest tweets in cached_tweets:")
from datetime import datetime, timedelta
for x in r2.data:
    ts = x['created_at']
    et = datetime.utcfromtimestamp(ts) - timedelta(hours=5)
    print(f"  ID: {x['id'][:20]}... | ET: {et.strftime('%Y-%m-%d %H:%M')}")
