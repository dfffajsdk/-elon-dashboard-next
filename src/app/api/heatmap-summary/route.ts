import { NextResponse } from 'next/server';
import { getHeatmapSummary } from '@/lib/cache';

// GET /api/heatmap-summary
// Returns daily summaries of tweet activity from cached heatmap data
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start') || undefined;
    const endDate = searchParams.get('end') || undefined;

    try {
        const summary = await getHeatmapSummary(startDate, endDate);

        // Calculate some overall stats
        const totalDays = summary.length;
        const totalTweets = summary.reduce((sum, d) => sum + d.totalTweets, 0);
        const totalReplies = summary.reduce((sum, d) => sum + d.totalReplies, 0);
        const avgPerDay = totalDays > 0 ? Math.round((totalTweets + totalReplies) / totalDays) : 0;

        // Find most active day
        const mostActiveDay = summary.reduce((max, d) =>
            (d.totalTweets + d.totalReplies) > (max?.totalTweets + max?.totalReplies || 0) ? d : max
            , summary[0]);

        console.log('[API] Heatmap summary:', totalDays, 'days,', totalTweets, 'tweets');

        return NextResponse.json({
            success: true,
            summary: {
                totalDays,
                totalTweets,
                totalReplies,
                avgPerDay,
                mostActiveDay: mostActiveDay ? {
                    date: mostActiveDay.date,
                    count: mostActiveDay.totalTweets + mostActiveDay.totalReplies,
                    peakHour: mostActiveDay.peakHour
                } : null,
                dateRange: summary.length > 0 ? {
                    start: summary[summary.length - 1].dateNormalized,
                    end: summary[0].dateNormalized
                } : null
            },
            days: summary
        });
    } catch (error) {
        console.error('[API] heatmap-summary error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get heatmap summary' },
            { status: 500 }
        );
    }
}
