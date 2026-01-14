'use client';
import React from 'react';

interface MilestoneGridProps {
    milestones: any[];
    currentCount: number;
}

// Polymarket-style range milestones
const DEFAULT_MILESTONES = [
    { min: 320, max: 339, label: '320-339' },
    { min: 340, max: 359, label: '340-359' },
    { min: 360, max: 379, label: '360-379' },
    { min: 380, max: 399, label: '380-399' },
    { min: 400, max: 419, label: '400-419' },
    { min: 420, max: 439, label: '420-439' },
    { min: 440, max: 459, label: '440-459' },
    { min: 460, max: 479, label: '460-479' },
    { min: 480, max: 499, label: '480-499' },
    { min: 500, max: 519, label: '500-519' },
    { min: 520, max: 539, label: '520-539' },
    { min: 540, max: 559, label: '540-559' },
    { min: 560, max: 579, label: '560-579' },
    { min: 580, max: Infinity, label: '580+' },
];

const MilestoneGrid: React.FC<MilestoneGridProps> = ({ milestones, currentCount }) => {
    const targets = milestones.length > 0 ? milestones : DEFAULT_MILESTONES;

    // Find current range
    const currentRangeIndex = targets.findIndex(m => currentCount >= m.min && currentCount <= m.max);

    return (
        <div className="bg-white dark:bg-[#0a0a0b] p-6 rounded-[2rem] border border-white/10 dark:border-white/[0.05] shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-1.5 h-8 bg-gradient-to-b from-orange-400 to-red-600 rounded-full" />
                <div>
                    <h2 className="text-lg font-black text-text-primary tracking-tighter uppercase italic leading-none">
                        Milestone Tracker
                    </h2>
                    <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-wider">
                        Current: <span className="text-orange-500 font-bold">{currentCount}</span> tweets
                    </p>
                </div>
            </div>

            {/* Milestone List */}
            <div className="space-y-2">
                {targets.map((milestone, index) => {
                    const isPassed = currentCount > milestone.max;
                    const isCurrent = currentCount >= milestone.min && currentCount <= milestone.max;
                    const isFuture = currentCount < milestone.min;
                    const gap = milestone.min - currentCount;

                    // Progress within current range
                    const rangeProgress = isCurrent
                        ? ((currentCount - milestone.min) / (milestone.max - milestone.min)) * 100
                        : isPassed ? 100 : 0;

                    return (
                        <div
                            key={index}
                            className={`relative flex items-center gap-4 p-3 rounded-xl transition-all ${isCurrent
                                    ? 'bg-orange-500/10 border border-orange-500/30'
                                    : isPassed
                                        ? 'bg-green-500/5 border border-green-500/20'
                                        : 'bg-white/[0.02] border border-white/[0.05]'
                                }`}
                        >
                            {/* Status Icon */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isPassed
                                    ? 'bg-green-500/20'
                                    : isCurrent
                                        ? 'bg-orange-500/20'
                                        : 'bg-white/5'
                                }`}>
                                {isPassed ? (
                                    <span className="text-green-500 text-lg">✓</span>
                                ) : isCurrent ? (
                                    <span className="text-orange-500 text-sm font-black">{currentCount}</span>
                                ) : (
                                    <span className="text-text-secondary text-xs">—</span>
                                )}
                            </div>

                            {/* Range Label */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-sm font-bold ${isCurrent ? 'text-orange-400' : isPassed ? 'text-green-500' : 'text-text-primary'
                                        }`}>
                                        {milestone.label}
                                    </span>
                                    {isCurrent && (
                                        <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold uppercase">
                                            Current
                                        </span>
                                    )}
                                    {isPassed && (
                                        <span className="text-[10px] text-green-500 font-bold uppercase">
                                            Passed
                                        </span>
                                    )}
                                    {isFuture && gap > 0 && (
                                        <span className="text-[10px] text-text-secondary">
                                            <span className="text-orange-500 font-bold">{gap}</span> to go
                                        </span>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${isPassed ? 'bg-green-500' : isCurrent ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-transparent'
                                            }`}
                                        style={{ width: `${rangeProgress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MilestoneGrid;
