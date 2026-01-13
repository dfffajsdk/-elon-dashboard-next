"""
Debug script to find 'Tweeted' messages from Elon Musk.
"""
import os
import asyncio
from telethon import TelegramClient
from dotenv import load_dotenv

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')

async def main():
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    channel = 'elonvitalikalerts'
    print(f"📡 Searching for 'Tweeted' messages from Elon in @{channel}...")
    
    found_count = 0
    async for message in client.iter_messages(channel, limit=1000):
        if message.text and 'elonmusk' in message.text and 'Tweeted' in message.text:
            if 'Retweeted' not in message.text:
                found_count += 1
                print(f"\n[FOUND #{found_count}] ID: {message.id}")
                print(f"RAW TEXT: {repr(message.text[:150])}...")
                if found_count >= 5:
                    break
    
    if found_count == 0:
        print("\n❌ No 'Tweeted' messages found for Elon in the last 1000 messages.")
    
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
