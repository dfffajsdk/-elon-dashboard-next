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
    
    try:
        bot_entity = await client.get_input_entity('ElonTweets_dBot')
        print(f"DEBUG: Last 3 messages from {bot_entity.user_id}:")
        async for message in client.iter_messages(bot_entity, limit=3):
            print("-" * 20)
            print(f"Message ID: {message.id}")
            # print(f"Text:\n{repr(message.text)}")
            if message.text:
                lines = message.text.split('\n')
                print(f"Header Line: {repr(lines[0])}")
                print(f"Full Text Preview: {repr(message.text[:100])}")
            print("-" * 20)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
