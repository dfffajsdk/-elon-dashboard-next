import pymysql

conn = pymysql.connect(
    host='127.0.0.1',
    port=3306,
    user='root',
    password='123456',
    database='elon_musk',
    charset='utf8mb4'
)

cursor = conn.cursor(pymysql.cursors.DictCursor)

# Check for future dates in heatmap
print("Checking cached_heatmap for future dates...")
cursor.execute("SELECT * FROM cached_heatmap WHERE date_normalized > '2026-02-01' ORDER BY date_normalized DESC LIMIT 10")
future_heatmap = cursor.fetchall()

if future_heatmap:
    print(f"\nFound {len(future_heatmap)} future heatmap entries:")
    for row in future_heatmap:
        print(f"  {row['date_normalized']} {row['hour']} - tweets:{row['tweet_count']}, replies:{row['reply_count']}")
else:
    print("No future dates in heatmap")

# Check for future dates in tweets
print("\nChecking cached_tweets for future timestamps...")
cursor.execute("SELECT id, created_at, FROM_UNIXTIME(created_at) as datetime FROM cached_tweets WHERE created_at > 1780000000 LIMIT 10")
future_tweets = cursor.fetchall()

if future_tweets:
    print(f"\nFound {len(future_tweets)} future tweets:")
    for row in future_tweets:
        print(f"  {row['id']} - {row['datetime']} (unix: {row['created_at']})")
else:
    print("No future timestamps in tweets")

cursor.close()
conn.close()
