import { NextResponse } from 'next/server';
import { activeDataSource } from '@/lib/data-sources';
import { getCachedHeatmapData, saveCachedHeatmapData } from '@/lib/cache';

// Revalidate every 60 seconds
export const revalidate = 60;

// GET /api/tweet-status
export async function GET() {
    try {
        const status = await activeDataSource.getTweetStatus() as any;

        // If API returns empty or invalid structure, try cache
        if (!status?.posts || status.posts.length === 0) {
            console.log('[API] External source returned empty heatmap, using cache');
            const cached = await getCachedHeatmapData();
            return NextResponse.json(cached);
        }

        // Save live data to cache asynchronously (fire and forget)
        console.log('[API] Got live heatmap, saving to cache...');
        saveCachedHeatmapData(status).catch(err => console.error('[API] Failed to save heatmap cache:', err));

        return NextResponse.json(status);
    } catch (error) {
        console.error('[API] tweet-status error:', error);

        // Try cache on error
        console.log('[API] External source failed, using cache for heatmap');
        const cached = await getCachedHeatmapData();

        if (cached?.data?.posts?.length > 0) {
            return NextResponse.json(cached);
        }

        return NextResponse.json(
            { error: 'Failed to fetch tweet status', message: (error as Error).message },
            { status: 500 }
        );
    }
}
