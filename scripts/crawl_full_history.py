"""
Full 6-month Elon Musk data crawl from @elonvitalikalerts.
Saves data to Supabase cached_tweets and cached_heatmap tables.
"""
import os
import asyncio
import re
from datetime import datetime, timedelta, timezone
from telethon import TelegramClient, types
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not all([API_ID, API_HASH, SUPABASE_URL, SUPABASE_KEY]):
    print("❌ Missing required environment variables")
    exit(1)

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Eastern Time offset
ET_OFFSET = timedelta(hours=-5)

# Reference period start (Tuesday Dec 23 2025 12pm ET)
REF_PERIOD_START = 1766509200

def get_period_start(timestamp):
    """Calculate period start based on weekly cycle."""
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
    
    # Use telegram message ID if no tweet ID found
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
    
    # Convert to ET
    utc_time = message.date.replace(tzinfo=timezone.utc)
    et_time = utc_time + ET_OFFSET
    unix_ts = int(utc_time.timestamp())
    
    return {
        "id": tweet_id,
        "tweet_type": tweet_type,
        "is_reply": tweet_type == "reply",
        "content": content,
        "unix_ts": unix_ts,
        "et_time": et_time,
        "date_str": et_time.strftime("%b %d"),
        "date_normalized": et_time.strftime("%Y-%m-%d"),
        "hour": et_time.strftime("%H:00"),
        "period_start": get_period_start(unix_ts),
        "tweet_link": tweet_link
    }

async def main():
    print("🚀 Starting Full 6-Month Crawl...")
    print("="*60)
    
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    channel = 'elonvitalikalerts'
    
    # Calculate 6 months ago
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    print(f"📅 Crawling from {six_months_ago.strftime('%Y-%m-%d')} to now...")
    
    tweets_data = []
    heatmap_data = {}  # {(date_normalized, hour): {tweet_count, reply_count}}
    
    count = 0
    oldest_date = None
    
    # Crawl all messages (large limit for 6 months)
    print("📡 Fetching messages from Telegram (this may take a few minutes)...")
    
    async for message in client.iter_messages(channel, limit=50000):  # 50k should cover 6 months
        # Stop if message is older than 6 months
        if message.date < six_months_ago:
            print(f"⏹️ Reached 6-month boundary at {message.date}")
            break
        
        parsed = parse_elon_message(message)
        if parsed:
            tweets_data.append(parsed)
            
            # Aggregate for heatmap
            key = (parsed["date_normalized"], parsed["hour"])
            if key not in heatmap_data:
                heatmap_data[key] = {"tweet_count": 0, "reply_count": 0, "date_str": parsed["date_str"]}
            
            if parsed["is_reply"]:
                heatmap_data[key]["reply_count"] += 1
            else:
                heatmap_data[key]["tweet_count"] += 1
            
            count += 1
            oldest_date = parsed["date_str"]
            
            if count % 500 == 0:
                print(f"   Processed {count} tweets... (oldest so far: {oldest_date})")
    
    print(f"\n✅ Total tweets crawled: {count}")
    print(f"📆 Date range: {oldest_date} to {tweets_data[0]['date_str'] if tweets_data else 'N/A'}")
    
    # Save to Supabase - Tweets
    print("\n💾 Saving tweets to Supabase (cached_tweets)...")
    batch_size = 100
    for i in range(0, len(tweets_data), batch_size):
        batch = tweets_data[i:i+batch_size]
        records = [{
            "id": t["id"],
            "period_start": t["period_start"],
            "text": t["content"],
            "msg": t["content"],
            "created_at": t["unix_ts"],
            "is_reply": t["is_reply"],
            "raw_data": {"type": t["tweet_type"], "link": t["tweet_link"]}
        } for t in batch]
        
        try:
            supabase.table('cached_tweets').upsert(records).execute()
            if (i // batch_size) % 10 == 0:
                print(f"   Saved {min(i+batch_size, len(tweets_data))}/{len(tweets_data)} tweets...")
        except Exception as e:
            print(f"   ⚠️ Error saving batch: {e}")
    
    print(f"✅ Saved {len(tweets_data)} tweets to cached_tweets")
    
    # Save to Supabase - Heatmap
    print("\n💾 Saving heatmap data to Supabase (cached_heatmap)...")
    heatmap_records = []
    for (date_norm, hour), data in heatmap_data.items():
        heatmap_records.append({
            "date_str": data["date_str"],
            "date_normalized": date_norm,
            "hour": hour,
            "tweet_count": data["tweet_count"],
            "reply_count": data["reply_count"]
        })
    
    for i in range(0, len(heatmap_records), batch_size):
        batch = heatmap_records[i:i+batch_size]
        try:
            supabase.table('cached_heatmap').upsert(batch, on_conflict='date_normalized, hour').execute()
        except Exception as e:
            print(f"   ⚠️ Error saving heatmap batch: {e}")
    
    print(f"✅ Saved {len(heatmap_records)} heatmap entries to cached_heatmap")
    
    print("\n" + "="*60)
    print("🎉 Full crawl complete!")
    print(f"   📊 Total tweets: {len(tweets_data)}")
    print(f"   📅 Heatmap entries: {len(heatmap_records)}")
    
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
