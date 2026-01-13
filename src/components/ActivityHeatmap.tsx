'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { Tooltip, Checkbox, Spin } from 'antd';
import { TweetStatusRawResponse } from '../lib/types';
import { etToLt } from '../lib/utils';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

interface ActivityHeatmapProps {
    tweets?: any[]; // Kept for now, unused
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = () => {
    const [includeReplies, setIncludeReplies] = useState(false);
    const [showLocalTime, setShowLocalTime] = useState(true); // Default to true or false based on preference
    const [apiData, setApiData] = useState<TweetStatusRawResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentETPosition, setCurrentETPosition] = useState<{ date: string, hour: number } | null>(null);

    // Update current ET position every second
    useEffect(() => {
        const updateCurrentET = () => {
            const now = new Date();
            const etFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                hour12: false
            });
            const parts = etFormatter.formatToParts(now);
            const month = parts.find(p => p.type === 'month')?.value || 'Jan';
            const day = parts.find(p => p.type === 'day')?.value || '01';
            const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
            setCurrentETPosition({ date: `${month} ${day}`, hour });
        };

        updateCurrentET();
        const interval = setInterval(updateCurrentET, 1000);
        return () => clearInterval(interval);
    }, []);

    // Fetch heatmap data from API
    useEffect(() => {
        const fetchHeatmapData = async () => {
            try {
                const response = await fetch('/api/tweet-status');
                const data = await response.json();
                // API returns object with posts and t
                if (data && data.posts) {
                    setApiData(data);
                } else if (data && data.code === 0 && data.data) {
                    // Handle older proxy format if still lingering, though we expect raw response
                    setApiData(data.data);
                } else {
                    // If direct response from getTweetStatus (which returns data directly)
                    setApiData(data);
                }
            } catch (error) {
                console.error('Failed to fetch heatmap data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHeatmapData();

        // Refresh every minute
        const interval = setInterval(fetchHeatmapData, 60000);
        return () => clearInterval(interval);
    }, []);

    // Process API data into heatmap format
    const { heatmapData, dates, hours } = useMemo(() => {
        if (!apiData?.posts) {
            return { heatmapData: {}, dates: [], hours: [], latestCell: null };
        }

        const data: Record<string, Record<number, { count: number }>> = {};

        // Display ALL days from API (matching official site behavior)
        const apiPosts = apiData.posts;
        const dateList: string[] = [];

        apiPosts.forEach(dayData => {
            const dateStr = dayData.date; // e.g. "Jan 08"
            dateList.push(dateStr);
            data[dateStr] = {};

            // Process each hour
            for (const key of Object.keys(dayData)) {
                if (key === 'date') continue;

                const hour = parseInt(key.split(':')[0]);
                // Cast to any because dayData[key] can be number or object
                const hourData = dayData[key] as any;

                let count = 0;
                if (typeof hourData === 'object') {
                    if (includeReplies) {
                        count = (hourData.tweet || 0) + (hourData.reply || 0);
                    } else {
                        count = hourData.tweet || 0;
                    }
                } else {
                    // Legacy format: just a number
                    count = Number(hourData);
                }

                if (count > 0) {
                    data[dateStr][hour] = { count };
                }
            }
        });

        // Always ensure today (ET) is in the list, even if API hasn't returned it yet
        const now = new Date();
        const etFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: '2-digit'
        });
        const parts = etFormatter.formatToParts(now);
        const month = parts.find(p => p.type === 'month')?.value || 'Jan';
        const day = parts.find(p => p.type === 'day')?.value || '01';
        const todayET = `${month} ${day}`;

        if (!dateList.includes(todayET)) {
            dateList.unshift(todayET); // Add to the beginning (most recent)
            data[todayET] = {}; // Empty data for today
        }

        // Find latest tweet cell from API's 't' array
        let latestCellInfo: { date: string; hour: number } | null = null;
        if (apiData.t && apiData.t.length > 0) {
            const latestTimestamp = apiData.t[0].timestamp;
            // Convert UTC timestamp to ET hour
            const utcDate = new Date(latestTimestamp * 1000);
            const etFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                hour12: false
            });
            const parts = etFormatter.formatToParts(utcDate);
            const month = parts.find(p => p.type === 'month')?.value || 'Jan';
            const day = parts.find(p => p.type === 'day')?.value || '01';
            const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');

            latestCellInfo = { date: `${month} ${day}`, hour };
        }

        return {
            heatmapData: data,
            dates: dateList,
            hours: Array.from({ length: 24 }, (_, i) => i),
            latestCell: latestCellInfo
        };
    }, [apiData, includeReplies]);

    const getCellColor = (count: number) => {
        if (!count) return 'bg-slate-100 dark:bg-zinc-800/30'; // 明亮模式用浅灰，暗黑模式用透明深灰
        if (count <= 2) return 'bg-amber-400 dark:bg-amber-500';
        if (count <= 5) return 'bg-amber-500 dark:bg-amber-600';
        if (count <= 10) return 'bg-orange-500';
        return 'bg-orange-600';
    };

    // Calculate totals
    const getDayTotal = (date: string) => {
        return Object.values(heatmapData[date] || {}).reduce((sum, cell) => sum + cell.count, 0);
    };

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // ... existing useEffects ...

    if (!mounted || loading) {
        return (
            <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center h-64 transition-all duration-300">
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="bg-surface p-6 sm:p-8 rounded-3xl shadow-lg shadow-purple-900/5 transition-all duration-300 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
                <div className="flex items-center gap-6">
                    <h3 className="text-text-primary font-bold text-xl sm:text-2xl tracking-tight flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-gradient-to-b from-orange-400 to-orange-600 rounded-full"></span>
                        Daily Activity
                    </h3>
                    <Checkbox
                        checked={includeReplies}
                        onChange={(e) => setIncludeReplies(e.target.checked)}
                        className="text-text-secondary hover:text-primary transition-colors"
                    >
                        <span className="text-text-secondary text-xs sm:text-sm">Include Replies</span>
                    </Checkbox>
                </div>
                <div className="flex gap-4 items-center">
                    <button
                        onClick={() => setShowLocalTime(!showLocalTime)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${showLocalTime
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                            : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        {showLocalTime ? 'Hide Local Time' : 'Show Local Time'}
                    </button>
                    <div className="flex gap-3 items-center text-xs sm:text-sm">
                        <span className="text-blue-600 dark:text-blue-400 font-medium">● ET</span>
                        {showLocalTime && <span className="text-gray-500">● LT</span>}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                <div className="min-w-[1000px] pr-4">
                    {/* Header row with ET/LT times */}
                    <div className="flex mb-2">
                        <div className="w-20 shrink-0 text-right pr-3 text-sm font-medium">
                            <div className="text-blue-600 dark:text-blue-400">ET:</div>
                            {showLocalTime && <div className="text-gray-500">LT:</div>}
                        </div>
                        {hours.map(hour => (
                            <div key={hour} className="flex-1 text-center">
                                <div className="text-xs text-blue-600 dark:text-blue-400 leading-5 font-medium">{String(hour).padStart(2, '0')}:00</div>
                                {showLocalTime && <div className="text-xs text-gray-400 dark:text-gray-500 leading-5">{String(etToLt(hour)).padStart(2, '0')}:00</div>}
                            </div>
                        ))}
                        <div className="w-14 text-center text-xs text-gray-400">Total</div>
                    </div>

                    {/* Data rows */}
                    {dates.map((date, dateIdx) => (
                        <div key={date} className="flex items-center mb-2">
                            <div className="w-20 shrink-0 text-sm text-gray-600 dark:text-gray-300 text-right pr-3 font-medium">{date}</div>
                            <div className="flex-1 flex gap-1">
                                {hours.map((hour, hourIdx) => {
                                    const cell = heatmapData[date]?.[hour];
                                    const count = cell?.count || 0;
                                    // Show avatar at current ET position (real-time)
                                    const isCurrentET = currentETPosition?.date === date && currentETPosition?.hour === hour;

                                    return (
                                        <Tooltip
                                            key={hour}
                                            overlayClassName="heatmap-tooltip"
                                            title={
                                                <div className="flex flex-col gap-1 text-center">
                                                    <span className="opacity-70 text-[10px] uppercase tracking-wider">
                                                        {date} • {String(hour).padStart(2, '0')}:00 ET
                                                        {showLocalTime && <span className="block">{String(etToLt(hour)).padStart(2, '0')}:00 LT</span>}
                                                    </span>
                                                    <span className="font-bold text-base text-white">
                                                        {count} <span className="text-xs font-normal opacity-70">{includeReplies ? 'tweets+replies' : 'tweets'}</span>
                                                    </span>
                                                </div>
                                            }
                                        >
                                            <div
                                                className={`flex-1 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-300 cursor-pointer relative 
                                                    ${getCellColor(count)} 
                                                    hover:scale-110 hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-500/30 hover:z-30 hover:ring-2 hover:ring-white dark:hover:ring-zinc-800
                                                    ${!count && !isCurrentET ? 'hover:bg-gray-200 dark:hover:bg-zinc-700' : ''}
                                                `}
                                            >
                                                {isCurrentET && (
                                                    <div className="absolute -top-3 -right-3 z-20 w-8 h-8 pointer-events-none">
                                                        <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping"></span>
                                                        <div className="relative inline-flex rounded-full h-8 w-8 border-2 border-white dark:border-zinc-900 overflow-hidden shadow-lg bg-surface">
                                                            <img
                                                                src="https://elontweets.live/loading.png"
                                                                alt="Now"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => (e.currentTarget.src = 'https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg')}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                {count > 0 && (
                                                    <span className="relative z-10 text-white drop-shadow-md text-base sm:text-lg font-bold animate-scale-in">
                                                        {count}
                                                    </span>
                                                )}
                                            </div>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                            <div className="w-14 text-center text-sm text-orange-500 dark:text-orange-400 font-bold">
                                {getDayTotal(date)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ActivityHeatmap;
