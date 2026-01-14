'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import { Tweet } from '../types';

interface HybridData {
    allTweets: Tweet[];
    periodTweetCount: number;
    lastApiUpdate: Date | null;
    loading: boolean;
    error: string | null;
}

interface UseHybridDataOptions {
    pollInterval?: number;
    periodStart: Date;
    periodEnd: Date;
}

export function useHybridData(options: UseHybridDataOptions) {
    const { pollInterval = 60000, periodStart, periodEnd } = options;

    const [data, setData] = useState<HybridData>({
        allTweets: [],
        periodTweetCount: 0,
        lastApiUpdate: null,
        loading: true,
        error: null,
    });

    const [initialLoading, setInitialLoading] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isFirstApiCall = useRef(true);

    // Get timestamp for API calls
    const getPeriodTimestamp = useCallback(() => {
        return Math.floor(periodStart.getTime() / 1000);
    }, [periodStart]);

    // Fetch real-time data from API
    const fetchApiData = useCallback(async () => {
        try {
            const timestamp = getPeriodTimestamp();
            const endTimestamp = Math.floor(periodEnd.getTime() / 1000);

            // 1. Fetch tweet count from Next.js API (Server-side proxy)
            const countResponse = await fetch(`/api/tweet-count?t=${timestamp}&end=${endTimestamp}`);
            const countData = await countResponse.json();
            const apiCount = countData?.count || 0;

            // 2. Fetch tweets list from Next.js API (Server-side proxy)
            const tweetsResponse = await fetch(`/api/tweets?limit=100&t=${timestamp}&end=${endTimestamp}`);
            const tweetsData = await tweetsResponse.json();
            // Next.js API returns { tweets: [...] }
            const tweetsList = tweetsData?.tweets || [];

            console.log(`[API] Tweet count: ${apiCount}, Tweets: ${tweetsList.length}`);

            setData(prev => ({
                ...prev,
                periodTweetCount: apiCount >= 0 ? apiCount : prev.periodTweetCount,
                allTweets: tweetsList,
                lastApiUpdate: new Date(),
                loading: false,
                error: null,
            }));

            if (isFirstApiCall.current) {
                isFirstApiCall.current = false;
                setInitialLoading(false);
            }

        } catch (error) {
            console.error('API fetch failed:', error);
            setData(prev => ({
                ...prev,
                loading: false,
                error: 'API unavailable',
            }));
            if (isFirstApiCall.current) {
                isFirstApiCall.current = false;
                setInitialLoading(false);
            }
        }
    }, [getPeriodTimestamp]);

    // Initial load
    useEffect(() => {
        fetchApiData();
    }, [fetchApiData]);

    // Refetch when period changes
    useEffect(() => {
        console.log(`[PERIOD] Changed to ${periodStart.toISOString()}, refetching...`);
        fetchApiData();
    }, [periodStart, fetchApiData]);

    // Polling
    useEffect(() => {
        intervalRef.current = setInterval(fetchApiData, pollInterval);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchApiData, pollInterval]);

    const refresh = useCallback(() => {
        fetchApiData();
    }, [fetchApiData]);

    return {
        ...data,
        refresh,
        isUsingApiData: data.lastApiUpdate !== null,
        initialLoading,
    };
}

export default useHybridData;
