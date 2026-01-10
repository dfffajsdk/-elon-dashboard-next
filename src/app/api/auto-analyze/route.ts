import { NextResponse } from 'next/server';
import { getClient } from '@/lib/cache';

/**
 * POST /api/auto-analyze
 * 
 * Automatically analyzes newly completed periods and stores results.
 * Called on page load or via cron to keep data up-to-date.
 * 
 * Logic:
 * 1. Get all period definitions
 * 2. Check which periods have ended
 * 3. Check which ended periods are NOT in cached_counts
 * 4. Analyze and store missing periods
 */

interface Period {
    label: string;
    startDate: string;  // YYYY-MM-DD
    endDate: string;    // YYYY-MM-DD
}

// All period definitions (12pm ET to 12pm ET)
const ALL_PERIODS: Period[] = [
    { label: 'Jan 16', startDate: '2026-01-09', endDate: '2026-01-16' },
    { label: 'Jan 13', startDate: '2026-01-06', endDate: '2026-01-13' },
    { label: 'Jan 9', startDate: '2026-01-02', endDate: '2026-01-09' },
    { label: 'Jan 2', startDate: '2025-12-26', endDate: '2026-01-02' },
    { label: 'Dec 26', startDate: '2025-12-19', endDate: '2025-12-26' },
    { label: 'Dec 19', startDate: '2025-12-12', endDate: '2025-12-19' },
    { label: 'Dec 12', startDate: '2025-12-05', endDate: '2025-12-12' },
    { label: 'Dec 5', startDate: '2025-11-28', endDate: '2025-12-05' },
    { label: 'Nov 28', startDate: '2025-11-21', endDate: '2025-11-28' },
];

function toET12pmTimestamp(dateStr: string): number {
    return Math.floor(new Date(`${dateStr}T12:00:00-05:00`).getTime() / 1000);
}

export async function POST() {
    const client = getClient();
    if (!client) {
        return NextResponse.json({ success: false, error: 'Database not configured' });
    }

    try {
        const now = new Date();

        // 1. Find periods that have ended
        const endedPeriods = ALL_PERIODS.filter(p =>
            new Date(`${p.endDate}T12:00:00-05:00`) <= now
        );

        // 2. Get existing cached_counts
        const { data: existingCounts } = await client
            .from('cached_counts')
            .select('period_start');

        const existingStarts = new Set((existingCounts || []).map(r => r.period_start));

        // 3. Find periods that are ended but NOT in cached_counts
        const missingPeriods = endedPeriods.filter(p => {
            const startTs = toET12pmTimestamp(p.startDate);
            return !existingStarts.has(startTs);
        });

        if (missingPeriods.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'All periods are up to date',
                analyzed: 0
            });
        }

        console.log(`[AutoAnalyze] Found ${missingPeriods.length} new periods to analyze`);

        // 4. Fetch heatmap data for analysis
        const { data: heatmapData } = await client
            .from('cached_heatmap')
            .select('*')
            .order('date_normalized', { ascending: true });

        if (!heatmapData || heatmapData.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No heatmap data available'
            });
        }

        // Group heatmap by date with hourly data
        const dailyData = new Map<string, { tweets: number; replies: number; hourlyTweets: number[]; hourlyReplies: number[] }>();

        for (const row of heatmapData) {
            const date = row.date_normalized;
            const hour = parseInt(row.hour.split(':')[0]);

            if (!dailyData.has(date)) {
                dailyData.set(date, {
                    tweets: 0,
                    replies: 0,
                    hourlyTweets: new Array(24).fill(0),
                    hourlyReplies: new Array(24).fill(0)
                });
            }

            const day = dailyData.get(date)!;
            day.tweets += row.tweet_count || 0;
            day.replies += row.reply_count || 0;
            day.hourlyTweets[hour] += row.tweet_count || 0;
            day.hourlyReplies[hour] += row.reply_count || 0;
        }

        // 5. Analyze each missing period
        const results = [];

        for (const period of missingPeriods) {
            let tweets = 0;
            let replies = 0;

            const startD = new Date(period.startDate);
            const endD = new Date(period.endDate);

            for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                const dayData = dailyData.get(dateStr);

                if (!dayData) continue;

                if (dateStr === period.startDate) {
                    // First day: only 12:00-23:00
                    for (let h = 12; h < 24; h++) {
                        tweets += dayData.hourlyTweets[h];
                        replies += dayData.hourlyReplies[h];
                    }
                } else if (dateStr === period.endDate) {
                    // Last day: only 00:00-11:00
                    for (let h = 0; h < 12; h++) {
                        tweets += dayData.hourlyTweets[h];
                        replies += dayData.hourlyReplies[h];
                    }
                } else {
                    // Middle days: all 24 hours
                    tweets += dayData.tweets;
                    replies += dayData.replies;
                }
            }

            // Save to cached_counts
            const startTs = toET12pmTimestamp(period.startDate);

            const { error } = await client
                .from('cached_counts')
                .upsert({
                    period_start: startTs,
                    count: tweets,
                    mt_count: tweets + replies,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'period_start' });

            if (error) {
                console.error(`[AutoAnalyze] Failed to save ${period.label}:`, error);
            } else {
                console.log(`[AutoAnalyze] Saved ${period.label}: ${tweets} tweets, ${replies} replies`);
                results.push({
                    label: period.label,
                    nonReplyCount: tweets,
                    replyCount: replies,
                    totalCount: tweets + replies
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Analyzed ${results.length} new periods`,
            analyzed: results.length,
            periods: results
        });

    } catch (error) {
        console.error('[AutoAnalyze] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Analysis failed'
        }, { status: 500 });
    }
}

// Also support GET for easy testing
export async function GET() {
    return POST();
}
