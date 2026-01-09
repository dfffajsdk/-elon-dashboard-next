'use client';

import { useState, useEffect } from 'react';

interface CountdownTime {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string;
}

export function useCountdown(targetDate: Date | null): CountdownTime {
    const [timeLeft, setTimeLeft] = useState<CountdownTime>(calculateTimeLeft(targetDate));

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft(targetDate));
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    return timeLeft;
}

function calculateTimeLeft(targetDate: Date | null): CountdownTime {
    if (!targetDate) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, formatted: '0d 00:00:00' };
    }

    const now = new Date().getTime();
    const target = targetDate.getTime();
    const difference = target - now;

    if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, formatted: '0d 00:00:00' };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    const formatted = `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return { days, hours, minutes, seconds, formatted };
}

export function getNextPeriodEnd(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();

    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0) {
        daysUntilFriday = 7;
    }

    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + daysUntilFriday);
    nextFriday.setHours(23, 59, 59, 999);

    return nextFriday;
}

export default useCountdown;
