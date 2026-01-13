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

            // Fetch recent heatmap data
            const { data, error } = await client
                .from('cached_heatmap')
                .select('*')
                .order('date_normalized', { ascending: false })
                .limit(24 * 60); // Last 60 days

            if (error) return { posts: [] };

            // Group by date, keeping track of date_normalized for proper sorting
            const dateGroups: Record<string, any> = {};
            (data || []).forEach(row => {
                if (!dateGroups[row.date_str]) {
                    dateGroups[row.date_str] = {
                        date: row.date_str,
                        _dateNormalized: row.date_normalized // Keep for sorting
                    };
                }
                dateGroups[row.date_str][row.hour] = {
                    tweet: row.tweet_count,
                    reply: row.reply_count
                };
            });

            // Convert to array and sort by date_normalized descending (newest first)
            const posts = Object.values(dateGroups)
                .sort((a, b) => b._dateNormalized.localeCompare(a._dateNormalized))
                .map(({ _dateNormalized, ...rest }) => rest); // Remove internal field

            // Fetch recent tweets to populate the 't' array for identifying the latest cell
            const { data: recentTweets } = await client
                .from('cached_tweets')
                .select('created_at, id')
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
