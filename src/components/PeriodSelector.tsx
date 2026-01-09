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

    const getDayName = (year: number, month: number, day: number): string => {
        // Create date in UTC to avoid local timezone shifts
        const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getUTCDay()];
    };

    for (const config of periodConfigs) {
        // Create dates in ET timezone at 12:00 PM (noon)
        // 12:00 PM ET = 17:00 UTC (EST is UTC-5)
        const startDate = new Date(`2026-01-${String(config.startDay).padStart(2, '0')}T12:00:00-05:00`);
        const endDate = new Date(`2026-01-${String(config.endDay).padStart(2, '0')}T12:00:00-05:00`);

        // GATING LOGIC: 
        // 1. Must have started (now >= start)
        // 2. Must not be expired (now < end) - user requested to "delete" old ones
        // Using a small buffer (e.g., 1 hour) to ensure smooth transition? No, strictly remove after end.
        if (etNow >= startDate) {
            // If the period has ended, skip it (unless it's the ONLY available one? Logic below handles empty/fallback)
            // However, strictly adhering to "active" periods means excluding those where etNow > endDate.
            // But wait, etNow is flawed (Local time representation).
            // Let's use the REAL absolute current time for comparison.

            const nowAbsolute = new Date();

            // Check if period is strictly in the future
            if (nowAbsolute < startDate) continue;

            // Check if period is strictly in the past (expired)
            // User wants to remove old ones.
            if (nowAbsolute >= endDate) continue;

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

    // Fallback: If no ACTIVE periods found (e.g. between periods?), show the next upcoming one or the last expired one?
    // Given the overlapping schedule (Jan 2-9, Jan 6-13), we should always have an active one.
    // If somehow empty, maybe show the last one config that passed start check?
    if (periods.length === 0 && periodConfigs.length > 0) {
        // Try to find the *next* upcoming period to show as "coming soon" or most recent
        // Just return empty array and let app handle? Or safest: return the most relevant one.
        // Let's rely on overlap.
    }

    return periods;
}

export default PeriodSelector;


