#!/usr/bin/env python3
"""Debug: Check period_start calculation"""
from datetime import datetime, timezone

# Reference: Jan 9 2026 12pm ET
ref_start = 1736442000
week_seconds = 7 * 24 * 3600

# Test with a sample timestamp (Jan 14 2026 13:00 ET)
# Jan 14 2026 13:00 EST = Jan 14 2026 18:00 UTC
test_ts = int(datetime(2026, 1, 14, 18, 0, 0, tzinfo=timezone.utc).timestamp())

print(f"ref_start: {ref_start}")
print(f"test_ts: {test_ts}")

diff = test_ts - ref_start
print(f"diff: {diff}")

period_num = diff // week_seconds
print(f"period_num: {period_num}")

period_start = ref_start + (period_num * week_seconds)
print(f"period_start: {period_start}")

# Also check a much older date
old_ts = int(datetime(2024, 12, 1, 18, 0, 0, tzinfo=timezone.utc).timestamp())
old_diff = old_ts - ref_start
old_period_num = old_diff // week_seconds
old_period_start = ref_start + (old_period_num * week_seconds)

print(f"\nOld date: {old_ts}")
print(f"Old diff: {old_diff}")
print(f"Old period_num: {old_period_num}")  
print(f"Old period_start: {old_period_start}")
