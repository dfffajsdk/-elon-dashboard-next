import os
import asyncio
from telethon import TelegramClient
from dotenv import load_dotenv

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')

async def main():
    print("Connecting to Telegram...")
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    try:
        # Get the entity
        bot_entity = await client.get_input_entity('ElonTweets_dBot')
        
        # Get total message count
        # limit=0 returns the total count in the .total attribute
        total_messages = (await client.get_messages(bot_entity, limit=0)).total
        
        print(f"📊 Total messages in chat history: {total_messages}")
        
        # Peek at the very last message (oldest) we can access
        # Note: 'reverse=True' with limit=1 gets the oldest message? 
        # Actually iter_messages reverse=True iterates from old to new. 
        # So taking the first one should be the oldest.
        print("🔍 Checking oldest accessible message...")
        async for message in client.iter_messages(bot_entity, reverse=True, limit=1):
            print(f"Oldest Message Date: {message.date}")
            print(f"Oldest Message Text Preview: {message.text[:50] if message.text else '[Media]'}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
