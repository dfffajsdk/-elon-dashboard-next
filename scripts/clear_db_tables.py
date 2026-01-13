"""Clear and re-crawl data."""
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv('.env.local')

s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

print("🗑️ Clearing cached_heatmap...")
s.table('cached_heatmap').delete().neq('id', 0).execute()
print("✅ cached_heatmap cleared")

print("🗑️ Clearing cached_tweets...")
s.table('cached_tweets').delete().neq('id', '').execute()
print("✅ cached_tweets cleared")

print("\n✅ Database cleared. Run crawl_full_history.py to re-populate.")
