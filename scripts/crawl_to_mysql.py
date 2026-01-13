"""
Crawl Elon Musk data from Telegram and save directly to MySQL using PyMySQL.
"""
import os
import asyncio
import re
import pymysql
from datetime import datetime, timedelta, timezone
from telethon import TelegramClient, types
from dotenv import load_dotenv

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')

# MySQL connection info
MYSQL_HOST = '127.0.0.1'
MYSQL_PORT = 3306
MYSQL_USER = 'root'
MYSQL_PASSWORD = '123456'
MYSQL_DATABASE = 'elon_musk'

# Eastern Time offset (UTC-5)
ET_OFFSET_HOURS = -5

# Reference period start
REF_PERIOD_START = 1766509200

def get_period_start(timestamp):
    diff = timestamp - REF_PERIOD_START
    weeks = diff // (7 * 24 * 3600)
    return REF_PERIOD_START + (weeks * 7 * 24 * 3600)

def parse_elon_message(message):
    text = message.text
    if not text: return None
    
    if '**elonmusk**' not in text and '[elonmusk]' not in text:
        return None
    
    tweet_type = None
    if '`Retweeted`' in text:
        tweet_type = "retweet"
    elif '**Quoted**' in text:
        tweet_type = "quote"
    elif '`Replied To`' in text:
        tweet_type = "reply"
    elif 'Tweeted' in text and 'Retweeted' not in text:
        tweet_type = "original"
    
    if not tweet_type: return None
    
    # Link Extraction
    tweet_link = None
    tweet_id = None
    
    if message.entities:
        for entity in message.entities:
            if isinstance(entity, types.MessageEntityTextUrl):
                if any(x in entity.url for x in ['fxtwitter.com', 'x.com', 'twitter.com']):
                    tweet_link = entity.url
                    break
    
    if not tweet_link:
        link_match = re.search(r'https://(?:fxtwitter\.com|x\.com|twitter\.com)/(\w+)/status/(\d+)', text)
        if link_match: tweet_link = link_match.group(0)
            
    if not tweet_link and message.media and hasattr(message.media, 'webpage'):
        wp = message.media.webpage
        if wp and hasattr(wp, 'url') and wp.url and any(x in wp.url for x in ['fxtwitter.com', 'x.com', 'twitter.com']):
            if '/status/' in wp.url: tweet_link = wp.url

    if tweet_link:
        id_match = re.search(r'status/(\d+)', tweet_link)
        if id_match: tweet_id = id_match.group(1)
    
    if not tweet_id:
        tweet_id = f"tg_{message.id}"

    # Content extraction
    lines = text.split('\n')
    content_lines = []
    for i, line in enumerate(lines):
        if i == 0: continue
        clean_line = line.strip()
        if clean_line: content_lines.append(clean_line)
    
    content = '\n'.join(content_lines)
    
    # Use message.date directly
    msg_date = message.date
    unix_ts = int(msg_date.timestamp())
    
    # Convert to ET
    et_datetime = msg_date + timedelta(hours=ET_OFFSET_HOURS)
    
    return {
        "id": tweet_id,
        "tweet_type": tweet_type,
        "is_reply": tweet_type == "reply",
        "content": content,
        "unix_ts": unix_ts,
        "date_str": et_datetime.strftime("%b %d"),
        "date_normalized": et_datetime.strftime("%Y-%m-%d"),
        "hour": et_datetime.strftime("%H:00"),
        "period_start": get_period_start(unix_ts),
        "tweet_link": tweet_link
    }

