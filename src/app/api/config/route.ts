import { NextResponse } from 'next/server';
import { activeDataSource } from '@/lib/data-sources';

// GET /api/config
export async function GET() {
    try {
        const config = await activeDataSource.getConfig();
        return NextResponse.json(config);
    } catch (error) {
        console.error('[API] config error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch config', message: (error as Error).message },
            { status: 500 }
        );
    }
}
