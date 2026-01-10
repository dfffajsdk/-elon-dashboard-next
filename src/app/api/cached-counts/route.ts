import { NextResponse } from 'next/server';
import { getClient } from '@/lib/cache';

/**
 * GET /api/cached-counts
 * Returns all cached period counts for AI context
 * 
 * Response: { success: boolean, periods: [...] }
 */
export async function GET() {
    try {
        const client = getClient();
        if (!client) {
            return NextResponse.json({
                success: false,
                error: 'Database not configured',
                periods: []
            });
        }

        const { data, error } = await client
            .from('cached_counts')
            .select('*')
            .order('period_start', { ascending: false });

        if (error) {
            console.error('[API] cached-counts error:', error);
            return NextResponse.json({
                success: false,
                error: error.message,
                periods: []
            });
        }

        // Format the data for AI consumption
        const periods = (data || []).map(row => {
            const startDate = new Date(row.period_start * 1000);
            const endDate = new Date((row.period_start + 7 * 24 * 60 * 60) * 1000);

            return {
                periodStart: row.period_start,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                nonReplyCount: row.count,
                totalCount: row.mt_count,
                replyCount: (row.mt_count || 0) - (row.count || 0),
                updatedAt: row.updated_at
            };
        });

        console.log(`[API] cached-counts: Found ${periods.length} periods`);

        return NextResponse.json({
            success: true,
            periods
        });
    } catch (error) {
        console.error('[API] cached-counts exception:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch cached counts',
            periods: []
        }, { status: 500 });
    }
}
