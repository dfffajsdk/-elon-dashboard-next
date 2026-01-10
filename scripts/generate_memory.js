/**
 * Generate Historical Memory Documents
 * 
 * This script:
 * 1. Reads historical data from cached_heatmap
 * 2. Generates weekly summaries
 * 3. Identifies patterns and insights
 * 4. Stores them in memory_documents for AI RAG
 * 5. Updates cached_counts with period statistics
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

// Simple embedding function (placeholder - in production use real embeddings)
function generateSimpleEmbedding(text) {
    // Create a simple hash-based "embedding" for demo purposes
    // In production, you'd call an actual embedding API
    const embedding = new Array(1024).fill(0);
    for (let i = 0; i < text.length; i++) {
        embedding[i % 1024] += text.charCodeAt(i) / 1000;
    }
    return embedding;
}

async function fetchHeatmapData() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cached_heatmap?select=*&order=date_normalized.asc`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });
    return response.json();
}

async function storeMemoryDocument(doc) {
    const embedding = generateSimpleEmbedding(doc.content);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/memory_documents`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
            type: doc.type,
            content: doc.content,
            embedding: embedding,
            metadata: doc.metadata || {}
        })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('Store error:', err);
        return false;
    }
    return true;
}

async function updateCachedCount(periodStart, count, mtCount = 0) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cached_counts?on_conflict=period_start`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
            period_start: periodStart,
            count: count,
            mt_count: mtCount
        })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('Cached count error:', err);
        return false;
    }
    return true;
}

async function main() {
    console.log('📊 Fetching historical heatmap data...');
    const rawData = await fetchHeatmapData();
    console.log(`Found ${rawData.length} hourly records`);

    // Group by date
    const dateMap = new Map();
    for (const row of rawData) {
        const date = row.date_normalized;
        if (!dateMap.has(date)) {
            dateMap.set(date, { tweets: 0, replies: 0, hours: [] });
        }
        const entry = dateMap.get(date);
        entry.tweets += row.tweet_count || 0;
        entry.replies += row.reply_count || 0;
        entry.hours.push({ hour: row.hour, tweets: row.tweet_count, replies: row.reply_count });
    }

    const dailyStats = Array.from(dateMap.entries())
        .map(([date, data]) => ({
            date,
            dayOfWeek: new Date(date).getDay(),
            ...data
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    console.log(`Processed ${dailyStats.length} days of data`);

    // ========== 1. Generate Weekly Summaries ==========
    console.log('\n📅 Generating weekly summaries...');

    // Group by week
    const weeks = [];
    let currentWeek = [];
    let currentWeekStart = null;

    for (const day of dailyStats) {
        if (currentWeekStart === null) {
            currentWeekStart = day.date;
        }
        currentWeek.push(day);

        // Week ends on Saturday (day 6) or if it's the last day
        if (day.dayOfWeek === 6 || day === dailyStats[dailyStats.length - 1]) {
            if (currentWeek.length > 0) {
                const totalTweets = currentWeek.reduce((sum, d) => sum + d.tweets, 0);
                const totalReplies = currentWeek.reduce((sum, d) => sum + d.replies, 0);
                const avgPerDay = Math.round((totalTweets + totalReplies) / currentWeek.length);
                const peakDay = currentWeek.reduce((max, d) =>
                    (d.tweets + d.replies) > (max.tweets + max.replies) ? d : max, currentWeek[0]);
                const lowDay = currentWeek.reduce((min, d) =>
                    (d.tweets + d.replies) < (min.tweets + min.replies) ? d : min, currentWeek[0]);

                weeks.push({
                    startDate: currentWeekStart,
                    endDate: day.date,
                    days: currentWeek.length,
                    totalTweets,
                    totalReplies,
                    avgPerDay,
                    peakDay: { date: peakDay.date, count: peakDay.tweets + peakDay.replies },
                    lowDay: { date: lowDay.date, count: lowDay.tweets + lowDay.replies }
                });
            }
            currentWeek = [];
            currentWeekStart = null;
        }
    }

    // Store weekly summaries
    for (const week of weeks) {
        const content = `周报 (${week.startDate} ~ ${week.endDate}): 共${week.days}天，总推文${week.totalTweets}条，回复${week.totalReplies}条，日均${week.avgPerDay}条。高峰日: ${week.peakDay.date}(${week.peakDay.count}条)，低谷日: ${week.lowDay.date}(${week.lowDay.count}条)。`;

        const success = await storeMemoryDocument({
            type: 'period_summary',
            content,
            metadata: {
                startDate: week.startDate,
                endDate: week.endDate,
                totalTweets: week.totalTweets,
                totalReplies: week.totalReplies
            }
        });

        if (success) {
            console.log(`  ✅ Stored summary for ${week.startDate} ~ ${week.endDate}`);
        }
    }

    // ========== 2. Generate Pattern Insights ==========
    console.log('\n🔍 Analyzing patterns...');

    // Weekday vs Weekend pattern
    const weekdayData = dailyStats.filter(d => d.dayOfWeek >= 1 && d.dayOfWeek <= 5);
    const weekendData = dailyStats.filter(d => d.dayOfWeek === 0 || d.dayOfWeek === 6);

    const weekdayAvg = weekdayData.length > 0
        ? Math.round(weekdayData.reduce((sum, d) => sum + d.tweets + d.replies, 0) / weekdayData.length)
        : 0;
    const weekendAvg = weekendData.length > 0
        ? Math.round(weekendData.reduce((sum, d) => sum + d.tweets + d.replies, 0) / weekendData.length)
        : 0;

    const weekdayPattern = `发现规律: 工作日(周一至周五)平均每天${weekdayAvg}条推文，周末平均${weekendAvg}条。${weekdayAvg > weekendAvg ? '工作日比周末活跃' : '周末比工作日活跃'}，差异约${Math.abs(weekdayAvg - weekendAvg)}条/天 (${Math.round(Math.abs(weekdayAvg - weekendAvg) / Math.max(weekdayAvg, weekendAvg) * 100)}%)。`;

    await storeMemoryDocument({
        type: 'tweet_pattern',
        content: weekdayPattern,
        metadata: { patternType: 'weekday_vs_weekend', weekdayAvg, weekendAvg }
    });
    console.log('  ✅ Stored weekday/weekend pattern');

    // Day-of-week pattern
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayAverages = [];
    for (let dow = 0; dow < 7; dow++) {
        const daysOfWeek = dailyStats.filter(d => d.dayOfWeek === dow);
        const avg = daysOfWeek.length > 0
            ? Math.round(daysOfWeek.reduce((sum, d) => sum + d.tweets + d.replies, 0) / daysOfWeek.length)
            : 0;
        dayAverages.push({ day: dayNames[dow], avg });
    }

    const peakDayOfWeek = dayAverages.reduce((max, d) => d.avg > max.avg ? d : max, dayAverages[0]);
    const lowDayOfWeek = dayAverages.reduce((min, d) => d.avg < min.avg ? d : min, dayAverages[0]);

    const dayOfWeekPattern = `每周规律: ${dayAverages.map(d => `${d.day}=${d.avg}`).join(', ')}。最活跃: ${peakDayOfWeek.day}(${peakDayOfWeek.avg}条)，最安静: ${lowDayOfWeek.day}(${lowDayOfWeek.avg}条)。`;

    await storeMemoryDocument({
        type: 'tweet_pattern',
        content: dayOfWeekPattern,
        metadata: { patternType: 'day_of_week', dayAverages }
    });
    console.log('  ✅ Stored day-of-week pattern');

    // Hourly pattern (aggregate across all days)
    const hourlyTotals = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    for (const day of dailyStats) {
        for (const h of day.hours) {
            const hour = parseInt(h.hour.split(':')[0]);
            hourlyTotals[hour] += (h.tweets || 0) + (h.replies || 0);
            hourlyCounts[hour]++;
        }
    }

    const hourlyAvg = hourlyTotals.map((total, i) => ({
        hour: i,
        avg: hourlyCounts[i] > 0 ? Math.round(total / hourlyCounts[i] * 10) / 10 : 0
    }));

    const peakHours = hourlyAvg.sort((a, b) => b.avg - a.avg).slice(0, 3);
    const quietHours = hourlyAvg.sort((a, b) => a.avg - b.avg).slice(0, 3);

    const hourlyPattern = `每日小时规律 (ET时区): 高峰时段 ${peakHours.map(h => `${h.hour}:00(${h.avg}条)`).join(', ')}。低迷时段 ${quietHours.map(h => `${h.hour}:00(${h.avg}条)`).join(', ')}。`;

    await storeMemoryDocument({
        type: 'tweet_pattern',
        content: hourlyPattern,
        metadata: { patternType: 'hourly', peakHours: peakHours.map(h => h.hour), quietHours: quietHours.map(h => h.hour) }
    });
    console.log('  ✅ Stored hourly pattern');

    // ========== 3. Update Cached Counts ==========
    console.log('\n📈 Updating cached_counts...');

    // Period configs (same as in cache/index.ts)
    const PERIOD_CONFIGS = [
        { id: 'jan2', label: 'Jan 2', startDate: '2025-12-26T12:00:00-05:00', endDate: '2026-01-02T12:00:00-05:00' },
        { id: 'jan9', label: 'Jan 9', startDate: '2026-01-02T12:00:00-05:00', endDate: '2026-01-09T12:00:00-05:00' },
        { id: 'jan13', label: 'Jan 13', startDate: '2026-01-06T12:00:00-05:00', endDate: '2026-01-13T12:00:00-05:00' },
        { id: 'jan16', label: 'Jan 16', startDate: '2026-01-09T12:00:00-05:00', endDate: '2026-01-16T12:00:00-05:00' },
    ];

    for (const config of PERIOD_CONFIGS) {
        const startTs = Math.floor(new Date(config.startDate).getTime() / 1000);
        const endTs = Math.floor(new Date(config.endDate).getTime() / 1000);
        const startDateStr = new Date(config.startDate).toISOString().split('T')[0];
        const endDateStr = new Date(config.endDate).toISOString().split('T')[0];

        // Count tweets in this period from daily stats
        const periodDays = dailyStats.filter(d => d.date >= startDateStr && d.date < endDateStr);
        const totalTweets = periodDays.reduce((sum, d) => sum + d.tweets, 0);
        const totalReplies = periodDays.reduce((sum, d) => sum + d.replies, 0);

        if (totalTweets + totalReplies > 0) {
            const success = await updateCachedCount(startTs, totalTweets, totalTweets + totalReplies);
            if (success) {
                console.log(`  ✅ ${config.label}: ${totalTweets} tweets, ${totalReplies} replies (total: ${totalTweets + totalReplies})`);
            }
        }
    }

    // ========== 4. Store Overall Summary ==========
    console.log('\n📝 Storing overall summary...');

    const totalDays = dailyStats.length;
    const totalTweets = dailyStats.reduce((sum, d) => sum + d.tweets, 0);
    const totalReplies = dailyStats.reduce((sum, d) => sum + d.replies, 0);
    const overallAvg = Math.round((totalTweets + totalReplies) / totalDays);
    const firstDate = dailyStats[0]?.date;
    const lastDate = dailyStats[dailyStats.length - 1]?.date;

    const overallSummary = `历史总览 (${firstDate} ~ ${lastDate}): 共分析${totalDays}天数据，总推文${totalTweets}条，总回复${totalReplies}条，日均${overallAvg}条。工作日平均${weekdayAvg}条，周末平均${weekendAvg}条。`;

    await storeMemoryDocument({
        type: 'period_summary',
        content: overallSummary,
        metadata: {
            summaryType: 'overall',
            totalDays,
            totalTweets,
            totalReplies,
            dateRange: { start: firstDate, end: lastDate }
        }
    });
    console.log('  ✅ Stored overall summary');

    console.log('\n🎉 Historical memory generation complete!');
    console.log(`   - Weekly summaries: ${weeks.length}`);
    console.log(`   - Pattern documents: 3`);
    console.log(`   - Period counts updated`);
}

main().catch(console.error);
