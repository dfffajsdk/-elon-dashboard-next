#!/usr/bin/env python3
"""
Complete Telegram Sync Script - FIXED
Fetches all messages from Telegram and populates:
- cached_tweets: For Recent Tweets display
- cached_heatmap: For Activity Matrix display
"""
import os
import re
import asyncio
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from telethon import TelegramClient
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

# Telegram channels to fetch from
CHANNELS = ['elonvitalikalerts', 'ElonTweets_dBot']

# Regex patterns
RE_POSTED_AT = r"Posted at:.*?(\w{3},\s+\d{1,2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+[GS]MT)"
RE_LINK_ELONTWEETS = r"Link:.*?(https://x\.com/elonmusk/status/(\d+))"
RE_LINK_FXTWITTER = r"https://(?:fx)?twitter\.com/(\w+)/status/(\d+)"
RE_LINK_X = r"https://x\.com/(\w+)/status/(\d+)"

def parse_message(text, message_date):
    """Parse Telegram message to extract tweet data"""
    if not text:
        return None
    
    tweet_id = None
    username = None
    
    # Try ElonTweetsD format
    link_match = re.search(RE_LINK_ELONTWEETS, text)
    if link_match:
        tweet_id = link_match.group(2)
        username = 'elonmusk'
    else:
        # Try fxtwitter format
        link_match = re.search(RE_LINK_FXTWITTER, text)
        if link_match:
            username = link_match.group(1).lower()
            tweet_id = link_match.group(2)
        else:
            # Try x.com format
            link_match = re.search(RE_LINK_X, text)
            if link_match:
                username = link_match.group(1).lower()
                tweet_id = link_match.group(2)
    
    if not tweet_id:
        return None
    
    # Filter for Elon's tweets only
    if username and username != 'elonmusk':
        return None
    
    # Extract timestamp
    ts = 0
    time_match = re.search(RE_POSTED_AT, text)
    if time_match:
        time_str = time_match.group(1).strip()
        time_str = re.sub(r'\s+', ' ', time_str)
        try:
            dt = datetime.strptime(time_str, "%a, %d %b %Y %H:%M:%S %Z")
            dt = dt.replace(tzinfo=timezone.utc)
            ts = int(dt.timestamp())
        except:
            pass
    
    # Fallback to message date
    if ts == 0 and message_date:
        if hasattr(message_date, 'timestamp'):
            ts = int(message_date.timestamp())
    
    if ts == 0:
        return None
    
    # Determine tweet type
    text_lower = text.lower()
    is_reply = 'replied' in text_lower or '`replied`' in text_lower
    
    # Extract content
    lines = text.split('\n')
    content = ""
    for line in lines:
        if not any(x in line.lower() for x in ['posted at:', 'link:', '🚨', 'http', 'fxtwitter', 'x.com']):
            if line.strip():
                content = line.strip()
                break
    
    return {
        'id': str(tweet_id),
        'created_at': ts,
        'msg': content[:500] if content else None,
        'is_reply': is_reply,
    }


async def fetch_all_messages(client, channel_name, limit=5000):
    """Fetch messages from a Telegram channel"""
    print(f"\n📥 Fetching from {channel_name}...")
    messages = []
    
    try:
        entity = await client.get_entity(channel_name)
        async for msg in client.iter_messages(entity, limit=limit):
            if msg.text:
                parsed = parse_message(msg.text, msg.date)
                if parsed:
                    messages.append(parsed)
        print(f"   ✓ Found {len(messages)} Elon tweets")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    return messages


def deduplicate_tweets(all_tweets):
    """Remove duplicates, keeping the one with content"""
    seen = {}
    for t in all_tweets:
        if t['id'] not in seen:
            seen[t['id']] = t
        elif t['msg'] and not seen[t['id']].get('msg'):
            seen[t['id']] = t
    return list(seen.values())


def build_heatmap(tweets):
    """Build hourly heatmap from tweets"""
    heatmap = defaultdict(lambda: {'count': 0, 'reply_count': 0})
    
    for t in tweets:
        # Convert to ET timezone
        dt = datetime.fromtimestamp(t['created_at'], tz=timezone.utc)
        et_offset = timedelta(hours=-5)  # EST
        dt_et = dt + et_offset
        
        date_iso = dt_et.strftime('%Y-%m-%d')
        hour = dt_et.hour
        
        key = (date_iso, hour)
        heatmap[key]['count'] += 1
        if t['is_reply']:
            heatmap[key]['reply_count'] += 1
    
    return heatmap


