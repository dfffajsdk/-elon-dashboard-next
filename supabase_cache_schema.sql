-- =============================================
-- CACHE TABLES for Tweet Data Persistence
-- =============================================

-- Table to cache tweet counts per period
CREATE TABLE IF NOT EXISTS cached_counts (
    id SERIAL PRIMARY KEY,
    period_start BIGINT NOT NULL UNIQUE,  -- Unix timestamp of period start
    count INTEGER NOT NULL DEFAULT 0,
    mt_count INTEGER DEFAULT 0,           -- Total count including replies
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to cache individual tweets
CREATE TABLE IF NOT EXISTS cached_tweets (
    id TEXT PRIMARY KEY,                  -- Tweet ID
    period_start BIGINT NOT NULL,         -- Which period this tweet belongs to
    text TEXT,
    msg TEXT,
    created_at BIGINT,                    -- Unix timestamp
    is_reply BOOLEAN DEFAULT FALSE,
    raw_data JSONB,                       -- Store complete raw tweet data
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast period-based queries
CREATE INDEX IF NOT EXISTS idx_cached_tweets_period ON cached_tweets(period_start);
CREATE INDEX IF NOT EXISTS idx_cached_tweets_created ON cached_tweets(created_at DESC);

-- Enable RLS
ALTER TABLE cached_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_tweets ENABLE ROW LEVEL SECURITY;

-- Allow all operations (server-side with service key)
CREATE POLICY "Allow all on cached_counts" ON cached_counts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on cached_tweets" ON cached_tweets FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- CACHED HEATMAP DATA (Hourly Statistics)
-- For storing per-hour tweet stats (used by heatmap)
-- =============================================
CREATE TABLE IF NOT EXISTS cached_heatmap (
    id SERIAL PRIMARY KEY,
    date_str TEXT NOT NULL,           -- e.g., "Jan 08", "Dec 25"
    date_normalized DATE NOT NULL,     -- e.g., "2026-01-08", for proper sorting
    hour TEXT NOT NULL,                -- e.g., "00:00", "13:00"
    tweet_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date_normalized, hour)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_heatmap_date ON cached_heatmap(date_normalized);
CREATE INDEX IF NOT EXISTS idx_heatmap_date_str ON cached_heatmap(date_str);

-- RLS for heatmap
ALTER TABLE cached_heatmap ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on cached_heatmap" ON cached_heatmap FOR ALL USING (true) WITH CHECK (true);
