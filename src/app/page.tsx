'use client';

import { ConfigProvider, Spin, Tag } from 'antd';
import { SyncOutlined, CheckCircleFilled } from '@ant-design/icons';
import PeriodSelector, { createPeriods } from '@/components/PeriodSelector';
import KeyMetrics from '@/components/KeyMetrics';
import MilestoneGrid from '@/components/MilestoneGrid';
import PacingCard from '@/components/PacingCard';
import ActivityHeatmap from '@/components/ActivityHeatmap';
import TweetTable from '@/components/TweetTable';
import LoadingScreen from '@/components/LoadingScreen';
import AIAssistant from '@/components/AIAssistant';
import Header from '@/components/Header';
import { useMemo, useState, useEffect } from 'react';
import { useHybridData } from '@/lib/hooks/useHybridData';
import { theme } from 'antd';

export default function Home() {
  // Theme management - default to dark mode
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme');
    if (stored === 'light') {
      setIsDarkMode(false);
    } else if (stored === 'dark') {
      setIsDarkMode(true);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setIsDarkMode(false);
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      return newMode;
    });
  };

  // Apply dark mode class to html element
  useEffect(() => {
    if (!mounted) return;
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode, mounted]);

  // Period management
  const periods = useMemo(() => createPeriods(), []);
  const [activePeriodId, setActivePeriodId] = useState(() => {
    const all = createPeriods();
    const now = new Date();
    const current = all.find(p => now >= p.startDate && now < p.endDate);
    return current ? current.id : all[0].id;
  });

  const activePeriod = useMemo(() =>
    periods.find(p => p.id === activePeriodId) || periods[0],
    [periods, activePeriodId]
  );

  // Hybrid data: API with polling
  const {
    allTweets,
    periodTweetCount,
    lastApiUpdate,
    loading,
    refresh,
    isUsingApiData,
    initialLoading,
  } = useHybridData({
    pollInterval: 60000,
    periodStart: activePeriod.startDate,
    periodEnd: activePeriod.endDate,
  });

  // Generate milestones based on period tweet count
  const milestones = useMemo(() => {
    const count = periodTweetCount;
    const targets = [200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 420, 440, 460, 480, 500, 520, 540, 560, 580];

    const now = new Date();
    const daysRemaining = Math.max(0, (activePeriod.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return targets.map(target => {
      let status: 'pass' | 'current' | 'future' = 'future';
      const deficit = count - target; // count 520, target 540 -> deficit -20

      if (count >= target) {
        status = 'pass';
      } else if (count >= target - 20) {
        status = 'current';
      }

      const absoluteGap = target - count;
      const daysRemaining = Math.max(0, (activePeriod.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const rate = daysRemaining > 0 ? Math.ceil(absoluteGap / daysRemaining) : absoluteGap;

      // Progress towards this milestone (relative to previous 20-tweet chunk)
      // e.g. if we are at 530, progress towards 540 is 10/20 = 50%
      const progress = Math.max(0, Math.min(1, (count - (target - 20)) / 20));

      return {
        target,
        status,
        rate: (status === 'current' || status === 'future') ? `${rate}/day` : undefined,
        deficit: (status === 'current' || status === 'future') ? absoluteGap : undefined,
        progress: status === 'current' ? progress : 0
      };
    });
  }, [periodTweetCount, activePeriod]);

  // Pacing info from data
  const pacingItems = useMemo(() => {
    if (!allTweets?.length) return [];

    const sortedByTime = [...allTweets].sort((a: any, b: any) => {
      const aTime = a.timestr || a.timestamp || 0;
      const bTime = b.timestr || b.timestamp || 0;
      return bTime - aTime;
    });
    const latestTweet: any = sortedByTime[0];
    const latestTimestamp = latestTweet.timestr || latestTweet.timestamp || 0;

    const now = new Date();
    const todayET = new Date(now.toLocaleString("en-US", { timeZone: 'America/New_York' }));
    todayET.setHours(0, 0, 0, 0);
    const todayStartTimestamp = Math.floor(todayET.getTime() / 1000);

    const todayTweets = sortedByTime.filter((t: any) => {
      const ts = t.timestr || t.timestamp || 0;
      return ts >= todayStartTimestamp;
    });
    const firstTodayTweet: any = todayTweets[todayTweets.length - 1];
    const firstTodayTimestamp = firstTodayTweet?.timestr || firstTodayTweet?.timestamp || 0;

    const formatDateTimeET = (timestamp: number) => {
      if (!timestamp) return "--";
      const date = new Date(timestamp * 1000);
      const month = date.toLocaleDateString("en-US", { timeZone: 'America/New_York', month: 'short' });
      const day = date.toLocaleDateString("en-US", { timeZone: 'America/New_York', day: 'numeric' });
      const time = date.toLocaleTimeString("en-US", {
        timeZone: 'America/New_York',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${month} ${day}, ${time} ET`;
    };

    return [
      { label: 'Time since last activity', value: '', isTimer: true, timerStartTimestamp: latestTimestamp },
      { label: 'Last one (ET)', value: formatDateTimeET(latestTimestamp) },
      { label: 'First today (ET)', value: formatDateTimeET(firstTodayTimestamp) },
    ];
  }, [allTweets]);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <>
      {initialLoading && <LoadingScreen />}
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#7c3aed',
            borderRadius: 8,
          },
          algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        }}
      >
        <div className="min-h-screen bg-background text-text-primary">
          {/* Header with ET time display */}
          <Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} />

          <main className="p-6 space-y-6 pt-20">
            {/* Period Selector & Status */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <PeriodSelector
                periods={periods}
                activePeriodId={activePeriodId}
                onSelect={setActivePeriodId}
              />
              <div className="flex items-center gap-2">
                {isUsingApiData ? (
                  <Tag icon={<CheckCircleFilled />} color="success" className="border-0">Live Data</Tag>
                ) : (
                  <Tag icon={<SyncOutlined spin />} color="processing" className="border-0 bg-blue-500/10 text-blue-500">Loading</Tag>
                )}
                <button
                  onClick={refresh}
                  className="flex items-center gap-1 text-sm text-text-secondary hover:text-primary transition-colors"
                >
                  <SyncOutlined spin={loading} /> Refresh
                </button>
                {lastApiUpdate && (
                  <span className="text-xs text-text-tertiary">Updated: {lastApiUpdate.toLocaleTimeString()}</span>
                )}
              </div>
            </div>

            {/* Key Metrics */}
            <Spin spinning={loading}>
              <KeyMetrics
                tweetCount={periodTweetCount}
                periodStart={activePeriod.startDate}
                periodEnd={activePeriod.endDate}
                tweets={allTweets}
              />
            </Spin>

            {/* Activity Heatmap */}
            <ActivityHeatmap tweets={allTweets} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <MilestoneGrid milestones={milestones} currentCount={periodTweetCount} />
                <TweetTable />
              </div>
              <div>
                <div className="sticky top-20">
                  <PacingCard items={pacingItems} />
                </div>
              </div>
            </div>
          </main>
        </div>
      </ConfigProvider>

      {/* AI Assistant */}
      <AIAssistant
        dashboardData={{
          tweetCount: periodTweetCount,
          periodStart: activePeriod.startDate,
          periodEnd: activePeriod.endDate,
          tweets: allTweets || [],
          progress: Math.round(((new Date().getTime() - activePeriod.startDate.getTime()) / (activePeriod.endDate.getTime() - activePeriod.startDate.getTime())) * 100),
          milestones: milestones,
          pacing: pacingItems
        }}
        isDarkMode={isDarkMode}
      />
    </>
  );
}
