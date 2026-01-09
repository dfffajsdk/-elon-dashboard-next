/**
 * Convert Eastern Time (ET) hour to Local Time (LT, UTC+8)
 * ET is UTC-5 (Standard) or UTC-4 (Daylight)
 * Assuming UTC-5 for simple calculation matching original logic
 * UTC+8 is 13 hours ahead of ET
 */
export const etToLt = (etHour: number): number => {
    return (etHour + 13) % 24;
};
