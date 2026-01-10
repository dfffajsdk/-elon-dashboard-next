import os
import re
import asyncio
import json
from datetime import datetime, timezone
import calendar
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not all([API_ID, API_HASH, SUPABASE_URL, SUPABASE_KEY]):
    print("❌ Missing required environment variables in .env.local")
    exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Extremely flexible regex for parsing ElonTweetsD messages
RE_HEADER = r"🚨🚨🚨"
# Match format like: Sat, 10 Jan 2026 14:27:17 GMT
# Allow markdown backticks and varying whitespace
RE_POSTED_AT = r"Posted at:.*?(\w{3},\s+\d{1,2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+[GS]MT)"
RE_LINK = r"Link:.*?(https://x\.com/elonmusk/status/(\d+))"

def parse_tg_message(text):
    if not text: return None
    try:
        # Extract Link and ID
        link_match = re.search(RE_LINK, text)
        if not link_match:
            return None
        
        tweet_id = link_match.group(2)
        tweet_link = link_match.group(1)

        # Extract Timestamp
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
            except Exception as te:
                print(f"  Timestamp parse error: {te}")
        
        # Determine Type: Reply, Retweet, or Original
        is_reply = False
        
        # Check first line for header
        first_line = text.split('\n')[0]
        
        if "Reply" in first_line:
            is_reply = True
        elif "Reposted" in first_line:
            is_reply = False # Retweet
        elif "Tweeted" in first_line:
            is_reply = False # Original
        
        # Fallback: check content for RT @ if header is missing or weird
        # But rely primarily on header as it's explicit from the bot
        
        # Extract Content
        lines = text.split('\n')
        content_lines = []
        
        for line in lines:
            if "🚨🚨🚨" in line: continue
            if "Posted at:" in line: break
            if "Link:" in line: break
            
            clean_line = line.strip()
            if clean_line.startswith("┃"):
                clean_line = clean_line.replace("┃", "").strip()
            
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
        print(f"Error parsing message: {e}")
        return None

async def sync_to_supabase(parsed):
    if not parsed or not parsed['created_at']: 
        return
    
    # Calculate period_start (Tuesday Dec 23 2025 12pm ET = 1766509200)
    # This aligns with the User's "Tuesday to Tuesday" cycle requirement
    ref_start = 1766509200 
    diff = parsed['created_at'] - ref_start
    weeks = diff // (7 * 24 * 3600)
    period_start = ref_start + (weeks * 7 * 24 * 3600)

    try:
        # Upsert into cached_tweets ONLY
        # We will rebuild heatmap later to avoid double counting distortion
        supabase.table('cached_tweets').upsert({
            "id": parsed['id'],
            "period_start": period_start,
            "text": parsed['text'],
            "msg": parsed['text'],
            "created_at": parsed['created_at'],
            "is_reply": parsed['is_reply'],
            "raw_data": parsed
        }).execute()
        
        print(f"✅ Synced: {parsed['id']} | Reply: {parsed['is_reply']} | {parsed['date_str']}")
            
    except Exception as e:
        print(f"❌ Supabase sync error: {e}")

async def rebuild_heatmap():
    print("\n🔄 Rebuilding Heatmap from Cached Tweets...")
    
    # 1. Fetch all tweets from cached_tweets (pagination needed if huge, but 1000 is fine)
    all_tweets = []
    offset = 0
    while True:
        res = supabase.from_('cached_tweets').select('*').range(offset, offset+999).execute()
        if not res.data: break
        all_tweets.extend(res.data)
        if len(res.data) < 1000: break
        offset += 1000
        
    print(f"📚 Loaded {len(all_tweets)} tweets for processing.")
    
    # 2. Aggregate in memory
    heatmap = {} # key: "date_norm|hour" -> {tweet_count, reply_count, date_str}
    
    for row in all_tweets:
        ts = row['created_at']
        dt_et = datetime.fromtimestamp(ts - 5*3600, tz=timezone.utc)
        date_norm = dt_et.strftime("%Y-%m-%d")
        hour_str = dt_et.strftime("%H:00")
        date_str = dt_et.strftime("%b %d") # Jan 08
        
        key = f"{date_norm}|{hour_str}"
        if key not in heatmap:
            heatmap[key] = {
                "date_normalized": date_norm,
                "hour": hour_str,
                "date_str": date_str,
                "tweet_count": 0,
                "reply_count": 0
            }
        
        if row['is_reply']:
            heatmap[key]['reply_count'] += 1
        else:
            heatmap[key]['tweet_count'] += 1
            
    # 3. Truncate and Insert (or Upsert)
    # Ideally truncate, but RLS might block. Let's try upserting all.
    # Actually, to clear old wrong data (double counts), we should wipe.
    # But let's just Upsert correct values. If we overwrite, it's fine.
    
    print(f"💾 Saving {len(heatmap)} heatmap slots...")
    
    for key, val in heatmap.items():
        # Upsert based on unique constraint (date_normalized, hour)
        supabase.table('cached_heatmap').upsert(val, on_conflict='date_normalized, hour').execute()
        
    print("🔥 Heatmap rebuild complete!")


