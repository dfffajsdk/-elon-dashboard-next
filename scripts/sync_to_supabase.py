"""
Sync data from local MySQL to Supabase cloud.
1. Clear Supabase tables
2. Read from MySQL
3. Upload to Supabase
"""
import os
import pymysql
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

# Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

# MySQL
MYSQL_HOST = '127.0.0.1'
MYSQL_PORT = 3306
MYSQL_USER = 'root'
MYSQL_PASSWORD = '123456'
MYSQL_DATABASE = 'elon_musk'

def main():
    print("🚀 SYNC MYSQL TO SUPABASE")
    print("="*60)
    
    # Connect to Supabase
    print("\n1. Connecting to Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("   ✅ Connected")
    
    # Clear Supabase tables
    print("\n2. Clearing Supabase tables...")
    try:
        supabase.from_('cached_heatmap').delete().neq('id', -999999).execute()
        print("   ✅ cached_heatmap cleared")
    except Exception as e:
        print(f"   ⚠️ cached_heatmap error: {e}")
    
    try:
        supabase.from_('cached_tweets').delete().neq('id', '___impossible___').execute()
        print("   ✅ cached_tweets cleared")
    except Exception as e:
        print(f"   ⚠️ cached_tweets error: {e}")
    
    # Connect to MySQL
    print("\n3. Connecting to MySQL...")
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
        charset='utf8mb4'
    )
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    print(f"   ✅ Connected to MySQL (Server: {conn.get_server_info()})")
    
    # Read tweets from MySQL
    print("\n4. Reading tweets from MySQL...")
    cursor.execute("SELECT * FROM cached_tweets ORDER BY created_at DESC")
    tweets = cursor.fetchall()
    print(f"   Found {len(tweets)} tweets")
    
    # Upload tweets to Supabase
    print("\n5. Uploading tweets to Supabase...")
    batch_size = 100
    for i in range(0, len(tweets), batch_size):
        batch = tweets[i:i+batch_size]
        records = [{
            "id": str(t["id"]),
            "period_start": t["period_start"],
            "text": t["text"] or "",
            "msg": t["msg"] or "",
            "created_at": t["created_at"],
            "is_reply": bool(t["is_reply"]),
            "raw_data": {"type": t.get("tweet_type", "unknown"), "link": t.get("tweet_link", None)}
        } for t in batch]
        
        try:
            supabase.table('cached_tweets').upsert(records).execute()
            if (i // batch_size) % 10 == 0:
                print(f"   Uploaded {min(i+batch_size, len(tweets))}/{len(tweets)} tweets...")
        except Exception as e:
            print(f"   ⚠️ Error: {e}")
    
    print(f"   ✅ Uploaded {len(tweets)} tweets")
    
    # Read heatmap from MySQL
    print("\n6. Reading heatmap from MySQL...")
    cursor.execute("SELECT * FROM cached_heatmap ORDER BY date_normalized DESC")
    heatmap = cursor.fetchall()
    print(f"   Found {len(heatmap)} heatmap entries")
    
    # Upload heatmap to Supabase
    print("\n7. Uploading heatmap to Supabase...")
    for i in range(0, len(heatmap), batch_size):
        batch = heatmap[i:i+batch_size]
        records = [{
            "date_str": h["date_str"],
            "date_normalized": str(h["date_normalized"]),
            "hour": h["hour"],
            "tweet_count": h["tweet_count"] or 0,
            "reply_count": h["reply_count"] or 0
        } for h in batch]
        
        try:
            supabase.table('cached_heatmap').upsert(records, on_conflict='date_normalized, hour').execute()
        except Exception as e:
            print(f"   ⚠️ Error: {e}")
    
    print(f"   ✅ Uploaded {len(heatmap)} heatmap entries")
    
    # Verify
    print("\n8. Verification...")
    r1 = supabase.from_('cached_tweets').select('*', count='exact').execute()
    r2 = supabase.from_('cached_heatmap').select('*', count='exact').execute()
    r3 = supabase.from_('cached_heatmap').select('date_normalized').order('date_normalized', desc=False).limit(1).execute()
    r4 = supabase.from_('cached_heatmap').select('date_normalized').order('date_normalized', desc=True).limit(1).execute()
    
    print(f"   Tweets in Supabase: {r1.count}")
    print(f"   Heatmap in Supabase: {r2.count}")
    if r3.data and r4.data:
        print(f"   Date range: {r3.data[0]['date_normalized']} to {r4.data[0]['date_normalized']}")
    
    # Cleanup
    cursor.close()
    conn.close()
    
    print("\n" + "="*60)
    print("🎉 SYNC COMPLETE! Data is now in Supabase cloud.")

if __name__ == '__main__':
    main()