async def main():
    print("=" * 60)
    print("COMPLETE TELEGRAM SYNC")
    print("=" * 60)
    
    # Initialize Supabase
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Use local session file
    print("⚠️ Using local session...")
    session_file = 'elon_crawler_session'
    client = TelegramClient(session_file, API_ID, API_HASH)
    
    await client.start()
    print("✅ Connected to Telegram")
    
    # Fetch from all channels
    all_tweets = []
    for channel in CHANNELS:
        tweets = await fetch_all_messages(client, channel, limit=10000)
        all_tweets.extend(tweets)
    
    await client.disconnect()
    
    # Deduplicate
    unique_tweets = deduplicate_tweets(all_tweets)
    print(f"\n📊 Total unique tweets: {len(unique_tweets)}")
    
    if not unique_tweets:
        print("❌ No tweets found!")
        return
    
    # Clear existing data
    print("\n🗑️ Clearing old data...")
    try:
        supabase.table('cached_tweets').delete().neq('id', '').execute()
        print("   ✓ cached_tweets cleared")
    except Exception as e:
        print(f"   ⚠️ cached_tweets clear error: {e}")
    
    try:
        supabase.table('cached_heatmap').delete().gt('id', 0).execute()
        print("   ✓ cached_heatmap cleared")
    except Exception as e:
        print(f"   ⚠️ cached_heatmap clear error: {e}")
    
    # Reference for period calculation
    ref_start = 1736442000  # Thu Jan 9 2026 12pm ET
    week_seconds = 7 * 24 * 3600
    
    # Insert tweets into cached_tweets
    print("\n📝 Inserting tweets into cached_tweets...")
    batch_size = 50
    inserted = 0
    for i in range(0, len(unique_tweets), batch_size):
        batch = unique_tweets[i:i+batch_size]
        rows = []
        for t in batch:
            # Calculate period_start
            diff = t['created_at'] - ref_start
            period_num = diff // week_seconds
            period_start = ref_start + (period_num * week_seconds)
            
            rows.append({
                'id': str(t['id']),
                'period_start': period_start,
                'msg': t.get('msg'),
                'created_at': t['created_at'],
                'is_reply': t['is_reply'],
            })
        
        try:
            supabase.table('cached_tweets').upsert(rows, on_conflict='id').execute()
            inserted += len(rows)
            print(f"   ✓ Inserted {inserted}/{len(unique_tweets)}")
        except Exception as e:
            print(f"   ❌ Insert error: {e}")
    
    # Build and insert heatmap
    print("\n📊 Building heatmap...")
    heatmap = build_heatmap(unique_tweets)
    
    print(f"   Found {len(heatmap)} date-hour combinations")
    
    heatmap_rows = []
    for (date_iso, hour), data in heatmap.items():
        # Convert date_iso (2026-01-14) to date_str (Jan 14)
        dt = datetime.strptime(date_iso, '%Y-%m-%d')
        date_str = dt.strftime('%b %d')  # "Jan 14"
        hour_str = f"{hour:02d}:00"  # "00:00", "13:00"
        
        heatmap_rows.append({
            'date_str': date_str,
            'date_normalized': date_iso,
            'hour': hour_str,
            'tweet_count': data['count'],
            'reply_count': data['reply_count'],
        })
    
    print("\n📝 Inserting heatmap data...")
    inserted = 0
    for i in range(0, len(heatmap_rows), batch_size):
        batch = heatmap_rows[i:i+batch_size]
        try:
            supabase.table('cached_heatmap').upsert(batch, on_conflict='date_normalized,hour').execute()
            inserted += len(batch)
            print(f"   ✓ Inserted {inserted}/{len(heatmap_rows)}")
        except Exception as e:
            print(f"   ❌ Heatmap insert error: {e}")
            # Print first row for debugging
            if batch:
                print(f"      Sample row: {batch[0]}")
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ SYNC COMPLETE!")
    print("=" * 60)
    print(f"   Tweets: {len(unique_tweets)}")
    print(f"   Heatmap entries: {len(heatmap_rows)}")
    
    # Show date range
    dates = sorted(set(r['date_normalized'] for r in heatmap_rows))
    if dates:
        print(f"   Date range: {dates[0]} to {dates[-1]}")


if __name__ == '__main__':
    asyncio.run(main())
