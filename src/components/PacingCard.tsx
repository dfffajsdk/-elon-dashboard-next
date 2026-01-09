'use client';
import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';

interface PacingItem {
    label: string;
    value: string;
    highlight?: boolean;
    isTimer?: boolean;
    timerStartTimestamp?: number; // Unix timestamp in seconds
}

interface PacingCardProps {
    items: PacingItem[];
}

// Real-time timer component
const LiveTimer: React.FC<{ startTimestamp: number }> = ({ startTimestamp }) => {
    const [elapsed, setElapsed] = useState('00:00:00');

    useEffect(() => {
        const updateTimer = () => {
            const now = Math.floor(Date.now() / 1000);
            const diff = now - startTimestamp;

            if (diff < 0) {
                setElapsed('00:00:00');
                return;
            }

            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;

            setElapsed(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [startTimestamp]);

    return <span className="font-mono font-bold text-xl text-orange-500 dark:text-orange-400 animate-pulse">{elapsed}</span>;
};

const PacingCard: React.FC<PacingCardProps> = React.memo(({ items }) => {
    return (
        <div className="bg-surface p-6 rounded-xl shadow-sm transition-colors duration-300">
            <h3 className="text-text-secondary font-medium mb-4 flex items-center gap-2">
                Current Pacing
                <span className="text-xs text-text-tertiary">ⓘ</span>
            </h3>
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div
                        key={index}
                        className={clsx(
                            "flex justify-between items-center p-3 rounded-lg transition-colors",
                            item.highlight ? "bg-amber-50 dark:bg-amber-900/20" : "bg-background",
                            "hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                        )}
                    >
                        <span className="text-text-secondary font-medium">{item.label}</span>
                        <div className="text-right">
                            {item.isTimer && item.timerStartTimestamp ? (
                                <LiveTimer startTimestamp={item.timerStartTimestamp} />
                            ) : (
                                <span className={clsx(
                                    "font-bold text-lg tabular-nums",
                                    item.highlight ? "text-amber-600 dark:text-amber-500" : "text-text-primary"
                                )}>
                                    {item.value}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

export default PacingCard;
