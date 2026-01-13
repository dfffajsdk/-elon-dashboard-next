/**
 * MySQL Cache Service for Tweet Data
 * Uses local MySQL to persist tweet data
 */

import mysql from 'mysql2/promise';
import { Tweet } from '../types';

const MYSQL_CONFIG = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '123456',
    database: process.env.MYSQL_DATABASE || 'elon_musk',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let _pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool | null {
    if (!_pool) {
        try {
            _pool = mysql.createPool(MYSQL_CONFIG);
            console.log('[MySQL] Pool created');
        } catch (e) {
            console.error('[MySQL] Failed to create pool:', e);
            return null;
        }
    }
    return _pool;
}

// =============================================
// CACHE COUNT OPERATIONS
// =============================================

const PERIOD_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

export async function getCachedCount(periodStart: number): Promise<{ count: number; mt_count?: number } | null> {
    const pool = getPool();
    if (!pool) return null;

    try {
        const periodEnd = periodStart + PERIOD_DURATION;

        const [rows] = await pool.execute<any[]>(
            'SELECT COUNT(*) as count FROM cached_tweets WHERE created_at >= ? AND created_at < ?',
            [periodStart, periodEnd]
        );

        const count = rows[0]?.count || 0;
        console.log('[MySQL] Found cached count for period:', count);
        return { count };
    } catch (error) {
        console.error('[MySQL] getCachedCount error:', error);
        return null;
    }
}

// =============================================
// CACHE TWEETS OPERATIONS
// =============================================

interface PeriodConfig {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
}

const PERIOD_CONFIGS: PeriodConfig[] = [
    { id: 'jan2', label: 'Jan 2', startDate: '2025-12-26T12:00:00-05:00', endDate: '2026-01-02T12:00:00-05:00' },
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

export async function getAllPeriodStats(): Promise<PeriodStats[]> {
    const pool = getPool();
    if (!pool) return [];

    const now = new Date();
    const results: PeriodStats[] = [];

    try {
        const [rows] = await pool.execute<any[]>(
            'SELECT created_at, msg, text, is_reply, tweet_type FROM cached_tweets ORDER BY created_at DESC LIMIT 5000'
        );
        const allTweets = rows || [];

        for (const config of PERIOD_CONFIGS) {
            const startDate = new Date(config.startDate);
            const endDate = new Date(config.endDate);

            const startTs = Math.floor(startDate.getTime() / 1000);
            const endTs = Math.floor(endDate.getTime() / 1000);

            let status: 'ended' | 'active' | 'upcoming';
            if (now >= endDate) {
                status = 'ended';
            } else if (now >= startDate) {
                status = 'active';
            } else {
                status = 'upcoming';
            }

            const tweetsInPeriod = allTweets.filter((t: any) =>
                t.created_at >= startTs && t.created_at < endTs
            );

            let replies = 0;
            let retweets = 0;
            let original = 0;

            tweetsInPeriod.forEach((t: any) => {
                if (t.is_reply || t.tweet_type === 'reply') {
                    replies++;
                } else if (t.tweet_type === 'retweet') {
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
                quotes: 0,
                original,
                status
            });
        }

        return results;
    } catch (e) {
        console.error('[MySQL] getAllPeriodStats error:', e);
        return [];
    }
}

export async function getCachedTweets(periodStart: number, limit: number = 100): Promise<Tweet[]> {
    const pool = getPool();
    if (!pool) return [];

    try {
        const periodEnd = periodStart + PERIOD_DURATION;

        const [rows] = await pool.execute<any[]>(
            'SELECT * FROM cached_tweets WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT ?',
            [periodStart, periodEnd, limit]
        );

        console.log('[MySQL] Found', rows.length, 'cached tweets in period range');

        return rows.map((row: any) => ({
            id: row.id,
            text: row.text || '',
            msg: row.msg || '',
            timestamp: row.created_at || 0,
        }));
    } catch (error) {
        console.error('[MySQL] getCachedTweets error:', error);
        return [];
    }
}

export async function getAllCachedTweets(limit: number = 1000): Promise<Tweet[]> {
    const pool = getPool();
    if (!pool) return [];

    try {
        const [rows] = await pool.execute<any[]>(
            'SELECT * FROM cached_tweets ORDER BY created_at DESC LIMIT ?',
            [limit]
        );

        console.log('[MySQL] Found', rows.length, 'total cached tweets');

        return rows.map((row: any) => ({
            id: row.id,
            text: row.text || '',
            msg: row.msg || '',
            timestamp: row.created_at || 0,
        }));
    } catch (error) {
        console.error('[MySQL] getAllCachedTweets error:', error);
        return [];
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

export async function getHeatmapSummary(startDate?: string, endDate?: string): Promise<DailySummary[]> {
    const pool = getPool();
    if (!pool) return [];

    try {
        let sql = 'SELECT * FROM cached_heatmap';
        const params: any[] = [];

        if (startDate && endDate) {
            sql += ' WHERE date_normalized >= ? AND date_normalized <= ?';
            params.push(startDate, endDate);
        } else if (startDate) {
            sql += ' WHERE date_normalized >= ?';
            params.push(startDate);
        } else if (endDate) {
            sql += ' WHERE date_normalized <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY date_normalized DESC';

        const [rows] = await pool.execute<any[]>(sql, params);

        // Group by date and calculate summaries
        const dateMap = new Map<string, DailySummary>();

        for (const row of rows) {
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
        console.error('[MySQL] getHeatmapSummary error:', error);
        return [];
    }
}

export async function getCachedHeatmapData(): Promise<any> {
    const pool = getPool();
    if (!pool) return { code: 0, data: { posts: [] } };

    try {
        const [rows] = await pool.execute<any[]>(
            'SELECT * FROM cached_heatmap ORDER BY date_normalized DESC'
        );

        // Reconstruct the nested object structure
        const postsMap = new Map<string, any>();

        for (const row of rows) {
            const dateKey = row.date_normalized;

            if (!postsMap.has(dateKey)) {
                postsMap.set(dateKey, {
                    date: row.date_str
                });
            }

            const dayObj = postsMap.get(dateKey);

            if (row.tweet_count > 0 || row.reply_count > 0) {
                dayObj[row.hour] = {};
                if (row.tweet_count > 0) dayObj[row.hour].tweet = row.tweet_count;
                if (row.reply_count > 0) dayObj[row.hour].reply = row.reply_count;
            }
        }

        return {
            code: 0,
            data: {
                posts: Array.from(postsMap.values())
            }
        };
    } catch (error) {
        console.error('[MySQL] getCachedHeatmapData error:', error);
        return { code: 0, data: { posts: [] } };
    }
}

// Keep these for compatibility but they're not needed for read-only local deployment
export async function saveCachedCount(periodStart: number, count: number, mtCount?: number): Promise<boolean> {
    return true;
}

export async function saveCachedTweets(periodStart: number, tweets: Tweet[]): Promise<boolean> {
    return true;
}

export async function saveCachedHeatmapData(rawData: any): Promise<boolean> {
    return true;
}

export async function getLatestCacheTime(periodStart: number): Promise<Date | null> {
    return new Date();
}

// Also export getClient as null for compatibility
export function getClient(): null {
    return null;
}
