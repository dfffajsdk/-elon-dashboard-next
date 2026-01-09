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
// IMPORTANT: Only show tabs that have started (currentTime >= startTime in ET)
export function createPeriods(): Period[] {
    const periods: Period[] = [];

    // Get current time in ET
    const now = new Date();
    const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    // Base periods - each period is 7 days from noon to noon ET
    // Jan 9 Fri = Jan 2 12:00 PM ET -> Jan 9 12:00 PM ET
    // Jan 13 Tue = Jan 6 12:00 PM ET -> Jan 13 12:00 PM ET  
    // Jan 16 Fri = Jan 9 12:00 PM ET -> Jan 16 12:00 PM ET
    // etc.

    const periodConfigs = [
        { id: 'jan9', endDay: 9, startDay: 2 },
        { id: 'jan13', endDay: 13, startDay: 6 },
        { id: 'jan16', endDay: 16, startDay: 9 },
        { id: 'jan20', endDay: 20, startDay: 13 },
        { id: 'jan23', endDay: 23, startDay: 16 },
        { id: 'jan27', endDay: 27, startDay: 20 },
        { id: 'jan30', endDay: 30, startDay: 23 },
    ];

    const getDayName = (date: Date): string => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()];
    };

    for (const config of periodConfigs) {
        // Create dates in ET timezone at 12:00 PM (noon)
        // 12:00 PM ET = 17:00 UTC (EST is UTC-5)
        const startDate = new Date(`2026-01-${String(config.startDay).padStart(2, '0')}T12:00:00-05:00`);
        const endDate = new Date(`2026-01-${String(config.endDay).padStart(2, '0')}T12:00:00-05:00`);

        // GATING LOGIC: Only include periods that have started (current ET time >= start time)
        if (etNow >= startDate) {
            const dayName = getDayName(endDate);
            const label = `Jan ${config.endDay} ${dayName}`;

            periods.push({
                id: config.id,
                label,
                startDate,
                endDate,
            });
        }
    }

    return periods;
}

export default PeriodSelector;


