import re
from datetime import datetime, timezone

# Copied from telegram_crawler.py
RE_HEADER = r"🚨🚨🚨"
RE_POSTED_AT = r"Posted at:.*?(\w{3},\s+\d{1,2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+[GS]MT)"
RE_LINK = r"Link:.*?(https://x\.com/elonmusk/status/(\d+))"

def parse_tg_message(text):
    if not text: return None
    try:
        # Extract Link and ID
        link_match = re.search(RE_LINK, text)
        if not link_match:
            print("Link not found")
            return None
        
        tweet_id = link_match.group(2)
        tweet_link = link_match.group(1)

        # Extract Timestamp
        time_match = re.search(RE_POSTED_AT, text)
        ts = 0
        date_str = ""
        if time_match:
            time_str = time_match.group(1).strip()
            time_str = re.sub(r'\s+', ' ', time_str)
            try:
                dt = datetime.strptime(time_str, "%a, %d %b %Y %H:%M:%S %Z")
                dt = dt.replace(tzinfo=timezone.utc)
                ts = int(dt.timestamp())
                date_str = dt.strftime("%Y-%m-%d")
            except Exception as te:
                print(f"  Timestamp parse error: {te}")
        else:
            print("Time match failed")
        
        # Determine Type: Reply, Retweet, or Original
        is_reply = False
        
        first_line = text.split('\n')[0]
        
        if "Reply" in first_line:
            is_reply = True
        elif "Reposted" in first_line:
            is_reply = False # Retweet
        elif "Tweeted" in first_line:
            is_reply = False # Original
        
        content = "Sample Content"
        
        result = {
            "id": tweet_id,
            "text": content,
            "created_at": ts,
            "date_str": date_str,
            "is_reply": is_reply,
            "link": tweet_link
        }
        return result
    except Exception as e:
        print(f"Error parsing message: {e}")
        return None

# Sample message text (reconstructed from memory/screenshots)
sample_text = """🚨🚨🚨
**Reply** from Elon Musk(@elonmusk)
This is a sample tweet text.

Posted at: Sat, 10 Jan 2026 14:27:17 GMT
Link: https://x.com/elonmusk/status/2006833428424171844
"""

parsed = parse_tg_message(sample_text)
print("Parsed Result:", parsed)

if not parsed or not parsed['created_at']: 
    print("❌ Filter logic says: SKIP")
else:
    print("✅ Filter logic says: INSERT")
