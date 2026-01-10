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

            // Count non-reply tweets for this period
            const { count, error } = await client
                .from('cached_tweets')
                .select('*', { count: 'exact', head: true })
                .eq('period_start', periodStartTimestamp)
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
                query = query.eq('period_start', periodStartTimestamp);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[DatabaseDS] getTweets error:', error);
                return [];
            }

            return (data || []).map(row => ({
                id: row.id,
                text: row.text || row.msg || '',
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

            // Group by date
            const dateGroups: Record<string, any> = {};
            (data || []).forEach(row => {
                if (!dateGroups[row.date_str]) {
                    dateGroups[row.date_str] = { date: row.date_str };
                }
                dateGroups[row.date_str][row.hour] = {
                    tweet: row.tweet_count,
                    reply: row.reply_count
                };
            });

            // Convert back to array of posts
            const posts = Object.values(dateGroups);

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
        // Return 7-day periods ending on Thursdays (12pm ET)
        // 2026-01-16 (Upcoming/Current), Jan 9, Jan 2, Dec 26
        return {
            periods: [
                { start: 1767978000, end: 1768582800 }, // Jan 16 (Current/Upcoming)
                { start: 1767373200, end: 1767978000 }, // Jan 9 (Completed)
                { start: 1766768400, end: 1767373200 }, // Jan 2 (Completed)
                { start: 1766163600, end: 1766768400 }, // Dec 26 (Completed)
            ]
        };
    }
}

export const localDatabase = new LocalDatabaseDataSource();
