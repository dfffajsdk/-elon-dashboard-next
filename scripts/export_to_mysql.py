"""
Export crawled Elon Musk data to local MySQL database.
Reads from Supabase and writes to MySQL.

Usage:
1. Set MySQL connection in .env.local:
   MYSQL_HOST=localhost
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=elon_tweets

2. Run: python scripts/export_to_mysql.py
"""
import os
import mysql.connector
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

# Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

# MySQL - Default values if not set
MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'elon_tweets')

def create_mysql_tables(cursor):
    """Create tables if they don't exist."""
    
    # Tweets table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cached_tweets (
            id VARCHAR(50) PRIMARY KEY,
            period_start BIGINT NOT NULL,
            text TEXT,
            msg TEXT,
            created_at BIGINT,
            is_reply BOOLEAN DEFAULT FALSE,
            tweet_type VARCHAR(20),
            tweet_link TEXT,
            cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_period (period_start),
            INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    
    # Heatmap table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cached_heatmap (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date_str VARCHAR(10) NOT NULL,
            date_normalized DATE NOT NULL,
            hour VARCHAR(5) NOT NULL,
            tweet_count INT DEFAULT 0,
            reply_count INT DEFAULT 0,
            cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_date_hour (date_normalized, hour),
            INDEX idx_date (date_normalized)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    
    print("✅ MySQL tables created/verified")

def main():
    print("🚀 Starting MySQL Export...")
    print("="*60)
    
    # Connect to Supabase
    print("📡 Connecting to Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Connect to MySQL
    print(f"🔌 Connecting to MySQL ({MYSQL_HOST}/{MYSQL_DATABASE})...")
    try:
        conn = mysql.connector.connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DATABASE,
            charset='utf8mb4'
        )
        cursor = conn.cursor()
        print("✅ MySQL connection established")
    except mysql.connector.Error as e:
        if e.errno == 1049:  # Database doesn't exist
            print(f"📁 Database '{MYSQL_DATABASE}' doesn't exist, creating...")
            conn = mysql.connector.connect(
                host=MYSQL_HOST,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD
            )
            cursor = conn.cursor()
            cursor.execute(f"CREATE DATABASE {MYSQL_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            cursor.execute(f"USE {MYSQL_DATABASE}")
            print(f"✅ Database '{MYSQL_DATABASE}' created")
        else:
            print(f"❌ MySQL connection error: {e}")
            return
    
    # Create tables
    create_mysql_tables(cursor)
    
    # Fetch tweets from Supabase
    print("\n📥 Fetching tweets from Supabase...")
    all_tweets = []
    offset = 0
    while True:
        res = supabase.from_('cached_tweets').select('*').range(offset, offset+999).execute()
        if not res.data:
            break
        all_tweets.extend(res.data)
        if len(res.data) < 1000:
            break
        offset += 1000
        print(f"   Fetched {len(all_tweets)} tweets...")
    
    print(f"✅ Total tweets fetched: {len(all_tweets)}")
    
    # Insert tweets into MySQL
    print("\n💾 Inserting tweets into MySQL...")
    insert_sql = """
        INSERT INTO cached_tweets (id, period_start, text, msg, created_at, is_reply, tweet_type, tweet_link)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            text = VALUES(text),
            msg = VALUES(msg),
            is_reply = VALUES(is_reply),
            tweet_type = VALUES(tweet_type),
            tweet_link = VALUES(tweet_link)
    """
    
    batch_size = 100
    for i in range(0, len(all_tweets), batch_size):
        batch = all_tweets[i:i+batch_size]
        for tweet in batch:
            raw_data = tweet.get('raw_data', {}) or {}
            cursor.execute(insert_sql, (
                tweet['id'],
                tweet['period_start'],
                tweet.get('text', ''),
                tweet.get('msg', ''),
                tweet.get('created_at'),
                tweet.get('is_reply', False),
                raw_data.get('type', 'unknown'),
                raw_data.get('link', None)
            ))
        conn.commit()
        if (i // batch_size) % 10 == 0:
            print(f"   Inserted {min(i+batch_size, len(all_tweets))}/{len(all_tweets)} tweets...")
    
    print(f"✅ Saved {len(all_tweets)} tweets to MySQL")
    
    # Fetch heatmap from Supabase
    print("\n📥 Fetching heatmap data from Supabase...")
    heatmap_data = []
    offset = 0
    while True:
        res = supabase.from_('cached_heatmap').select('*').range(offset, offset+999).execute()
        if not res.data:
            break
        heatmap_data.extend(res.data)
        if len(res.data) < 1000:
            break
        offset += 1000
    
    print(f"✅ Total heatmap entries fetched: {len(heatmap_data)}")
    
    # Insert heatmap into MySQL
    print("\n💾 Inserting heatmap into MySQL...")
    insert_heatmap_sql = """
        INSERT INTO cached_heatmap (date_str, date_normalized, hour, tweet_count, reply_count)
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            date_str = VALUES(date_str),
            tweet_count = VALUES(tweet_count),
            reply_count = VALUES(reply_count)
    """
    
    for entry in heatmap_data:
        cursor.execute(insert_heatmap_sql, (
            entry['date_str'],
            entry['date_normalized'],
            entry['hour'],
            entry.get('tweet_count', 0),
            entry.get('reply_count', 0)
        ))
    conn.commit()
    
    print(f"✅ Saved {len(heatmap_data)} heatmap entries to MySQL")
    
    # Close connections
    cursor.close()
    conn.close()
    
    print("\n" + "="*60)
    print("🎉 MySQL export complete!")
    print(f"   📊 Tweets: {len(all_tweets)}")
    print(f"   📅 Heatmap: {len(heatmap_data)}")

if __name__ == '__main__':
    main()
