/**
 * Prediction Library
 * Provides sophisticated prediction and pattern analysis for tweet activity
 */

import { getClient } from './cache';

// ============= TYPES =============

export interface DayStats {
    date: string;           // YYYY-MM-DD
    dayOfWeek: number;      // 0=Sunday, 6=Saturday
    totalTweets: number;
    totalReplies: number;
    isWeekend: boolean;
}

export interface HourlyPattern {
    hour: number;           // 0-23
    avgTweets: number;
    avgReplies: number;
}

export interface TrendAnalysis {
    direction: 'up' | 'down' | 'stable';
    sevenDayAvg: number;
    thirtyDayAvg: number;
    changePercent: number;
}

export interface WeekdayPattern {
    weekdayAvg: number;     // Mon-Fri average
    weekendAvg: number;     // Sat-Sun average
    dayAverages: number[];  // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
}

export interface PredictionResult {
    predicted: number;
    confidence: 'high' | 'medium' | 'low';
    range: { min: number; max: number };
    reasoning: string[];
}

export interface FullPredictionContext {
    prediction: PredictionResult;
    patterns: WeekdayPattern;
    trend: TrendAnalysis;
    hourlyPattern: HourlyPattern[];
    nextSixHours: { hour: string; predicted: number }[];
}

// ============= DATA FETCHING =============

/**
 * Fetch daily stats from cached_heatmap for analysis
 */
export async function fetchDailyStats(days: number = 60): Promise<DayStats[]> {
    const client = getClient();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from('cached_heatmap')
            .select('date_normalized, tweet_count, reply_count')
            .order('date_normalized', { ascending: false });

        if (error || !data) return [];

        // Group by date
        const dateMap = new Map<string, { tweets: number; replies: number }>();

        for (const row of data) {
            const dateStr = row.date_normalized;
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, { tweets: 0, replies: 0 });
            }
            const entry = dateMap.get(dateStr)!;
            entry.tweets += row.tweet_count || 0;
            entry.replies += row.reply_count || 0;
        }

        // Convert to DayStats array
        const stats: DayStats[] = [];
        dateMap.forEach((value, dateStr) => {
            const date = new Date(dateStr);
            const dayOfWeek = date.getDay();
            stats.push({
                date: dateStr,
                dayOfWeek,
                totalTweets: value.tweets,
                totalReplies: value.replies,
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6
            });
        });

        // Sort by date descending and limit
        return stats
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, days);

    } catch (e) {
        console.error('[Prediction] fetchDailyStats error:', e);
        return [];
    }
}

/**
 * Fetch hourly patterns from cached_heatmap
 */
export async function fetchHourlyPatterns(): Promise<HourlyPattern[]> {
    const client = getClient();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from('cached_heatmap')
            .select('hour, tweet_count, reply_count');

        if (error || !data) return [];

        // Aggregate by hour
        const hourMap = new Map<number, { tweets: number[]; replies: number[] }>();

        for (let h = 0; h < 24; h++) {
            hourMap.set(h, { tweets: [], replies: [] });
        }

        for (const row of data) {
            const hourStr = row.hour; // e.g., "13:00"
            const hour = parseInt(hourStr.split(':')[0]);
            if (!isNaN(hour) && hourMap.has(hour)) {
                hourMap.get(hour)!.tweets.push(row.tweet_count || 0);
                hourMap.get(hour)!.replies.push(row.reply_count || 0);
            }
        }

        // Calculate averages
        const patterns: HourlyPattern[] = [];
        hourMap.forEach((value, hour) => {
            const avgTweets = value.tweets.length > 0
                ? value.tweets.reduce((a, b) => a + b, 0) / value.tweets.length
                : 0;
            const avgReplies = value.replies.length > 0
                ? value.replies.reduce((a, b) => a + b, 0) / value.replies.length
                : 0;
            patterns.push({ hour, avgTweets, avgReplies });
        });

        return patterns.sort((a, b) => a.hour - b.hour);

    } catch (e) {
        console.error('[Prediction] fetchHourlyPatterns error:', e);
        return [];
    }
}

