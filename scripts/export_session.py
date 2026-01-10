import os
import asyncio
from telethon.sync import TelegramClient
from telethon.sessions import StringSession
from dotenv import load_dotenv

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')

if not API_ID or not API_HASH:
    print("❌ Please ensure TG_API_ID and TG_API_HASH are in .env.local")
    exit(1)

print("🚀 Exporting Telegram Session String...")
print("NOTE: This will use your existing local session 'elon_crawler_session.session'")

async def main():
    # Load the existing session file
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    # Export as string
    session_string = StringSession.save(client.session)
    
    print("\n✅ SUCCESS! Here is your Session String (KEEP THIS SAFE):")
    print("-" * 60)
    print(session_string)
    print("-" * 60)
    print("\nCopy the string above and add it to your GitHub Repository Secrets as:")
    print("Name: TG_SESSION_STRING")
    print("Value: <paste the string>")
    
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
