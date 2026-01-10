import { NextResponse } from 'next/server';
import { activeDataSource } from '@/lib/data-sources';
import { getCachedTweets, saveCachedTweets } from '@/lib/cache';

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
        if (tweets.length > 0 && periodStart) {
            console.log('[API] Got', tweets.length, 'tweets from API');
            await saveCachedTweets(periodStart, tweets);
            return NextResponse.json({ tweets });
        }

        // Step 3: API returned empty, try cache fallback
        if (periodStart) {
            console.log('[API] API returned 0 tweets, trying cache...');
            const cached = await getCachedTweets(periodStart, limit);
            if (cached.length > 0) {
                console.log('[API] Using', cached.length, 'cached tweets');
                return NextResponse.json({ tweets: cached, fromCache: true });
            }
        }

        return NextResponse.json({ tweets });

    } catch (error) {
        console.error('[API] tweets error:', error);

        // Step 4: On API error, try cache fallback
        if (periodStart) {
            const cached = await getCachedTweets(periodStart, limit);
            if (cached.length > 0) {
                console.log('[API] API failed, using', cached.length, 'cached tweets');
                return NextResponse.json({ tweets: cached, fromCache: true });
            }
        }

        return NextResponse.json(
            { error: 'Failed to fetch tweets', tweets: [] },
            { status: 500 }
        );
    }
}
