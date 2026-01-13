"""
Complete database reset and re-crawl with date validation.
"""
import os
import asyncio
import re
from datetime import datetime, timedelta, timezone
from telethon import TelegramClient, types
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    
    # CRITICAL: Use message.date directly - it has correct year/month/day
    msg_date = message.date  # This is UTC datetime with correct year
    unix_ts = int(msg_date.timestamp())
    
    # Convert to ET by subtracting 5 hours
    et_datetime = msg_date + timedelta(hours=ET_OFFSET_HOURS)
    
    return {
        "id": tweet_id,
        "tweet_type": tweet_type,
        "is_reply": tweet_type == "reply",
        "content": content,
        "unix_ts": unix_ts,
        "date_str": et_datetime.strftime("%b %d"),        # e.g., "Oct 31"
        "date_normalized": et_datetime.strftime("%Y-%m-%d"),  # e.g., "2025-10-31"
        "hour": et_datetime.strftime("%H:00"),
        "period_start": get_period_start(unix_ts),
        "tweet_link": tweet_link,
        # For debugging
        "_raw_date": str(msg_date),
        "_et_date": str(et_datetime)
    }

async def main():
    print("🔄 COMPLETE DATABASE RESET AND RE-CRAWL")
    print("="*60)
    
    # Step 1: Delete ALL data from tables
    print("\n🗑️ Step 1: Clearing ALL data from tables...")
    
    try:
        # Delete all from cached_heatmap
        supabase.from_('cached_heatmap').delete().neq('id', -999999).execute()
        print("   ✅ cached_heatmap cleared")
    except Exception as e:
        print(f"   ⚠️ cached_heatmap error: {e}")
    
    try:
        # Delete all from cached_tweets (id is TEXT, use empty string trick)
        supabase.from_('cached_tweets').delete().neq('id', '___impossible___').execute()
        print("   ✅ cached_tweets cleared")
    except Exception as e:
        print(f"   ⚠️ cached_tweets error: {e}")
    
    # Step 2: Connect to Telegram
    print("\n📡 Step 2: Connecting to Telegram...")
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    channel = 'elonvitalikalerts'
    
    # Calculate 6 months ago
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    print(f"   Crawling from {six_months_ago.strftime('%Y-%m-%d')} to now...")
    
    # Step 3: Crawl with validation
    print("\n📥 Step 3: Crawling messages with date validation...")
    
    tweets_data = []
    heatmap_data = {}
    
    count = 0
    skipped = 0
    
    async for message in client.iter_messages(channel, limit=50000):
        if message.date < six_months_ago:
            print(f"   ⏹️ Reached 6-month boundary at {message.date}")
            break
        
        parsed = parse_elon_message(message)
        if parsed:
            # VALIDATION: Check year is reasonable (2025 or 2026 only)
            year = int(parsed["date_normalized"][:4])
            if year < 2025 or year > 2026:
                print(f"   ⚠️ Invalid year {year} for message, skipping...")
                skipped += 1
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
                sample = parsed
                print(f"   #{count}: {sample['date_normalized']} ({sample['date_str']}) - raw: {sample['_raw_date'][:10]}")
    
    print(f"\n   ✅ Crawled: {count} tweets")
    print(f"   ⚠️ Skipped: {skipped} invalid")
    
    # Step 4: Show date range before saving
    if tweets_data:
        newest = tweets_data[0]["date_normalized"]
        oldest = tweets_data[-1]["date_normalized"]
        print(f"\n📅 Date range: {oldest} to {newest}")
    
    # Step 5: Save to Supabase
    print("\n💾 Step 4: Saving to Supabase...")
    
    batch_size = 100
    
    # Save tweets
    print("   Saving tweets...")
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
        except Exception as e:
            print(f"   ⚠️ Error: {e}")
    
    print(f"   ✅ Saved {len(tweets_data)} tweets")
    
    # Save heatmap
    print("   Saving heatmap...")
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
            print(f"   ⚠️ Error: {e}")
    
    print(f"   ✅ Saved {len(heatmap_records)} heatmap entries")
    
    # Step 5: Verification
    print("\n✅ Step 5: Verification...")
    
    # Check date range in database
    r1 = supabase.from_('cached_heatmap').select('date_normalized').order('date_normalized', desc=False).limit(1).execute()
    r2 = supabase.from_('cached_heatmap').select('date_normalized').order('date_normalized', desc=True).limit(1).execute()
    
    if r1.data and r2.data:
        print(f"   Database date range: {r1.data[0]['date_normalized']} to {r2.data[0]['date_normalized']}")
    
    # Count
    r3 = supabase.from_('cached_heatmap').select('*', count='exact').execute()
    print(f"   Total heatmap entries: {r3.count}")
    
    r4 = supabase.from_('cached_tweets').select('*', count='exact').execute()
    print(f"   Total tweets: {r4.count}")
    
    print("\n" + "="*60)
    print("🎉 COMPLETE! Database has been reset and re-populated.")
    
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