async def main():
    print("🚀 CRAWL TO MYSQL")
    print("="*60)
    
    # Step 1: Connect to MySQL
    print("\n1. Connecting to MySQL...")
    
    try:
        # First connect without database to create it
        conn = pymysql.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            charset='utf8mb4'
        )
        cursor = conn.cursor()
        
        # Create database if not exists
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {MYSQL_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        cursor.execute(f"USE {MYSQL_DATABASE}")
        print(f"   ✅ Connected to MySQL (Server: {conn.get_server_info()})")
        
        # Create tables
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
        conn.commit()
        print("   ✅ Tables created/verified")
        
    except pymysql.Error as e:
        print(f"   ❌ MySQL error: {e}")
        return
    
    # Step 2: Connect to Telegram
    print("\n2. Connecting to Telegram...")
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    print("   ✅ Connected")
    
    channel = 'elonvitalikalerts'
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    print(f"   Crawling from {six_months_ago.strftime('%Y-%m-%d')} to now...")
    
    # Step 3: Crawl and save
    print("\n3. Crawling messages...")
    
    tweets_data = []
    heatmap_data = {}
    count = 0
    
    async for message in client.iter_messages(channel, limit=50000):
        if message.date < six_months_ago:
            print(f"   ⏹️ Reached 6-month boundary")
            break
        
        parsed = parse_elon_message(message)
        if parsed:
            # Validate year
            year = int(parsed["date_normalized"][:4])
            if year < 2025 or year > 2026:
                continue
            
            tweets_data.append(parsed)
            
            key = (parsed["date_normalized"], parsed["hour"])
            if key not in heatmap_data:
                heatmap_data[key] = {"tweet_count": 0, "reply_count": 0, "date_str": parsed["date_str"]}
            
            if parsed["is_reply"]:
                heatmap_data[key]["reply_count"] += 1
            else:
                heatmap_data[key]["tweet_count"] += 1
            
            count += 1
            
            if count % 500 == 0:
                print(f"   Processed {count} tweets (oldest: {parsed['date_normalized']})")
    
    print(f"\n   ✅ Crawled {count} tweets")
    
    # Step 4: Save tweets to MySQL
    print("\n4. Saving tweets to MySQL...")
    insert_tweet = """
        INSERT INTO cached_tweets (id, period_start, text, msg, created_at, is_reply, tweet_type, tweet_link)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            text = VALUES(text),
            msg = VALUES(msg),
            is_reply = VALUES(is_reply),
            tweet_type = VALUES(tweet_type),
            tweet_link = VALUES(tweet_link)
    """
    
    for i, t in enumerate(tweets_data):
        cursor.execute(insert_tweet, (
            t["id"],
            t["period_start"],
            t["content"],
            t["content"],
            t["unix_ts"],
            t["is_reply"],
            t["tweet_type"],
            t["tweet_link"]
        ))
        if (i+1) % 1000 == 0:
            conn.commit()
            print(f"   Saved {i+1}/{len(tweets_data)} tweets...")
    
    conn.commit()
    print(f"   ✅ Saved {len(tweets_data)} tweets")
    
    # Step 5: Save heatmap to MySQL
    print("\n5. Saving heatmap to MySQL...")
    insert_heatmap = """
        INSERT INTO cached_heatmap (date_str, date_normalized, hour, tweet_count, reply_count)
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            date_str = VALUES(date_str),
            tweet_count = VALUES(tweet_count),
            reply_count = VALUES(reply_count)
    """
    
    for (date_norm, hour), data in heatmap_data.items():
        cursor.execute(insert_heatmap, (
            data["date_str"],
            date_norm,
            hour,
            data["tweet_count"],
            data["reply_count"]
        ))
    
    conn.commit()
    print(f"   ✅ Saved {len(heatmap_data)} heatmap entries")
    
    # Step 6: Verify
    print("\n6. Verification...")
    cursor.execute("SELECT COUNT(*) FROM cached_tweets")
    tweet_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM cached_heatmap")
    heatmap_count = cursor.fetchone()[0]
    cursor.execute("SELECT MIN(date_normalized), MAX(date_normalized) FROM cached_heatmap")
    date_range = cursor.fetchone()
    
    print(f"   Tweets in MySQL: {tweet_count}")
    print(f"   Heatmap entries: {heatmap_count}")
    print(f"   Date range: {date_range[0]} to {date_range[1]}")
    
    # Cleanup
    cursor.close()
    conn.close()
    await client.disconnect()
    
    print("\n" + "="*60)
    print(f"🎉 COMPLETE! Data saved to MySQL database '{MYSQL_DATABASE}'")

if __name__ == '__main__':
    asyncio.run(main())
