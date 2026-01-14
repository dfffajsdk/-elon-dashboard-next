import { DataSource, DataSourceConfig, Tweet, TweetStatus, TweetStatusRawResponse } from './index';


const config: DataSourceConfig = {
    name: 'ElonTweets.Live',
    baseUrl: 'https://elontweets.live/api',
    // Correct token from original server.js
    token: process.env.ELONTWEETS_TOKEN || '8b611f29-6961-4e5f-a89e-b89f5f1266a4',
};

class ElonTweetsLiveDataSource implements DataSource {
    name = 'ElonTweets.Live';
    config = config;

    async getTweetCount(periodStartTimestamp: number, endTimestamp?: number): Promise<{ count: number }> {
        try {
            // Original: ${BASE_URL}/tweet_count?t=${timestamp}
            const url = `${config.baseUrl}/tweet_count?t=${periodStartTimestamp}`;
            console.log('[DataSource] Fetching tweet count from:', url);

            const response = await fetch(url, {
                headers: { 'token': config.token! },
                cache: 'no-store'
            });

            if (!response.ok) {
                console.error('[DataSource] Tweet count error:', response.status);
                return { count: 0 };
            }

            const data = await response.json();
            console.log('[DataSource] Tweet count response:', JSON.stringify(data).substring(0, 100));

            // API returns { code: 0, data: count, mt_count: total }
            if (data && data.code === 0) {
                return { count: data.data || 0 };
            }
            return { count: 0 };
        } catch (error) {
            console.error('[DataSource] getTweetCount error:', error);
            return { count: 0 };
        }
    }

    async getTweets(limit: number = 100, periodStart?: number, periodEnd?: number): Promise<Tweet[]> {
        try {
            // Default to Jan 2, 2026 12:00 PM ET (Start of current period)
            // 12:00 PM ET = 17:00 UTC (EST is UTC-5)
            const defaultStart = Math.floor(new Date('2026-01-02T12:00:00-05:00').getTime() / 1000);
            const timestamp = periodStart || defaultStart;

            const url = `${config.baseUrl}/tweets2?version=2&t=${timestamp}&limit=${limit}`;
            console.log('[DataSource] Fetching tweets from:', url);

            // Use AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'token': config.token!,
                        'Accept': 'application/json',
                    },
                    signal: controller.signal,
                    // @ts-ignore - Next.js specific option
                    cache: 'no-store',
                });

                clearTimeout(timeoutId);
                console.log('[DataSource] Tweets response status:', response.status, response.statusText);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[DataSource] Tweets error:', response.status, errorText);
                    return [];
                }

                const data = await response.json();
                console.log('[DataSource] Tweets response code:', data?.code, 'count:', data?.data?.length || 0);

                // API returns { code: 0, data: [...tweets] }
                if (data && data.code === 0 && Array.isArray(data.data)) {
                    return data.data;
                }
                console.log('[DataSource] Tweets: Invalid response structure', JSON.stringify(data).substring(0, 200));
                return [];
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    console.error('[DataSource] Tweets request timed out');
                } else {
                    console.error('[DataSource] Tweets fetch error:', fetchError.message || fetchError);
                }
                return [];
            }
        } catch (error) {
            console.error('[DataSource] getTweets error:', error);
            return [];
        }
    }

    async getTweetStatus(): Promise<TweetStatusRawResponse> {
        try {
            // Original: ${BASE_URL}/get_tweet_status?version=2
            const url = `${config.baseUrl}/get_tweet_status?version=2`;
            console.log('[DataSource] Fetching tweet status from:', url);

            const response = await fetch(url, {
                headers: { 'token': config.token! },
                cache: 'no-store'
            });

            if (!response.ok) {
                console.error('[DataSource] Tweet status error:', response.status);
                return { posts: [] };
            }

            const data = await response.json();
            console.log('[DataSource] Tweet status response code:', data?.code);

            // API returns { code: 0, data: { posts: [...], t: [...] } }
            if (data && data.code === 0 && data.data) {
                return data.data;
            }
            return { posts: [] };
        } catch (error) {
            console.error('[DataSource] getTweetStatus error:', error);
            return { posts: [] };
        }
    }

    async getConfig(): Promise<{ periods: Array<{ start: number; end: number }> }> {
        try {
            const url = `${config.baseUrl}/config`;
            const response = await fetch(url, {
                headers: { 'token': config.token! },
                cache: 'no-store'
            });

            if (!response.ok) {
                return { periods: [] };
            }

            return await response.json();
        } catch (error) {
            console.error('[DataSource] getConfig error:', error);
            return { periods: [] };
        }
    }
}

export const elonTweetsLive = new ElonTweetsLiveDataSource();
