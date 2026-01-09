import { NextResponse } from 'next/server';
import { activeDataSource } from '@/lib/data-sources';

// GET /api/tweets?limit=<number>
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '100');

        const tweets = await activeDataSource.getTweets(limit);

        return NextResponse.json({ tweets });
    } catch (error) {
        console.error('[API] tweets error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tweets', message: (error as Error).message },
            { status: 500 }
        );
    }
}
