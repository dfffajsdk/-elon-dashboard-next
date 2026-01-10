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
// IMPORTANT: Strict Absolute Time comparison against ET timestamps
export function createPeriods(): Period[] {
    const periods: Period[] = [];
    const now = new Date(); // Current absolute time (UTC-based internally)

    // Base periods - each period is 7 days from noon to noon ET
    const periodConfigs = [
        { id: 'jan9', endDay: 9, startDay: 2 },
        { id: 'jan13', endDay: 13, startDay: 6 },
        { id: 'jan16', endDay: 16, startDay: 9 },
        { id: 'jan20', endDay: 20, startDay: 13 },
        { id: 'jan23', endDay: 23, startDay: 16 },
        { id: 'jan27', endDay: 27, startDay: 20 },
        { id: 'jan30', endDay: 30, startDay: 23 },
    ];

    const getDayName = (year: number, month: number, day: number): string => {
        // Create date in UTC to avoid local timezone shifts
        // Use 12:00 UTC just to be safe in middle of day
        const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getUTCDay()];
    };

    for (const config of periodConfigs) {
        // Create Absolute Dates corresponding to 12:00 PM ET
        // 12:00 PM ET is always the anchor. 
        // We use explicit ISO string with -05:00 offset to guarantee it represents ET noon.
        const startDate = new Date(`2026-01-${String(config.startDay).padStart(2, '0')}T12:00:00-05:00`);
        const endDate = new Date(`2026-01-${String(config.endDay).padStart(2, '0')}T12:00:00-05:00`);

        // LOGIC: Show period IF it has started (now >= startDate)
        // Include expired periods so users can view historical data
        if (now >= startDate) {
            const dayName = getDayName(2026, 1, config.endDay);
            const label = `Jan ${config.endDay} ${dayName}`;

            periods.push({
                id: config.id,
                label,
                startDate,
                endDate,
            });
        }
    }

    // FALLBACK: If we are between periods or all finished, show the next upcoming one
    // or the last one if everything is over.
    if (periods.length === 0) {
        // Find first period that hasn't started yet (Upcoming)
        const upcoming = periodConfigs.find(c => {
            const start = new Date(`2026-01-${String(c.startDay).padStart(2, '0')}T12:00:00-05:00`);
            return now < start;
        });

        if (upcoming) {
            const start = new Date(`2026-01-${String(upcoming.startDay).padStart(2, '0')}T12:00:00-05:00`);
            const end = new Date(`2026-01-${String(upcoming.endDay).padStart(2, '0')}T12:00:00-05:00`);
            periods.push({
                id: upcoming.id,
                label: `Jan ${upcoming.endDay} ${getDayName(2026, 1, upcoming.endDay)}`,
                startDate: start,
                endDate: end
            });
        } else {
            // Everyone has started. Show the last one? Or finding the one that *just* expired?
            // If Jan 13 period ends Jan 13, and Jan 16 starts Jan 9, there shouldn't be gaps unless configs are wrong.
            // But if somehow empty, default to the last configured period.
            const last = periodConfigs[periodConfigs.length - 1];
            const start = new Date(`2026-01-${String(last.startDay).padStart(2, '0')}T12:00:00-05:00`);
            const end = new Date(`2026-01-${String(last.endDay).padStart(2, '0')}T12:00:00-05:00`);
            periods.push({
                id: last.id,
                label: `Jan ${last.endDay} ${getDayName(2026, 1, last.endDay)}`,
                startDate: start,
                endDate: end
            });
        }
    }

    return periods;
}

export default PeriodSelector;


