"""
Crawl Elon tweets from Telegram and compare with existing elon_all_data.json stats.
This script will:
1. Crawl data from @elonvitalikalerts
2. Aggregate by date/hour in ET timezone
3. Compare with existing stats for validation
"""
import os
import asyncio
import json
import re
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from telethon import TelegramClient, types
from dotenv import load_dotenv

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')

# Eastern Time offset (UTC-5 for standard, ignoring DST for simplicity)
ET_OFFSET = timedelta(hours=-5)

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
    
    # Convert to ET
    utc_time = message.date.replace(tzinfo=timezone.utc)
    et_time = utc_time + ET_OFFSET
    
    return {
        "tweet_type": tweet_type,
        "et_time": et_time,
        "date_str": et_time.strftime("%b %d"),  # e.g., "Jan 06"
        "hour_str": et_time.strftime("%H:00"),  # e.g., "09:00"
    }

async def main():
    print("🚀 Connecting to Telegram...")
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    channel = 'elonvitalikalerts'
    
    # Aggregate stats: {date_str: {hour_str: {reply: N, tweet: N}}}
    stats = defaultdict(lambda: defaultdict(lambda: {"reply": 0, "tweet": 0}))
    
    print(f"📡 Crawling data from @{channel} (this may take a while)...")
    
    count = 0
    async for message in client.iter_messages(channel, limit=5000):  # Start with 5000 for testing
        parsed = parse_elon_message(message)
        if parsed:
            date_str = parsed["date_str"]
            hour_str = parsed["hour_str"]
            
            if parsed["tweet_type"] == "reply":
                stats[date_str][hour_str]["reply"] += 1
            else:
                stats[date_str][hour_str]["tweet"] += 1
            
            count += 1
    
    print(f"\n✅ Processed {count} Elon tweets/replies.")
    
    # Convert to the same format as elon_all_data.json
    output_stats = []
    for date_str in sorted(stats.keys(), key=lambda x: datetime.strptime(x, "%b %d"), reverse=True):
        day_data = {"date": date_str}
        for hour_str in sorted(stats[date_str].keys()):
            hour_data = {}
            if stats[date_str][hour_str]["reply"] > 0:
                hour_data["reply"] = stats[date_str][hour_str]["reply"]
            if stats[date_str][hour_str]["tweet"] > 0:
                hour_data["tweet"] = stats[date_str][hour_str]["tweet"]
            if hour_data:
                day_data[hour_str] = hour_data
        output_stats.append(day_data)
    
    # Save crawled stats
    with open('crawled_stats.json', 'w', encoding='utf-8') as f:
        json.dump(output_stats, f, indent=2, ensure_ascii=False)
    
    print(f"\n📁 Saved crawled stats to crawled_stats.json")
    
    # Load existing stats for comparison
    try:
        with open('D:/polymarket/elon_all_data.json', 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
        existing_stats = existing_data.get("stats", {}).get("posts", [])
        
        print("\n📊 Comparison with existing data (first 3 days):\n")
        
        for i, crawled_day in enumerate(output_stats[:3]):
            date = crawled_day["date"]
            existing_day = next((d for d in existing_stats if d.get("date") == date), None)
            
            print(f"=== {date} ===")
            
            # Get all hours from both
            all_hours = set(k for k in crawled_day.keys() if k != "date")
            if existing_day:
                all_hours.update(k for k in existing_day.keys() if k != "date")
            
            for hour in sorted(all_hours):
                crawled_hour = crawled_day.get(hour, {})
                existing_hour = existing_day.get(hour, {}) if existing_day else {}
                
                c_reply = crawled_hour.get("reply", 0)
                c_tweet = crawled_hour.get("tweet", 0)
                e_reply = existing_hour.get("reply", 0)
                e_tweet = existing_hour.get("tweet", 0)
                
                match = "✅" if (c_reply == e_reply and c_tweet == e_tweet) else "❌"
                print(f"  {hour}: Crawled(r={c_reply}, t={c_tweet}) vs Existing(r={e_reply}, t={e_tweet}) {match}")
            print()
            
    except Exception as e:
        print(f"⚠️ Could not load existing data for comparison: {e}")
    
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
