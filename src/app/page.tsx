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

    // Auto-analyze: Check for newly completed periods on page load
    fetch('/api/auto-analyze', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.analyzed > 0) {
          console.log(`[AutoAnalyze] Saved ${data.analyzed} new period(s)`);
        }
      })
      .catch(e => console.warn('[AutoAnalyze] Failed (non-critical):', e));
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
  const [periods, setPeriods] = useState(() => createPeriods());
  const [activePeriodId, setActivePeriodId] = useState(() => {
    const all = createPeriods();
    const now = new Date();
    const current = all.find(p => now >= p.startDate && now < p.endDate);
    if (!all.length) return '';
    return current ? current.id : all[0].id;
  });

  // Fetch counts for each period
  useEffect(() => {
    const fetchCounts = async () => {
      const updatedPeriods = await Promise.all(periods.map(async (p) => {
        try {
          const start = Math.floor(p.startDate.getTime() / 1000);
          const end = Math.floor(p.endDate.getTime() / 1000);
          const res = await fetch(`/api/tweet-count?start=${start}&end=${end}`);
          const data = await res.json();
          return { ...p, count: data.count || 0 };
        } catch (e) {
          return p;
        }
      }));
      setPeriods(updatedPeriods);
    };

    fetchCounts();
    // Refresh counts every 2 minutes
    const interval = setInterval(fetchCounts, 120000);
    return () => clearInterval(interval);
  }, [periods.length]); // Re-run if period rotation adds/removes a period

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

  // Milestones placeholder for now
  const milestones = useMemo(() => [], []);

  // Pacing info placeholder
  const pacingItems = useMemo(() => [], []);

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
            <ActivityHeatmap />

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
