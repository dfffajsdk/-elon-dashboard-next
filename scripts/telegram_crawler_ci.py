"""
Telegram Crawler for CI/CD (GitHub Actions)

This is a streamlined version specifically for running in GitHub Actions.
It syncs the last 100 messages (to catch anything new since last run).
"""

import os
import re
import asyncio
from datetime import datetime, timezone
from telethon import TelegramClient
from telethon.sessions import StringSession
from supabase import create_client, Client

# Environment Variables (from GitHub Secrets)
API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')
SESSION_STRING = os.getenv('TG_SESSION_STRING')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not all([API_ID, API_HASH, SESSION_STRING, SUPABASE_URL, SUPABASE_KEY]):
    print("❌ Missing required environment variables")
    exit(1)

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Regex patterns
RE_POSTED_AT = r"Posted at:.*?(\w{3},\s+\d{1,2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+[GS]MT)"
RE_LINK = r"Link:.*?(https://x\.com/elonmusk/status/(\d+))"

def parse_tg_message(text):
    if not text:
        return None
    try:
        link_match = re.search(RE_LINK, text)
        if not link_match:
            return None
        
        tweet_id = link_match.group(2)
        tweet_link = link_match.group(1)

        time_match = re.search(RE_POSTED_AT, text)
        ts = 0
        date_str = ""
        if time_match:
            time_str = time_match.group(1).strip()
            time_str = re.sub(r'\s+', ' ', time_str)
            try:
                dt = datetime.strptime(time_str, "%a, %d %b %Y %H:%M:%S %Z")
                dt = dt.replace(tzinfo=timezone.utc)
                ts = int(dt.timestamp())
                date_str = dt.strftime("%Y-%m-%d")
            except Exception:
                pass
        
        first_line = text.split('\n')[0]
        is_reply = "Reply" in first_line
        
        lines = text.split('\n')
        content_lines = []
        for line in lines:
            if "🚨🚨🚨" in line: continue
            if "Posted at:" in line: break
            if "Link:" in line: break
            clean_line = line.strip().replace("┃", "").strip()
            if clean_line:
                content_lines.append(clean_line)
        content = " ".join(content_lines)
        
        return {
            "id": tweet_id,
            "text": content,
            "created_at": ts,
            "date_str": date_str,
            "is_reply": is_reply,
            "link": tweet_link
        }
    except Exception as e:
        print(f"Error parsing: {e}")
        return None

async def sync_to_supabase(parsed):
    if not parsed or not parsed['created_at']:
        return False
    
    ref_start = 1766509200
    diff = parsed['created_at'] - ref_start
    weeks = diff // (7 * 24 * 3600)
    period_start = ref_start + (weeks * 7 * 24 * 3600)

    try:
        supabase.table('cached_tweets').upsert({
            "id": parsed['id'],
            "period_start": period_start,
            "text": parsed['text'],
            "msg": parsed['text'],
            "created_at": parsed['created_at'],
            "is_reply": parsed['is_reply'],
            "raw_data": parsed
        }).execute()
        return True
    except Exception as e:
        print(f"❌ Sync error: {e}")
        return False

async def update_heatmap(parsed):
    if not parsed or not parsed['created_at']:
        return
    
    ts = parsed['created_at']
    dt_et = datetime.fromtimestamp(ts - 5*3600, tz=timezone.utc)
    date_norm = dt_et.strftime("%Y-%m-%d")
    hour_str = dt_et.strftime("%H:00")
    date_str = dt_et.strftime("%b %d")
    
    try:
        res = supabase.table('cached_heatmap').select('*').match({
            "date_normalized": date_norm, 
            "hour": hour_str
        }).execute()
        
        if res.data:
            row = res.data[0]
            field = 'reply_count' if parsed['is_reply'] else 'tweet_count'
            new_count = row[field] + 1
            supabase.table('cached_heatmap').update({field: new_count}).eq('id', row['id']).execute()
        else:
            supabase.table('cached_heatmap').insert({
                "date_str": date_str,
                "date_normalized": date_norm,
                "hour": hour_str,
                "tweet_count": 0 if parsed['is_reply'] else 1,
                "reply_count": 1 if parsed['is_reply'] else 0
            }).execute()
    except Exception as e:
        print(f"⚠️ Heatmap error: {e}")

async def main():
    print(f"🚀 CI Crawler Starting... ({datetime.now().isoformat()})")
    
    clean_session = SESSION_STRING.replace('\n', '').replace(' ', '').strip()
    client = TelegramClient(StringSession(clean_session), int(API_ID), API_HASH)
    
    await client.start()
    print("✅ Connected to Telegram")
    
    bot_entity = 'ElonTweets_dBot'
    count = 0
    synced = 0
    
    # Only process the last 100 messages (5-minute window should have very few new ones)
    async for message in client.iter_messages(bot_entity, limit=100):
        if message.text:
            parsed = parse_tg_message(message.text)
            if parsed:
                count += 1
                if await sync_to_supabase(parsed):
                    await update_heatmap(parsed)
                    synced += 1
    
    print(f"📊 Processed: {count} messages, Synced: {synced}")
    await client.disconnect()
    print("✅ Done!")

if __name__ == '__main__':
    asyncio.run(main())
