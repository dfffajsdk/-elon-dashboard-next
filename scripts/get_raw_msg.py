"""
Get raw message from elonvitalikalerts
"""
import os
import asyncio
from telethon import TelegramClient
from dotenv import load_dotenv

load_dotenv('.env.local')

async def main():
    client = TelegramClient('elon_crawler_session', 
                           os.getenv('TG_API_ID'), 
                           os.getenv('TG_API_HASH'))
    await client.start()
    
    msgs = await client.get_messages('elonvitalikalerts', limit=3)
    for i, msg in enumerate(msgs):
        print(f"\n=== MESSAGE {i+1} (ID: {msg.id}) ===")
        print(f"Date: {msg.date}")
        print(f"Raw text:\n{repr(msg.text)}")
        print("=" * 50)
    
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
