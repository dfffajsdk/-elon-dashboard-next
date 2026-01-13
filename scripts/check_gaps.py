import os
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_continuity():
    print("🔍 Checking for data gaps in cached_tweets...")
    
    # Fetch all tweet timestamps ordered chronologically
    # 2000 limit should cover the transition period easily (since we have ~1000 total or so)
    res = supabase.from_('cached_tweets').select('created_at, id').order('created_at', desc=True).limit(2000).execute()
    
    tweets = res.data
    tweets.sort(key=lambda x: x['created_at']) # Sort oldest to newest
    
    if not tweets:
        print("No tweets found.")
        return

    print(f"Total tweets: {len(tweets)}")
    print(f"Oldest: {datetime.fromtimestamp(tweets[0]['created_at'], tz=timezone.utc)}")
    print(f"Newest: {datetime.fromtimestamp(tweets[-1]['created_at'], tz=timezone.utc)}")

    # Check for gaps > 6 hours
    max_gap_hours = 6
    gaps_found = 0
    
    for i in range(1, len(tweets)):
        prev = tweets[i-1]
        curr = tweets[i]
        
        diff_seconds = curr['created_at'] - prev['created_at']
        diff_hours = diff_seconds / 3600.0
        
        if diff_hours > max_gap_hours:
            t1 = datetime.fromtimestamp(prev['created_at'], tz=timezone.utc).strftime('%Y-%m-%d %H:%M')
            t2 = datetime.fromtimestamp(curr['created_at'], tz=timezone.utc).strftime('%Y-%m-%d %H:%M')
            print(f"⚠️ Gap found: {diff_hours:.2f} hours")
            print(f"   Between {t1} and {t2}")
            gaps_found += 1
            
    if gaps_found == 0:
        print("✅ No significant gaps found. Data is continuous.")
    else:
        print(f"❌ Found {gaps_found} gaps > {max_gap_hours} hours.")

if __name__ == '__main__':
    check_continuity()
