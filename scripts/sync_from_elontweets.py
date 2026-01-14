"""
Sync latest data from elontweets.live API to Supabase
"""
import requests
import os
from datetime import datetime, timezone
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('.env.local')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase credentials")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fetch from elontweets.live
print("🔄 Fetching from elontweets.live...")
try:
    resp = requests.get("https://elontweets.live/api/", timeout=30)
    data = resp.json()
    print(f"✅ API returned {len(data.get('data', {}).get('t', []))} tweets")
except Exception as e:
    print(f"❌ API Error: {e}")
    exit(1)

# Get tweets
tweets = data.get('data', {}).get('t', [])
if not tweets:
    print("No tweets found in API response")
    exit(0)

# Sync to Supabase
synced = 0
for tw in tweets:
    ts = tw.get('timestamp', 0)
    if not ts:
        continue
    
    # Calculate period_start
    ref_start = 1766509200
    diff = ts - ref_start
    weeks = diff // (7 * 24 * 3600)
    period_start = ref_start + (weeks * 7 * 24 * 3600)
    
    # Check if is_reply
    is_reply = tw.get('is_reply', False) or tw.get('isReply', False)
    if not is_reply:
        text = tw.get('msg', '') or tw.get('text', '')
        is_reply = text.strip().startswith('@') or 'Reply' in text[:50]
    
    tweet_id = tw.get('id', f"etl_{ts}")
    
    try:
        supabase.table('cached_tweets').upsert({
            "id": tweet_id,
            "period_start": period_start,
            "text": tw.get('msg', ''),
            "msg": tw.get('msg', ''),
            "created_at": ts,
            "is_reply": is_reply,
            "raw_data": tw
        }).execute()
        synced += 1
    except Exception as e:
        print(f"⚠️ Error syncing {tweet_id}: {e}")

print(f"✅ Synced {synced} tweets to Supabase")

# Update heatmap
print("🔄 Updating heatmap...")
heatmap_data = data.get('data', {}).get('posts', [])

for day in heatmap_data:
    date_str = day.get('date', '')
    if not date_str:
        continue
    
    # Parse date
    months = {'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
              'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'}
    parts = date_str.split(' ')
    if len(parts) < 2:
        continue
    month = months.get(parts[0], '01')
    day_num = parts[1].zfill(2)
    year = '2025' if parts[0] in ['Nov', 'Dec'] else '2026'
    date_norm = f"{year}-{month}-{day_num}"
    
    for key, val in day.items():
        if key == 'date':
            continue
        if not isinstance(val, dict):
            continue
        
        hour = key
        tweet_count = val.get('tweet', 0)
        reply_count = val.get('reply', 0)
        
        try:
            supabase.table('cached_heatmap').upsert({
                "date_str": date_str,
                "date_normalized": date_norm,
                "hour": hour,
                "tweet_count": tweet_count,
                "reply_count": reply_count
            }, on_conflict='date_normalized,hour').execute()
        except Exception as e:
            pass

print("✅ Heatmap updated!")
print("🎉 Done! Refresh your dashboard to see the latest data.")
