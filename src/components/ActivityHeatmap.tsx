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
        const searchDate = currentET.dateStr.toLowerCase().trim();
        const hasCurrentDay = posts.some(p => p.date?.toLowerCase().trim() === searchDate);

        if (!hasCurrentDay && currentET.dateStr) {
            posts.push({ date: currentET.dateStr, _norm: currentET.normDate });
            posts.sort((a, b) => {
                if (!a._norm) return 1;
                if (!b._norm) return -1;
                return b._norm.localeCompare(a._norm);
            });
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
        const isCurrently = rowDate === currentET.normDate && hour === currentET.hour;

        if (count === 0) {
            // Normal styling for empty current slot, no weird pulsing border
            if (isCurrently) return 'bg-orange-500/10 border border-orange-500/40';
            return past
                ? 'bg-slate-800/20 border border-white/[0.02]'
                : 'bg-transparent border border-dashed border-white/[0.05]';
        }

        let bgClass = '';
        if (count <= 2) bgClass = 'bg-orange-500';
        else if (count <= 5) bgClass = 'bg-orange-600';
        else bgClass = 'bg-red-600';

        return `${bgClass} text-white font-black border border-white/10`;
    };

    return (
        <div className="bg-white dark:bg-[#0a0a0b] p-8 rounded-[2rem] border border-white/10 dark:border-white/[0.05] shadow-2xl overflow-hidden relative">
            <div className="flex flex-col lg:flex-row items-center justify-between mb-10 gap-6 px-4 relative z-20">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <span className="w-2 h-10 bg-gradient-to-b from-orange-400 to-red-600 rounded-full block"></span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-text-primary tracking-tighter uppercase italic leading-none mb-2">Timeline Matrix</h2>
                        <div className="flex items-center gap-3">
                            <div className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-[10px] font-bold text-green-500/80 uppercase tracking-widest leading-none">Live</span>
                            </div>
                            <span className="text-xs font-bold text-text-tertiary opacity-60 leading-none">ET: {currentET.dateStr} {currentET.hour}:{currentET.minute.toString().padStart(2, '0')}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <label className="flex items-center gap-2 cursor-pointer group bg-zinc-50 dark:bg-white/[0.02] px-4 py-2 rounded-xl border border-zinc-200/50 dark:border-white/[0.03] transition-all">
                        <Checkbox
                            checked={includeReplies}
                            onChange={e => setIncludeReplies(e.target.checked)}
                        />
                        <span className="text-xs font-bold text-text-tertiary uppercase tracking-wide group-hover:text-text-secondary">Include Replies</span>
                    </label>

                    <div className="flex items-center gap-5 py-2 px-5 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200/50 dark:border-white/[0.03]">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-text-tertiary">
                            <span className="w-3 h-3 bg-slate-800/40 rounded-sm border border-white/5"></span>
                            <span>HISTORY</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-text-tertiary opacity-40">
                            <span className="w-3 h-3 border border-dashed border-zinc-500 rounded-sm"></span>
                            <span>PENDING</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-10 custom-scrollbar scroll-smooth">
                <div className="min-w-[1080px] px-4">
                    {/* Header */}
                    <div className="grid grid-cols-[130px_1fr_70px] gap-2 mb-6 items-end relative z-20">
                        <div className="flex flex-col justify-center text-[11px] font-black text-text-tertiary text-right pr-6 italic opacity-50 space-y-1">
                            <div>ET TIME</div>
                        </div>
                        <div className="grid grid-cols-24 gap-1.5 h-8">
                            {hours.map(h => (
                                <div key={h} className="flex items-center justify-center">
                                    <span className={`text-[12px] font-black leading-none ${h === currentET.hour ? 'text-orange-500 scale-110' : 'text-text-tertiary opacity-30'}`}>
                                        {h.toString().padStart(2, '0')}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-end text-[11px] font-black text-text-tertiary opacity-40 pr-4 italic">SUM</div>
                    </div>

                    <Spin spinning={loading} size="large">
                        <div className="space-y-2 pb-6 relative z-10">
                            {heatmapRows.map((row) => {
                                let rowTotal = 0;
                                const rowDateNorm = row.date?.toLowerCase().trim();
                                const todayDateNorm = currentET.dateStr.toLowerCase().trim();
                                const isToday = rowDateNorm === todayDateNorm;

                                return (
                                    <div key={row.date} className="grid grid-cols-[130px_1fr_70px] gap-2 group/row items-center relative">
                                        <div className={`text-[13px] font-black transition-all uppercase text-right pr-6 ${isToday ? 'text-orange-500 scale-105' : 'text-text-tertiary opacity-40 group-hover/row:opacity-100 group-hover/row:text-text-secondary'}`}>
                                            {row.date}
                                        </div>

                                        <div className="grid grid-cols-24 gap-1.5 p-1 bg-zinc-50/50 dark:bg-white/[0.01] border border-white/[0.03] rounded-2xl transition-all group-hover/row:bg-zinc-100/50 dark:group-hover/row:bg-white/[0.02]">
                                            {hours.map(h => {
                                                const hourKey = h.toString().padStart(2, '0') + ':00';
                                                const hourData = row[hourKey] || { tweet: 0, reply: 0 };
                                                const count = includeReplies ? (hourData.tweet + hourData.reply) : hourData.tweet;
                                                rowTotal += count;

                                                const isCurrentSlot = isToday && h === currentET.hour;

                                                return (
                                                    <Tooltip
                                                        key={h}
                                                        title={`${row.date} ${hourKey}: ${count} posts`}
                                                        color="#111"
                                                    >
                                                        <div
                                                            className={`h-11 rounded-xl transition-all flex items-center justify-center text-lg font-black cursor-pointer relative overflow-hidden group/cell ${isCurrentSlot ? 'z-20 bg-[#1a1a1b] border border-orange-500/50' : 'hover:scale-110 active:scale-95'} ${getCellStyles(count, row._norm, h)}`}
                                                        >
                                                            {isCurrentSlot ? (
                                                                <div className="w-full h-full flex items-center justify-center p-1 relative pointer-events-none">
                                                                    <div className="w-full h-full bg-white/5 rounded-lg flex items-center justify-center">
                                                                        <img
                                                                            src="/assets/elon_laugh.png"
                                                                            alt="Elon"
                                                                            className="w-full h-full object-contain scale-125"
                                                                        />
                                                                    </div>
                                                                    {count > 0 && (
                                                                        <span className="absolute bottom-0.5 right-0.5 text-[10px] bg-red-600 text-white px-1 rounded-sm z-20 font-black shadow-sm">
                                                                            {count}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="relative z-10">{count > 0 ? count : ''}</span>
                                                            )}
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-end pr-4">
                                            <div className={`text-xs font-black transition-all ${rowTotal > 0 ? 'text-orange-500' : 'text-text-tertiary opacity-10'}`}>
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
