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

// Period configurations (same as PeriodSelector)
const PERIOD_CONFIGS = [
    { id: 'jan9', label: 'Jan 9', startDay: 2, endDay: 9 },
    { id: 'jan13', label: 'Jan 13', startDay: 6, endDay: 13 },
    { id: 'jan16', label: 'Jan 16', startDay: 9, endDay: 16 },
    { id: 'jan20', label: 'Jan 20', startDay: 13, endDay: 20 },
    { id: 'jan23', label: 'Jan 23', startDay: 16, endDay: 23 },
    { id: 'jan27', label: 'Jan 27', startDay: 20, endDay: 27 },
    { id: 'jan30', label: 'Jan 30', startDay: 23, endDay: 30 },
];

export interface PeriodStats {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    count: number;
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

    for (const config of PERIOD_CONFIGS) {
        // Create timestamps for period (12:00 PM ET = 17:00 UTC in winter)
        const startDate = new Date(`2026-01-${String(config.startDay).padStart(2, '0')}T12:00:00-05:00`);
        const endDate = new Date(`2026-01-${String(config.endDay).padStart(2, '0')}T12:00:00-05:00`);

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

        // Count tweets in this period
        try {
            const { count, error } = await client
                .from('cached_tweets')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', startTs)
                .lt('created_at', endTs);

            results.push({
                id: config.id,
                label: config.label,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                count: error ? 0 : (count || 0),
                status
            });
        } catch {
            results.push({
                id: config.id,
                label: config.label,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                count: 0,
                status
            });
        }
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
