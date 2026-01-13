"""
Final check for Elon Musk tweets - extracting links from text, entities, AND media webpage previews.
"""
import os
import asyncio
import json
import re
from telethon import TelegramClient, types
from dotenv import load_dotenv

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')

def parse_elon_message(message):
    text = message.text
    if not text:
        return None
    
    # Check if this is an Elon message
    is_elon = '**elonmusk**' in text or '[elonmusk]' in text
    if not is_elon:
        return None
    
    # Determine tweet type
    tweet_type = None
    if '`Retweeted`' in text:
        tweet_type = "retweet"
    elif '**Quoted**' in text:
        tweet_type = "quote"
    elif 'Tweeted' in text and 'Retweeted' not in text:
        tweet_type = "original"
    
    # Also check for replies just in case, though user only asked for 3 types
    # I'll include 'reply' in the matching so I can see it in debug, 
    # but filter later if needed.
    is_reply = '`Replied To`' in text
    if is_reply:
        tweet_type = "reply"

    if not tweet_type:
        return None
    
    # --- Link Extraction ---
    tweet_link = None
    
    # 1. Look for links hidden in entities (e.g. [🖇️](url), [💬](url))
    if message.entities:
        for entity in message.entities:
            if isinstance(entity, types.MessageEntityTextUrl):
                url = entity.url
                if 'fxtwitter.com' in url or 'x.com' in url or 'twitter.com' in url:
                    tweet_link = url
                    break
    
    # 2. Look for literal URLs in text
    if not tweet_link:
        link_match = re.search(r'https://(?:fxtwitter\.com|x\.com|twitter\.com)/(\w+)/status/(\d+)', text)
        if link_match:
            tweet_link = link_match.group(0)
    
    # 3. Look for links in the Media Webpage preview
    if not tweet_link and message.media and hasattr(message.media, 'webpage'):
        wp = message.media.webpage
        if hasattr(wp, 'url'):
            url = wp.url
            if 'fxtwitter.com' in url or 'x.com' in url or 'twitter.com' in url:
                if '/status/' in url:
                    tweet_link = url

    # Extract ID and Author from link
    tweet_id = None
    original_author = None
    if tweet_link:
        id_match = re.search(r'status/(\d+)', tweet_link)
        if id_match:
            tweet_id = id_match.group(1)
        author_match = re.search(r'(?:fxtwitter\.com|x\.com|twitter\.com)/(\w+)', tweet_link)
        if author_match:
            original_author = author_match.group(1)

    # Content extraction (skip header line)
    lines = text.split('\n')
    content_lines = []
    for i, line in enumerate(lines):
        if i == 0: continue
        clean_line = line.strip()
        if clean_line:
            content_lines.append(clean_line)
    
    content = '\n'.join(content_lines)
    
    return {
        "tweet_type": tweet_type,
        "tweet_id": tweet_id,
        "tweet_link": tweet_link,
        "original_author": original_author,
        "content": content,
        "raw_text": text[:200] + "..." if len(text) > 200 else text
    }

async def main():
    print("🚀 Connecting to Telegram...")
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    channel = 'elonvitalikalerts'
    elon_tweets = []
    
    print(f"📡 Fetching and extracting links from @{channel}...")
    
    # Fetch more to find enough retweets/quotes/original
    async for message in client.iter_messages(channel, limit=300):
        parsed = parse_elon_message(message)
        if parsed and parsed["tweet_type"] in ["retweet", "quote", "original"]:
            parsed["tg_date"] = message.date.isoformat()
            elon_tweets.append(parsed)
            if len(elon_tweets) >= 15:
                break
    
    # Save results
    output_file = 'elon_final_sample.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(elon_tweets, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Created {output_file} with {len(elon_tweets)} entries.")
    
    # Preview
    for i, t in enumerate(elon_tweets[:5]):
        print(f"\n[{i+1}] {t['tweet_type'].upper()} - {t['tg_date']}")
        print(f"    Link: {t['tweet_link']}")
        print(f"    Author: {t['original_author']}")
    
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
