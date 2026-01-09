import { NextResponse } from 'next/server';
import { activeDataSource } from '@/lib/data-sources';

// GET /api/tweet-count?start=<timestamp>
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start') || searchParams.get('t');

        if (!start) {
            return NextResponse.json({ error: 'Missing start parameter' }, { status: 400 });
        }

        const periodStartTimestamp = parseInt(start);
        const result = await activeDataSource.getTweetCount(periodStartTimestamp);

        return NextResponse.json(result);
    } catch (error) {
        console.error('[API] tweet-count error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tweet count', message: (error as Error).message },
            { status: 500 }
        );
    }
}
