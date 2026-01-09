'use client';
import React from 'react';
import { clsx } from 'clsx';
import { CheckCircleOutlined, ArrowUpOutlined, ClockCircleOutlined } from '@ant-design/icons';

interface Milestone {
    target: number;
    status: 'pass' | 'current' | 'future';
    rate?: string;
    deficit?: number;
    progress?: number;
}

interface MilestoneGridProps {
    milestones: Milestone[];
    currentCount: number;
}

const MilestoneGrid: React.FC<MilestoneGridProps> = React.memo(({ milestones, currentCount }) => {
    return (
        <div className="bg-surface p-8 rounded-2xl shadow-lg border border-border/5">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-7 bg-primary rounded-full"></div>
                <div>
                    <h3 className="text-text-primary font-black text-2xl leading-none">
                        Milestone Tracker
                    </h3>
                    <p className="text-xs text-text-tertiary mt-1 font-medium">Progress towards next 20-tweet targets</p>
                </div>
                <div className="ml-auto text-right">
                    <div className="text-xs text-text-tertiary font-bold uppercase tracking-widest">Current Count</div>
                    <div className="text-xl font-black text-primary">{currentCount}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {milestones.map((m) => {
                    // Safety check for gap calculation
                    const displayGap = m.status === 'pass' ? 0 : (m.target - currentCount);

                    return (
                        <div
                            key={m.target}
                            className={clsx(
                                "group relative overflow-hidden rounded-xl transition-all duration-300 h-[145px] flex flex-col border-2",
                                m.status === 'pass' && "bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20",
                                m.status === 'current' && "bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-400/40 shadow-lg shadow-blue-500/10",
                                m.status === 'future' && "bg-surface-highlight border-border/10"
                            )}
                        >
                            <div className="relative flex-1 flex flex-col items-center justify-center gap-1.5 p-2">
                                {/* Header: Target */}
                                <div className="text-center">
                                    <div className={clsx(
                                        "text-xl font-black tracking-tighter leading-none",
                                        m.status === 'pass' && "text-green-600 dark:text-green-400",
                                        m.status === 'current' && "text-blue-600 dark:text-blue-400",
                                        m.status === 'future' && "text-text-tertiary"
                                    )}>
                                        {m.target}
                                    </div>
                                    <div className="text-[9px] text-text-tertiary font-bold uppercase mt-0.5 opacity-60">Target</div>
                                </div>

                                {/* Middle: Visual */}
                                <div className="flex items-center justify-center py-1">
                                    {m.status === 'pass' && (
                                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                            <CheckCircleOutlined className="text-green-500 text-xl" />
                                        </div>
                                    )}

                                    {m.status === 'current' && (
                                        <div className="relative w-12 h-12">
                                            <svg className="transform -rotate-90 w-12 h-12">
                                                <circle
                                                    cx="24"
                                                    cy="24"
                                                    r="20"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                    fill="transparent"
                                                    className="text-gray-100 dark:text-gray-800"
                                                />
                                                <circle
                                                    cx="24"
                                                    cy="24"
                                                    r="20"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                    fill="transparent"
                                                    strokeDasharray={`${2 * Math.PI * 20}`}
                                                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - Math.max(0, Math.min(1, m.progress || 0)))}`}
                                                    className="text-blue-500 dark:text-blue-400 transition-all duration-1000"
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <ArrowUpOutlined className="text-blue-600 dark:text-blue-400 text-base" />
                                            </div>
                                        </div>
                                    )}

                                    {m.status === 'future' && (
                                        <ClockCircleOutlined className="text-text-tertiary opacity-20 text-2xl" />
                                    )}
                                </div>

                                {/* Footer: Info */}
                                <div className="flex flex-col items-center justify-center w-full">
                                    {m.status === 'pass' ? (
                                        <span className="text-[9px] text-green-600 dark:text-green-500 font-black uppercase tracking-widest leading-none bg-green-500/10 px-2 py-0.5 rounded">
                                            Achieved
                                        </span>
                                    ) : (
                                        <div className="flex items-center gap-1.5 bg-surface-active px-2 py-0.5 rounded shadow-sm opacity-90 hover:opacity-100 transition-opacity">
                                            <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-tighter">Gap</span>
                                            <span className={clsx(
                                                "text-sm font-black leading-none",
                                                m.status === 'current' ? "text-blue-500 dark:text-blue-400" : "text-text-primary"
                                            )}>
                                                {displayGap}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

MilestoneGrid.displayName = 'MilestoneGrid';

export default MilestoneGrid;

