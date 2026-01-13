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
            if (isCurrently) return 'bg-orange-500/10 border-2 border-orange-500/60 shadow-[0_0_25px_rgba(249,115,22,0.2)] anim-pulse-border scale-[1.05] z-10';
            return past
                ? 'bg-[#1e293b]/30 dark:bg-slate-800/20 border border-white/[0.03] hover:bg-white/10 transition-colors'
                : 'bg-transparent border border-dashed border-white/[0.08] hover:border-white/20 transition-all';
        }

        let bgClass = '';
        let glowClass = '';

        if (count <= 2) {
            bgClass = 'bg-gradient-to-tr from-[#f59e0b] via-[#fbbf24] to-[#f59e0b] bg-[length:200%_200%] animate-shimmer-fast';
            glowClass = 'shadow-[0_4px_12px_rgba(245,158,11,0.3)]';
        } else if (count <= 5) {
            bgClass = 'bg-gradient-to-tr from-[#f97316] via-[#fb923c] to-[#f97316] bg-[length:200%_200%] animate-shimmer-fast';
            glowClass = 'shadow-[0_4px_16px_rgba(249,115,22,0.4)]';
        } else {
            bgClass = 'bg-gradient-to-tr from-[#e11d48] via-[#f43f5e] to-[#e11d48] bg-[length:200%_200%] animate-shimmer-fast';
            glowClass = 'shadow-[0_4px_20px_rgba(225,29,72,0.5)]';
        }

        return `${bgClass} ${glowClass} text-white font-black border border-white/20 scale-[1.05] hover:scale-125 hover:z-20 transition-all cursor-pointer shadow-xl ring-1 ring-white/10`;
    };

    return (
        <div className="bg-white/95 dark:bg-[#0a0a0b]/95 backdrop-blur-[40px] p-8 rounded-[3.5rem] border border-white/20 dark:border-white/[0.08] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] overflow-hidden relative group/main">
            {/* Ultra-premium background glows */}
            <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[500px] h-[500px] bg-orange-500/10 blur-[150px] pointer-events-none rounded-full opacity-50 group-hover/main:opacity-80 transition-opacity duration-1000"></div>
            <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[500px] h-[500px] bg-red-600/10 blur-[150px] pointer-events-none rounded-full opacity-50 group-hover/main:opacity-80 transition-opacity duration-1000"></div>

            <div className="flex flex-col xl:flex-row items-center justify-between mb-12 gap-8 px-6 relative z-20">
                <div className="flex items-center gap-8">
                    <div className="relative">
                        <div className="absolute -inset-2 bg-gradient-to-b from-orange-400 to-red-600 rounded-full blur-[8px] opacity-20 animate-pulse"></div>
                        <span className="relative w-2.5 h-14 bg-gradient-to-b from-orange-400 via-orange-500 to-red-600 rounded-full block shadow-lg"></span>
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-4xl font-black text-text-primary tracking-[0.05em] uppercase italic leading-none selection:bg-orange-500 selection:text-white">Timeline</h2>
                            <span className="text-4xl font-light text-text-tertiary opacity-30 italic">/ Matrix</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="px-4 py-1.5 bg-gradient-to-r from-green-500/20 to-emerald-500/10 border border-green-500/30 rounded-full flex items-center gap-2.5 shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
                                <span className="text-[11px] font-black text-green-500 uppercase tracking-[0.2em]">Live Stream</span>
                            </div>
                            <span className="text-[13px] font-black text-text-tertiary tracking-tighter tabular-nums opacity-60">
                                {currentET.dateStr} <span className="mx-1 opacity-20">•</span> {currentET.hour}:{currentET.minute.toString().padStart(2, '0')} ET
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-10">
                    <label className="flex items-center gap-4 cursor-pointer group bg-zinc-50 dark:bg-white/[0.03] px-6 py-3 rounded-3xl border border-zinc-200/50 dark:border-white/[0.05] hover:border-orange-500/40 transition-all shadow-sm hover:shadow-lg active:scale-95">
                        <Checkbox
                            checked={includeReplies}
                            onChange={e => setIncludeReplies(e.target.checked)}
                            className="hidden"
                        />
                        <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all duration-500 ${includeReplies ? 'bg-gradient-to-br from-orange-400 to-orange-600 border-orange-500 shadow-lg' : 'border-zinc-400/50'}`}>
                            {includeReplies && <svg className="w-3.5 h-3.5 text-white fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>}
                        </div>
                        <span className={`text-[12px] font-black uppercase tracking-[0.15em] transition-colors ${includeReplies ? 'text-orange-500' : 'text-text-tertiary group-hover:text-text-secondary'}`}>Show Replies</span>
                    </label>

                    <div className="flex items-center gap-8 py-3 px-8 bg-zinc-50 dark:bg-white/[0.03] rounded-3xl border border-zinc-200/50 dark:border-white/[0.05] shadow-sm">
                        <div className="flex items-center gap-3 text-[11px] font-black tracking-widest text-text-tertiary group/legend">
                            <span className="w-4 h-4 bg-slate-800/60 rounded-md border border-white/10 shadow-inner group-hover/legend:scale-110 transition-transform"></span>
                            <span className="opacity-60 group-hover/legend:opacity-100 transition-opacity">ARCHIVE</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-black tracking-widest text-text-tertiary group/legend">
                            <span className="w-4 h-4 border-2 border-dashed border-zinc-500/30 rounded-md group-hover/legend:scale-110 transition-transform"></span>
                            <span className="opacity-40 group-hover/legend:opacity-100 transition-opacity">FUTURE</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-12 custom-scrollbar scroll-smooth">
                <div className="min-w-[1100px] px-6 scale-[0.99] origin-top">
                    {/* Precision Header */}
                    <div className="grid grid-cols-[140px_1fr_80px] gap-4 mb-8 items-end relative z-20">
                        <div className="flex flex-col justify-center text-[12px] font-black text-text-tertiary text-right pr-8 italic opacity-40 space-y-1.5 selection:bg-none">
                            <div className="tracking-[0.2em] font-light">ET SCALE</div>
                            <div className="text-orange-500 font-black tracking-widest">LT SYNC</div>
                        </div>
                        <div className="grid grid-cols-24 gap-2 h-12 px-2">
                            {hours.map(h => (
                                <div key={h} className="flex flex-col items-center justify-center group/hour">
                                    <span className={`text-[14px] font-black leading-none tracking-tighter transition-all duration-300 ${h === currentET.hour ? 'text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.6)] scale-125' : 'text-text-tertiary opacity-20 group-hover/hour:opacity-60'}`}>
                                        {h.toString().padStart(2, '0')}
                                    </span>
                                    <span className="text-[10px] font-bold text-text-tertiary opacity-5 mt-1.5 transition-opacity group-hover/hour:opacity-30 tabular-nums">
                                        {((h + 13) % 24).toString().padStart(2, '0')}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-end text-[12px] font-black text-text-tertiary opacity-30 pr-6 tracking-[0.2em]">SUM</div>
                    </div>

                    <Spin spinning={loading} size="large">
                        <div className="space-y-3 pb-8 relative z-10">
                            {heatmapRows.map((row, idx) => {
                                let rowTotal = 0;
                                const rowDateNorm = row.date?.toLowerCase().trim();
                                const todayDateNorm = currentET.dateStr.toLowerCase().trim();
                                const isToday = rowDateNorm === todayDateNorm;

                                return (
                                    <div key={row.date}
                                        className="grid grid-cols-[140px_1fr_80px] gap-4 group/row items-center relative py-1.5 transition-all duration-500 hover:translate-x-1"
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                    >
                                        {isToday && (
                                            <div className="absolute -inset-y-2 -left-4 w-[160px] bg-gradient-to-r from-orange-500/10 to-transparent border-l-[3px] border-orange-500 rounded-r-2xl pointer-events-none shadow-[inset_10px_0_20px_-10px_rgba(249,115,22,0.2)]"></div>
                                        )}
                                        <div className={`text-[15px] font-black transition-all uppercase text-right pr-8 tabular-nums ${isToday ? 'text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-110' : 'text-text-tertiary opacity-30 group-hover/row:opacity-100 group-hover/row:text-text-secondary group-hover/row:tracking-widest'}`}>
                                            {row.date}
                                        </div>

                                        <div className="grid grid-cols-24 gap-2 p-2 bg-slate-50/30 dark:bg-white/[0.012] border border-white/[0.04] rounded-[1.5rem] transition-all duration-500 group-hover/row:bg-slate-100/40 dark:group-hover/row:bg-white/[0.025] group-hover/row:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.3)] group-hover/row:border-white/[0.08] backdrop-blur-sm">
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
                                                            <div className="p-4 min-w-[160px] backdrop-blur-xl bg-black/60 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                                                                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 blur-2xl rounded-full"></div>
                                                                <div className="font-black border-b border-white/10 mb-3 pb-2 text-orange-400 tracking-wider flex justify-between items-center text-xs">
                                                                    <span>{row.date}</span>
                                                                    <span className="opacity-40">{hourKey}</span>
                                                                </div>
                                                                <div className="flex justify-between items-end mb-2">
                                                                    <span className="text-[10px] uppercase font-bold text-white/40 tracking-[0.1em]">Intensity</span>
                                                                    <span className="text-xl font-black text-white leading-none">{count}</span>
                                                                </div>
                                                                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                                                    <div className="bg-orange-500 h-full transition-all duration-500" style={{ width: `${Math.min(count * 5, 100)}%` }}></div>
                                                                </div>
                                                            </div>
                                                        }
                                                        color="transparent"
                                                        overlayClassName="heatmap-tooltip-v2"
                                                        mouseEnterDelay={0.01}
                                                    >
                                                        <div
                                                            className={`h-11 rounded-[0.85rem] transition-all duration-300 flex items-center justify-center text-xs font-black cursor-crosshair relative group/cell ${isCurrentSlot ? 'z-40 shadow-[0_8px_32px_rgba(0,0,0,0.5)]' : ''} ${getCellStyles(count, row._norm, h)}`}
                                                        >
                                                            {isCurrentSlot ? (
                                                                <div className="w-full h-full flex items-center justify-center p-0.5 relative pointer-events-none group-hover/cell:scale-110 transition-transform">
                                                                    <div className="w-full h-full bg-white/10 backdrop-blur-xl rounded-xl border border-white/40 flex items-center justify-center animate-bounce-subtle z-10 shadow-2xl overflow-hidden">
                                                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"></div>
                                                                        <img
                                                                            src="/assets/elon_laugh.png"
                                                                            alt="Elon"
                                                                            className="w-full h-full object-contain scale-[1.3] drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] relative z-20"
                                                                        />
                                                                    </div>
                                                                    {count > 0 && (
                                                                        <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-lg z-30 font-black shadow-[0_4px_12px_rgba(220,38,38,0.5)] border-2 border-white/50 animate-pulse">
                                                                            {count}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="relative z-10 select-none drop-shadow-sm transition-all group-hover/cell:scale-125">{count > 0 ? count : ''}</span>
                                                            )}

                                                            {/* Intelligent Cell Light */}
                                                            {count > 0 && !isCurrentSlot && (
                                                                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/10 opacity-40"></div>
                                                            )}
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-end pr-6">
                                            <div className={`px-4 py-2 rounded-2xl text-[13px] font-black transition-all duration-500 tabular-nums ${rowTotal > 0 ? 'bg-orange-500/10 text-orange-500 shadow-md border border-orange-500/20 group-hover/row:bg-orange-500 group-hover/row:text-white group-hover/row:shadow-orange-500/40' : 'text-text-tertiary opacity-5 cursor-not-allowed group-hover/row:opacity-20'}`}>
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

            {/* Global Design Styles */}
            <style jsx global>{`
                @keyframes pulse-border {
                    0% { border-color: rgba(249, 115, 22, 0.4); box-shadow: 0 0 5px rgba(249, 115, 22, 0.2); }
                    50% { border-color: rgba(249, 115, 22, 1); box-shadow: 0 0 25px rgba(249, 115, 22, 0.5); }
                    100% { border-color: rgba(249, 115, 22, 0.4); box-shadow: 0 0 5px rgba(249, 115, 22, 0.2); }
                }
                @keyframes shimmer-fast {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .anim-pulse-border {
                    animation: pulse-border 2.5s infinite ease-in-out;
                }
                .animate-shimmer-fast {
                    animation: shimmer-fast 3s linear infinite;
                }
                .heatmap-tooltip-v2 .ant-tooltip-inner {
                    padding: 0 !important;
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .heatmap-tooltip-v2 .ant-tooltip-arrow {
                    display: none !important;
                }
            `}</style>
        </div>
    );
};

export default ActivityHeatmap;
