import { NextResponse } from 'next/server';
import { getHeatmapSummary } from '@/lib/cache';

/**
 * POST /api/ai-query
 * Direct database query for AI to get precise tweet counts for any date range.
 * This ensures the AI gets accurate data without relying on pre-loaded context.
 * 
 * Body: { startDate: "2025-12-26", endDate: "2026-01-02" }
 * Response: { success: true, data: { totalTweets, totalReplies, dailyBreakdown } }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { startDate, endDate } = body;

        if (!startDate || !endDate) {
            return NextResponse.json({
                success: false,
                error: 'startDate and endDate are required'
            }, { status: 400 });
        }

        console.log(`[AI-Query] Querying database for ${startDate} to ${endDate}`);

        // Query database directly with date range
        const summary = await getHeatmapSummary(startDate, endDate);

        // Calculate totals
        const totalTweets = summary.reduce((sum, d) => sum + d.totalTweets, 0);
        const totalReplies = summary.reduce((sum, d) => sum + d.totalReplies, 0);
        const totalAll = totalTweets + totalReplies;

        // Build daily breakdown
        const dailyBreakdown = summary.map(d => ({
            date: d.dateNormalized,
            tweets: d.totalTweets,
            replies: d.totalReplies,
            total: d.totalTweets + d.totalReplies
        }));

        console.log(`[AI-Query] Found ${summary.length} days, ${totalTweets} tweets, ${totalReplies} replies`);

        return NextResponse.json({
            success: true,
            query: { startDate, endDate },
            data: {
                daysCount: summary.length,
                totalTweets,      // Non-reply tweets only
                totalReplies,     // Reply tweets only
                totalAll,         // Combined total
                dailyBreakdown
            }
        });
    } catch (error) {
        console.error('[AI-Query] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Database query failed'
        }, { status: 500 });
    }
}

// Also support GET for easy testing
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    if (!startDate || !endDate) {
        return NextResponse.json({
            success: false,
            error: 'start and end query params are required',
            usage: '/api/ai-query?start=2025-12-26&end=2026-01-02'
        }, { status: 400 });
    }

    // Reuse POST logic
    const fakeRequest = new Request(request.url, {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate })
    });

    return POST(fakeRequest);
}
