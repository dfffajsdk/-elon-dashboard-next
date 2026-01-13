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

            // Format for comparison (e.g., 2026-01-13)
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
        // Note: posts already have _sortKey (normDate) from database.ts refined earlier
        const hasCurrentDay = posts.some(p => p.date === currentET.dateStr);

        if (!hasCurrentDay && currentET.dateStr) {
            // Add skeleton for today if missing
            posts.unshift({ date: currentET.dateStr, _norm: currentET.normDate });
        }

        return { heatmapRows: posts, hours: hourArray };
    }, [apiData, currentET.dateStr, currentET.normDate]);

    const isPast = (rowDate: string, hour: number) => {
        // rowDate is something like "2026-01-14" or matching the _sortKey from DB
        // But the posts array in database.ts stripped _sortKey. 
        // Let's rely on the date comparison logic.
        const [rowYear, rowMonth, rowDay] = (rowDate || '').split('-').map(Number);
        const [nowYear, nowMonth, nowDay] = currentET.normDate.split('-').map(Number);

        if (!rowYear) return true; // Fallback for historical

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

        // Base background for empty cells
        if (count === 0) {
            return past
                ? 'bg-slate-200/40 dark:bg-zinc-800/40 border border-slate-300/30 dark:border-white/5'
                : 'bg-slate-100/20 dark:bg-zinc-800/10 border border-dashed border-slate-200/50 dark:border-white/5';
        }

        let colorClasses = '';
        let shadowClasses = '';

        if (count <= 2) {
            colorClasses = 'bg-amber-400 dark:bg-amber-500';
            shadowClasses = 'shadow-[0_0_12px_rgba(251,191,36,0.3)]';
        } else if (count <= 5) {
            colorClasses = 'bg-orange-400 dark:bg-orange-500';
            shadowClasses = 'shadow-[0_0_15px_rgba(251,146,60,0.4)]';
        } else if (count <= 10) {
            colorClasses = 'bg-orange-600 dark:bg-orange-600';
            shadowClasses = 'shadow-[0_0_20px_rgba(234,88,12,0.5)]';
        } else {
            colorClasses = 'bg-red-600 dark:bg-red-600';
            shadowClasses = 'shadow-[0_0_25px_rgba(220,38,38,0.6)]';
        }

        // Add "Solidified" effect for passed data
        const borderClass = past ? 'ring-2 ring-white/20' : 'border border-white/10';

        return `${colorClasses} ${shadowClasses} ${borderClass} text-white scale-[1.02] hover:scale-125 z-10`;
    };

    return (
        <div className="bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-orange-500/10 blur-[100px] pointer-events-none rounded-full animate-pulse"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-amber-500/10 blur-[100px] pointer-events-none rounded-full animate-pulse"></div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4 relative z-20">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <span className="w-2 h-10 bg-gradient-to-b from-orange-400 to-red-600 rounded-full block shadow-[0_0_15px_rgba(249,115,22,0.5)]"></span>
                        <span className="absolute inset-0 bg-orange-500/40 blur-lg rounded-full animate-pulse"></span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-text-primary tracking-tighter uppercase italic">Timeline Matrix</h2>
                        <div className="flex items-center gap-2 mt-1 px-2 py-0.5 bg-green-500/10 rounded-lg w-fit">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-[ping_2s_infinite]"></div>
                            <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest">
                                ET Synchronized: {currentET.dateStr} {currentET.hour}:{currentET.minute.toString().padStart(2, '0')}
                            </span>
                        </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer ml-8 bg-white/50 dark:bg-zinc-800/40 px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-orange-500/50 transition-all active:scale-95 group shadow-sm">
                        <Checkbox
                            checked={includeReplies}
                            onChange={e => setIncludeReplies(e.target.checked)}
                            className="hidden"
                        />
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${includeReplies ? 'bg-orange-500 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'border-zinc-400 group-hover:border-orange-400'}`}>
                            {includeReplies && <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>}
                        </div>
                        <span className={`text-xs font-black uppercase tracking-widest transition-colors ${includeReplies ? 'text-orange-500' : 'text-text-tertiary group-hover:text-text-secondary'}`}>
                            Include Replies
                        </span>
                    </label>
                </div>

                <div className="p-4 bg-slate-50/80 dark:bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/5 flex items-center gap-6 text-[10px] font-black tracking-widest text-text-tertiary">
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-slate-200/50 dark:bg-zinc-800/40 rounded-md border border-slate-300/30"></span>
                        <span>PASSED</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-slate-100/10 dark:bg-zinc-800/10 rounded-md border border-dashed border-zinc-500/30"></span>
                        <span>FUTURE</span>
                    </div>
                    <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800"></div>
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-orange-500 rounded-md shadow-lg"></span>
                        <span>ACTIVE</span>
                    </div>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-10 custom-scrollbar scroll-smooth">
                <div className="min-w-[1000px] relative">
                    {/* Time Header Grid */}
                    <div className="flex mb-12 items-end relative">
                        <div className="w-28 shrink-0"></div>
                        <div className="flex-1 grid grid-cols-24 gap-1.5 relative px-0">
                            {hours.map(h => (
                                <div key={h} className="text-center group/hour relative h-8 flex flex-col justify-between">
                                    <span className="text-[11px] font-black text-text-tertiary group-hover/hour:text-orange-500 transition-colors block">
                                        {h.toString().padStart(2, '0')}
                                    </span>
                                    <div className="flex justify-center">
                                        <div className={`w-[2px] h-2 rounded-full transition-colors ${h === currentET.hour ? 'bg-orange-500' : 'bg-slate-200 dark:bg-zinc-800'}`}></div>
                                    </div>
                                </div>
                            ))}

                            {/* Precise Avatar Tracker */}
                            <div
                                className="absolute -top-4 bottom-[-1000px] transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) z-30 pointer-events-none"
                                style={{
                                    left: `calc(${((currentET.hour + currentET.minute / 60) / 24) * 100}% + 1px)`,
                                    transform: 'translateX(-50%)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center'
                                }}
                            >
                                <div className="relative flex flex-col items-center">
                                    <div className="bg-orange-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md mb-2 border border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.6)] whitespace-nowrap animate-pulse">
                                        LIVE MARKER
                                    </div>
                                    <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-orange-600 via-amber-400 to-red-600 shadow-2xl animate-bounce-subtle ring-4 ring-orange-500/20">
                                        <div className="w-full h-full rounded-full border-2 border-slate-900 overflow-hidden bg-black">
                                            <img
                                                src="https://pbs.twimg.com/profile_images/1780044485541699584/p_isra3f_400x400.jpg"
                                                alt="Elon"
                                                className="w-full h-full object-cover scale-110"
                                            />
                                        </div>
                                    </div>
                                    <div className="w-[2px] h-[5000px] bg-gradient-to-b from-orange-500/80 via-orange-500/20 to-transparent mt-2"></div>
                                </div>
                            </div>
                        </div>
                        <div className="w-20 shrink-0 text-right pr-6 text-[11px] font-black text-text-tertiary tracking-widest uppercase">Sum</div>
                    </div>

                    {/* Data Matrix */}
                    <Spin spinning={loading} size="large">
                        <div className="space-y-4 relative z-10">
                            {heatmapRows.map((row) => {
                                let rowTotal = 0;
                                const isToday = row.date === currentET.dateStr;
                                return (
                                    <div key={row.date} className="flex items-center group/row relative">
                                        {isToday && (
                                            <div className="absolute -inset-y-2 -inset-x-3 bg-gradient-to-r from-orange-500/10 to-transparent border-l-4 border-orange-500 rounded-r-3xl pointer-events-none transition-all group-hover/row:from-orange-500/15"></div>
                                        )}
                                        <div className="w-28 shrink-0 relative">
                                            <div className={`text-xs font-black transition-all uppercase pr-6 text-right flex flex-col ${isToday ? 'text-orange-600 scale-110' : 'text-text-tertiary group-hover/row:text-orange-500'}`}>
                                                <span>{row.date}</span>
                                                {isToday && <span className="text-[9px] font-black text-orange-500/70 tracking-tighter">CURRENT SESSION</span>}
                                            </div>
                                        </div>

                                        <div className="flex-1 grid grid-cols-24 gap-1.5 p-2 bg-slate-50/30 dark:bg-white/[0.02] rounded-2xl border border-slate-200/50 dark:border-white/5 transition-all group-hover/row:bg-slate-100/50 dark:group-hover/row:bg-white/[0.05] group-hover/row:shadow-xl">
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
                                                                <div className="font-extrabold border-b border-white/20 mb-2 pb-1 text-orange-500">{row.date} {hourKey}</div>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="opacity-70 text-[10px] uppercase font-bold">Post Count</span>
                                                                    <span className="font-black text-sm">{hourData.tweet}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="opacity-70 text-[10px] uppercase font-bold">Replies</span>
                                                                    <span className="font-black text-sm">{hourData.reply}</span>
                                                                </div>
                                                            </div>
                                                        }
                                                        color="#09090b"
                                                        overlayClassName="heatmap-tooltip"
                                                        mouseEnterDelay={0}
                                                    >
                                                        <div
                                                            className={`h-11 rounded-xl transition-all duration-500 flex items-center justify-center text-[13px] font-black cursor-none select-none ${getCellStyles(count, row._norm, h)}`}
                                                        >
                                                            {count > 0 ? count : ''}
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>

                                        <div className="w-20 shrink-0 text-right pr-6 relative">
                                            <div className={`inline-block px-4 py-1.5 rounded-xl text-sm font-black transition-all ${rowTotal > 0 ? 'text-white bg-orange-600 shadow-lg shadow-orange-600/20' : 'text-text-tertiary opacity-30 scale-90'}`}>
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
