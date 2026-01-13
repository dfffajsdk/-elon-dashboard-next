"""Test MySQL with PyMySQL."""
import pymysql

print("Testing MySQL connection with PyMySQL...")
try:
    conn = pymysql.connect(
        host='127.0.0.1',
        port=3306,
        user='root',
        password='123456',
        connect_timeout=10
    )
    print(f"✅ Connected! Server: {conn.get_server_info()}")
    conn.close()
except Exception as e:
    print(f"❌ Error: {type(e).__name__}: {e}")
