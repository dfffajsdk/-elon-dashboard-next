import pymysql
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv('.env.local')

# MySQL
conn = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='123456', database='elon_musk')
cursor = conn.cursor()

cursor.execute('SELECT COUNT(DISTINCT date_normalized) FROM cached_heatmap')
mysql_unique_dates = cursor.fetchone()[0]

cursor.execute('SELECT MIN(date_normalized), MAX(date_normalized) FROM cached_heatmap')
mysql_min, mysql_max = cursor.fetchone()

cursor.execute('SELECT COUNT(*) FROM cached_heatmap')
mysql_total = cursor.fetchone()[0]

print(f"MySQL: {mysql_total} rows, {mysql_unique_dates} unique dates, range: {mysql_min} to {mysql_max}")

cursor.close()
conn.close()

# Supabase
client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

r1 = client.from_('cached_heatmap').select('*', count='exact').execute()
supabase_total = r1.count

r2 = client.from_('cached_heatmap').select('date_normalized').execute()
supabase_dates = set([d['date_normalized'] for d in r2.data])
supabase_unique = len(supabase_dates)
supabase_min = min(supabase_dates)
supabase_max = max(supabase_dates)

print(f"Supabase: {supabase_total} rows, {supabase_unique} unique dates, range: {supabase_min} to {supabase_max}")

# Check for missing dates
cursor2 = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='123456', database='elon_musk').cursor()
cursor2.execute('SELECT DISTINCT date_normalized FROM cached_heatmap ORDER BY date_normalized')
mysql_dates = set([str(d[0]) for d in cursor2.fetchall()])
cursor2.close()

missing = mysql_dates - supabase_dates
print(f"\nDates in MySQL but NOT in Supabase: {len(missing)}")
if missing:
    print(f"Sample missing: {list(sorted(missing))[:10]}")
