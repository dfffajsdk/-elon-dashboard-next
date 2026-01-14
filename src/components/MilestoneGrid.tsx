'use client';
import React from 'react';

interface MilestoneGridProps {
    milestones: any[];
    currentCount: number;
}

// Default milestones if none provided
const DEFAULT_MILESTONES = [
    { target: 100, label: '100 Tweets' },
    { target: 200, label: '200 Tweets' },
    { target: 300, label: '300 Tweets' },
    { target: 400, label: '400 Tweets' },
    { target: 500, label: '500 Tweets' },
    { target: 600, label: '600 Tweets' },
];

const MilestoneGrid: React.FC<MilestoneGridProps> = ({ milestones, currentCount }) => {
    // Use default milestones if none provided
    const targets = milestones.length > 0 ? milestones : DEFAULT_MILESTONES;

    return (
        <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">
                Milestone Tracker
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {targets.map((milestone, index) => {
                    const target = milestone.target;
                    const isPassed = currentCount >= target;
                    const gap = target - currentCount;
                    const progress = Math.min((currentCount / target) * 100, 100);

                    return (
                        <div
                            key={index}
                            className={`p-4 rounded-xl border transition-all ${isPassed
                                    ? 'bg-green-500/10 border-green-500/30'
                                    : 'bg-white/5 border-white/10 dark:border-white/5'
                                }`}
                        >
                            {/* Target Label */}
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-bold ${isPassed ? 'text-green-500' : 'text-text-primary'}`}>
                                    {milestone.label || `${target} Tweets`}
                                </span>
                                {isPassed && (
                                    <span className="text-green-500 text-lg">✓</span>
                                )}
                            </div>

                            {/* Progress Bar */}
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${isPassed ? 'bg-green-500' : 'bg-orange-500'
                                        }`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            {/* Status */}
                            <div className="text-xs">
                                {isPassed ? (
                                    <span className="text-green-500 font-medium">Completed</span>
                                ) : (
                                    <span className="text-text-secondary">
                                        Gap: <span className="text-orange-500 font-bold">{gap}</span> to go
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                    Current: <span className="text-text-primary font-bold">{currentCount}</span> tweets
                </span>
                <span className="text-xs text-text-secondary">
                    {targets.filter(m => currentCount >= m.target).length} / {targets.length} milestones reached
                </span>
            </div>
        </div>
    );
};

export default MilestoneGrid;
