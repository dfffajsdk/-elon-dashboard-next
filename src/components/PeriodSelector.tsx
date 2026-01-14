'use client';
import React from 'react';
import { clsx } from 'clsx';

export interface Period {
    id: string;
    label: string;
    startDate: Date;
    endDate: Date;
}

interface PeriodSelectorProps {
    periods: Period[];
    activePeriodId: string;
    onSelect: (periodId: string) => void;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = React.memo(({ periods, activePeriodId, onSelect }) => {
    return (
        <div className="bg-surface-highlight p-1 rounded-lg inline-flex gap-1 transition-colors duration-300">
            {periods.map((period) => (
                <button
                    key={period.id}
                    onClick={() => onSelect(period.id)}
                    className={clsx(
                        "px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                        activePeriodId === period.id
                            ? "bg-white dark:bg-zinc-700 text-primary shadow-sm"
                            : "text-text-tertiary hover:text-text-primary hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                    )}
                >
                    {period.label}
                </button>
            ))}
        </div>
    );
});

// Helper function to create periods based on US Eastern time noon-to-noon
// Each period is 7 days from 12:00 PM ET to 12:00 PM ET
// Tab shows the END date of the period
// Periods auto-rotate: When current time passes noon ET on end day, remove that period and add next one
export function createPeriods(): Period[] {
    const periods: Period[] = [];
    const now = new Date();

    // Reference periods (user-defined anchor points)
    // Period 1: Jan 9 12:00 PM ET - Jan 16 12:00 PM ET (labeled "Jan 16")
    // Period 2: Jan 16 12:00 PM ET - Jan 23 12:00 PM ET (labeled "Jan 23")
    // etc.

    // Reference: Jan 9, 2026 12:00 PM ET = Start of first defined period
    const REFERENCE_START = new Date('2026-01-09T12:00:00-05:00');
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    // Calculate how many weeks have passed since reference
    const msFromRef = now.getTime() - REFERENCE_START.getTime();
    const weeksFromRef = Math.floor(msFromRef / WEEK_MS);

    // Helper to get day name
    const getDayName = (date: Date): string => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getUTCDay()];
    };

    // Helper to format date label
    const formatLabel = (date: Date): string => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        // Get date parts in ET
        const etFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            weekday: 'short'
        });
        const parts = etFormatter.formatToParts(date);
        const month = parts.find(p => p.type === 'month')?.value || '';
        const day = parts.find(p => p.type === 'day')?.value || '';
        const weekday = parts.find(p => p.type === 'weekday')?.value || '';
        return `${month} ${day} ${weekday}`;
    };

    // Generate current period and next period
    // Current period: starts at (weeksFromRef * WEEK) after reference
    const currentPeriodStart = new Date(REFERENCE_START.getTime() + Math.max(0, weeksFromRef) * WEEK_MS);
    const currentPeriodEnd = new Date(currentPeriodStart.getTime() + WEEK_MS);

    // Next period
    const nextPeriodStart = new Date(currentPeriodEnd.getTime());
    const nextPeriodEnd = new Date(nextPeriodStart.getTime() + WEEK_MS);

    // Show current period if active (not yet ended)
    if (now < currentPeriodEnd) {
        periods.push({
            id: `period_${currentPeriodEnd.getTime()}`,
            label: formatLabel(currentPeriodEnd),
            startDate: currentPeriodStart,
            endDate: currentPeriodEnd
        });
    }

    // Always show next period
    periods.push({
        id: `period_${nextPeriodEnd.getTime()}`,
        label: formatLabel(nextPeriodEnd),
        startDate: nextPeriodStart,
        endDate: nextPeriodEnd
    });

    return periods;
}

export default PeriodSelector;


