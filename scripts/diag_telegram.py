
import os
import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv('.env.local')

async def check_entity(client, entity_name):
    print(f"\n🔍 Checking {entity_name}...")
    try:
        count = 0
        async for message in client.iter_messages(entity_name, limit=5):
            count += 1
            ts = message.date.timestamp()
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            text_preview = message.text[:50].replace('\n', ' ')
            print(f"  [{count}] Date: {dt.isoformat()} | Text: {text_preview}...")
        if count == 0:
            print("  No messages found.")
    except Exception as e:
        print(f"  Error: {e}")

async def main():
    api_id = os.getenv('TG_API_ID')
    api_hash = os.getenv('TG_API_HASH')
    session_string = os.getenv('TG_SESSION_STRING')

    if not all([api_id, api_hash, session_string]):
        print("Missing env vars")
        return

    print("📂 Using Local Session File...")
    client = TelegramClient('elon_crawler_session', int(api_id), api_hash)
    await client.start()
    
    entities = ['ElonTweets_dBot', 'elonvitalikalerts', 'ElonTweetsD']
    for e in entities:
        await check_entity(client, e)
        
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
