/**
 * Cache Service for Tweet Data
 * Uses Supabase to persist tweet data for offline/fallback access
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Tweet } from '../types';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
    if (!supabaseUrl || !supabaseServiceKey) {
        console.warn('[Cache] Supabase not configured');
        return null;
    }
    if (!_client) {
        _client = createClient(supabaseUrl, supabaseServiceKey);
    }
    return _client;
}

// =============================================
// CACHE COUNT OPERATIONS
// =============================================

// Each period is 7 days
const PERIOD_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

export async function getCachedCount(periodStart: number): Promise<{ count: number; mt_count?: number } | null> {
    const client = getClient();
    if (!client) return null;

    try {
        const periodEnd = periodStart + PERIOD_DURATION;

        // Count tweets within this period's time range
        const { count, error } = await client
            .from('cached_tweets')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', periodStart)
            .lt('created_at', periodEnd);

        if (error) {
            console.log('[Cache] Count query error:', error);
            return null;
        }

        console.log('[Cache] Found cached count for period:', count);
        return { count: count || 0 };
    } catch (error) {
        console.error('[Cache] getCachedCount error:', error);
        return null;
    }
}

export async function saveCachedCount(periodStart: number, count: number, mtCount?: number): Promise<boolean> {
    const client = getClient();
    if (!client) return false;

    try {
        const { error } = await client
            .from('cached_counts')
            .upsert({
                period_start: periodStart,
                count: count,
                mt_count: mtCount || 0,
                updated_at: new Date().toISOString()
            }, { onConflict: 'period_start' });

        if (error) {
            console.error('[Cache] saveCachedCount error:', error);
            return false;
        }

        console.log('[Cache] Saved count for period', periodStart, ':', count);
        return true;
    } catch (error) {
        console.error('[Cache] saveCachedCount exception:', error);
        return false;
    }
}

// =============================================
// CACHE TWEETS OPERATIONS
// =============================================

// Period configurations with explicit dates (to handle cross-year periods)
interface PeriodConfig {
    id: string;
    label: string;
    startDate: string; // ISO format
    endDate: string;   // ISO format
}

const PERIOD_CONFIGS: PeriodConfig[] = [
    // 2025-2026 cross-year period
    { id: 'jan2', label: 'Jan 2', startDate: '2025-12-26T12:00:00-05:00', endDate: '2026-01-02T12:00:00-05:00' },
    // 2026 periods
    { id: 'jan9', label: 'Jan 9', startDate: '2026-01-02T12:00:00-05:00', endDate: '2026-01-09T12:00:00-05:00' },
    { id: 'jan13', label: 'Jan 13', startDate: '2026-01-06T12:00:00-05:00', endDate: '2026-01-13T12:00:00-05:00' },
    { id: 'jan16', label: 'Jan 16', startDate: '2026-01-09T12:00:00-05:00', endDate: '2026-01-16T12:00:00-05:00' },
    { id: 'jan20', label: 'Jan 20', startDate: '2026-01-13T12:00:00-05:00', endDate: '2026-01-20T12:00:00-05:00' },
    { id: 'jan23', label: 'Jan 23', startDate: '2026-01-16T12:00:00-05:00', endDate: '2026-01-23T12:00:00-05:00' },
    { id: 'jan27', label: 'Jan 27', startDate: '2026-01-20T12:00:00-05:00', endDate: '2026-01-27T12:00:00-05:00' },
    { id: 'jan30', label: 'Jan 30', startDate: '2026-01-23T12:00:00-05:00', endDate: '2026-01-30T12:00:00-05:00' },
];

export interface PeriodStats {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    count: number;
    replies: number;
    retweets: number;
    quotes: number;
    original: number;
    status: 'ended' | 'active' | 'upcoming';
}

/**
 * Get statistics for all periods based on cached tweet data
 */
