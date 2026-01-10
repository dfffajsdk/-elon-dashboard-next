/**
 * Generate Period Analysis from Heatmap Data
 * 
 * PRIMARY SOURCE: cached_heatmap (53 days of hourly data)
 *   - tweet_count = non-reply tweets
 *   - reply_count = replies
 * 
 * SUPPLEMENTARY: cached_tweets (recent tweets for content analysis)
 * 
 * Period definition: 7 days, from 12:00 PM ET to 12:00 PM ET
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

function generateSimpleEmbedding(text) {
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
    return response.ok;
}

async function clearOldData() {
    console.log('🗑️ Clearing old data...');
    await fetch(`${SUPABASE_URL}/rest/v1/memory_documents?id=not.is.null`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    await fetch(`${SUPABASE_URL}/rest/v1/cached_counts?period_start=gt.0`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    console.log('  ✅ Old data cleared\n');
}

async function main() {
    await clearOldData();

    console.log('📥 Fetching heatmap data from cached_heatmap...');
    const heatmapData = await fetchHeatmapData();
    console.log(`Found ${heatmapData.length} heatmap records\n`);

    // ========== Group heatmap by date ==========
    // Each row in cached_heatmap: { date_normalized, hour, tweet_count, reply_count }
    const dailyData = new Map();

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

        const day = dailyData.get(date);
        day.tweets += row.tweet_count || 0;
        day.replies += row.reply_count || 0;
        day.hourlyTweets[hour] += row.tweet_count || 0;
        day.hourlyReplies[hour] += row.reply_count || 0;
    }

    console.log(`Grouped into ${dailyData.size} days of data\n`);

    // ========== Define 7-day periods (12pm ET to 12pm ET) ==========
    // Period = from startDate 12:00 PM ET to endDate 12:00 PM ET
    // This means:
    //   - startDate: count hours 12:00-23:00 (12 hours)
    //   - middle days: count all 24 hours
    //   - endDate: count hours 00:00-11:00 (12 hours)

    const now = new Date();
    const periods = [
        { label: 'Jan 9', startDate: '2026-01-02', endDate: '2026-01-09' },
        { label: 'Jan 2', startDate: '2025-12-26', endDate: '2026-01-02' },
        { label: 'Dec 26', startDate: '2025-12-19', endDate: '2025-12-26' },
        { label: 'Dec 19', startDate: '2025-12-12', endDate: '2025-12-19' },
        { label: 'Dec 12', startDate: '2025-12-05', endDate: '2025-12-12' },
        { label: 'Dec 5', startDate: '2025-11-28', endDate: '2025-12-05' },
        { label: 'Nov 28', startDate: '2025-11-21', endDate: '2025-11-28' },
    ].filter(p => new Date(`${p.endDate}T12:00:00-05:00`) <= now);

    console.log(`📊 Analyzing ${periods.length} completed periods...\n`);

    const periodStats = [];

    for (const period of periods) {
        let tweets = 0;
        let replies = 0;

        // Iterate through each day in the period
        const startD = new Date(period.startDate);
        const endD = new Date(period.endDate);

        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dayData = dailyData.get(dateStr);

            if (!dayData) continue;

            if (dateStr === period.startDate) {
                // First day: only count 12:00-23:00 (hours 12-23)
                for (let h = 12; h < 24; h++) {
                    tweets += dayData.hourlyTweets[h];
                    replies += dayData.hourlyReplies[h];
                }
            } else if (dateStr === period.endDate) {
                // Last day: only count 00:00-11:00 (hours 0-11)
                for (let h = 0; h < 12; h++) {
                    tweets += dayData.hourlyTweets[h];
                    replies += dayData.hourlyReplies[h];
                }
            } else {
                // Middle days: count all 24 hours
                tweets += dayData.tweets;
                replies += dayData.replies;
            }
        }

        const stats = {
            label: period.label,
            startDate: period.startDate,
            endDate: period.endDate,
            nonReplyCount: tweets,
            replyCount: replies,
            totalCount: tweets + replies
        };

        periodStats.push(stats);

        console.log(`📅 ${period.label}周期 (${period.startDate} 12pm ~ ${period.endDate} 12pm ET):`);
        console.log(`   非回复推文: ${stats.nonReplyCount}, 回复: ${stats.replyCount}, 总计: ${stats.totalCount}`);

        // Save to cached_counts
        const startTs = Math.floor(new Date(`${period.startDate}T12:00:00-05:00`).getTime() / 1000);
        await updateCachedCount(startTs, stats.nonReplyCount, stats.totalCount);
    }

    // ========== Trend Analysis ==========
    console.log('\n📈 分析趋势...');

    let trendContent = '历史周期统计 (非回复推文, 12pm ET 到 12pm ET):\n';
    let prevCount = null;

    for (const stats of periodStats) {
        let change = '';
        if (prevCount !== null) {
            const diff = stats.nonReplyCount - prevCount;
            const pct = prevCount > 0 ? Math.round(diff / prevCount * 100) : 0;
            if (diff > 0) change = ` 📈↑${diff}条(+${pct}%)`;
            else if (diff < 0) change = ` 📉↓${Math.abs(diff)}条(${pct}%)`;
            else change = ' ➡️持平';
        }
        trendContent += `- ${stats.label}周期 (${stats.startDate}~${stats.endDate}): ${stats.nonReplyCount}条${change}\n`;
        prevCount = stats.nonReplyCount;
    }

    await storeMemoryDocument({
        type: 'period_summary',
        content: trendContent,
        metadata: { type: 'period_trend', periods: periodStats.map(p => ({ label: p.label, count: p.nonReplyCount })) }
    });
    console.log('  ✅ 周期趋势已存储');

    // ========== Hourly Pattern Analysis ==========
    console.log('\n⏰ 分析小时活跃规律...');

    const hourlyTotals = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    for (const [_, dayData] of dailyData) {
        for (let h = 0; h < 24; h++) {
            hourlyTotals[h] += dayData.hourlyTweets[h];
            hourlyCounts[h]++;
        }
    }

    const hourlyAvg = hourlyTotals.map((total, i) => ({
        hour: i,
        avg: hourlyCounts[i] > 0 ? (total / hourlyCounts[i]).toFixed(1) : '0'
    })).sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg));

    const peakHours = hourlyAvg.slice(0, 5);
    const quietHours = [...hourlyAvg].sort((a, b) => parseFloat(a.avg) - parseFloat(b.avg)).slice(0, 5);

    const hourlyContent = `每日小时规律 (ET时区, 非回复推文):
高峰时段: ${peakHours.map(h => `${h.hour}:00(均${h.avg}条)`).join(', ')}
低迷时段: ${quietHours.map(h => `${h.hour}:00(均${h.avg}条)`).join(', ')}
分析: 凌晨3-8点ET通常是沉默期(睡眠时间)，上午10-14点和下午16-20点是主要活跃期。`;

    await storeMemoryDocument({
        type: 'tweet_pattern',
        content: hourlyContent,
        metadata: { patternType: 'hourly', peakHours: peakHours.map(h => h.hour), quietHours: quietHours.map(h => h.hour) }
    });
    console.log('  ✅ 小时规律已存储');

    // ========== Day-of-Week Pattern ==========
    console.log('\n📆 分析星期规律...');

    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayTotals = new Array(7).fill(0);
    const dayCounts = new Array(7).fill(0);

    for (const [dateStr, dayData] of dailyData) {
        const dow = new Date(dateStr).getDay();
        dayTotals[dow] += dayData.tweets;
        dayCounts[dow]++;
    }

    const dayAvg = dayTotals.map((total, i) => ({
        day: dayNames[i],
        dow: i,
        avg: dayCounts[i] > 0 ? Math.round(total / dayCounts[i]) : 0
    }));

    const weekdayAvg = Math.round(dayAvg.filter(d => d.dow >= 1 && d.dow <= 5).reduce((s, d) => s + d.avg, 0) / 5);
    const weekendAvg = Math.round(dayAvg.filter(d => d.dow === 0 || d.dow === 6).reduce((s, d) => s + d.avg, 0) / 2);
    const peakDay = dayAvg.reduce((max, d) => d.avg > max.avg ? d : max, dayAvg[0]);
    const lowDay = dayAvg.reduce((min, d) => d.avg < min.avg ? d : min, dayAvg[0]);

    const dayContent = `星期规律 (非回复推文):
${dayAvg.map(d => `${d.day}=${d.avg}`).join(', ')}
工作日平均: ${weekdayAvg}条/天, 周末平均: ${weekendAvg}条/天
最活跃: ${peakDay.day}(${peakDay.avg}条), 最安静: ${lowDay.day}(${lowDay.avg}条)
${weekdayAvg > weekendAvg ? '工作日比周末活跃' : '周末比工作日活跃'}，差异约${Math.abs(weekdayAvg - weekendAvg)}条/天`;

    await storeMemoryDocument({
        type: 'tweet_pattern',
        content: dayContent,
        metadata: { patternType: 'day_of_week', weekdayAvg, weekendAvg }
    });
    console.log('  ✅ 星期规律已存储');

    // ========== Overall Summary ==========
    console.log('\n📝 生成总结...');

    const totalNonReply = periodStats.reduce((sum, p) => sum + p.nonReplyCount, 0);
    const avgPerPeriod = Math.round(totalNonReply / periodStats.length);
    const maxPeriod = periodStats.reduce((max, p) => p.nonReplyCount > max.nonReplyCount ? p : max, periodStats[0]);
    const minPeriod = periodStats.reduce((min, p) => p.nonReplyCount < min.nonReplyCount ? p : min, periodStats[0]);

    const summaryContent = `历史总览 (基于${periodStats.length}个已完成周期, 数据来源: cached_heatmap):
- 平均每周期: ${avgPerPeriod}条非回复推文
- 最高周期: ${maxPeriod.label} (${maxPeriod.nonReplyCount}条)
- 最低周期: ${minPeriod.label} (${minPeriod.nonReplyCount}条)
- 工作日平均${weekdayAvg}条/天，周末平均${weekendAvg}条/天
- 高峰时段: ${peakHours.slice(0, 3).map(h => `${h.hour}:00`).join(', ')} ET`;

    await storeMemoryDocument({
        type: 'period_summary',
        content: summaryContent,
        metadata: { type: 'overall', avgPerPeriod, totalPeriods: periodStats.length }
    });
    console.log('  ✅ 总结已存储');

    console.log('\n🎉 分析完成！');
    console.log(`   - 周期数据: ${periodStats.length}个 (存入 cached_counts)`);
    console.log(`   - 趋势分析: 1条 (存入 memory_documents)`);
    console.log(`   - 时间规律: 2条 (存入 memory_documents)`);
    console.log(`   - 总结: 1条 (存入 memory_documents)`);
}

main().catch(console.error);
