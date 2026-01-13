"""Debug script to check actual message dates from Telegram."""
import asyncio
from datetime import datetime, timedelta, timezone
from telethon import TelegramClient
from dotenv import load_dotenv
import os

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')

async def main():
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    channel = 'elonvitalikalerts'
    
    print("Checking message dates from Telegram:\n")
    
    count = 0
    async for message in client.iter_messages(channel, limit=5000):
        if count % 500 == 0 and count > 0:
            # Print sample every 500 messages
            print(f"[Message #{count}]")
            print(f"  Raw date: {message.date}")
            print(f"  Year: {message.date.year}")
            print(f"  Month: {message.date.month}")
            print(f"  Day: {message.date.day}")
            print(f"  Formatted: {message.date.strftime('%Y-%m-%d')}")
            print()
        count += 1
    
    print(f"\nTotal messages checked: {count}")
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
