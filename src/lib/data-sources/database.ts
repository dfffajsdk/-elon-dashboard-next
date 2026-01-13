import { DataSource, DataSourceConfig, Tweet, TweetStatus, TweetStatusRawResponse } from './index';
import { getClient } from '../cache';

/**
 * LocalDatabaseDataSource
 * Reads data directly from Supabase (populated by Telegram crawler)
 */
class LocalDatabaseDataSource implements DataSource {
    name = 'Local Database (Telegram Sync)';
    config: DataSourceConfig = { name: 'Local Database' };

    async getTweetCount(periodStartTimestamp: number): Promise<{ count: number }> {
        try {
            const client = getClient();
            if (!client) return { count: 0 };

            // Dynamic Range Query: Count non-reply tweets within [start, start + 7 days)
            // This supports overlapping periods (e.g. Tue-Tue AND Fri-Fri)
            const periodEnd = periodStartTimestamp + (7 * 24 * 3600);

            const { count, error } = await client
                .from('cached_tweets')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', periodStartTimestamp)
                .lt('created_at', periodEnd)
                .eq('is_reply', false);

            if (error) {
                console.error('[DatabaseDS] Error:', error);
                return { count: 0 };
            }

            return { count: count || 0 };
        } catch (error) {
            console.error('[DatabaseDS] Exception:', error);
            return { count: 0 };
        }
    }

    async getTweets(limit: number = 100, periodStartTimestamp?: number): Promise<Tweet[]> {
        try {
            const client = getClient();
            if (!client) return [];

            let query = client
                .from('cached_tweets')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (periodStartTimestamp) {
                const periodEnd = periodStartTimestamp + (7 * 24 * 3600);
                query = query.gte('created_at', periodStartTimestamp)
                    .lt('created_at', periodEnd);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[DatabaseDS] getTweets error:', error);
                return [];
            }

            return (data || []).map(row => ({
                id: row.id,
                text: row.text || row.msg || '',
                timestamp: row.created_at, // Explicitly map to timestamp
                created_at: row.created_at,
                is_reply: row.is_reply,
                ...row.raw_data
            }));
        } catch (error) {
            console.error('[DatabaseDS] getTweets exception:', error);
            return [];
        }
    }

    async getTweetStatus(): Promise<TweetStatusRawResponse> {
        try {
            const client = getClient();
            if (!client) return { posts: [] };

            // Fetch recent heatmap data, ordered by date descending
            const { data, error } = await client
                .from('cached_heatmap')
                .select('date_str, date_normalized, hour, tweet_count, reply_count')
                .order('date_normalized', { ascending: false })
                .order('hour', { ascending: true }) // Keep hours internal chronological
                .limit(24 * 365); // Last 365 days max

            if (error) {
                console.error('[DatabaseDS] Heatmap query error:', error);
                return { posts: [] };
            }

            // Group by date_normalized (unique key)
            const dateGroups = new Map<string, any>();

            (data || []).forEach(row => {
                const key = row.date_normalized;

                if (!dateGroups.has(key)) {
                    dateGroups.set(key, {
                        date: row.date_str,
                        _sortKey: row.date_normalized
                    });
                }

                const group = dateGroups.get(key)!;
                // Hour is already an integer in the new schema
                const hourFormatted = row.hour.toString().padStart(2, '0') + ':00';
                group[hourFormatted] = {
                    tweet: row.tweet_count || 0,
                    reply: row.reply_count || 0
                };
            });

            // Convert to array and ensure descending order by actual date
            const posts = Array.from(dateGroups.values())
                .sort((a, b) => b._sortKey.localeCompare(a._sortKey))
                .map(({ _sortKey, ...rest }) => ({ ...rest, _norm: _sortKey }));

            // Get latest tweet timestamp for "current" cell logic
            const { data: recentTweets } = await client
                .from('cached_tweets')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1);

            const t = (recentTweets || []).map(tw => ({
                timestamp: tw.created_at,
                timestr: new Date(tw.created_at * 1000).toISOString()
            }));

            return { posts, t };
        } catch (error) {
            console.error('[DatabaseDS] getTweetStatus error:', error);
            return { posts: [] };
        }
    }

    async getConfig(): Promise<{ periods: Array<{ start: number; end: number }> }> {
        // Return overlapping periods to support multiple market tabs
        // Tuesday cycles AND Friday cycles
        return {
            periods: [
                // Friday Cycles (e.g. Ending Jan 16)
                { start: 1767978000, end: 1768582800 }, // Jan 9 - Jan 16 (Fri)

                // Tuesday Cycles (e.g. Ending Jan 13)
                { start: 1767718800, end: 1768323600 }, // Jan 6 - Jan 13 (Tue)

                // Historical
                { start: 1767373200, end: 1767978000 }, // Jan 2 - Jan 9 (Fri)
                { start: 1767114000, end: 1767718800 }, // Dec 30 - Jan 6 (Tue)
            ]
        };
    }
}

export const localDatabase = new LocalDatabaseDataSource();
