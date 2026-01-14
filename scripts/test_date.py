#!/usr/bin/env python3
"""Debug: Show what we're trying to insert"""
from datetime import datetime

# Test
date_iso = '2026-01-14'
hour = 13

dt = datetime.strptime(date_iso, '%Y-%m-%d')
date_str = dt.strftime('%b %d')  # "Jan 14"
hour_str = f"{hour:02d}:00"

print(f"date_str: {date_str}")
print(f"date_normalized: {date_iso}")
print(f"hour: {hour_str}")

# Example row
row = {
    'date_str': date_str,
    'date_normalized': date_iso,
    'hour': hour_str,
    'tweet_count': 5,
    'reply_count': 2,
}
print(f"Row: {row}")
