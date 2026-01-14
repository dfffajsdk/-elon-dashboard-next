
const REFERENCE_START = new Date('2026-01-09T12:00:00-05:00');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function createPeriods(now = new Date()) {
    const periods = [];
    const msFromRef = now.getTime() - REFERENCE_START.getTime();
    const weeksFromRef = Math.floor(msFromRef / WEEK_MS);

    const formatLabel = (date) => {
        return date.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', weekday: 'short' });
    };

    const currentPeriodStart = new Date(REFERENCE_START.getTime() + Math.max(0, weeksFromRef) * WEEK_MS);
    const currentPeriodEnd = new Date(currentPeriodStart.getTime() + WEEK_MS);

    const nextPeriodStart = new Date(currentPeriodEnd.getTime());
    const nextPeriodEnd = new Date(nextPeriodStart.getTime() + WEEK_MS);

    if (now < currentPeriodEnd) {
        periods.push({
            id: `period_${currentPeriodEnd.getTime()}`,
            label: formatLabel(currentPeriodEnd),
            startDate: currentPeriodStart,
            endDate: currentPeriodEnd
        });
    }

    periods.push({
        id: `period_${nextPeriodEnd.getTime()}`,
        label: formatLabel(nextPeriodEnd),
        startDate: nextPeriodStart,
        endDate: nextPeriodEnd
    });

    return periods;
}

const mockNow = new Date('2026-01-14T23:38:00-05:00');
console.log('Periods for Jan 14 23:38:', JSON.stringify(createPeriods(mockNow), null, 2));
