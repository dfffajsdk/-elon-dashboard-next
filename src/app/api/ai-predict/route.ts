import { NextResponse } from 'next/server';
import { generatePredictionContext, fetchDailyStats, analyzeTrend, analyzeWeekdayPattern } from '@/lib/prediction';

/**
 * GET /api/ai-predict
 * 
 * Returns comprehensive prediction data for AI to use:
 * - Period end prediction with confidence
 * - Trend analysis (7-day vs 30-day)
 * - Weekday/weekend patterns
 * - Next 6 hours forecast
 * 
 * Query params:
 *   currentTweets: number (required)
 *   periodStart: ISO date string (required)
 *   periodEnd: ISO date string (required)
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const currentTweets = parseInt(searchParams.get('currentTweets') || '0');
        const periodStartStr = searchParams.get('periodStart');
        const periodEndStr = searchParams.get('periodEnd');

        if (!periodStartStr || !periodEndStr) {
            // Return general patterns without prediction
            const dailyStats = await fetchDailyStats(60);
            const trend = analyzeTrend(dailyStats);
            const patterns = analyzeWeekdayPattern(dailyStats);

            return NextResponse.json({
                success: true,
                mode: 'patterns_only',
                trend,
                patterns,
                message: 'To get full prediction, provide currentTweets, periodStart, and periodEnd params'
            });
        }

        const periodStart = new Date(periodStartStr);
        const periodEnd = new Date(periodEndStr);

        if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
            return NextResponse.json({
                success: false,
                error: 'Invalid date format'
            }, { status: 400 });
        }

        console.log(`[AI-Predict] Generating prediction for ${currentTweets} tweets, period ${periodStartStr} to ${periodEndStr}`);

        const context = await generatePredictionContext({
            currentTweets,
            periodStart,
            periodEnd
        });

        if (!context) {
            return NextResponse.json({
                success: false,
                error: 'Failed to generate prediction context'
            }, { status: 500 });
        }

        console.log(`[AI-Predict] Prediction: ${context.prediction.predicted} (${context.prediction.confidence})`);

        return NextResponse.json({
            success: true,
            ...context
        });

    } catch (error) {
        console.error('[AI-Predict] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Prediction failed'
        }, { status: 500 });
    }
}
