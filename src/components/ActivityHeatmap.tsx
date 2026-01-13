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
        const interval = setInterval(updateET, 10000); // 10s is enough for ET precision
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

    // Process data for display
    const { heatmapRows, hours } = useMemo(() => {
        const rows: any[] = [];
        const hourArray = Array.from({ length: 24 }, (_, i) => i);

        if (!apiData?.posts) return { heatmapRows: [], hours: hourArray };

        // Ensure current day is always at the top
        const posts = [...apiData.posts];
        const hasCurrentDay = posts.some(p => p.date === currentET.dateStr);

        if (!hasCurrentDay && currentET.dateStr) {
            // Unshift current day if missing (auto-new-day logic)
            posts.unshift({ date: currentET.dateStr });
        }

        return { heatmapRows: posts, hours: hourArray };
    }, [apiData, currentET.dateStr]);

    const getCellColor = (count: number) => {
        if (count === 0) return 'bg-slate-100 dark:bg-zinc-800/30';
        if (count <= 2) return 'bg-amber-400 dark:bg-amber-500';
        if (count <= 5) return 'bg-amber-500 dark:bg-amber-600';
        if (count <= 10) return 'bg-orange-500';
        return 'bg-orange-600';
    };

    return (
        <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                    <h2 className="text-xl font-bold text-text-primary">Daily Activity</h2>
                    <Checkbox
                        checked={includeReplies}
                        onChange={e => setIncludeReplies(e.target.checked)}
                        className="ml-4 text-text-secondary"
                    >
                        Include Replies
                    </Checkbox>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-text-tertiary">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-slate-100 dark:bg-zinc-800/30 rounded-sm"></span>
                        <span>0</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-amber-400 rounded-sm"></span>
                        <span>1-2</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-orange-500 rounded-sm"></span>
                        <span>3-10</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-orange-600 rounded-sm"></span>
                        <span>10+</span>
                    </div>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-4 custom-scrollbar">
                <div className="min-w-[800px]">
                    {/* Header: Hours */}
                    <div className="flex mb-4">
                        <div className="w-20 shrink-0"></div>
                        <div className="flex-1 flex relative">
                            {hours.map(h => (
                                <div key={h} className="flex-1 text-center text-[10px] font-medium text-text-tertiary">
                                    {h.toString().padStart(2, '0')}:00
                                </div>
                            ))}

                            {/* Moving Avatar Logic */}
                            <div
                                className="absolute -top-1 transition-all duration-1000 ease-in-out z-10"
                                style={{
                                    left: `${(currentET.hour / 24) * 100}%`,
                                    width: `${(1 / 24) * 100}%`,
                                    display: 'flex',
                                    justifyContent: 'center'
                                }}
                            >
                                <div className="w-6 h-6 rounded-full border-2 border-orange-500 overflow-hidden shadow-lg bg-white">
                                    <img
                                        src="https://pbs.twimg.com/profile_images/1780044485541699584/p_isra3f_400x400.jpg"
                                        alt="Elon"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="w-16 shrink-0 text-right text-[10px] font-bold text-text-primary px-2">Total</div>
                    </div>

                    {/* Content: Days */}
                    <Spin spinning={loading}>
                        <div className="space-y-1">
                            {heatmapRows.map((row, idx) => {
                                let rowTotal = 0;
                                return (
                                    <div key={row.date} className="flex items-center group">
                                        <div className="w-20 shrink-0 text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                                            {row.date}
                                        </div>
                                        <div className="flex-1 flex gap-1">
                                            {hours.map(h => {
                                                const hourKey = h.toString().padStart(2, '0') + ':00';
                                                const hourData = row[hourKey] || { tweet: 0, reply: 0 };
                                                const count = includeReplies
                                                    ? (hourData.tweet + hourData.reply)
                                                    : hourData.tweet;

                                                rowTotal += count;

                                                return (
                                                    <Tooltip
                                                        key={h}
                                                        title={`${row.date} ${hourKey}: ${hourData.tweet} tweets, ${hourData.reply} replies`}
                                                        color="#1a1a1a"
                                                    >
                                                        <div className={`flex-1 h-8 rounded-md transition-all duration-300 hover:scale-110 hover:shadow-md cursor-pointer ${getCellColor(count)}`}>
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>
                                        <div className="w-16 shrink-0 text-right text-xs font-bold text-text-primary px-2">
                                            {rowTotal}
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
