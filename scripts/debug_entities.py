"""
Debug script to inspect ALL entities in Telegram messages from @elonvitalikalerts.
"""
import os
import asyncio
import json
from telethon import TelegramClient, types
from dotenv import load_dotenv

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')

async def main():
    print("🚀 Connecting to Telegram...")
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    channel = 'elonvitalikalerts'
    print(f"📡 Inspecting messages from @{channel}...")
    
    async for message in client.iter_messages(channel, limit=50):
        if not message.text: continue
        
        # Only look at Elon's Retweets for debugging
        if 'elonmusk' in message.text and 'Retweeted' in message.text:
            print(f"\n{'='*60}")
            print(f"Message ID: {message.id}")
            print(f"Text: {message.text[:100]}...")
            
            if message.entities:
                print(f"Entities Found: {len(message.entities)}")
                for i, entity in enumerate(message.entities):
                    print(f"  [{i}] Type: {type(entity).__name__}")
                    if isinstance(entity, types.MessageEntityTextUrl):
                        print(f"      URL: {entity.url}")
                    elif isinstance(entity, types.MessageEntityUrl):
                        # This is for literal URLs in text
                        url = message.text[entity.offset:entity.offset+entity.length]
                        print(f"      URL (Literal): {url}")
            else:
                print("No entities found.")
            
            # Also check if it's a media-based message with a webpage
            if message.media and hasattr(message.media, 'webpage'):
                if hasattr(message.media.webpage, 'url'):
                    print(f"Media Webpage URL: {message.media.webpage.url}")

    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
