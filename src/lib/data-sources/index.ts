// Data Source Interface
// This abstraction allows switching between different data sources
// (e.g., elontweets.live API or future Telegram bot)

import { Tweet, TweetStatus, TweetStatusRawResponse } from '../types';
export type { Tweet, TweetStatus, TweetStatusRawResponse };

export interface DataSourceConfig {
    name: string;
    baseUrl?: string;
    token?: string;
}

export interface DataSource {
    name: string;
    config: DataSourceConfig;

    // Get tweet count since a specific timestamp
    getTweetCount(periodStartTimestamp: number): Promise<{ count: number }>;

    // Get list of tweets
    getTweets(limit?: number): Promise<Tweet[]>;

    // Get tweet activity status (for heatmap)
    getTweetStatus(): Promise<TweetStatusRawResponse>;

    // Get configuration
    getConfig(): Promise<{ periods: Array<{ start: number; end: number }> }>;
}

// Export the active data source (can be switched by changing this import)
export { elonTweetsLive as activeDataSource } from './elontweets-live';