export async function getAllPeriodStats(): Promise<PeriodStats[]> {
    const client = getClient();
    if (!client) return [];

    const now = new Date();
    const results: PeriodStats[] = [];

    // Fetch all tweets once to optimize (instead of N queries)
    // Assuming reasonable dataset size (<10k)
    let allTweets: any[] = [];
    try {
        const { data } = await client
            .from('cached_tweets')
            .select('created_at, msg, text, is_reply');
        if (data) allTweets = data;
    } catch (e) {
        console.error('[Cache] Failed to fetch all tweets for stats:', e);
    }

    for (const config of PERIOD_CONFIGS) {
        // Parse dates from config
        const startDate = new Date(config.startDate);
        const endDate = new Date(config.endDate);

        const startTs = Math.floor(startDate.getTime() / 1000);
        const endTs = Math.floor(endDate.getTime() / 1000);

        // Determine status
        let status: 'ended' | 'active' | 'upcoming';
        if (now >= endDate) {
            status = 'ended';
        } else if (now >= startDate) {
            status = 'active';
        } else {
            status = 'upcoming';
        }

        // Filter tweets in memory
        const tweetsInPeriod = allTweets.filter(t =>
            t.created_at >= startTs && t.created_at < endTs
        );

        let replies = 0;
        let retweets = 0;
        let quotes = 0; // Hard to distinguish from original without raw data, grouping with original for now
        let original = 0;

        tweetsInPeriod.forEach(t => {
            const content = (t.msg || t.text || '').trim();
            const isReply = t.is_reply || content.startsWith('@');

            if (isReply) {
                replies++;
            } else if (content.startsWith('RT @')) {
                retweets++;
            } else {
                original++;
            }
        });

        results.push({
            id: config.id,
            label: config.label,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            count: tweetsInPeriod.length,
            replies,
            retweets,
            quotes: 0, // Placeholder
            original,
            status
        });
    }

    return results;
}

export async function getCachedTweets(periodStart: number, limit: number = 100): Promise<Tweet[]> {
    const client = getClient();
    if (!client) return [];

    try {
        const periodEnd = periodStart + PERIOD_DURATION;

        // Get tweets within this period's time range
        const { data, error } = await client
            .from('cached_tweets')
            .select('*')
            .gte('created_at', periodStart)
            .lt('created_at', periodEnd)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error || !data) {
            console.log('[Cache] No cached tweets for period range', periodStart, '-', periodEnd);
            return [];
        }

        console.log('[Cache] Found', data.length, 'cached tweets in period range');

        // Convert cached data back to Tweet format
        return data.map(row => ({
            id: row.id,
            text: row.text || '',
            msg: row.msg || '',
            timestamp: row.created_at || 0,
            ...(row.raw_data || {})
        }));
    } catch (error) {
        console.error('[Cache] getCachedTweets error:', error);
        return [];
    }
}

/**
 * Get ALL cached tweets (no period filter)
 * Used for Recent Tweets table
 */
export async function getAllCachedTweets(limit: number = 1000): Promise<Tweet[]> {
    const client = getClient();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from('cached_tweets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error || !data) {
            console.log('[Cache] No cached tweets found');
            return [];
        }

        console.log('[Cache] Found', data.length, 'total cached tweets');

        return data.map(row => ({
            id: row.id,
            text: row.text || '',
            msg: row.msg || '',
            timestamp: row.created_at || 0,
            ...(row.raw_data || {})
        }));
    } catch (error) {
        console.error('[Cache] getAllCachedTweets error:', error);
        return [];
    }
}

export async function saveCachedTweets(periodStart: number, tweets: Tweet[]): Promise<boolean> {
    const client = getClient();
    if (!client || tweets.length === 0) return false;

    try {
        // Prepare data for upsert
        const rows = tweets.map(tweet => ({
            id: tweet.id,
            period_start: periodStart,
            text: tweet.text || '',
            msg: tweet.msg || '',
            created_at: tweet.timestamp || 0,
            is_reply: false,
            raw_data: tweet,
            cached_at: new Date().toISOString()
        }));

        // Upsert in batches of 100
        for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100);
            const { error } = await client
                .from('cached_tweets')
                .upsert(batch, { onConflict: 'id' });

            if (error) {
                console.error('[Cache] saveCachedTweets batch error:', error);
            }
        }

        console.log('[Cache] Saved', tweets.length, 'tweets for period', periodStart);
        return true;
    } catch (error) {
        console.error('[Cache] saveCachedTweets exception:', error);
        return false;
    }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

