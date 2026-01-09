'use client';
import React, { useEffect, useState } from 'react';
import { Table, Tag, Typography, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface TweetData {
    key: string;
    count: number;
    time: string;
    type: string;
    baseId: string;
    trackerId: string;
    content: string;
}

// Unused interfaces removed

import { Tweet } from '../lib/types';

// Map action types to display names
const getActionType = (action: string): string => {
    if (action === 'huifu') return 'Reply';
    return 'Tweet/Retweet/Quote';
};

const TweetTable: React.FC = () => {
    const [tweets, setTweets] = useState<TweetData[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 10;

    const fetchTweets = async () => {
        try {
            setLoading(true);
            // Fetch directly from Next.js API
            // limit=1000 to get enough data for table
            const response = await fetch('/api/tweets?limit=1000');
            const data = await response.json();

            // API returns { tweets: [...] }
            if (data.tweets && Array.isArray(data.tweets)) {
                const formattedTweets: TweetData[] = data.tweets.map((tweet: Tweet, index: number) => ({
                    key: `${tweet.id || tweet.xid || 'tweet'}-${index}`,
                    count: data.tweets.length - index,
                    time: (() => {
                        // Handle timestr or timestamp (both could be Unix seconds)
                        if (typeof tweet.timestr === 'number') return new Date(tweet.timestr * 1000).toISOString();
                        if (typeof tweet.timestr === 'string' && /^\d{10}$/.test(tweet.timestr)) return new Date(parseInt(tweet.timestr) * 1000).toISOString();
                        if (tweet.timestamp) return new Date(tweet.timestamp * 1000).toISOString();
                        return tweet.timestr || new Date().toISOString();
                    })(),
                    type: getActionType(tweet.action || ''),
                    baseId: tweet.baseid || tweet.id || '-',
                    trackerId: tweet.xid || '-',
                    content: tweet.msg || tweet.text || ''
                }));

                setTweets(formattedTweets);
                setTotalCount(formattedTweets.length);
            }
        } catch (error) {
            console.error('Error fetching tweets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTweets();
        const interval = setInterval(fetchTweets, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    const columns: ColumnsType<TweetData> = [
        {
            title: 'Count',
            dataIndex: 'count',
            key: 'count',
            width: 80,
            sorter: (a, b) => a.count - b.count,
            render: (count) => (
                <span className={count > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                    {count}
                </span>
            ),
        },
        {
            title: 'Time',
            dataIndex: 'time',
            key: 'time',
            width: 160,
            defaultSortOrder: 'descend',
            render: (text) => {
                try {
                    // Format as YYYY-MM-DD HH:mm:ss in ET (Eastern Time)
                    const date = new Date(text);
                    const etFormatter = new Intl.DateTimeFormat('en-US', {
                        timeZone: 'America/New_York',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    });
                    const formatted = etFormatter.format(date).replace(',', '');
                    return <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">{formatted} ET</span>;
                } catch {
                    return <span className="text-gray-500 dark:text-gray-500">{text}</span>;
                }
            },
            sorter: (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            width: 120,
            filters: [
                { text: 'Tweet/Retweet/Quote', value: 'Tweet/Retweet/Quote' },
                { text: 'Reply', value: 'Reply' },
            ],
            onFilter: (value, record) => record.type === value,
            render: (type) => (
                <Tag className="border-0 font-medium" color={type === 'Reply' ? 'default' : 'green'}>
                    {type}
                </Tag>
            ),
        },
        {
            title: 'Base ID / X Tracker ID',
            key: 'ids',
            width: 200,
            render: (_, record) => (
                <div className="text-xs font-mono">
                    <div className="text-gray-600 dark:text-gray-400">{record.baseId}</div>
                    <div className="text-gray-400 dark:text-gray-500">{record.trackerId}</div>
                </div>
            )
        },
        {
            title: 'Content',
            dataIndex: 'content',
            key: 'content',
            render: (text, record) => (
                <div>
                    <Typography.Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'More' }} className="mb-0 text-sm !text-gray-900 dark:!text-gray-300">
                        {text || '-'}
                    </Typography.Paragraph>
                    {record.trackerId !== 'None' && (
                        <a
                            href={`https://x.com/elonmusk/status/${record.trackerId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 dark:text-blue-400 hover:underline block mt-1"
                        >
                            → X Status
                        </a>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="bg-surface p-6 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-text-primary font-bold text-xl tracking-tight flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-gradient-to-b from-green-400 to-green-600 rounded-full"></span>
                    Recent Tweets
                </h3>
                <span className="text-xs text-text-tertiary font-mono px-3 py-1 bg-surface-highlight rounded-full">Total: {totalCount}</span>
            </div>
            <Spin spinning={loading}>
                <Table
                    columns={columns}
                    dataSource={tweets}
                    pagination={{
                        current: currentPage,
                        pageSize: pageSize,
                        total: totalCount,
                        onChange: (page) => setCurrentPage(page),
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showQuickJumper: true,
                        showTotal: (total, range) => <span className="text-text-secondary">{`${range[0]}-${range[1]} of ${total}`}</span>,
                    }}
                    size="middle"
                    scroll={{ x: 900 }}
                    rowClassName="hover:bg-surface-highlight transition-colors"
                />
            </Spin>
        </div>
    );
};

export default TweetTable;


