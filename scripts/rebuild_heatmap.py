import pymysql
import datetime
from collections import defaultdict

# MySQL Config
MYSQL_HOST = '127.0.0.1'
MYSQL_PORT = 3306
MYSQL_USER = 'root'
MYSQL_PASSWORD = '123456'
MYSQL_DATABASE = 'elon_musk'

def rebuild():
    print("🔄 REBUILDING HEATMAP FROM TWEETS")
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
        charset='utf8mb4'
    )
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    # 1. Clear existing heatmap
    print("Clearing cached_heatmap...")
    cursor.execute("DELETE FROM cached_heatmap")
    
    # 2. Fetch all tweets
    print("Fetching all tweets...")
    cursor.execute("SELECT created_at, is_reply FROM cached_tweets")
    tweets = cursor.fetchall()
    print(f"Found {len(tweets)} tweets.")

    # 3. Aggregate by day and hour (ET)
    # Note: Heatmap uses ET for the grid display logic
    heatmap = defaultdict(lambda: defaultdict(lambda: {"tweet": 0, "reply": 0}))

    for t in tweets:
        ts = t["created_at"]
        dt = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc)
        # Convert to ET (UTC-5 or UTC-4) - Simplified for aggregate
        # The app uses Intl.DateTimeFormat 'America/New_York'
        # We should try to match that. For now, we'll use a fixed offset or simple logic
        # Actually, let's just use UTC or a consistent offset for normalized dates
        # The app's database.ts handles the display.
        
        # To be safe, we'll use a simple ET approx or just use dates as they are
        # but the normalized date MUST be consistent.
        
        # Let's use UTC-5 for ET (approx)
        et_dt = dt - datetime.timedelta(hours=5)
        date_str = et_dt.strftime('%b %d') # "Jul 17"
        date_norm = et_dt.strftime('%Y-%m-%d') # "2025-07-17"
        hour = et_dt.hour
        
        is_reply = bool(t["is_reply"])
        if is_reply:
            heatmap[(date_str, date_norm)][hour]["reply"] += 1
        else:
            heatmap[(date_str, date_norm)][hour]["tweet"] += 1

    # 4. Insert into cached_heatmap
    print("Inserting into cached_heatmap...")
    insert_data = []
    for (date_str, date_norm), hours in heatmap.items():
        for hour, counts in hours.items():
            insert_data.append((
                date_str,
                date_norm,
                f"{hour:02d}:00",
                counts["tweet"],
                counts["reply"]
            ))

    batch_size = 500
    for i in range(0, len(insert_data), batch_size):
        batch = insert_data[i:i+batch_size]
        cursor.executemany(
            "INSERT INTO cached_heatmap (date_str, date_normalized, hour, tweet_count, reply_count) VALUES (%s, %s, %s, %s, %s)",
            batch
        )
        print(f"Inserted {min(i+batch_size, len(insert_data))}/{len(insert_data)}...")

    conn.commit()
    cursor.close()
    conn.close()
    print("✅ REBUILD COMPLETE")

if __name__ == '__main__':
    rebuild()
