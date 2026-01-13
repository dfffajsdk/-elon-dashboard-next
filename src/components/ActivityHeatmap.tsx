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
            if (isCurrently) return 'bg-orange-500/10 border-2 border-orange-500/60 shadow-[0_0_20px_rgba(249,115,22,0.2)] anim-pulse-border';
            return past
                ? 'bg-[#1e293b]/40 dark:bg-slate-800/20 border border-white/[0.02]'
                : 'bg-transparent border border-dashed border-white/[0.05]';
        }

        let bgClass = '';
        let glowClass = '';

        if (count <= 2) {
            bgClass = 'bg-gradient-to-br from-amber-400 to-orange-500';
            glowClass = 'shadow-[0_4px_12px_rgba(245,158,11,0.2)]';
        } else if (count <= 5) {
            bgClass = 'bg-gradient-to-br from-orange-500 to-red-500';
            glowClass = 'shadow-[0_4px_16px_rgba(234,88,12,0.3)]';
        } else {
            bgClass = 'bg-gradient-to-br from-red-500 to-rose-700';
            glowClass = 'shadow-[0_4px_20px_rgba(225,29,72,0.4)]';
        }

        return `${bgClass} ${glowClass} text-white font-bold border border-white/10 scale-[1.02]`;
    };

    return (
        <div className="bg-white/95 dark:bg-[#0f0f10]/95 backdrop-blur-3xl p-8 rounded-[3rem] border border-white/10 dark:border-white/[0.05] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden relative">
            {/* Design accents */}
            <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-orange-600/5 blur-[120px] pointer-events-none rounded-full"></div>
            <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-96 h-96 bg-red-600/5 blur-[120px] pointer-events-none rounded-full"></div>

            <div className="flex flex-col lg:flex-row items-center justify-between mb-10 gap-6 px-4 relative z-20">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-b from-orange-400 to-red-600 rounded-full blur-[4px] opacity-20"></div>
                        <span className="relative w-2 h-12 bg-gradient-to-b from-orange-400 to-red-600 rounded-full block"></span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-text-primary tracking-tighter uppercase italic leading-none mb-2">Matrix Stream</h2>
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-[10px] font-black text-green-500/80 uppercase tracking-widest">LIVE DATA FEED</span>
                            </div>
                            <span className="text-xs font-bold text-text-tertiary opacity-60">ET: {currentET.dateStr} {currentET.hour}:{currentET.minute.toString().padStart(2, '0')}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <label className="flex items-center gap-3 cursor-pointer group bg-zinc-50 dark:bg-white/[0.02] px-5 py-2.5 rounded-2xl border border-zinc-200/50 dark:border-white/[0.03] hover:border-orange-500/30 transition-all">
                        <Checkbox
                            checked={includeReplies}
                            onChange={e => setIncludeReplies(e.target.checked)}
                            className="hidden"
                        />
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${includeReplies ? 'bg-orange-500 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]' : 'border-zinc-400/50'}`}>
                            {includeReplies && <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>}
                        </div>
                        <span className={`text-xs font-black uppercase tracking-widest transition-colors ${includeReplies ? 'text-orange-500' : 'text-text-tertiary group-hover:text-text-secondary'}`}>REPLIES</span>
                    </label>

                    <div className="flex items-center gap-6 py-2 px-5 bg-zinc-50 dark:bg-white/[0.02] rounded-2xl border border-zinc-200/50 dark:border-white/[0.03]">
                        <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-text-tertiary">
                            <span className="w-3 h-3 bg-slate-800/40 rounded-sm border border-white/5"></span>
                            <span>HISTORY</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-text-tertiary opacity-40">
                            <span className="w-3 h-3 border border-dashed border-zinc-500 rounded-sm"></span>
                            <span>PENDING</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-10 custom-scrollbar scroll-smooth">
                <div className="min-w-[1080px] px-4 scale-[0.98] origin-top">
                    {/* Simplified Header */}
                    <div className="grid grid-cols-[130px_1fr_70px] gap-3 mb-6 items-end relative z-20">
                        <div className="flex flex-col justify-center text-[11px] font-black text-text-tertiary text-right pr-6 italic opacity-50 space-y-1">
                            <div>ET TIME</div>
                            <div className="text-orange-500/50">LT SYNC</div>
                        </div>
                        <div className="grid grid-cols-24 gap-1.5 h-10 px-1">
                            {hours.map(h => (
                                <div key={h} className="flex flex-col items-center justify-center">
                                    <span className={`text-[12px] font-black leading-none tracking-tighter ${h === currentET.hour ? 'text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'text-text-tertiary opacity-30'}`}>
                                        {h.toString().padStart(2, '0')}
                                    </span>
                                    <span className="text-[9px] font-bold text-text-tertiary opacity-10 mt-1">
                                        {((h + 13) % 24).toString().padStart(2, '0')}
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
                                    <div key={row.date} className="grid grid-cols-[130px_1fr_70px] gap-3 group/row items-center relative py-1">
                                        {isToday && (
                                            <div className="absolute -inset-y-1 -left-2 w-[130px] bg-orange-500/[0.02] border-l-2 border-orange-500/40 rounded-r-xl pointer-events-none"></div>
                                        )}
                                        <div className={`text-[13px] font-black transition-all uppercase text-right pr-6 ${isToday ? 'text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.3)]' : 'text-text-tertiary opacity-40 group-hover/row:opacity-100 group-hover/row:text-text-secondary'}`}>
                                            {row.date}
                                        </div>

                                        <div className="grid grid-cols-24 gap-1.5 p-1.5 bg-zinc-50/50 dark:bg-white/[0.015] border border-white/[0.04] rounded-[1.25rem] transition-all group-hover/row:bg-zinc-100/50 dark:group-hover/row:bg-white/[0.03] group-hover/row:shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
                                            {hours.map(h => {
                                                const hourKey = h.toString().padStart(2, '0') + ':00';
                                                const hourData = row[hourKey] || { tweet: 0, reply: 0 };
                                                const count = includeReplies ? (hourData.tweet + hourData.reply) : hourData.tweet;
                                                rowTotal += count;

                                                const isCurrentSlot = isToday && h === currentET.hour;

                                                return (
                                                    <Tooltip
                                                        key={h}
                                                        title={
                                                            <div className="p-3 min-w-[140px]">
                                                                <div className="font-extrabold border-b border-white/10 mb-2 pb-1 text-orange-400 tracking-tight">{row.date} @ {hourKey}</div>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-[10px] uppercase font-bold text-white/50">Engagement</span>
                                                                    <span className="font-black text-white">{count} Posts</span>
                                                                </div>
                                                                <div className="text-[9px] text-white/20 uppercase font-black mt-1">Live Matrix Feed</div>
                                                            </div>
                                                        }
                                                        color="#09090b"
                                                        overlayClassName="heatmap-tooltip"
                                                        mouseEnterDelay={0.02}
                                                    >
                                                        <div
                                                            className={`h-11 rounded-[0.75rem] transition-all duration-300 flex items-center justify-center text-xs font-black cursor-crosshair relative overflow-hidden group/cell ${isCurrentSlot ? 'z-30 shadow-[0_0_20px_rgba(0,0,0,0.4)]' : 'hover:scale-125 hover:z-20 hover:shadow-xl'} ${getCellStyles(count, row._norm, h)}`}
                                                        >
                                                            {isCurrentSlot ? (
                                                                <div className="w-full h-full flex items-center justify-center p-0.5 relative pointer-events-none">
                                                                    <div className="w-full h-full bg-white/10 backdrop-blur-md rounded-lg border border-white/30 flex items-center justify-center animate-bounce-subtle z-10 shadow-lg">
                                                                        <img
                                                                            src="/assets/elon_laugh.png"
                                                                            alt="Elon"
                                                                            className="w-full h-full object-contain scale-110 drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]"
                                                                        />
                                                                    </div>
                                                                    {count > 0 && (
                                                                        <span className="absolute -bottom-1 -right-1 text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded-md z-20 font-black shadow-[0_2px_4px_rgba(0,0,0,0.3)] border border-white/20">
                                                                            {count}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="relative z-10 select-none">{count > 0 ? count : ''}</span>
                                                            )}
                                                            {/* Subtle shimmer for active cells */}
                                                            {count > 0 && !isCurrentSlot && (
                                                                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover/cell:opacity-100 transition-opacity"></div>
                                                            )}
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-end pr-4">
                                            <div className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${rowTotal > 0 ? 'bg-orange-500/5 text-orange-500 shadow-sm border border-orange-500/10' : 'text-text-tertiary opacity-10'}`}>
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
            <style jsx global>{`
                @keyframes pulse-border {
                    0% { border-color: rgba(249, 115, 22, 0.4); box-shadow: 0 0 5px rgba(249, 115, 22, 0.2); }
                    50% { border-color: rgba(249, 115, 22, 1); box-shadow: 0 0 15px rgba(249, 115, 22, 0.4); }
                    100% { border-color: rgba(249, 115, 22, 0.4); box-shadow: 0 0 5px rgba(249, 115, 22, 0.2); }
                }
                .anim-pulse-border {
                    animation: pulse-border 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default ActivityHeatmap;
