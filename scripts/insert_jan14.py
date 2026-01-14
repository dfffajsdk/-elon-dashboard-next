"""
Insert Jan 14 data from elontweets.live into Supabase
Data extracted from browser subagent:
- Jan 14 Wed: [21, 10, 0, 0, 0, 0, 8, 2, 25, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] → Total: 72
"""
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('.env.local')

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_KEY')
)

# Jan 14 data (ET hours 0-23)
jan14_data = [21, 10, 0, 0, 0, 0, 8, 2, 25, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

print("🔄 Inserting Jan 14 heatmap data...")

for hour, count in enumerate(jan14_data):
    if count > 0:
        print(f"  {hour:02d}:00: {count} tweets")
        
        # Check if exists
        res = supabase.table('cached_heatmap').select('*').match({
            "date_normalized": "2026-01-14",
            "hour": hour
        }).execute()
        
        if res.data:
            # Update
            supabase.table('cached_heatmap').update({
                "tweet_count": count
            }).eq('id', res.data[0]['id']).execute()
        else:
            # Insert
            supabase.table('cached_heatmap').insert({
                "date_str": "Jan 14",
                "date_normalized": "2026-01-14",
                "hour": hour,
                "tweet_count": count,
                "reply_count": 0
            }).execute()

# Also insert Jan 13 correct data (from browser)
jan13_data = [11, 8, 0, 0, 0, 0, 6, 0, 6, 0, 0, 7, 0, 1, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0]

print("\n🔄 Updating Jan 13 heatmap data...")

for hour, count in enumerate(jan13_data):
    if count > 0:
        res = supabase.table('cached_heatmap').select('*').match({
            "date_normalized": "2026-01-13",
            "hour": hour
        }).execute()
        
        if res.data:
            supabase.table('cached_heatmap').update({
                "tweet_count": count
            }).eq('id', res.data[0]['id']).execute()
        else:
            supabase.table('cached_heatmap').insert({
                "date_str": "Jan 13",
                "date_normalized": "2026-01-13",
                "hour": hour,
                "tweet_count": count,
                "reply_count": 0
            }).execute()

print("\n✅ Done! Refresh your dashboard.")
