"""
Check message format from elonvitalikalerts channel
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
    
    print("📨 Latest 5 messages from elonvitalikalerts:\n")
    
    messages = await client.get_messages('elonvitalikalerts', limit=5)
    for i, msg in enumerate(messages):
        print(f"--- Message {i+1} (ID: {msg.id}) ---")
        print(f"Date: {msg.date}")
        print(f"Text:\n{msg.text}\n")
        print("-" * 50)
    
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
