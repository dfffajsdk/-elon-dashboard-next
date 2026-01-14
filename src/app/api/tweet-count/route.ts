import { NextResponse } from 'next/server';
import { activeDataSource } from '@/lib/data-sources';
import { getCachedCount, saveCachedCount } from '@/lib/cache';

// GET /api/tweet-count?start=<timestamp>
// Strategy: API first, cache fallback
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || searchParams.get('t');
    const end = searchParams.get('end');

    if (!start) {
        return NextResponse.json({ error: 'Missing start parameter' }, { status: 400 });
    }

    const periodStartTimestamp = parseInt(start);
    const periodEndTimestamp = end ? parseInt(end) : undefined;

    try {
        // Step 1: Try fetching from API
        const result = await activeDataSource.getTweetCount(periodStartTimestamp, periodEndTimestamp);

        // Step 2: If API returned valid data, save to cache
        if (result.count > 0) {
            console.log('[API] Got count from API:', result.count);
            await saveCachedCount(periodStartTimestamp, result.count);
            return NextResponse.json(result);
        }

        // Step 3: API returned 0, try cache fallback
        console.log('[API] API returned 0, trying cache...');
        const cached = await getCachedCount(periodStartTimestamp);
        if (cached && cached.count > 0) {
            console.log('[API] Using cached count:', cached.count);
            return NextResponse.json({ count: cached.count, fromCache: true });
        }

        // No cache available, return API result (0)
        return NextResponse.json(result);

    } catch (error) {
        console.error('[API] tweet-count error:', error);

        // Step 4: On API error, try cache fallback
        const cached = await getCachedCount(periodStartTimestamp);
        if (cached && cached.count > 0) {
            console.log('[API] API failed, using cached count:', cached.count);
            return NextResponse.json({ count: cached.count, fromCache: true });
        }

        return NextResponse.json(
            { error: 'Failed to fetch tweet count', count: 0 },
            { status: 500 }
        );
    }
}
