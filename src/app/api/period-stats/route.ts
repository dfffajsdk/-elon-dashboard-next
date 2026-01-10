import { NextResponse } from 'next/server';
import { getAllPeriodStats } from '@/lib/cache';

// GET /api/period-stats
// Returns statistics for all periods based on cached data
export async function GET() {
    try {
        const stats = await getAllPeriodStats();

        console.log('[API] Period stats:', stats.map(s => `${s.label}: ${s.count}`).join(', '));

        return NextResponse.json({
            success: true,
            periods: stats
        });
    } catch (error) {
        console.error('[API] period-stats error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get period stats', periods: [] },
            { status: 500 }
        );
    }
}
