import urllib.request
import json

r = urllib.request.urlopen('https://elon-dashboard-next-76tq.vercel.app/api/tweet-status')
d = json.load(r)
posts = d.get('posts', [])
print(f'Total posts: {len(posts)}')
print(f'First: {posts[0]["date"] if posts else "N/A"}')
print(f'Last: {posts[-1]["date"] if posts else "N/A"}')
