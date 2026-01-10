import { NextResponse } from 'next/server';
import { activeDataSource } from '@/lib/data-sources';
import { getCachedTweets, saveCachedTweets, getAllCachedTweets } from '@/lib/cache';

// GET /api/tweets?limit=<number>&t=<timestamp>
// Strategy: API first, cache fallback
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const periodStart = searchParams.get('t') ? parseInt(searchParams.get('t')!) : undefined;

    try {
        // Step 1: Try fetching from API
        const tweets = await activeDataSource.getTweets(limit, periodStart);

        // Step 2: If API returned data, save to cache
        if (tweets.length > 0) {
            console.log('[API] Got', tweets.length, 'tweets from API, saving to cache...');
            // Save with periodStart if available, otherwise use 0 (default/all)
            // Fire and forget
            saveCachedTweets(periodStart || 0, tweets).catch(err => console.error('[API] Failed to save tweets cache:', err));

            return NextResponse.json({ tweets });
        }

        // Step 3: API returned empty, try cache fallback
        if (tweets.length === 0) {
            console.log('[API] API returned 0 tweets, trying cache...');

            // If periodStart specified, get tweets for that period
            // Otherwise get all cached tweets
            const cached = periodStart
                ? await getCachedTweets(periodStart, limit)
                : await getAllCachedTweets(limit);

            if (cached.length > 0) {
                console.log('[API] Using', cached.length, 'cached tweets');
                return NextResponse.json({ tweets: cached, fromCache: true });
            }
        }

        return NextResponse.json({ tweets });

    } catch (error) {
        console.error('[API] tweets error:', error);

        // Step 4: On API error, try cache fallback
        console.log('[API] API failed, trying cache fallback...');
        const cached = periodStart
            ? await getCachedTweets(periodStart, limit)
            : await getAllCachedTweets(limit);

        if (cached.length > 0) {
            console.log('[API] Using', cached.length, 'cached tweets after error');
            return NextResponse.json({ tweets: cached, fromCache: true });
        }

        return NextResponse.json(
            { error: 'Failed to fetch tweets', tweets: [] },
            { status: 500 }
        );
    }
}
