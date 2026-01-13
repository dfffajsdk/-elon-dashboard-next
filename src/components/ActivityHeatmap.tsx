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
                ? 'bg-zinc-300/[0.15] dark:bg-zinc-700/[0.25] border border-white/[0.04]' // Noticeable past
                : 'bg-transparent border border-dashed border-white/[0.05]'; // Hollow future
        }

        let bgClass = '';
        let glowClass = '';

        if (count <= 2) {
            bgClass = 'bg-orange-400 dark:bg-orange-500';
            glowClass = 'shadow-[0_0_12px_rgba(251,146,60,0.25)]';
        } else if (count <= 5) {
            bgClass = 'bg-orange-600 dark:bg-orange-600';
            glowClass = 'shadow-[0_0_18px_rgba(234,88,12,0.35)]';
        } else {
            bgClass = 'bg-red-600 dark:bg-red-600';
            glowClass = 'shadow-[0_0_24px_rgba(220,38,38,0.45)]';
        }

        return `${bgClass} ${glowClass} text-white font-black border border-white/10 ring-1 ring-white/5 scale-[1.02]`;
    };

    return (
        <div className="bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-orange-500/5 blur-[100px] pointer-events-none rounded-full"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-amber-500/5 blur-[100px] pointer-events-none rounded-full"></div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4 relative z-20">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <span className="w-1.5 h-10 bg-gradient-to-b from-orange-400 to-red-600 rounded-full block"></span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-text-primary tracking-tighter uppercase italic">Activity Stream</h2>
                        <div className="flex items-center gap-2 mt-1 px-2 py-0.5 bg-green-500/5 border border-green-500/10 rounded-lg w-fit">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500/60"></div>
                            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                                ET: {currentET.dateStr} {currentET.hour}:{currentET.minute.toString().padStart(2, '0')}
                            </span>
                        </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer ml-8 bg-slate-50 dark:bg-zinc-800/30 px-4 py-2 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-orange-500/30 transition-all hover:bg-slate-100 dark:hover:bg-zinc-800/50 group active:scale-95 shadow-sm">
                        <Checkbox
                            checked={includeReplies}
                            onChange={e => setIncludeReplies(e.target.checked)}
                            className="hidden"
                        />
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${includeReplies ? 'bg-orange-500 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]' : 'border-zinc-400 group-hover:border-orange-400'}`}>
                            {includeReplies && <svg className="w-2 h-2 text-white fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>}
                        </div>
                        <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${includeReplies ? 'text-orange-500' : 'text-text-tertiary group-hover:text-text-secondary'}`}>
                            Include Replies
                        </span>
                    </label>
                </div>

                <div className="p-3 bg-slate-50/80 dark:bg-zinc-900/40 border border-slate-100 dark:border-white/5 rounded-2xl flex items-center gap-5 text-[9px] font-black tracking-widest text-text-tertiary">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-zinc-300/40 dark:bg-zinc-700/60 rounded border border-zinc-400/30"></span>
                        <span className="text-text-secondary">PASSED</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-50">
                        <span className="w-3 h-3 bg-transparent rounded border border-dashed border-zinc-500/30"></span>
                        <span>FUTURE</span>
                    </div>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-10 custom-scrollbar scroll-smooth">
                <div className="min-w-[1050px] relative">
                    {/* Header Scale with ET and LT */}
                    <div className="grid grid-cols-[100px_1fr_60px] mb-10 items-end relative">
                        <div className="flex flex-col justify-center pr-4 text-[10px] font-black text-text-tertiary uppercase opacity-50">
                            <div>ET</div>
                            <div className="text-orange-500/80">LT</div>
                        </div>
                        <div className="grid grid-cols-24 gap-1.5 relative px-0">
                            {hours.map(h => (
                                <div key={h} className="text-center group/hour relative h-10 flex flex-col justify-center">
                                    <span className={`text-[11px] font-black transition-colors block leading-none ${h === currentET.hour ? 'text-orange-500 scale-125' : 'text-text-tertiary opacity-60'}`}>
                                        {h.toString().padStart(2, '0')}
                                    </span>
                                    <span className="text-[9px] font-bold text-text-tertiary opacity-30 mt-1">
                                        {((h + 13) % 24).toString().padStart(2, '0')}
                                    </span>
                                </div>
                            ))}

                            {/* Precise Avatar Tracker - Laughing Head Edition */}
                            <div
                                className="absolute -top-10 bottom-[-2000px] transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) z-40 pointer-events-none"
                                style={{
                                    left: `${((currentET.hour + currentET.minute / 60) / 24) * 100}%`,
                                    transform: 'translateX(-50%)',
                                }}
                            >
                                <div className="flex flex-col items-center">
                                    <div className="w-16 h-16 animate-bounce-subtle drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
                                        <img
                                            src="/assets/elon_laugh.png"
                                            alt="Elon"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <div className="w-[1.5px] h-full bg-gradient-to-b from-orange-500/60 via-orange-500/5 to-transparent mt-1"></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end pr-4 text-[10px] font-black text-text-tertiary tracking-widest uppercase opacity-40">SUM</div>
                    </div>

                    <Spin spinning={loading} size="large">
                        <div className="space-y-3 relative z-10">
                            {heatmapRows.map((row) => {
                                let rowTotal = 0;
                                const isToday = row.date === currentET.dateStr;
                                return (
                                    <div key={row.date} className="grid grid-cols-[100px_1fr_60px] group/row relative items-center">
                                        {isToday && (
                                            <div className="absolute -inset-y-1.5 -inset-x-2 bg-orange-500/[0.04] border-l-2 border-orange-500/20 rounded-r-2xl pointer-events-none"></div>
                                        )}
                                        <div className="w-100 shrink-0 relative">
                                            <div className={`text-[11px] font-black transition-all uppercase pr-6 text-right ${isToday ? 'text-orange-500' : 'text-text-tertiary opacity-70 group-hover/row:opacity-100 group-hover/row:text-orange-400'}`}>
                                                {row.date}
                                            </div>
                                        </div>

                                        <div className="flex-1 grid grid-cols-24 gap-1.5 p-1.5 bg-slate-50/20 dark:bg-white/[0.01] rounded-2xl border border-slate-100/50 dark:border-white/5 transition-all group-hover/row:bg-slate-100/30 dark:group-hover/row:bg-white/[0.02]">
                                            {hours.map(h => {
                                                const hourKey = h.toString().padStart(2, '0') + ':00';
                                                const hourData = row[hourKey] || { tweet: 0, reply: 0 };
                                                const count = includeReplies ? (hourData.tweet + hourData.reply) : hourData.tweet;
                                                rowTotal += count;

                                                return (
                                                    <Tooltip
                                                        key={h}
                                                        title={
                                                            <div className="p-2 min-w-[120px]">
                                                                <div className="font-extrabold border-b border-white/20 mb-2 pb-1 text-orange-400">{row.date} {hourKey}</div>
                                                                <div className="flex justify-between items-center mb-1 text-xs text-white">
                                                                    <span>Tweets</span>
                                                                    <span className="font-black">{hourData.tweet}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-xs text-white/70">
                                                                    <span>Replies</span>
                                                                    <span className="font-black">{hourData.reply}</span>
                                                                </div>
                                                            </div>
                                                        }
                                                        color="#09090b"
                                                        overlayClassName="heatmap-tooltip"
                                                        mouseEnterDelay={0.05}
                                                    >
                                                        <div
                                                            className={`h-10 rounded-xl transition-all duration-300 flex items-center justify-center text-xs font-black relative overflow-hidden hover:scale-125 z-10 ${getCellStyles(count, row._norm, h)}`}
                                                        >
                                                            {count > 0 ? count : ''}
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-end pr-4 relative">
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
