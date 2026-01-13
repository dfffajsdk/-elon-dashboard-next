# Telegram Crawler Setup Guide

Since the original `elontweets.live` source is offline, this project now uses a custom Telegram Crawler to fetch data from `@ElonTweets_dBot`. 

You have two ways to run this, and you can combine them!

## Strategy 1: Cloud Sync (Recommended for 24/7 Coverage)
**Use this so you don't miss tweets while you dream.**

- **Mechanism**: GitHub Actions (runs on GitHub's servers).
- **Frequency**: Every 5 minutes.
- **Requirement**: Free GitHub account.
- **Pros**: Works 24/7 even if your computer is off.
- **Cons**: Up to 5 minutes delay.

### Setup
1. Run `python scripts/export_session.py` locally to get your Session String.
2. Go to your GitHub Repo -> Settings -> Secrets -> Actions.
3. Add `TG_SESSION_STRING`, `TG_API_ID`, `TG_API_HASH`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
4. Done! It runs automatically forever.

---

## Strategy 2: Local Real-Time Listen
**Use this when you are actively watching the dashboard.**

- **Mechanism**: Local Python script on your PC.
- **Frequency**: **Real-time (Instant)**.
- **Requirement**: Your computer must be **ON** and terminal running.
- **Pros**: Zero delay. Instant updates.
- **Cons**: Stops when you close your laptop.

### Usage
Run this command in your VS Code terminal:
```bash
python scripts/telegram_crawler.py --listen
```
(Keep the terminal window open)

---

## 🏆 Best Practice: The Hybrid Approach
1. **Configure GitHub Actions** first. This ensures you have a baseline of data 24/7.
2. When you are sitting at your desk and want to watch the stats live, **run the Local Listen command**.

They utilize `d upsert` (insert or update), so they won't conflict. You get the best of both worlds!
