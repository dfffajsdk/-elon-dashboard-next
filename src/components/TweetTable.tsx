'use client';
import React, { useState, useEffect } from 'react';
import { Spin } from 'antd';

interface Tweet {
    id: string;
    text: string;
    msg?: string;
    created_at: number;
    is_reply: boolean;
}

const TweetTable: React.FC = () => {
    const [tweets, setTweets] = useState<Tweet[]>([]);
    const [loading, setLoading] = useState(true);
    const [showReplies, setShowReplies] = useState(true);

    useEffect(() => {
        const fetchTweets = async () => {
            try {
                // Fetch tweets from last 15 days
                const now = Math.floor(Date.now() / 1000);
                const fifteenDaysAgo = now - (15 * 24 * 60 * 60);

                const res = await fetch(`/api/tweets?start=${fifteenDaysAgo}&limit=200`);
                const data = await res.json();

                if (data.tweets) {
                    // Sort by created_at descending (newest first)
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
        // Refresh every 2 minutes
        const interval = setInterval(fetchTweets, 120000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        // Format in ET
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

                {/* Toggle Replies */}
                <label className="flex items-center gap-2 cursor-pointer group bg-white/[0.02] px-3 py-1.5 rounded-lg border border-white/[0.05]">
                    <input
                        type="checkbox"
                        checked={showReplies}
                        onChange={(e) => setShowReplies(e.target.checked)}
                        className="w-4 h-4 rounded accent-orange-500"
                    />
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wide">
                        Show Replies
                    </span>
                </label>
            </div>

            {/* Tweet List */}
            <Spin spinning={loading}>
                <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                    {filteredTweets.length === 0 && !loading && (
                        <p className="text-center text-text-secondary py-8">No tweets found</p>
                    )}

                    {filteredTweets.map((tweet) => (
                        <div
                            key={tweet.id}
                            className={`p-4 rounded-xl transition-all hover:bg-white/[0.03] ${tweet.is_reply
                                    ? 'bg-blue-500/5 border border-blue-500/10'
                                    : 'bg-white/[0.02] border border-white/[0.05]'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                {/* Type Indicator */}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tweet.is_reply ? 'bg-blue-500/20' : 'bg-orange-500/20'
                                    }`}>
                                    {tweet.is_reply ? (
                                        <span className="text-blue-400 text-sm">↩</span>
                                    ) : (
                                        <span className="text-orange-400 text-sm">✦</span>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] text-text-secondary">
                                            {formatTime(tweet.created_at)} ET
                                        </span>
                                        {tweet.is_reply && (
                                            <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold">
                                                Reply
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-text-primary leading-relaxed break-words">
                                        {tweet.msg || tweet.text || '(No content)'}
                                    </p>
                                    {/* Tweet Link */}
                                    <a
                                        href={`https://x.com/elonmusk/status/${tweet.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-orange-500 hover:underline mt-2 inline-block"
                                    >
                                        View on X →
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Spin>
        </div>
    );
};

export default TweetTable;