export async function getLatestCacheTime(periodStart: number): Promise<Date | null> {
    const client = getClient();
    if (!client) return null;

    try {
        const { data, error } = await client
            .from('cached_counts')
            .select('updated_at')
            .eq('period_start', periodStart)
            .single();

        if (error || !data) return null;
        return new Date(data.updated_at);
    } catch {
        return null;
    }
}

// =============================================
// HEATMAP DATA OPERATIONS
// =============================================

export interface DailySummary {
    date: string;
    dateNormalized: string;
    totalTweets: number;
    totalReplies: number;
    peakHour: string;
    peakCount: number;
}

/**
 * Get heatmap data summary for AI context
 * Returns daily summaries with peak hours
 */
export async function getHeatmapSummary(startDate?: string, endDate?: string): Promise<DailySummary[]> {
    const client = getClient();
    if (!client) return [];

    try {
        let query = client
            .from('cached_heatmap')
            .select('*')
            .order('date_normalized', { ascending: false });

        if (startDate) {
            query = query.gte('date_normalized', startDate);
        }
        if (endDate) {
            query = query.lte('date_normalized', endDate);
        }

        const { data, error } = await query;

        if (error || !data) {
            console.log('[Cache] Heatmap query error:', error);
            return [];
        }

        // Group by date and calculate summaries
        const dateMap = new Map<string, {
            date: string;
            dateNormalized: string;
            totalTweets: number;
            totalReplies: number;
            peakHour: string;
            peakCount: number;
        }>();

        for (const row of data) {
            const key = row.date_normalized;
            const hourTotal = (row.tweet_count || 0) + (row.reply_count || 0);

            if (!dateMap.has(key)) {
                dateMap.set(key, {
                    date: row.date_str,
                    dateNormalized: row.date_normalized,
                    totalTweets: 0,
                    totalReplies: 0,
                    peakHour: row.hour,
                    peakCount: hourTotal
                });
            }

            const entry = dateMap.get(key)!;
            entry.totalTweets += row.tweet_count || 0;
            entry.totalReplies += row.reply_count || 0;

            if (hourTotal > entry.peakCount) {
                entry.peakHour = row.hour;
                entry.peakCount = hourTotal;
            }
        }

        return Array.from(dateMap.values())
            .sort((a, b) => b.dateNormalized.localeCompare(a.dateNormalized));
    } catch (error) {
        console.error('[Cache] getHeatmapSummary error:', error);
        return [];
    }
}

/**
 * Get heatmap data in the original API format for the frontend
 */
export async function getCachedHeatmapData(): Promise<any> {
    const client = getClient();
    if (!client) return { code: 0, data: { posts: [] } };

    try {
        const { data, error } = await client
            .from('cached_heatmap')
            .select('*')
            .order('date_normalized', { ascending: false });

        if (error || !data) {
            console.log('[Cache] Heatmap query error:', error);
            return { code: 0, data: { posts: [] } };
        }

        // Reconstruct the nested object structure
        // Format: { date: "Jan 08", "00:00": { tweet: 1, reply: 1 }, ... }
        const postsMap = new Map<string, any>();

        for (const row of data) {
            // We group by normalized date to ensure correct grouping, 
            // but the key in the object is just fields
            const dateKey = row.date_normalized;

            if (!postsMap.has(dateKey)) {
                postsMap.set(dateKey, {
                    date: row.date_str
                });
            }

            const dayObj = postsMap.get(dateKey);

            // Add hourly data if counts exist
            if (row.tweet_count > 0 || row.reply_count > 0) {
                dayObj[row.hour] = {};
                if (row.tweet_count > 0) dayObj[row.hour].tweet = row.tweet_count;
                if (row.reply_count > 0) dayObj[row.hour].reply = row.reply_count;
            }
        }

        return {
            code: 0,
            data: {
                // Return array of day objects
                posts: Array.from(postsMap.values())
            }
        };
    } catch (error) {
        console.error('[Cache] getCachedHeatmapData error:', error);
        return { code: 0, data: { posts: [] } };
    }
}
