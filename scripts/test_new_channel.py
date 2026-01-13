"""
Test script to explore data from @elonvitalikalerts Telegram channel.
This will fetch the latest messages and output their structure to help 
understand what data types are available.
"""
import os
import asyncio
import json
from datetime import datetime, timezone
from telethon import TelegramClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')

if not all([API_ID, API_HASH]):
    print("❌ Missing TG_API_ID or TG_API_HASH in .env.local")
    exit(1)

async def main():
    print("🚀 Connecting to Telegram...")
    
    # Use local session file
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    channel = 'elonvitalikalerts'  # The new channel from the screenshot
    
    print(f"📡 Fetching latest 20 messages from @{channel}...")
    
    messages_data = []
    
    async for message in client.iter_messages(channel, limit=20):
        msg_info = {
            "id": message.id,
            "date": message.date.isoformat() if message.date else None,
            "text": message.text[:500] if message.text else None,  # First 500 chars
            "has_media": message.media is not None,
            "media_type": type(message.media).__name__ if message.media else None,
            "sender_id": message.sender_id,
            "forward_from": str(message.forward) if message.forward else None,
        }
        messages_data.append(msg_info)
        
        # Print each message for quick viewing
        print(f"\n{'='*60}")
        print(f"Message ID: {msg_info['id']}")
        print(f"Date: {msg_info['date']}")
        print(f"Media: {msg_info['media_type']}")
        print(f"Text Preview:\n{msg_info['text'][:200] if msg_info['text'] else '(No text)'}")
    
    # Save to JSON for detailed analysis
    output_file = 'test_channel_output.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(messages_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n\n✅ Saved {len(messages_data)} messages to {output_file}")
    print("📋 Review the JSON file to understand the data structure.")
    
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