// ============= ANALYSIS FUNCTIONS =============

/**
 * Analyze trend: Compare 7-day average vs 30-day average
 */
export function analyzeTrend(dailyStats: DayStats[]): TrendAnalysis {
    if (dailyStats.length < 7) {
        return { direction: 'stable', sevenDayAvg: 0, thirtyDayAvg: 0, changePercent: 0 };
    }

    const last7 = dailyStats.slice(0, 7);
    const last30 = dailyStats.slice(0, Math.min(30, dailyStats.length));

    const sevenDayTotal = last7.reduce((sum, d) => sum + d.totalTweets + d.totalReplies, 0);
    const thirtyDayTotal = last30.reduce((sum, d) => sum + d.totalTweets + d.totalReplies, 0);

    const sevenDayAvg = Math.round(sevenDayTotal / last7.length);
    const thirtyDayAvg = Math.round(thirtyDayTotal / last30.length);

    const changePercent = thirtyDayAvg > 0
        ? Math.round((sevenDayAvg - thirtyDayAvg) / thirtyDayAvg * 100)
        : 0;

    let direction: 'up' | 'down' | 'stable';
    if (changePercent > 10) direction = 'up';
    else if (changePercent < -10) direction = 'down';
    else direction = 'stable';

    return { direction, sevenDayAvg, thirtyDayAvg, changePercent };
}

/**
 * Analyze weekday/weekend patterns
 */
export function analyzeWeekdayPattern(dailyStats: DayStats[]): WeekdayPattern {
    // Group by day of week
    const dayGroups: number[][] = [[], [], [], [], [], [], []]; // Sun-Sat

    for (const day of dailyStats) {
        dayGroups[day.dayOfWeek].push(day.totalTweets + day.totalReplies);
    }

    const dayAverages = dayGroups.map(group =>
        group.length > 0 ? Math.round(group.reduce((a, b) => a + b, 0) / group.length) : 0
    );

    // Weekday (Mon-Fri) = index 1-5
    const weekdayData = [...dayGroups[1], ...dayGroups[2], ...dayGroups[3], ...dayGroups[4], ...dayGroups[5]];
    // Weekend (Sat-Sun) = index 0, 6
    const weekendData = [...dayGroups[0], ...dayGroups[6]];

    const weekdayAvg = weekdayData.length > 0
        ? Math.round(weekdayData.reduce((a, b) => a + b, 0) / weekdayData.length)
        : 0;
    const weekendAvg = weekendData.length > 0
        ? Math.round(weekendData.reduce((a, b) => a + b, 0) / weekendData.length)
        : 0;

    return { weekdayAvg, weekendAvg, dayAverages };
}

/**
 * Predict remaining tweets for current period
 */
