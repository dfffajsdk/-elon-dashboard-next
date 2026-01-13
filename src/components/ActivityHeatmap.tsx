'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { Tooltip, Checkbox, Spin } from 'antd';
import { TweetStatusRawResponse } from '../lib/types';

const ActivityHeatmap: React.FC = () => {
    const [includeReplies, setIncludeReplies] = useState(false);
    const [apiData, setApiData] = useState<TweetStatusRawResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentET, setCurrentET] = useState<{ dateStr: string; normDate: string; hour: number; minute: number }>({
        dateStr: '',
        normDate: '',
        hour: 0,
        minute: 0
    });

    // Update current ET time
    useEffect(() => {
        const updateET = () => {
            const now = new Date();
            const etFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const parts = etFormatter.formatToParts(now);
            const year = parts.find(p => p.type === 'year')?.value || '';
            const month = parts.find(p => p.type === 'month')?.value || '';
            const day = parts.find(p => p.type === 'day')?.value || '';
            const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
            const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

            const monthNum = now.toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit' });
            const normDate = `${year}-${monthNum}-${day}`;

            setCurrentET({
                dateStr: `${month} ${day}`,
                normDate: normDate,
                hour: hour,
                minute: minute
            });
        };

        updateET();
        const interval = setInterval(updateET, 10000);
        return () => clearInterval(interval);
    }, []);

    // Fetch heatmap data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/tweet-status');
                const data = await res.json();
                setApiData(data);
            } catch (err) {
                console.error('Failed to fetch heatmap:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, []);

    const { heatmapRows, hours } = useMemo(() => {
        const hourArray = Array.from({ length: 24 }, (_, i) => i);
        if (!apiData?.posts) return { heatmapRows: [], hours: hourArray };

        let posts = [...apiData.posts];
        const hasCurrentDay = posts.some(p => p.date === currentET.dateStr);

        if (!hasCurrentDay && currentET.dateStr) {
            posts.unshift({ date: currentET.dateStr, _norm: currentET.normDate });
        }

        return { heatmapRows: posts, hours: hourArray };
    }, [apiData, currentET.dateStr, currentET.normDate]);

    const isPast = (rowDate: string, hour: number) => {
        if (!rowDate) return true;
        const [rowYear, rowMonth, rowDay] = rowDate.split('-').map(Number);
        const [nowYear, nowMonth, nowDay] = currentET.normDate.split('-').map(Number);

        if (rowYear < nowYear) return true;
        if (rowYear > nowYear) return false;
        if (rowMonth < nowMonth) return true;
        if (rowMonth > nowMonth) return false;
        if (rowDay < nowDay) return true;
        if (rowDay > nowDay) return false;
        return hour < currentET.hour;
    };

    const getCellStyles = (count: number, rowDate: string, hour: number) => {
        const past = isPast(rowDate, hour);

        if (count === 0) {
            return past
                ? 'bg-[#11222c] border border-white/[0.03]' // High-contrast dark for passed
                : 'bg-transparent border border-dashed border-white/[0.08]'; // Clean future
        }

        let bgClass = '';
        if (count <= 2) bgClass = 'bg-orange-500/80';
        else if (count <= 5) bgClass = 'bg-orange-600';
        else bgClass = 'bg-red-600';

        return `${bgClass} text-white font-black border border-white/10 shadow-lg scale-[1.02]`;
    };

    return (
        <div className="bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/10 dark:border-white/5 shadow-2xl overflow-hidden relative">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 px-2">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black text-text-primary tracking-tighter uppercase italic">Timeline Matrix</h2>
                    <div className="flex items-center gap-2 px-2 py-1 bg-green-500/10 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-text-tertiary whitespace-nowrap">ET: {currentET.dateStr} {currentET.hour}:{currentET.minute.toString().padStart(2, '0')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                            checked={includeReplies}
                            onChange={e => setIncludeReplies(e.target.checked)}
                        />
                        <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wide">Include Replies</span>
                    </label>
                    <div className="flex items-center gap-4 text-[9px] font-black text-text-tertiary tracking-widest bg-zinc-100 dark:bg-zinc-800/50 px-4 py-2 rounded-xl">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 bg-[#11222c] rounded-sm"></span>
                            <span>PASSED</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 border border-dashed border-zinc-500 rounded-sm"></span>
                            <span>FUTURE</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-6 custom-scrollbar scroll-smooth">
                <div className="min-w-[1000px] px-2">
                    {/* Unified Grid Header */}
                    <div className="grid grid-cols-[120px_1fr_60px] gap-2 mb-4">
                        <div className="flex flex-col justify-center text-[10px] font-black text-text-tertiary text-right pr-4 italic opacity-60">
                            <div>ET TIME</div>
                            <div className="text-orange-500">LT SYNC</div>
                        </div>
                        <div className="grid grid-cols-24 gap-1 relative h-12">
                            {hours.map(h => (
                                <div key={h} className="flex flex-col items-center justify-center">
                                    <span className={`text-[11px] font-black leading-none ${h === currentET.hour ? 'text-orange-500 scale-110' : 'text-text-tertiary opacity-40'}`}>
                                        {h.toString().padStart(2, '0')}
                                    </span>
                                    <span className="text-[8px] font-bold text-text-tertiary opacity-20 mt-1">
                                        {((h + 13) % 24).toString().padStart(2, '0')}
                                    </span>
                                </div>
                            ))}

                            {/* Avatar Tracker - Inside a small jumping box */}
                            <div
                                className="absolute top-[-4px] bottom-[-2000px] transition-all duration-700 pointer-events-none z-30"
                                style={{
                                    left: `${((currentET.hour + currentET.minute / 60) / 24) * 100}%`,
                                    transform: 'translateX(-50%)',
                                }}
                            >
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 p-1 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 shadow-xl flex items-center justify-center animate-bounce-subtle">
                                        <div className="w-full h-full relative">
                                            <img
                                                src="/assets/elon_laugh.png"
                                                alt="Elon"
                                                className="w-full h-full object-contain scale-110"
                                            />
                                        </div>
                                    </div>
                                    <div className="w-[1px] h-full bg-orange-500/30 mt-1"></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end text-[10px] font-black text-text-tertiary opacity-40 pr-2 italic">SUM</div>
                    </div>

                    <Spin spinning={loading} size="large">
                        <div className="space-y-1.5 pb-4">
                            {heatmapRows.map((row) => {
                                let rowTotal = 0;
                                const isToday = row.date === currentET.dateStr;
                                return (
                                    <div key={row.date} className="grid grid-cols-[120px_1fr_60px] gap-2 group/row items-center relative">
                                        {isToday && (
                                            <div className="absolute -inset-y-1 -left-2 w-[120px] bg-orange-500/5 border-l-2 border-orange-500/20 rounded-r-lg pointer-events-none"></div>
                                        )}
                                        <div className={`text-[11px] font-black transition-all uppercase text-right pr-4 ${isToday ? 'text-orange-500 scale-105' : 'text-text-tertiary group-hover/row:text-text-secondary'}`}>
                                            {row.date}
                                        </div>

                                        <div className="grid grid-cols-24 gap-1 p-1 bg-zinc-50 dark:bg-white/[0.02] border border-white/5 rounded-xl transition-all">
                                            {hours.map(h => {
                                                const hourKey = h.toString().padStart(2, '0') + ':00';
                                                const hourData = row[hourKey] || { tweet: 0, reply: 0 };
                                                const count = includeReplies ? (hourData.tweet + hourData.reply) : hourData.tweet;
                                                rowTotal += count;

                                                return (
                                                    <Tooltip
                                                        key={h}
                                                        title={`${row.date} ${hourKey}: ${count} posts`}
                                                        color="#09090b"
                                                    >
                                                        <div
                                                            className={`h-9 rounded-lg transition-all duration-300 flex items-center justify-center text-[11px] font-black cursor-crosshair overflow-hidden hover:scale-125 hover:z-10 ${getCellStyles(count, row._norm, h)}`}
                                                        >
                                                            {count > 0 ? count : ''}
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-end pr-2">
                                            <div className={`text-[11px] font-black transition-all ${rowTotal > 0 ? 'text-orange-500/80' : 'text-text-tertiary opacity-20'}`}>
                                                {rowTotal}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Spin>
                </div>
            </div>
        </div>
    );
};

export default ActivityHeatmap;
