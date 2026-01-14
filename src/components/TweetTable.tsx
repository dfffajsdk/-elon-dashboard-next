'use client';
import React, { useState, useEffect } from 'react';
import { Spin } from 'antd';

interface Tweet {
    id: string;
    text: string;
    msg?: string;
    created_at: number;
    is_reply: boolean;
    raw_data?: {
        is_retweet?: boolean;
        is_quote?: boolean;
    };
}

type TweetType = 'original' | 'retweeted' | 'replied' | 'quoted';

const ITEMS_PER_PAGE = 20;

const TweetTable: React.FC = () => {
    const [tweets, setTweets] = useState<Tweet[]>([]);
    const [loading, setLoading] = useState(true);
    const [showReplies, setShowReplies] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const fetchTweets = async () => {
            try {
                const now = Math.floor(Date.now() / 1000);
                const fifteenDaysAgo = now - (15 * 24 * 60 * 60);

                const res = await fetch(`/api/tweets?start=${fifteenDaysAgo}&limit=500`);
                const data = await res.json();

                if (data.tweets) {
                    const sorted = data.tweets.sort((a: Tweet, b: Tweet) => b.created_at - a.created_at);
                    setTweets(sorted);
                }
            } catch (err) {
                console.error('Failed to fetch tweets:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTweets();
        const interval = setInterval(fetchTweets, 120000);
        return () => clearInterval(interval);
    }, []);

    const getTweetType = (tweet: Tweet): TweetType => {
        const text = (tweet.msg || tweet.text || '').toLowerCase();

        if (tweet.is_reply || text.includes('replied') || text.startsWith('@')) {
            return 'replied';
        }
        if (tweet.raw_data?.is_retweet || text.includes('retweeted') || text.includes('🔄')) {
            return 'retweeted';
        }
        if (tweet.raw_data?.is_quote || text.includes('quoted')) {
            return 'quoted';
        }
        return 'original';
    };

    const getTypeStyle = (type: TweetType) => {
        switch (type) {
            case 'original':
                return { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: '✦', label: 'Original' };
            case 'retweeted':
                return { bg: 'bg-green-500/20', text: 'text-green-400', icon: '🔄', label: 'Retweeted' };
            case 'replied':
                return { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '↩', label: 'Replied' };
            case 'quoted':
                return { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: '❝', label: 'Quoted' };
        }
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const filteredTweets = showReplies ? tweets : tweets.filter(t => !t.is_reply);
    const totalPages = Math.ceil(filteredTweets.length / ITEMS_PER_PAGE);
    const paginatedTweets = filteredTweets.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <div className="bg-white dark:bg-[#0a0a0b] p-6 rounded-[2rem] border border-white/10 dark:border-white/[0.05] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-1.5 h-8 bg-gradient-to-b from-blue-400 to-purple-600 rounded-full" />
                    <div>
                        <h2 className="text-lg font-black text-text-primary tracking-tighter uppercase italic leading-none">
                            Recent Tweets
                        </h2>
                        <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-wider">
                            Last 15 days • {filteredTweets.length} tweets
                        </p>
                    </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer bg-white/[0.02] px-3 py-1.5 rounded-lg border border-white/[0.05]">
                    <input
                        type="checkbox"
                        checked={showReplies}
                        onChange={(e) => { setShowReplies(e.target.checked); setCurrentPage(1); }}
                        className="w-4 h-4 rounded accent-orange-500"
                    />
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wide">
                        Show Replies
                    </span>
                </label>
            </div>

            {/* Tweet List */}
            <Spin spinning={loading}>
                <div className="space-y-3">
                    {paginatedTweets.length === 0 && !loading && (
                        <p className="text-center text-text-secondary py-8">No tweets found</p>
                    )}

                    {paginatedTweets.map((tweet) => {
                        const type = getTweetType(tweet);
                        const style = getTypeStyle(type);

                        return (
                            <div
                                key={tweet.id}
                                className="group p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all"
                            >
                                {/* Header Row */}
                                <div className="flex items-center gap-3 mb-3">
                                    {/* Type Badge */}
                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${style.bg}`}>
                                        <span className={`text-sm ${style.text}`}>{style.icon}</span>
                                        <span className={`text-[10px] font-bold uppercase ${style.text}`}>{style.label}</span>
                                    </div>

                                    {/* Time */}
                                    <span className="text-xs text-text-secondary font-medium">
                                        {formatTime(tweet.created_at)} ET
                                    </span>
                                </div>

                                {/* Content */}
                                <p className="text-sm text-text-primary leading-relaxed mb-3 break-words">
                                    {tweet.msg || tweet.text || '(No content)'}
                                </p>

                                {/* Link */}
                                <a
                                    href={`https://x.com/elonmusk/status/${tweet.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400 transition-colors"
                                >
                                    <span>View on X</span>
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                </a>
                            </div>
                        );
                    })}
                </div>
            </Spin>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-white/[0.05]">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        ← Prev
                    </button>

                    <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let page: number;
                            if (totalPages <= 5) {
                                page = i + 1;
                            } else if (currentPage <= 3) {
                                page = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                                page = totalPages - 4 + i;
                            } else {
                                page = currentPage - 2 + i;
                            }

                            return (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === page
                                            ? 'bg-orange-500 text-white'
                                            : 'text-text-secondary hover:bg-white/[0.05]'
                                        }`}
                                >
                                    {page}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
};

export default TweetTable;
