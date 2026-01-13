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
                ? 'bg-[#1a2e3a] dark:bg-[#11222c] border border-white/5' // Solid dark for passed
                : 'bg-transparent border border-dashed border-white/10'; // Transparent for future
        }

        let bgClass = '';
        if (count <= 2) bgClass = 'bg-[#ffe4b5]'; // Moccasin
        else if (count <= 5) bgClass = 'bg-[#ffcc99]'; // Peach
        else if (count <= 10) bgClass = 'bg-[#ffb366]'; // Light Orange
        else bgClass = 'bg-[#ff9933]'; // Orange

        return `${bgClass} text-[#1a1a1a] font-bold border border-white/10`;
    };

    const getLT = (etHour: number) => {
        // ET (UTC-5) to LT (UTC+8) = +13h
        const ltHour = (etHour + 13) % 24;
        return ltHour.toString().padStart(2, '0') + ':00';
    };

    return (
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-2xl overflow-hidden relative text-white">
            <div className="flex items-center justify-between mb-6 gap-4 relative z-20">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold">Activity Heatmap</h2>
                    <label className="flex items-center gap-2 cursor-pointer ml-4">
                        <Checkbox
                            checked={includeReplies}
                            onChange={e => setIncludeReplies(e.target.checked)}
                            className="dark-checkbox"
                        />
                        <span className="text-xs text-gray-400">Include Replies</span>
                    </label>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#11222c] rounded-sm"></span> Passed</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 border border-dashed border-white/20 rounded-sm"></span> Future</span>
                </div>
            </div>

            <div className="relative overflow-x-auto pb-4 custom-scrollbar">
                <div className="min-w-[960px]">
                    {/* Header with ET and LT */}
                    <div className="grid grid-cols-[100px_1fr_60px] mb-2 text-[10px] font-bold text-gray-400">
                        <div className="flex flex-col justify-center px-2">
                            <div>ET:</div>
                            <div>LT:</div>
                        </div>
                        <div className="grid grid-cols-24 gap-px relative">
                            {hours.map(h => (
                                <div key={h} className="text-center flex flex-col justify-center h-8">
                                    <div>{h.toString().padStart(2, '0')}</div>
                                    <div className="opacity-60">{((h + 13) % 24).toString().padStart(2, '0')}</div>
                                </div>
                            ))}

                            {/* Avatar Tracker */}
                            <div
                                className="absolute top-0 bottom-[-1000px] transition-all duration-700 z-30 pointer-events-none"
                                style={{
                                    left: `${((currentET.hour + currentET.minute / 60) / 24) * 100}%`,
                                    transform: 'translateX(-50%)',
                                }}
                            >
                                <div className="flex flex-col items-center">
                                    <div className="w-6 h-6 rounded-full border border-white shadow-lg overflow-hidden bg-black mt-1">
                                        <img
                                            src="https://pbs.twimg.com/profile_images/1780044485541699584/p_isra3f_400x400.jpg"
                                            alt="Elon"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="w-px h-full bg-orange-500/40"></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end px-2 uppercase tracking-tighter opacity-60">Total</div>
                    </div>

                    <Spin spinning={loading}>
                        <div className="space-y-px">
                            {heatmapRows.map((row) => {
                                let rowTotal = 0;
                                return (
                                    <div key={row.date} className="grid grid-cols-[100px_1fr_60px] group">
                                        <div className="text-[10px] font-medium text-gray-500 flex items-center px-2 group-hover:text-white transition-colors">
                                            {row.date}
                                        </div>
                                        <div className="grid grid-cols-24 gap-px bg-white/5 border border-white/5">
                                            {hours.map(h => {
                                                const hourKey = h.toString().padStart(2, '0') + ':00';
                                                const hourData = row[hourKey] || { tweet: 0, reply: 0 };
                                                const count = includeReplies ? (hourData.tweet + hourData.reply) : hourData.tweet;
                                                rowTotal += count;

                                                return (
                                                    <Tooltip
                                                        key={h}
                                                        title={`${row.date} ${hourKey}: ${hourData.tweet} tweets`}
                                                        color="#1a1a1a"
                                                    >
                                                        <div
                                                            className={`h-8 flex items-center justify-center text-[11px] transition-all ${getCellStyles(count, row._norm, h)}`}
                                                        >
                                                            {count > 0 ? count : ''}
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>
                                        <div className="flex items-center justify-end px-2 text-[10px] font-bold text-gray-400 bg-white/5 border-y border-r border-white/5">
                                            {rowTotal}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Spin>
                </div>
            </div>
            <style jsx global>{`
                .dark-checkbox .ant-checkbox-inner {
                    background-color: transparent !important;
                    border-color: #444 !important;
                }
                .dark-checkbox .ant-checkbox-checked .ant-checkbox-inner {
                    background-color: #ff9933 !important;
                    border-color: #ff9933 !important;
                }
            `}</style>
        </div>
    );
};

export default ActivityHeatmap;
