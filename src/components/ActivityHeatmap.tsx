'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { Tooltip, Checkbox, Spin } from 'antd';
import { TweetStatusRawResponse } from '../lib/types';

const ActivityHeatmap: React.FC = () => {
    const [includeReplies, setIncludeReplies] = useState(false);
    const [apiData, setApiData] = useState<TweetStatusRawResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentET, setCurrentET] = useState<{ dateStr: string; hour: number }>({ dateStr: '', hour: 0 });

    // Update current ET time every second
    useEffect(() => {
        const updateET = () => {
            const now = new Date();
            const etFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                hour12: false
            });
            const parts = etFormatter.formatToParts(now);
            const month = parts.find(p => p.type === 'month')?.value || '';
            const day = parts.find(p => p.type === 'day')?.value || '';
            const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');

            setCurrentET({
                dateStr: `${month} ${day}`,
                hour: hour
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

        const posts = [...apiData.posts];
        const hasCurrentDay = posts.some(p => p.date === currentET.dateStr);

        if (!hasCurrentDay && currentET.dateStr) {
            posts.unshift({ date: currentET.dateStr });
        }

        return { heatmapRows: posts, hours: hourArray };
    }, [apiData, currentET.dateStr]);

    const getCellStyles = (count: number) => {
        if (count === 0) return 'bg-slate-100/50 dark:bg-zinc-800/20 text-transparent';

        let colorClasses = '';
        let shadowClasses = '';

        if (count <= 2) {
            colorClasses = 'bg-amber-400 dark:bg-amber-500';
            shadowClasses = 'shadow-[0_0_12px_rgba(251,191,36,0.2)]';
        } else if (count <= 5) {
            colorClasses = 'bg-orange-400 dark:bg-orange-500';
            shadowClasses = 'shadow-[0_0_15px_rgba(251,146,60,0.3)]';
        } else if (count <= 10) {
            colorClasses = 'bg-orange-600 dark:bg-orange-600';
            shadowClasses = 'shadow-[0_0_20px_rgba(234,88,12,0.4)]';
        } else {
            colorClasses = 'bg-red-600 dark:bg-red-600';
            shadowClasses = 'shadow-[0_0_25px_rgba(220,38,38,0.5)]';
        }

        return `${colorClasses} ${shadowClasses} text-white scale-[1.02]`;
    };

    return (
        <div className="bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-2xl overflow-hidden relative group/canvas">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-orange-500/10 blur-[100px] pointer-events-none rounded-full"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-amber-500/10 blur-[100px] pointer-events-none rounded-full"></div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <span className="w-2 h-8 bg-gradient-to-b from-orange-400 to-orange-600 rounded-full block"></span>
                        <span className="absolute inset-0 bg-orange-500/40 blur-md rounded-full animate-pulse"></span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-text-primary tracking-tight">EVALUATION FLOW</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-[ping_2s_infinite]"></div>
                            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest tracking-tighter">Live Monitor ET</span>
                        </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer ml-6 bg-slate-100 dark:bg-zinc-800/50 px-4 py-2 rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-800 transition-all active:scale-95 group">
                        <Checkbox
                            checked={includeReplies}
                            onChange={e => setIncludeReplies(e.target.checked)}
                            className="hidden"
                        />
                        <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${includeReplies ? 'bg-orange-500 border-orange-500 scale-110' : 'border-zinc-400 group-hover:border-orange-400'}`}>
                            {includeReplies && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${includeReplies ? 'text-orange-500' : 'text-text-tertiary group-hover:text-text-secondary'}`}>
                            Include Replies
                        </span>
                    </label>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center gap-4 text-[10px] font-black tracking-widest text-text-tertiary">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-slate-200 dark:bg-zinc-800 rounded-sm"></span>
                        <span>OFFLINE</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-amber-400 rounded-sm shadow-[0_0_8px_rgba(251,191,36,0.4)]"></span>
                        <span>LOW</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-orange-500 rounded-sm shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>
                        <span>PEAK</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-red-600 rounded-sm shadow-[0_0_12px_rgba(220,38,38,0.6)]"></span>
                        <span>OVERLOAD</span>
                    </div>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-6 custom-scrollbar scroll-smooth">
                <div className="min-w-[900px] relative">
                    {/* Time Scale Header */}
                    <div className="flex mb-10 items-end">
                        <div className="w-24 shrink-0 px-2 opacity-0">DATE</div>
                        <div className="flex-1 flex relative h-12 items-center px-1">
                            {hours.map(h => (
                                <div key={h} className="flex-1 text-center group/hour relative">
                                    <span className="text-[10px] font-bold text-text-tertiary group-hover/hour:text-orange-500 transition-colors">
                                        {h.toString().padStart(2, '0')}
                                    </span>
                                    <div className="absolute top-full left-1/2 -ml-[0.5px] w-[1px] h-2 bg-slate-200 dark:bg-zinc-800 mt-1"></div>
                                </div>
                            ))}

                            {/* Elon Avatar Tracking */}
                            <div
                                className="absolute top-0 transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) z-20 pointer-events-none"
                                style={{
                                    left: `${(currentET.hour / 24) * 100}%`,
                                    width: `${(1 / 24) * 100}%`,
                                    display: 'flex',
                                    justifyContent: 'center'
                                }}
                            >
                                <div className="relative flex flex-col items-center">
                                    <div className="bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full mb-1 border border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.8)]">
                                        ELON NOW
                                    </div>
                                    <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-orange-600 via-amber-400 to-orange-500 shadow-2xl animate-bounce-subtle">
                                        <div className="w-full h-full rounded-full border-2 border-slate-900 overflow-hidden bg-zinc-900">
                                            <img
                                                src="https://pbs.twimg.com/profile_images/1780044485541699584/p_isra3f_400x400.jpg"
                                                alt="Elon"
                                                className="w-full h-full object-cover scale-110"
                                            />
                                        </div>
                                    </div>
                                    <div className="h-64 w-[2px] bg-gradient-to-b from-orange-400/50 to-transparent mt-2 pointer-events-none"></div>
                                </div>
                            </div>
                        </div>
                        <div className="w-20 shrink-0 text-right pr-4 text-[10px] font-black text-text-tertiary tracking-widest">TOTAL</div>
                    </div>

                    {/* Data Grid */}
                    <Spin spinning={loading} size="large">
                        <div className="space-y-3 relative z-10">
                            {heatmapRows.map((row) => {
                                let rowTotal = 0;
                                return (
                                    <div key={row.date} className="flex items-center group/row">
                                        <div className="w-24 shrink-0">
                                            <div className="text-[11px] font-black text-text-tertiary group-hover/row:text-orange-500 transition-colors uppercase pr-4 text-right">
                                                {row.date}
                                            </div>
                                        </div>
                                        <div className="flex-1 flex gap-1.5 bg-slate-50/50 dark:bg-white/1 p-1.5 rounded-2xl border border-slate-100 dark:border-white/5 transition-all group-hover/row:bg-slate-100/50 dark:group-hover/row:bg-white/[0.03]">
                                            {hours.map(h => {
                                                const hourKey = h.toString().padStart(2, '0') + ':00';
                                                const hourData = row[hourKey] || { tweet: 0, reply: 0 };
                                                const count = includeReplies ? (hourData.tweet + hourData.reply) : hourData.tweet;
                                                rowTotal += count;

                                                return (
                                                    <Tooltip
                                                        key={h}
                                                        title={
                                                            <div className="p-1">
                                                                <div className="font-bold border-b border-white/10 mb-1 pb-1">{row.date} {hourKey}</div>
                                                                <div className="text-[11px]">Tweets: {hourData.tweet}</div>
                                                                <div className="text-[11px] opacity-70">Replies: {hourData.reply}</div>
                                                            </div>
                                                        }
                                                        color="#09090b"
                                                    >
                                                        <div
                                                            className={`flex-1 h-10 rounded-xl transition-all duration-300 hover:scale-125 hover:z-30 hover:rounded-lg cursor-crosshair flex items-center justify-center text-xs font-black ring-offset-2 ring-offset-transparent hover:ring-2 hover:ring-orange-400/50 ${getCellStyles(count)}`}
                                                        >
                                                            {count > 0 ? count : ''}
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>
                                        <div className="w-20 shrink-0 text-right pr-4">
                                            <div className={`inline-block px-3 py-1 rounded-full text-sm font-black transition-all ${rowTotal > 0 ? 'text-orange-500 bg-orange-500/10' : 'text-text-tertiary opacity-40'}`}>
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
