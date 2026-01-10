'use client';
import React, { useState, useRef, useEffect } from 'react';
import { SendOutlined, CloseOutlined, LoadingOutlined, DeleteOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AIAssistantProps {
    dashboardData: {
        tweetCount: number;
        periodStart: Date;
        periodEnd: Date;
        tweets: any[];
        progress: number;
        milestones?: any[]; // Added milestones
        pacing?: any[];    // Added pacing info
    };
    isDarkMode?: boolean;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ dashboardData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Load history from LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem('ai_chat_history');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const fixed = parsed.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                setMessages(fixed);
            } catch (e) {
                console.error('Failed to load chat history', e);
            }
        }
    }, []);

    // Save history to LocalStorage
    useEffect(() => {
        // Only save if we have messages (or save empty if cleared)
        localStorage.setItem('ai_chat_history', JSON.stringify(messages));
    }, [messages]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Build context from dashboard data - ALL IN ET TIMEZONE
    const buildContext = () => {
        const now = new Date();

        // Format helper for ET
        const formatET = (date: Date, options?: Intl.DateTimeFormatOptions) => {
            return date.toLocaleString('zh-CN', { timeZone: 'America/New_York', ...options });
        };

        const formatTimeET = (date: Date) => formatET(date, { hour: '2-digit', minute: '2-digit', hour12: false });
        const formatDateET = (date: Date) => formatET(date, { month: 'numeric', day: 'numeric' });
        const formatFullET = (date: Date) => `${formatDateET(date)} ${formatTimeET(date)} ET`;

        // Current ET time
        const nowET = formatFullET(now);

        const timeRemaining = Math.max(0, dashboardData.periodEnd.getTime() - now.getTime());
        const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
        const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        // Calculate daily rate
        const elapsedMs = now.getTime() - dashboardData.periodStart.getTime();
        const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
        const dailyRate = elapsedDays > 0 ? (dashboardData.tweetCount / elapsedDays).toFixed(1) : 0;

        // Helper to get timestamp from tweet
        const getTimestamp = (t: any): number => {
            let ts = t.timestr || t.timestamp;
            if (typeof ts === 'string' && /^\d+$/.test(ts)) ts = parseInt(ts);
            return typeof ts === 'number' ? ts : 0;
        };

        // Helper to get ET hour (0-23)
        const getETHour = (timestamp: number): number => {
            const date = new Date(timestamp * 1000);
            return parseInt(date.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }));
        };

        // ========== HOURLY ACTIVITY PATTERN ==========
        const hourlyTotals: Record<number, number> = {};
        for (let h = 0; h < 24; h++) hourlyTotals[h] = 0;

        dashboardData.tweets.forEach(t => {
            const ts = getTimestamp(t);
            if (ts > 0) {
                const hour = getETHour(ts);
                hourlyTotals[hour] = (hourlyTotals[hour] || 0) + 1;
            }
        });

        // Identify peak and quiet hours
        const sortedHours = Object.entries(hourlyTotals).sort((a, b) => b[1] - a[1]);
        const peakHours = sortedHours.slice(0, 5).map(([h, c]) => `${h}:00(${c}条)`).join(', ');
        const quietHours = sortedHours.slice(-5).reverse().map(([h, c]) => `${h}:00(${c}条)`).join(', ');

        const hourlyPatternStr = Object.entries(hourlyTotals)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .filter(([_, count]) => count > 0)
            .map(([hour, count]) => `${hour}:00=${count}`)
            .join(', ');

        // ========== MULTI-WINDOW MOMENTUM ==========
        const nowTs = Math.floor(now.getTime() / 1000);
        const windows = [1, 3, 6, 12]; // hours
        const momentumResults: string[] = [];

        windows.forEach(hours => {
            const windowStart = nowTs - hours * 3600;
            const windowTweets = dashboardData.tweets.filter(t => {
                const ts = getTimestamp(t);
                return ts > windowStart && ts <= nowTs;
            }).length;

            const expectedAvg = elapsedDays > 0 ? (dashboardData.tweetCount / (elapsedDays * 24)) * hours : 0;
            const ratio = expectedAvg > 0 ? windowTweets / expectedAvg : 1;

            let status = '正常';
            if (ratio > 1.5) status = '🔥爆发';
            else if (ratio > 1.2) status = '↗偏高';
            else if (ratio < 0.5) status = '😴低迷';
            else if (ratio < 0.8) status = '↘偏低';

            momentumResults.push(`最近${hours}h: ${windowTweets}条 (${status})`);
        });

        // ========== TIME-REMAINING BREAKDOWN ==========
        // Count remaining "active" vs "inactive" hours
        // Define quiet hours as 03:00-08:00 ET (sleep) and 12:00-13:00 ET (lunch)
        let activeHoursRemaining = 0;
        let inactiveHoursRemaining = 0;

        for (let i = 0; i < hoursRemaining + daysRemaining * 24; i++) {
            const futureTime = new Date(now.getTime() + i * 3600 * 1000);
            const futureETHour = parseInt(futureTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }));

            // Quiet hours: 3-8 (sleep), 12-13 (lunch)
            if ((futureETHour >= 3 && futureETHour < 8) || (futureETHour >= 12 && futureETHour < 13)) {
                inactiveHoursRemaining++;
            } else {
                activeHoursRemaining++;
            }
        }

        // ========== RECENT TWEETS (Last 15) ==========
        const recentTweets = dashboardData.tweets.slice(0, 15).map(t => {
            const ts = getTimestamp(t);
            const timeStr = ts > 0 ? formatFullET(new Date(ts * 1000)) : '未知';
            const content = t.msg || t.text || 'No text';
            return `[${timeStr}] ${content.substring(0, 50)}...`;
        });

        // ========== MILESTONES ==========
        const currentMilestone = dashboardData.milestones?.find((m: any) => m.status === 'current');
        const nextMilestone = dashboardData.milestones?.find((m: any) => m.status === 'future');
        const milestoneInfo = currentMilestone
            ? `当前目标: ${currentMilestone.target}, 缺口: ${currentMilestone.deficit}`
            : (nextMilestone ? `下一个目标: ${nextMilestone.target}` : '所有目标已完成');

        // ========== PACING ==========
        const pacingInfo = dashboardData.pacing?.map((p: any) => `${p.label}: ${p.value}`).join('\n- ');

        return `
你是一个专业的Elon Musk推文数据分析师。根据实时看板数据回答用户问题。
⚠️ **重要：所有分析和时间均以美国东部时间 (ET) 为准。**
⚠️ **回答原则 (System Override)**:
1. **极简主义**: 直接回答数字/结论。除非用户追问，否则**不要**解释计算过程。
2. **数据源优先级**: 统计推文数量时，**必须优先使用【每日详细数据 (热力图)】**。数据库 Raw Count 仅供参考，如有冲突，以热力图每日累加值为准 (Heatmap Non-Reply Count)。
3. **Jan 9周期特定规则**: 该周期总数若热力图累加约为 563-570，请直接认可该数据。

## ⏰ 当前时间 (ET)
${nowET}

## 📊 核心看板数据
- **当前周期**: ${formatDateET(dashboardData.periodStart)} 12:00 ET 至 ${formatDateET(dashboardData.periodEnd)} 12:00 ET
- **已发推文**: ${dashboardData.tweetCount} 条
- **时间进度**: ${dashboardData.progress}%
- **剩余时间**: ${daysRemaining}天 ${hoursRemaining}小时 (其中约 ${activeHoursRemaining}小时活跃时段, ${inactiveHoursRemaining}小时低迷时段)
- **整体速率**: ${dailyRate} 条/天

## 📈 分时活跃度 (本周期 ET)
${hourlyPatternStr || '暂无数据'}
- **高峰时段**: ${peakHours || '待分析'}
- **低迷时段**: ${quietHours || '待分析'}

## 🔥 实时动量分析
${momentumResults.join('\n')}

## 🎯 里程碑追踪
- ${milestoneInfo}

## ⏱️ 活跃度节奏
- ${pacingInfo || '暂无数据'}

## 📝 最近15条推文 (ET时间)
${recentTweets.join('\n')}

## 🧠 预测原则 (非常重要!)
1. **禁止简单外推**: 不要用 "当前速率 × 剩余时间" 做预测，这种方法会被马斯克的作息节奏欺骗。
2. **参考分时规律**: 如果当前是低迷时段（如凌晨3-8点ET），不要因为"最近几小时没发"就降低预测。
3. **动量权重**: 爆发期(🔥)可适当提高预测，低迷期(😴)如果在正常活跃时段则降低预测。
4. **给出区间**: 预测应给出合理区间，如 "570-590条"，而非精确数字。
5. **解释推理**: 告诉用户你为什么这样预测，引用具体的分时数据和动量。
`;
    };

    const sendMessage = async (customMessage?: string) => {
        const textToSend = customMessage || input.trim();
        if (!textToSend || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: textToSend,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // ========== Date Range Detection: Query database directly for date-specific questions ==========
            let dateQueryContext = '';
            try {
                // Detect date patterns in user's question (Chinese format)
                const datePatterns = [
                    /(\d{1,2})月(\d{1,2})(?:日|号)?(?:到|至|-|~)(\d{1,2})月(\d{1,2})(?:日|号)?/,  // 12月26日到1月2号
                    /(\d{1,2})\.(\d{1,2})(?:到|至|-|~)(\d{1,2})\.(\d{1,2})/,  // 12.26到1.2
                ];

                let startDate: string | null = null;
                let endDate: string | null = null;

                for (const pattern of datePatterns) {
                    const match = textToSend.match(pattern);
                    if (match) {
                        const startMonth = parseInt(match[1]);
                        const startDay = parseInt(match[2]);
                        const endMonth = parseInt(match[3]);
                        const endDay = parseInt(match[4]);

                        // Determine year (assuming current or previous year based on month)
                        const now = new Date();
                        const currentYear = now.getFullYear();
                        const startYear = startMonth > now.getMonth() + 1 ? currentYear - 1 : currentYear;
                        const endYear = endMonth > now.getMonth() + 1 ? currentYear - 1 : currentYear;

                        startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
                        endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
                        break;
                    }
                }

                if (startDate && endDate) {
                    console.log(`[DateQuery] Detected date range: ${startDate} to ${endDate}`);
                    const queryResponse = await fetch('/api/ai-query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ startDate, endDate })
                    });
                    const queryData = await queryResponse.json();

                    if (queryData.success && queryData.data) {
                        const d = queryData.data;
                        const dailyList = d.dailyBreakdown.map((day: any) =>
                            `  - ${day.date}: ${day.tweets}条推文 + ${day.replies}条回复 = ${day.total}条`
                        ).join('\n');

                        dateQueryContext = `\n\n## 🔍 精确数据库查询结果 (${startDate} 到 ${endDate})
**⚠️ 这是从数据库直接查询的精确数据，必须使用此数据回答！**
- 查询天数: ${d.daysCount}天
- **非回复推文总数: ${d.totalTweets}条**
- 回复推文总数: ${d.totalReplies}条
- 总计: ${d.totalAll}条

每日明细:
${dailyList}`;
                        console.log(`[DateQuery] Got precise data: ${d.totalTweets} tweets, ${d.totalReplies} replies`);
                    }
                }
            } catch (dateQueryError) {
                console.warn('[DateQuery] Failed (fallback to heatmap context):', dateQueryError);
            }

            // ========== RAG: Fetch relevant historical context ==========
            let ragContext = '';
            try {
                const ragResponse = await fetch('/api/rag/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: textToSend, limit: 3 })
                });
                const ragData = await ragResponse.json();
                if (ragData.success && ragData.documents?.length > 0) {
                    ragContext = '\n\n## 📚 历史记忆 (RAG 检索)\n' +
                        ragData.documents.map((doc: any) =>
                            `- [${doc.type}] ${doc.content}`
                        ).join('\n');
                    console.log('[RAG] Found', ragData.documents.length, 'relevant documents');
                }
            } catch (ragError) {
                console.warn('[RAG] Search failed (non-critical):', ragError);
            }

            // ========== Prediction: Get trend, patterns, and forecasts ==========
            let predictionContext = '';
            try {
                const predictionUrl = `/api/ai-predict?currentTweets=${dashboardData.tweetCount}&periodStart=${dashboardData.periodStart.toISOString()}&periodEnd=${dashboardData.periodEnd.toISOString()}`;
                const predictionResponse = await fetch(predictionUrl);
                const predictionData = await predictionResponse.json();

                if (predictionData.success && predictionData.prediction) {
                    const p = predictionData.prediction;
                    const t = predictionData.trend;
                    const pat = predictionData.patterns;
                    const next6 = predictionData.nextSixHours;

                    const trendEmoji = t.direction === 'up' ? '📈' : t.direction === 'down' ? '📉' : '➡️';
                    const trendText = t.direction === 'up' ? '上升' : t.direction === 'down' ? '下降' : '稳定';

                    predictionContext = `

## 🔮 智能预测系统 (基于历史数据分析)

### 周期结束预测
- **预测总数**: ${p.predicted}条 (置信度: ${p.confidence === 'high' ? '高🟢' : p.confidence === 'medium' ? '中🟡' : '低🔴'})
- **预测区间**: ${p.range.min} - ${p.range.max}条
- **推理依据**: ${p.reasoning.join(' | ')}

### 趋势分析
- ${trendEmoji} **7日均值**: ${t.sevenDayAvg}条/天
- ${trendEmoji} **30日均值**: ${t.thirtyDayAvg}条/天
- **趋势**: ${trendText} (${t.changePercent > 0 ? '+' : ''}${t.changePercent}%)

### 周期模式
- **工作日平均**: ${pat.weekdayAvg}条/天
- **周末平均**: ${pat.weekendAvg}条/天
- **今日预期**: ${new Date().getDay() === 0 || new Date().getDay() === 6 ? pat.weekendAvg : pat.weekdayAvg}条 (${new Date().getDay() === 0 || new Date().getDay() === 6 ? '周末' : '工作日'})

### 接下来6小时预测
${next6.map((h: any) => `- ${h.hour}: 预计 ~${h.predicted}条`).join('\n')}

**⚠️ 预测使用说明**: 上述预测基于历史数据统计，回答预测类问题时请直接引用这些数据，不要自己计算。`;

                    console.log('[Prediction] Got prediction:', p.predicted, 'confidence:', p.confidence);
                }
            } catch (predictionError) {
                console.warn('[Prediction] Fetch failed (non-critical):', predictionError);
            }

            // ========== Period Stats: Fetch historical period data ==========
            let periodStatsContext = '';
            try {
                const statsResponse = await fetch('/api/period-stats');
                const statsData = await statsResponse.json();
                if (statsData.success && statsData.periods?.length > 0) {
                    const periodLines = statsData.periods.map((p: any) => {
                        const startDate = new Date(p.startDate).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', timeZone: 'America/New_York'
                        });
                        const endDate = new Date(p.endDate).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', timeZone: 'America/New_York'
                        });
                        const statusEmoji = p.status === 'ended' ? '✅' : p.status === 'active' ? '🔄' : '⏳';

                        // Add detailed breakdown if available
                        let breakdown = '';
                        if (p.count > 0 && typeof p.replies === 'number') {
                            const nonReplies = p.count - p.replies;
                            breakdown = ` (原创+转+引: ${nonReplies}, 回复: ${p.replies}, RT: ${p.retweets}, Orig: ${p.original})`;
                        }

                        return `${statusEmoji} ${p.label}周期 (${startDate} 12pm ET - ${endDate} 12pm ET): ${p.count}条${breakdown} [${p.status}]`;
                    });
                    periodStatsContext = '\n\n## 📊 所有周期统计 (从数据库实时计算)\n' + periodLines.join('\n');
                    console.log('[PeriodStats] Got stats for', statsData.periods.length, 'periods');
                }
            } catch (statsError) {
                console.warn('[PeriodStats] Fetch failed (non-critical):', statsError);
            }

            // ========== Heatmap Summary: Fetch historical daily activity ==========
            let heatmapContext = '';
            try {
                const heatmapResponse = await fetch('/api/heatmap-summary');
                const heatmapData = await heatmapResponse.json();
                if (heatmapData.success && heatmapData.summary) {
                    const s = heatmapData.summary;
                    // INCREASED LIMIT: Show last 60 days to cover Dec/Nov quarters
                    const dailyLines = heatmapData.days.slice(0, 60).map((d: any) =>
                        `- ${d.date}: ${d.totalTweets} tweets (Non-Reply: ${d.totalTweets}, Reply: ${d.totalReplies})`
                    ).join('\n');

                    heatmapContext = `\n\n## 📈 每日详细数据 (优先使用此数据统计)
${dailyLines}

## 📊 历史活动摘要
- 数据范围: ${s.dateRange?.start} 至 ${s.dateRange?.end}
- 总推文: ${s.totalTweets}, 总回复: ${s.totalReplies}`;
                    console.log('[HeatmapSummary] Got summary for', s.totalDays, 'days');
                }
            } catch (heatmapError) {
                console.warn('[HeatmapSummary] Fetch failed (non-critical):', heatmapError);
            }

            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: textToSend,
                    context: buildContext() + dateQueryContext + predictionContext + periodStatsContext + heatmapContext + ragContext,
                    history: messages.slice(-6).map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            const assistantMessage: Message = {
                role: 'assistant',
                content: data.response || '抱歉，我无法生成回复。',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('AI request failed:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: error instanceof Error ? `Error: ${error.message}` : '抱歉，连接服务商超时，请稍后再试。',
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearHistory = () => {
        setMessages([]);
    };

    // Dynamic Suggestions
    const currentMilestone = dashboardData.milestones?.find((m: any) => m.status === 'current');
    const suggestions = [
        `📊 预测本周能发多少条？`,
        currentMilestone ? `🎯 还需要发多少条达到 ${currentMilestone.target}？` : `📈 分析当前发推节奏`,
        `🕒 今天什么时候最活跃？`
    ];

    // Draggable Logic - Optimized for Performance
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; isDragging: boolean }>({
        startX: 0, startY: 0, initialX: 0, initialY: 0, isDragging: false
    });

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only allow dragging on desktop (sm breakpoint)
        if (window.innerWidth < 640) return;

        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: position.x,
            initialY: position.y,
            isDragging: true
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragRef.current.isDragging || !panelRef.current) return;

            // Calculate new position
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            const newX = dragRef.current.initialX + dx;
            const newY = dragRef.current.initialY + dy;

            // Direct DOM update for 60fps performance
            panelRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!dragRef.current.isDragging) return;
            dragRef.current.isDragging = false;

            // Calculate final position
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            const finalX = dragRef.current.initialX + dx;
            const finalY = dragRef.current.initialY + dy;

            // Sync with React state to preserve position on re-renders
            setPosition({ x: finalX, y: finalY });

            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Theme-aware styles
    // Mobile: Solid background for better readability/immersion
    // Desktop: Glassmorphism
    const panelBg = 'glass-card border-none';
    const headerBg = 'bg-surface/30 border-b-0 cursor-move active:cursor-grabbing';
    const textPrimary = 'text-text-primary';
    const textSecondary = 'text-text-secondary';
    const inputBg = 'bg-surface-highlight/50 hover:bg-surface-highlight transition-colors border border-white/10 focus:border-primary/50';

    // Message Bubbles
    const userBubble = 'bg-primary text-white shadow-md shadow-primary/20';
    const aiBubble = 'bg-surface-highlight text-text-primary shadow-sm';

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-2xl shadow-primary/30 transform hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center z-50 overflow-hidden ${isOpen ? 'hidden' : ''}`}
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)' }}
            >
                <img src="/ai_icon.png" alt="AI" className="w-8 h-8 object-contain drop-shadow-md" />
            </button>

            {/* Chat Panel */}
            <div
                ref={panelRef}
                className={`fixed z-50 flex flex-col transition-opacity duration-300 ${panelBg} bg-surface dark:bg-zinc-900 sm:bg-transparent sm:dark:bg-transparent
                ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                inset-0 w-full h-full rounded-none
                sm:bottom-6 sm:right-6 sm:w-96 sm:h-[600px] sm:inset-auto sm:rounded-3xl sm:origin-bottom-right
                ${!isOpen && 'sm:scale-95'}
            `}
                style={{
                    transform: window.innerWidth >= 640 ? `translate(${position.x}px, ${position.y}px)` : 'none'
                }}
            >
                {/* Header */}
                <div
                    onMouseDown={handleMouseDown}
                    className={`flex items-center justify-between p-5 ${headerBg} sm:rounded-t-3xl pt-safe-top shrink-0 select-none`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-inner" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)' }}>
                            <img src="/ai_icon.png" alt="AI" className="w-6 h-6 object-contain" />
                        </div>
                        <div>
                            <h3 className={`font-bold text-base ${textPrimary}`}>Elon Insight</h3>
                            <p className={`text-[10px] uppercase tracking-wider font-semibold ${textSecondary} opacity-70`}>Powered by Qwen</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={clearHistory}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-text-tertiary hover:text-text-primary transition-all`}
                            title="清除历史"
                        >
                            <DeleteOutlined style={{ fontSize: '14px' }} />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-text-tertiary hover:text-text-primary transition-all`}
                        >
                            <CloseOutlined style={{ fontSize: '14px' }} />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-surface-highlight scrollbar-track-transparent min-h-0">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full space-y-6 animate-fade-in">
                            <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl mb-2" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)' }}>
                                <img src="/ai_icon.png" alt="AI" className="w-12 h-12 object-contain drop-shadow-lg" />
                            </div>
                            <div className="text-center space-y-1">
                                <h4 className={`text-lg font-bold ${textPrimary}`}>有什么可以帮您？</h4>
                                <p className={`text-sm ${textSecondary}`}>基于实时数据分析 Elon Musk 的推文趋势</p>
                            </div>

                            <div className="w-full space-y-2.5">
                                {suggestions.map((suggestion, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => sendMessage(suggestion)}
                                        className="w-full text-left p-3.5 rounded-xl bg-surface/50 hover:bg-surface-highlight border border-white/5 hover:border-white/10 transition-all duration-200 text-sm font-medium text-text-secondary hover:text-text-primary hover:shadow-md group flex items-center justify-between"
                                    >
                                        <span>{suggestion}</span>
                                        <SendOutlined className="opacity-0 group-hover:opacity-50 -translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
                        >
                            <div
                                className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                    ? `${userBubble} rounded-br-none`
                                    : `${aiBubble} rounded-bl-none`
                                    }`}
                            >
                                {msg.role === 'assistant' ? (
                                    <div className="markdown-content">
                                        <ReactMarkdown
                                            components={{
                                                strong: ({ children }) => <span className="font-bold text-current opacity-90">{children}</span>,
                                                h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1 opacity-90">{children}</h1>,
                                                p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                                                ul: ({ children }) => <ul className="list-disc list-inside mb-1.5 space-y-0.5 opacity-90">{children}</ul>,
                                                li: ({ children }) => <li className="ml-1">{children}</li>,
                                                code: ({ children }) => <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p>{msg.content}</p>
                                )}
                                <p className={`text-[10px] mt-1.5 text-right opacity-60`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className={`p-4 rounded-2xl rounded-bl-none ${aiBubble} flex items-center gap-3`}>
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                                </div>
                                <span className="text-xs opacity-70">思考中...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 pt-2 shrink-0">
                    <div className={`flex items-end gap-2 rounded-2xl p-2 transition-colors ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="输入问题..."
                            className={`flex-1 bg-transparent px-3 py-3 text-sm resize-none focus:outline-none max-h-32 text-text-primary placeholder-text-tertiary ${inputBg} rounded-xl`}
                            rows={1}
                            style={{ minHeight: '48px' }}
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isLoading}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md ${input.trim()
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg hover:scale-105'
                                : 'bg-surface-highlight text-text-tertiary cursor-not-allowed'
                                }`}
                        >
                            {isLoading ? <LoadingOutlined /> : <SendOutlined />}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AIAssistant;


