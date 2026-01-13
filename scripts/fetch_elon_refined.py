"""
Refined scraper for Elon Musk tweets - Balanced sample.
"""
import os
import asyncio
import json
import re
from datetime import datetime, timedelta
from telethon import TelegramClient, types
from dotenv import load_dotenv

load_dotenv('.env.local')

API_ID = os.getenv('TG_API_ID')
API_HASH = os.getenv('TG_API_HASH')

def utc_to_et(utc_dt):
    return utc_dt - timedelta(hours=5)

def parse_elon_message(message):
    text = message.text
    if not text: return None
    
    if '**elonmusk**' not in text and '[elonmusk]' not in text:
        return None
    
    tweet_type = None
    if '`Retweeted`' in text:
        tweet_type = "retweet"
    elif '**Quoted**' in text:
        tweet_type = "quote"
    elif '`Replied To`' in text:
        tweet_type = "reply"
    elif 'Tweeted' in text and 'Retweeted' not in text:
        tweet_type = "original"
    
    if not tweet_type: return None
    
    # Link Extraction
    tweet_link = None
    if message.entities:
        for entity in message.entities:
            if isinstance(entity, types.MessageEntityTextUrl):
                if any(x in entity.url for x in ['fxtwitter.com', 'x.com', 'twitter.com']):
                    tweet_link = entity.url
                    break
    
    if not tweet_link:
        link_match = re.search(r'https://(?:fxtwitter\.com|x\.com|twitter\.com)/(\w+)/status/(\d+)', text)
        if link_match: tweet_link = link_match.group(0)
            
    if not tweet_link and message.media and hasattr(message.media, 'webpage'):
        wp = message.media.webpage
        if hasattr(wp, 'url') and any(x in wp.url for x in ['fxtwitter.com', 'x.com', 'twitter.com']):
            if '/status/' in wp.url: tweet_link = wp.url

    tweet_id = None
    original_author = None
    if tweet_link:
        id_match = re.search(r'status/(\d+)', tweet_link)
        if id_match: tweet_id = id_match.group(1)
        author_match = re.search(r'(?:fxtwitter\.com|x\.com|twitter\.com)/(\w+)', tweet_link)
        if author_match: original_author = author_match.group(1)

    lines = text.split('\n')
    content_lines = []
    for i, line in enumerate(lines):
        if i == 0: continue
        clean_line = line.strip()
        if clean_line: content_lines.append(clean_line)
    
    content = '\n'.join(content_lines)
    et_date = utc_to_et(message.date)
    
    return {
        "tweet_type": tweet_type,
        "tweet_id": tweet_id,
        "tweet_link": tweet_link,
        "original_author": original_author,
        "content": content,
        "timestamp_et": et_date.strftime("%Y-%m-%d %H:%M:%S ET")
    }

async def main():
    print("🚀 Connecting to Telegram...")
    client = TelegramClient('elon_crawler_session', API_ID, API_HASH)
    await client.start()
    
    channel = 'elonvitalikalerts'
    # Dictionary to keep track of how many of each type we have
    samples = {"retweet": [], "quote": [], "original": [], "reply": []}
    limit_per_type = 5
    
    print(f"📡 Scraping @{channel} to find a balanced sample of Elon's tweets...")
    
    async for message in client.iter_messages(channel, limit=1000):
        parsed = parse_elon_message(message)
        if parsed:
            p_type = parsed["tweet_type"]
            if len(samples[p_type]) < limit_per_type:
                samples[p_type].append(parsed)
            
            # Stop if we have enough of all major types (original, retweet, quote)
            # replies are very common so they'll likely be full fast
            if all(len(samples[t]) >= limit_per_type for t in ["original", "retweet", "quote"]):
                break
    
    # Flatten samples into a single list
    final_results = []
    for t in ["original", "retweet", "quote", "reply"]:
        final_results.extend(samples[t])
    
    output_file = 'elon_refined_rules.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_results, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Total {len(final_results)} tweets saved to {output_file}")
    for t in samples:
        print(f"  - {t}: {len(samples[t])}")

    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