export function predictRemainingTweets(params: {
    currentTweets: number;
    elapsedHours: number;
    remainingHours: number;
    weekdayPattern: WeekdayPattern;
    trend: TrendAnalysis;
    currentDayOfWeek: number;
}): PredictionResult {
    const { currentTweets, elapsedHours, remainingHours, weekdayPattern, trend, currentDayOfWeek } = params;

    // Base prediction: current rate extrapolation
    const currentRate = elapsedHours > 0 ? currentTweets / elapsedHours : 0;
    const baseExtrapolation = currentTweets + currentRate * remainingHours;

    // Adjust for weekday/weekend pattern
    const isWeekend = currentDayOfWeek === 0 || currentDayOfWeek === 6;
    const expectedDailyRate = isWeekend ? weekdayPattern.weekendAvg : weekdayPattern.weekdayAvg;

    // Calculate how many full days remain
    const daysRemaining = remainingHours / 24;

    // Pattern-based prediction
    const patternPrediction = currentTweets + expectedDailyRate * daysRemaining;

    // Blend the two predictions (60% current rate, 40% historical pattern)
    let predicted = Math.round(baseExtrapolation * 0.6 + patternPrediction * 0.4);

    // Apply trend adjustment
    if (trend.direction === 'up') {
        predicted = Math.round(predicted * 1.05);
    } else if (trend.direction === 'down') {
        predicted = Math.round(predicted * 0.95);
    }

    // Calculate confidence and range
    let confidence: 'high' | 'medium' | 'low';
    let rangePercent: number;

    if (elapsedHours > 48 && Math.abs(trend.changePercent) < 10) {
        confidence = 'high';
        rangePercent = 0.1;
    } else if (elapsedHours > 24) {
        confidence = 'medium';
        rangePercent = 0.15;
    } else {
        confidence = 'low';
        rangePercent = 0.25;
    }

    const range = {
        min: Math.round(predicted * (1 - rangePercent)),
        max: Math.round(predicted * (1 + rangePercent))
    };

    // Build reasoning
    const reasoning: string[] = [];
    reasoning.push(`当前节奏: ${currentRate.toFixed(1)}条/小时`);
    if (isWeekend) {
        reasoning.push(`周末模式: 平均${weekdayPattern.weekendAvg}条/天`);
    } else {
        reasoning.push(`工作日模式: 平均${weekdayPattern.weekdayAvg}条/天`);
    }
    if (trend.direction !== 'stable') {
        reasoning.push(`近期趋势: ${trend.direction === 'up' ? '上升' : '下降'}${Math.abs(trend.changePercent)}%`);
    }

    return { predicted, confidence, range, reasoning };
}

/**
 * Predict next 6 hours of activity
 */
export function predictNextSixHours(
    hourlyPattern: HourlyPattern[],
    currentHour: number
): { hour: string; predicted: number }[] {
    const result: { hour: string; predicted: number }[] = [];

    for (let i = 1; i <= 6; i++) {
        const targetHour = (currentHour + i) % 24;
        const pattern = hourlyPattern.find(p => p.hour === targetHour);
        const predicted = pattern ? Math.round(pattern.avgTweets + pattern.avgReplies) : 0;
        result.push({
            hour: `${String(targetHour).padStart(2, '0')}:00 ET`,
            predicted
        });
    }

    return result;
}

// ============= MAIN PREDICTION FUNCTION =============

/**
 * Generate full prediction context for AI
 */
export async function generatePredictionContext(params: {
    currentTweets: number;
    periodStart: Date;
    periodEnd: Date;
}): Promise<FullPredictionContext | null> {
    try {
        const now = new Date();
        const elapsedMs = now.getTime() - params.periodStart.getTime();
        const remainingMs = Math.max(0, params.periodEnd.getTime() - now.getTime());
        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        const remainingHours = remainingMs / (1000 * 60 * 60);

        // Fetch data
        const dailyStats = await fetchDailyStats(60);
        const hourlyPattern = await fetchHourlyPatterns();

        if (dailyStats.length === 0) {
            console.warn('[Prediction] No daily stats available');
            return null;
        }

        // Analyze patterns
        const trend = analyzeTrend(dailyStats);
        const patterns = analyzeWeekdayPattern(dailyStats);

        // Get current hour in ET
        const currentHourET = parseInt(now.toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            hour12: false
        }));

        // Generate predictions
        const currentDayOfWeek = now.getDay();
        const prediction = predictRemainingTweets({
            currentTweets: params.currentTweets,
            elapsedHours,
            remainingHours,
            weekdayPattern: patterns,
            trend,
            currentDayOfWeek
        });

        const nextSixHours = predictNextSixHours(hourlyPattern, currentHourET);

        return {
            prediction,
            patterns,
            trend,
            hourlyPattern,
            nextSixHours
        };

    } catch (e) {
        console.error('[Prediction] generatePredictionContext error:', e);
        return null;
    }
}
