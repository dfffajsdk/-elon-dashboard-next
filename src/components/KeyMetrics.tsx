'use client';
import React, { useMemo } from 'react';
import { useCountdown } from '@/lib/hooks/useCountdown';
import { Tweet } from '@/lib/types';

interface KeyMetricsProps {
    tweetCount: number;
    periodStart: Date;
    periodEnd: Date;
    tweets?: Tweet[];
}

const KeyMetrics: React.FC<KeyMetricsProps> = ({ tweetCount, periodStart, periodEnd, tweets = [] }) => {
    const countdown = useCountdown(periodEnd);

    // Advanced pace prediction algorithm
    const { progressPercent, paceValue } = useMemo(() => {
        const now = new Date();
        const totalDuration = periodEnd.getTime() - periodStart.getTime();
        const elapsed = now.getTime() - periodStart.getTime();
        const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

        if (elapsed <= 0 || tweetCount <= 0) {
            return { progressPercent: 0, paceValue: 0 };
        }

        const totalDays = totalDuration / (1000 * 60 * 60 * 24);
        const elapsedDays = elapsed / (1000 * 60 * 60 * 24);
        const remainingDays = Math.max(0, totalDays - elapsedDays);

        // Method 1: Simple linear projection
        const simpleRate = tweetCount / elapsedDays;
        const linearPrediction = Math.round(simpleRate * totalDays);

        // Method 2: Recent momentum (last 24 hours activity)
        let recentRate = simpleRate;
        if (tweets.length >= 2) {
            const oneDayAgo = (now.getTime() / 1000) - (24 * 60 * 60);
            const recentTweets = tweets.filter(t => {
                const ts = t.timestamp || (t.timestr ? new Date(t.timestr).getTime() / 1000 : 0);
                return ts >= oneDayAgo;
            });
            if (recentTweets.length > 0) {
                recentRate = recentTweets.length; // tweets in last 24h
            }
        }
        const momentumPrediction = Math.round(tweetCount + (recentRate * remainingDays));

        // Method 3: Weighted average based on progress
        // Early period: trust linear more, Late period: trust momentum more
        const momentumWeight = Math.min(0.7, progress / 100);
        const linearWeight = 1 - momentumWeight;

        const weightedPrediction = Math.round(
            (linearPrediction * linearWeight) + (momentumPrediction * momentumWeight)
        );

        // Apply confidence adjustment based on progress
        // More confident at higher progress, apply less conservative factor
        const confidenceFactor = 0.90 + (progress / 1000); // 0.90 to 1.00
        const finalPrediction = Math.round(weightedPrediction * confidenceFactor);

        return {
            progressPercent: Math.round(progress * 10) / 10,
            paceValue: Math.max(tweetCount, finalPrediction) // Never predict less than current
        };
    }, [tweetCount, periodStart, periodEnd, tweets]);

    // Generate day labels based on period
    const dayLabels = useMemo(() => {
        const labels: string[] = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const current = new Date(periodStart);
        for (let i = 0; i < 8; i++) {
            labels.push(dayNames[current.getDay()]);
            current.setDate(current.getDate() + 1);
        }
        return labels;
    }, [periodStart]);

    return (
        <div className="space-y-4">
            {/* Top metrics row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tweet Count */}
                <div className="group bg-surface hover:bg-surface-highlight p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-purple-500/10 transition-colors"></div>
                    <div className="text-text-secondary font-medium mb-1 text-sm uppercase tracking-wider">Tweet count</div>
                    <div className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br from-text-primary to-text-secondary">{tweetCount}</div>
                    <div className="mt-2 text-xs text-success font-medium flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                        Live tracking
                    </div>
                </div>

                {/* Time Left */}
                <div className="group bg-surface hover:bg-surface-highlight p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-blue-500/10 transition-colors"></div>
                    <div className="text-text-secondary font-medium mb-1 text-sm uppercase tracking-wider">Time left</div>
                    <div className="text-3xl font-bold text-text-primary font-mono tracking-tight">{countdown.formatted}</div>
                    <div className="mt-2 text-xs text-blue-500 font-medium">Until updated target</div>
                </div>

                {/* Progress & Pace */}
                <div className="group bg-surface hover:bg-surface-highlight p-6 rounded-2xl shadow-sm transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-pink-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-pink-500/10 transition-colors"></div>
                    <div className="flex justify-between items-end mb-6 relative z-10">
                        <div>
                            <div className="text-text-secondary font-medium text-sm uppercase tracking-wider mb-1">Progress</div>
                            <div className="text-2xl font-bold text-text-primary">{progressPercent}%</div>
                        </div>
                        <div className="text-right">
                            <div className="text-text-secondary font-medium text-xs uppercase tracking-wider mb-1">Pace</div>
                            <div className="text-xl font-bold text-primary">{paceValue} <span className="text-sm text-text-tertiary font-normal">tweets</span></div>
                        </div>
                    </div>
                    {/* Rainbow gradient progress bar */}
                    <div className="relative h-4 rounded-full bg-surface-highlight overflow-visible mt-2">
                        <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                            style={{
                                width: `${progressPercent}%`,
                                background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 50%, #EC4899 100%)'
                            }}
                        />
                        {/* Current Position Marker */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out z-20"
                            style={{ left: `${progressPercent}%` }}
                        >
                            <div className="w-8 h-8 rounded-full border-[3px] border-surface shadow-lg bg-black cursor-pointer hover:scale-110 transition-transform -ml-4 overflow-hidden">
                                <img
                                    src="https://elontweets.live/loading.png"
                                    alt="Elon"
                                    className="w-full h-full rounded-full object-cover"
                                    onError={(e) => (e.currentTarget.src = 'https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg')}
                                />
                            </div>
                        </div>
                    </div>
                    {/* Day labels */}
                    <div className="flex justify-between mt-4 text-[10px] text-text-tertiary uppercase font-medium tracking-wide">
                        {dayLabels.map((day, i) => (
                            <span key={i}>{day}</span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KeyMetrics;


