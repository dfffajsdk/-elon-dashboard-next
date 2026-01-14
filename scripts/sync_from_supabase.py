"""
Sync Supabase Data → Local MySQL

This script pulls the latest data from Supabase cloud and syncs it to your local MySQL database.
Run this whenever your computer comes online to get the latest tweet data that was crawled while you were offline.

Usage:
    python scripts/sync_from_supabase.py
"""

import os
import pymysql
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime

load_dotenv('.env.local')

# MySQL Config
MYSQL_HOST = '127.0.0.1'
MYSQL_PORT = 3306
MYSQL_USER = 'root'
MYSQL_PASSWORD = '123456'
MYSQL_DB = 'elon_musk'

# Supabase Config
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

def main():
    print("🔄 Syncing Supabase → Local MySQL...")
    print(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Connect to Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Connect to MySQL
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        charset='utf8mb4'
    )
    cursor = conn.cursor()
    
    # 1. Sync cached_tweets (with pagination)
    print("\n📥 Fetching tweets from Supabase...")
    all_tweets = []
    offset = 0
    page_size = 1000
    
    while True:
        res = supabase.from_('cached_tweets').select('*').range(offset, offset + page_size - 1).execute()
        if not res.data:
            break
        all_tweets.extend(res.data)
        if len(res.data) < page_size:
            break
        offset += page_size
    
    print(f"   Found {len(all_tweets)} tweets in cloud")
    
    # Get existing tweet IDs in MySQL
    cursor.execute("SELECT id FROM cached_tweets")
    existing_ids = set(str(row[0]) for row in cursor.fetchall())
    print(f"   Local MySQL has {len(existing_ids)} tweets")
    
    # Insert new tweets
    new_count = 0
    for tweet in all_tweets:
        if str(tweet['id']) not in existing_ids:
            try:
                cursor.execute("""
                    INSERT INTO cached_tweets (id, period_start, text, msg, created_at, is_reply, raw_data)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    tweet['id'],
                    tweet.get('period_start'),
                    tweet.get('text', ''),
                    tweet.get('msg', ''),
                    tweet.get('created_at'),
                    tweet.get('is_reply', False),
                    str(tweet.get('raw_data', {}))
                ))
                new_count += 1
            except Exception as e:
                pass  # Skip duplicates or errors
    
    conn.commit()
    print(f"   ✅ Added {new_count} new tweets to local MySQL")
    
    # 2. Sync cached_heatmap
    print("\n📥 Fetching heatmap from Supabase...")
    all_heatmap = []
    offset = 0
    
    while True:
        res = supabase.from_('cached_heatmap').select('*').range(offset, offset + page_size - 1).execute()
        if not res.data:
            break
        all_heatmap.extend(res.data)
        if len(res.data) < page_size:
            break
        offset += page_size
    
    print(f"   Found {len(all_heatmap)} heatmap entries in cloud")
    
    # Upsert heatmap data
    for entry in all_heatmap:
        try:
            hour_val = entry.get('hour', 0)
            if isinstance(hour_val, str):
                hour_val = int(hour_val.split(':')[0]) if ':' in hour_val else int(hour_val)
            
            cursor.execute("""
                INSERT INTO cached_heatmap (date_str, date_normalized, hour, tweet_count, reply_count)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    tweet_count = VALUES(tweet_count),
                    reply_count = VALUES(reply_count)
            """, (
                entry.get('date_str', ''),
                entry.get('date_normalized', ''),
                hour_val,
                entry.get('tweet_count', 0),
                entry.get('reply_count', 0)
            ))
        except Exception as e:
            pass
    
    conn.commit()
    print(f"   ✅ Synced heatmap data")
    
    # Summary
    cursor.execute("SELECT COUNT(*) FROM cached_tweets")
    local_tweets = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(DISTINCT date_normalized) FROM cached_heatmap")
    local_days = cursor.fetchone()[0]
    
    print(f"\n📊 Local MySQL Summary:")
    print(f"   Total tweets: {local_tweets}")
    print(f"   Heatmap days: {local_days}")
    
    cursor.close()
    conn.close()
    print("\n✅ Sync complete!")

if __name__ == '__main__':
    main()
