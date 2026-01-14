'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { Tooltip, Checkbox, Spin } from 'antd';
import { TweetStatusRawResponse } from '../lib/types';

const ActivityHeatmap: React.FC = () => {
    const [includeReplies, setIncludeReplies] = useState(false);
    const [apiData, setApiData] = useState<TweetStatusRawResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [daysToShow, setDaysToShow] = useState(30); // Default: show 1 month
    const [currentTime, setCurrentTime] = useState<{
        etDate: string;
        etNormDate: string;
        etHour: number;
        etMinute: number;
        cstHour: number;
    }>({
        etDate: '',
        etNormDate: '',
        etHour: 0,
        etMinute: 0,
        cstHour: 0
    });

    // Update current times (ET and CST)
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();

            // ET Formatting
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
            const etHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
            const etMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

            const monthNum = now.toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit' });
            const etNormDate = `${year}-${monthNum}-${day}`;

            // CST (Beijing) Formatting - simplified hour only for the grid comparison
            const cstFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Shanghai',
                hour: '2-digit',
                hour12: false
            });
            const cstHour = parseInt(cstFormatter.format(now));

            setCurrentTime({
                etDate: `${month} ${day}`,
                etNormDate: etNormDate,
                etHour: etHour,
                etMinute: etMinute,
                cstHour: cstHour
            });
        };

        updateTime();
        const interval = setInterval(updateTime, 10000);
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

    const { heatmapRows, hours, totalDays } = useMemo(() => {
        const hourArray = Array.from({ length: 24 }, (_, i) => i);
        if (!apiData?.posts) return { heatmapRows: [], hours: hourArray, totalDays: 0 };

        let posts = [...apiData.posts];
        const searchDate = currentTime.etDate.toLowerCase().trim();
        const hasCurrentDay = posts.some(p => p.date?.toLowerCase().trim() === searchDate);

        if (!hasCurrentDay && currentTime.etDate) {
            posts.push({ date: currentTime.etDate, _norm: currentTime.etNormDate });
            posts.sort((a, b) => {
                if (!a._norm) return 1;
                if (!b._norm) return -1;
                return b._norm.localeCompare(a._norm);
            });
        }

        const totalDays = posts.length;
        const displayedPosts = posts.slice(0, daysToShow);

        return { heatmapRows: displayedPosts, hours: hourArray, totalDays };
    }, [apiData, currentTime.etDate, currentTime.etNormDate, daysToShow]);

    const isPast = (rowDate: string, hour: number) => {
        if (!rowDate) return true;
        const [rowYear, rowMonth, rowDay] = rowDate.split('-').map(Number);
        const [nowYear, nowMonth, nowDay] = currentTime.etNormDate.split('-').map(Number);

        if (rowYear < nowYear) return true;
        if (rowYear > nowYear) return false;
        if (rowMonth < nowMonth) return true;
        if (rowMonth > nowMonth) return false;
        if (rowDay < nowDay) return true;
        if (rowDay > nowDay) return false;
        return hour < currentTime.etHour;
    };

    const getCellStyles = (count: number, rowDate: string, hour: number) => {
        const past = isPast(rowDate, hour);
        const isCurrently = rowDate === currentTime.etNormDate && hour === currentTime.etHour;

        if (count === 0) {
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

    // Get weekday from normalized date (YYYY-MM-DD) in ET
    const getWeekday = (normDate: string): string => {
        if (!normDate) return '';
        try {
            // Parse the normalized date and get weekday in ET
            const date = new Date(normDate + 'T12:00:00-05:00');
            const etFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                weekday: 'short'
            });
            return etFormatter.format(date);
        } catch {
            return '';
        }
    };

    return (
        <div className="bg-white dark:bg-[#0a0a0b] p-8 rounded-[2rem] border border-white/10 dark:border-white/[0.05] shadow-2xl overflow-hidden relative">
            <div className="flex flex-col lg:flex-row items-center justify-between mb-10 gap-6 px-4 relative z-20">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <span className="w-2 h-8 bg-gradient-to-b from-orange-400 to-red-600 rounded-full block"></span>
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-text-primary tracking-tighter uppercase italic leading-none mb-1">Activity Matrix</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-[9px] font-bold text-green-500/80 uppercase tracking-widest leading-none">Live Trace</span>
                            </div>
                            <span className="text-[10px] font-bold text-text-secondary leading-none tracking-tight">ET: {currentTime.etDate} {currentTime.etHour}:{currentTime.etMinute.toString().padStart(2, '0')}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <label className="flex items-center gap-2 cursor-pointer group bg-zinc-50 dark:bg-white/[0.02] px-3 py-1.5 rounded-lg border border-zinc-200/50 dark:border-white/[0.03] transition-all">
                        <Checkbox
                            checked={includeReplies}
                            onChange={e => setIncludeReplies(e.target.checked)}
                        />
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wide">Replies</span>
                    </label>

                    <div className="flex items-center gap-5 py-1.5 px-4 bg-zinc-50 dark:bg-white/[0.02] rounded-lg border border-zinc-200/50 dark:border-white/[0.03]">
                        <div className="flex items-center gap-2 text-[9px] font-bold tracking-widest text-text-secondary">
                            <span className="w-2.5 h-2.5 bg-slate-800/40 rounded-sm border border-white/5"></span>
                            <span>HISTORY</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-bold tracking-widest text-text-secondary opacity-60">
                            <span className="w-2.5 h-2.5 border border-dashed border-zinc-500 rounded-sm"></span>
                            <span>PENDING</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-10 custom-scrollbar scroll-smooth">
                <div className="min-w-[1080px] px-4">
                    {/* Dual Timezone Header */}
                    <div className="grid grid-cols-[140px_1fr_60px] gap-2 mb-4 items-center relative z-20">
                        <div className="flex flex-col justify-center text-[9px] font-black text-text-secondary text-right pr-4 italic space-y-1 mt-1">
                            <div className="leading-none opacity-80">ET (US)</div>
                            <div className="leading-none text-orange-500/70">CST (BJ)</div>
                        </div>
                        <div className="grid grid-cols-24 gap-1.5 py-1">
                            {hours.map(h => {
                                // Calculate CST for this ET hour column
                                // CST = ET + 13 hours
                                const cstH = (h + 13) % 24;
                                const isCurrent = h === currentTime.etHour;
                                return (
                                    <div key={h} className="flex flex-col items-center justify-center space-y-0.5">
                                        <span className={`text-[11px] font-black leading-none ${isCurrent ? 'text-orange-500 scale-110' : 'text-text-secondary opacity-60'}`}>
                                            {h.toString().padStart(2, '0')}:00
                                        </span>
                                        <span className={`text-[10px] font-bold leading-none ${isCurrent ? 'text-orange-500/80' : 'text-text-secondary opacity-30'}`}>
                                            {cstH.toString().padStart(2, '0')}:00
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex items-center justify-end text-[9px] font-black text-text-secondary opacity-60 pr-4 italic">SUM</div>
                    </div>

                    <Spin spinning={loading} size="large">
                        <div className="space-y-1.5 pb-6 relative z-10">
                            {heatmapRows.map((row) => {
                                let rowTotal = 0;
                                const rowDateNorm = row.date?.toLowerCase().trim();
                                const todayDateNorm = currentTime.etDate.toLowerCase().trim();
                                const isToday = rowDateNorm === todayDateNorm;

                                return (
                                    <div key={row.date} className="grid grid-cols-[140px_1fr_60px] gap-2 group/row items-center relative">
                                        <div className={`text-[14px] font-black transition-all uppercase text-right pr-4 flex items-center justify-end gap-2 ${isToday ? 'text-orange-500' : 'text-white/90 group-hover/row:opacity-100'}`}>
                                            <span>{row.date}</span>
                                            <span className={`text-[11px] font-bold ${isToday ? 'text-orange-400' : 'text-text-secondary opacity-60'}`}>
                                                {getWeekday(row._norm)}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-24 gap-1.5 p-1 bg-zinc-50/50 dark:bg-white/[0.01] border border-white/[0.02] rounded-xl transition-all group-hover/row:bg-zinc-100/50 dark:group-hover/row:bg-white/[0.015]">
                                            {hours.map(h => {
                                                const hourKey = h.toString().padStart(2, '0') + ':00';
                                                const hourData = row[hourKey] || { tweet: 0, reply: 0 };
                                                const count = includeReplies ? (hourData.tweet + hourData.reply) : hourData.tweet;
                                                rowTotal += count;

                                                const isCurrentSlot = isToday && h === currentTime.etHour;

                                                return (
                                                    <Tooltip
                                                        key={h}
                                                        title={`${row.date} ${hourKey}: ${count} posts`}
                                                        color="#111"
                                                    >
                                                        <div
                                                            className={`h-11 rounded-lg transition-all flex items-center justify-center text-lg font-black cursor-pointer relative overflow-hidden group/cell ${isCurrentSlot ? 'z-20' : 'hover:scale-110 active:scale-95'} ${getCellStyles(count, row._norm, h)}`}
                                                        >
                                                            {isCurrentSlot ? (
                                                                <>
                                                                    {/* Pulsing ring indicator */}
                                                                    <div className="absolute inset-0 rounded-lg border-2 border-orange-500 animate-pulse" />
                                                                    <div className="absolute inset-[-2px] rounded-lg border border-orange-500/30 animate-ping" style={{ animationDuration: '2s' }} />
                                                                    {/* Count in center */}
                                                                    <span className="text-lg font-black text-orange-400 z-20 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]">
                                                                        {count > 0 ? count : ''}
                                                                    </span>
                                                                    {/* Small NOW indicator */}
                                                                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[6px] font-black text-orange-500 uppercase tracking-wider">
                                                                        now
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="relative z-10">{count > 0 ? count : ''}</span>
                                                            )}
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-end pr-4">
                                            <div className={`text-[16px] font-black transition-all ${rowTotal > 0 ? 'text-orange-500' : 'text-white/90'}`}>
                                                {rowTotal}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Spin>

                    {/* Pagination Controls */}
                    {totalDays > daysToShow && (
                        <div className="flex items-center justify-center mt-6 gap-4">
                            <button
                                onClick={() => setDaysToShow(prev => Math.min(prev + 30, totalDays))}
                                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm font-bold rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-orange-500/20"
                            >
                                Load More History
                            </button>
                            <span className="text-xs font-bold text-text-secondary">
                                Showing {daysToShow} of {totalDays} days
                            </span>
                        </div>
                    )}
                    {daysToShow > 30 && (
                        <div className="flex items-center justify-center mt-3">
                            <button
                                onClick={() => setDaysToShow(30)}
                                className="px-4 py-1.5 text-xs font-bold text-text-secondary hover:text-orange-500 transition-colors"
                            >
                                ↑ Collapse to 30 Days
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActivityHeatmap;