async def listen_mode(client, bot_entity):
    print(f"👂 Listening for new messages from {bot_entity}...")
    print("   (Keep this window open. Updates will be synced in real-time.)")
    
    @client.on(events.NewMessage(chats=bot_entity))
    async def handler(event):
        print(f"\n⚡ New message received! (ID: {event.message.id})")
        if event.message.text:
            parsed = parse_tg_message(event.message.text)
            if parsed:
                # 1. Sync the tweet
                await sync_to_supabase(parsed)
                
                # 2. Increment heatmap immediately (lightweight update)
                # We don't do full rebuild here to be fast
                ts = parsed['created_at']
                dt_et = datetime.fromtimestamp(ts - 5*3600, tz=timezone.utc)
                date_norm = dt_et.strftime("%Y-%m-%d")
                hour_str = dt_et.strftime("%H:00")
                date_str = dt_et.strftime("%b %d")
                
                # Upsert/Increment logic for heatmap
                # For simplicity, we just fetch-modify-save or relies on the fact we have a unique row
                # Let's just do a safe RPC or simple select-update
                try:
                    res = supabase.table('cached_heatmap').select('*').match({"date_normalized": date_norm, "hour": hour_str}).execute()
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
                    print(f"   🔥 Heatmap updated for {hour_str}")
                except Exception as e:
                    print(f"   ⚠️ Heatmap update failed: {e}")

    await client.run_until_disconnected()

async def main():
    import sys
    mode = "listen" if "--listen" in sys.argv else "sync"

    print(f"🚀 Starting Telegram Crawler ({mode.upper()} mode)...")
    
    # Check if we have a session string (from GitHub Secrets)
    session_string = os.getenv('TG_SESSION_STRING')
    
    if session_string:
        print("🔐 Using Session String from Environment...")
        # Clean up string (remove newlines/spaces potentially copied by accident)
        clean_session = session_string.replace('\n', '').replace(' ', '').strip()
        
        try:
            # Ensure API_ID is int
            api_id_int = int(API_ID)
            client = TelegramClient(StringSession(clean_session), api_id_int, API_HASH)
        except Exception as e:
            print(f"❌ Session Init Error: {e}")
            return
    else:
        # Fallback to local session file
        print("📂 Using Local Session File...")
        client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
        
    await client.start()
    
    try:
        bot_entity = 'ElonTweets_dBot'
        
        if mode == "sync":
            print(f"📡 Deep syncing history from @{bot_entity}...")
            count = 0
            # Increase limit to 10,000 to cover 50+ days of history (User requirement)
            async for message in client.iter_messages(bot_entity, limit=10000):
                if message.text:
                    parsed = parse_tg_message(message.text)
                    if parsed:
                        await sync_to_supabase(parsed)
                        count += 1
            print(f"📥 Crawled {count} messages.")
            await rebuild_heatmap()
            print("💡 Tip: Run 'python scripts/telegram_crawler.py --listen' to keep receiving new tweets in real-time!")
            
        elif mode == "listen":
            await listen_mode(client, bot_entity)
        
    except Exception as e:
        print(f"❌ Error during execution: {e}")
    finally:
        if mode == "sync":
            await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
