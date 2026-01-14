"""
Diagnostic script to check which Telegram entities are active
"""
import os
import asyncio
from datetime import datetime
from telethon import TelegramClient
from dotenv import load_dotenv

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')

# Entities to check
ENTITIES = [
    'elonvitalikalerts',    # Channel (public)
    'ElonTweets_dBot',      # Bot (private messages)
    'ElonTweetsD',          # Might be user or channel
]

async def main():
    print("🔍 Checking Telegram entities...")
    
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    for entity_name in ENTITIES:
        print(f"\n📍 Checking: {entity_name}")
        try:
            entity = await client.get_entity(entity_name)
            print(f"   ✅ Found: {type(entity).__name__}")
            
            # Get latest messages
            messages = await client.get_messages(entity, limit=3)
            if messages:
                for msg in messages:
                    if msg and msg.date:
                        dt = msg.date.strftime("%Y-%m-%d %H:%M:%S")
                        text = (msg.text[:60] + "...") if msg.text and len(msg.text) > 60 else msg.text
                        print(f"   📨 {dt} - {text}")
            else:
                print("   ⚠️ No messages found (might need to start conversation)")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
