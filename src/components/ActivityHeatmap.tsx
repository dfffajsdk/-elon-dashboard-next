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
                ? 'bg-zinc-800/20 dark:bg-black/20 border border-white/[0.03]' // Subtle dark glass for passed
                : 'bg-transparent border border-dashed border-white/[0.05]'; // Hollow for future
        }

        let bgClass = '';
        let glowClass = '';

        if (count <= 2) {
            bgClass = 'bg-gradient-to-br from-amber-400 to-amber-600';
            glowClass = 'shadow-[0_0_15px_rgba(251,191,36,0.2)]';
        } else if (count <= 5) {
            bgClass = 'bg-gradient-to-br from-orange-400 to-orange-600';
            glowClass = 'shadow-[0_0_20px_rgba(249,115,22,0.3)]';
        } else {
            bgClass = 'bg-gradient-to-br from-red-500 to-red-700';
            glowClass = 'shadow-[0_0_25px_rgba(239,68,68,0.4)]';
        }

        return `${bgClass} ${glowClass} text-white font-black border border-white/10 ring-1 ring-white/5`;
    };

    return (
        <div className="bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl p-8 rounded-[3rem] border border-white/20 dark:border-white/5 shadow-[0_32px_128px_rgba(0,0,0,0.5)] overflow-hidden relative">
            {/* Design accents */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-orange-600/5 blur-[120px] pointer-events-none rounded-full"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-red-600/5 blur-[120px] pointer-events-none rounded-full"></div>

            <div className="flex flex-col md:flex-row items-end justify-between mb-8 gap-6 relative z-20">
                <div className="flex items-end gap-6">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-b from-orange-400 to-red-600 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                        <span className="relative w-2 h-12 bg-gradient-to-b from-orange-400 to-red-600 rounded-full block"></span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-text-primary tracking-tighter uppercase italic leading-none mb-2">Activity Stream</h2>
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest whitespace-nowrap">ET SYNC</span>
                            </div>
                            <span className="text-xs font-bold text-text-tertiary">
                                {currentET.dateStr} — {currentET.hour}:{currentET.minute.toString().padStart(2, '0')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <label className="flex items-center gap-3 cursor-pointer group bg-zinc-100 dark:bg-zinc-900/50 px-5 py-2.5 rounded-2xl border border-zinc-200 dark:border-white/5 hover:border-orange-500/50 transition-all">
                        <Checkbox
                            checked={includeReplies}
                            onChange={e => setIncludeReplies(e.target.checked)}
                            className="hidden"
                        />
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${includeReplies ? 'bg-orange-500 border-orange-500' : 'border-zinc-400 group-hover:border-orange-400'}`}>
                            {includeReplies && <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>}
                        </div>
                        <span className={`text-xs font-black uppercase tracking-widest transition-colors ${includeReplies ? 'text-orange-500' : 'text-text-tertiary group-hover:text-text-secondary'}`}>
                            REPLIES
                        </span>
                    </label>

                    <div className="flex items-center gap-4 text-[10px] font-black text-text-tertiary tracking-widest bg-zinc-100 dark:bg-zinc-900/30 px-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-white/5">
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 bg-zinc-800/40 rounded-sm border border-white/5"></span>
                            <span>PASS</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 border border-dashed border-white/20 rounded-sm"></span>
                            <span>NEXT</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-6 custom-scrollbar scroll-smooth">
                <div className="min-w-[1050px] relative">
                    {/* Precision Header Grid */}
                    <div className="grid grid-cols-[110px_1fr_70px] mb-4 relative z-20">
                        <div className="flex flex-col justify-center pr-4 text-[11px] font-black text-text-tertiary uppercase tracking-tighter opacity-70">
                            <div>ET TIME</div>
                            <div className="text-orange-500/80">LT SYNC</div>
                        </div>
                        <div className="grid grid-cols-24 gap-1.5 relative">
                            {hours.map(h => (
                                <div key={h} className="text-center group/hour relative h-10 flex flex-col justify-center">
                                    <span className={`text-[12px] font-black transition-colors block leading-none ${h === currentET.hour ? 'text-orange-500 scale-125' : 'text-text-tertiary opacity-40'}`}>
                                        {h.toString().padStart(2, '0')}
                                    </span>
                                    <span className="text-[9px] font-bold text-text-tertiary opacity-30 mt-1">
                                        {((h + 13) % 24).toString().padStart(2, '0')}
                                    </span>
                                </div>
                            ))}

                            {/* Avatar Tracker */}
                            <div
                                className="absolute top-0 bottom-[-2000px] transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) z-40 pointer-events-none"
                                style={{
                                    left: `${((currentET.hour + currentET.minute / 60) / 24) * 100}%`,
                                    transform: 'translateX(-50%)',
                                }}
                            >
                                <div className="flex flex-col items-center">
                                    <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-orange-400 via-white to-red-500 animate-bounce-subtle shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                                        <div className="w-full h-full rounded-full border-2 border-slate-900 overflow-hidden bg-black">
                                            <img
                                                src="https://pbs.twimg.com/profile_images/1780044485541699584/p_isra3f_400x400.jpg"
                                                alt="Elon"
                                                className="w-full h-full object-cover scale-110"
                                            />
                                        </div>
                                    </div>
                                    <div className="w-[1px] h-full bg-gradient-to-b from-orange-500/60 via-orange-500/5 to-transparent mt-2"></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end pr-4 text-[10px] font-black text-text-tertiary tracking-widest uppercase opacity-40 italic">SUM</div>
                    </div>

                    <Spin spinning={loading} size="large">
                        <div className="space-y-2 relative z-10">
                            {heatmapRows.map((row) => {
                                let rowTotal = 0;
                                const isToday = row.date === currentET.dateStr;
                                return (
                                    <div key={row.date} className="grid grid-cols-[110px_1fr_70px] group/row relative items-center">
                                        <div className={`text-xs font-black transition-all uppercase pr-6 text-right ${isToday ? 'text-orange-500 scale-110 drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]' : 'text-text-tertiary opacity-60 group-hover/row:opacity-100 group-hover/row:text-text-secondary'}`}>
                                            {row.date}
                                        </div>

                                        <div className="grid grid-cols-24 gap-1.5 p-1.5 bg-zinc-50/50 dark:bg-white/[0.02] rounded-2xl border border-zinc-200/50 dark:border-white/[0.03] transition-all group-hover/row:bg-zinc-100/50 dark:group-hover/row:bg-white/[0.04] group-hover/row:shadow-lg">
                                            {hours.map(h => {
                                                const hourKey = h.toString().padStart(2, '0') + ':00';
                                                const hourData = row[hourKey] || { tweet: 0, reply: 0 };
                                                const count = includeReplies ? (hourData.tweet + hourData.reply) : hourData.tweet;
                                                rowTotal += count;

                                                return (
                                                    <Tooltip
                                                        key={h}
                                                        title={
                                                            <div className="p-2 min-w-[140px]">
                                                                <div className="font-extrabold border-b border-white/10 mb-2 pb-1 text-orange-400 tracking-tight">{row.date} @ {hourKey}</div>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-[10px] uppercase font-bold text-white/50">Activity</span>
                                                                    <span className="font-black text-white">{count} Posts</span>
                                                                </div>
                                                                <div className="text-[9px] text-white/30 uppercase font-black">Ready for inspection</div>
                                                            </div>
                                                        }
                                                        color="#09090b"
                                                        overlayClassName="heatmap-tooltip"
                                                        mouseEnterDelay={0.02}
                                                    >
                                                        <div
                                                            className={`h-11 rounded-xl transition-all duration-300 flex items-center justify-center text-sm font-black relative overflow-hidden active:scale-90 group/cell ${getCellStyles(count, row._norm, h)}`}
                                                        >
                                                            <span className="relative z-10">{count > 0 ? count : ''}</span>
                                                            {/* High-end decorative shimmer for non-empty cells */}
                                                            {count > 0 && (
                                                                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover/cell:opacity-100 transition-opacity"></div>
                                                            )}
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-end pr-4 relative">
                                            <div className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${rowTotal > 0 ? 'bg-orange-500/10 text-orange-500 shadow-sm border border-orange-500/20' : 'text-text-tertiary opacity-20'}`}>
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
