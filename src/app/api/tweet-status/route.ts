import { NextResponse } from 'next/server';
import { activeDataSource } from '@/lib/data-sources';

// GET /api/tweet-status
export async function GET() {
    try {
        const status = await activeDataSource.getTweetStatus();
        return NextResponse.json(status);
    } catch (error) {
        console.error('[API] tweet-status error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tweet status', message: (error as Error).message },
            { status: 500 }
        );
    }
}
