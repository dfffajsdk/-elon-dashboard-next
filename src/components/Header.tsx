'use client';
import React, { useState, useEffect } from 'react';
import { Button, Avatar, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { UserOutlined, DownOutlined, BookOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';

interface HeaderProps {
    isDarkMode?: boolean;
    toggleTheme?: () => void;
}

// Eastern Time display component
const EasternTimeDisplay: React.FC = () => {
    const [time, setTime] = useState('');
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const options: Intl.DateTimeFormatOptions = {
                timeZone: 'America/New_York',
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            };
            const formatted = new Intl.DateTimeFormat('en-US', options).format(now);
            setTime(formatted);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            {/* Desktop View: Always Visible */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-700">
                <ClockCircleOutlined className="text-blue-500 dark:text-blue-400" />
                <span className="text-sm font-mono font-medium text-blue-600 dark:text-blue-300">
                    {time} ET
                </span>
            </div>

            {/* Mobile View: Toggle Button + Dropdown */}
            <div className="sm:hidden relative">
                <Button
                    icon={<ClockCircleOutlined />}
                    shape="circle"
                    size="middle"
                    className={isMobileExpanded ? 'text-blue-500 border-blue-500 bg-blue-50' : 'text-gray-500'}
                    onClick={() => setIsMobileExpanded(!isMobileExpanded)}
                />

                {isMobileExpanded && (
                    <div className="absolute top-full mt-2 right-0 w-max bg-white dark:bg-zinc-800 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-zinc-700 flex items-center gap-2 z-50 animate-fade-in-down">
                        <span className="text-sm font-mono font-medium text-blue-600 dark:text-blue-300">
                            {time} ET
                        </span>
                    </div>
                )}
            </div>
        </>
    );
};

const Header: React.FC<HeaderProps> = ({ isDarkMode, toggleTheme }) => {
    const items: MenuProps['items'] = [
        {
            key: '1',
            label: 'Profile',
            icon: <UserOutlined />,
        },
        {
            key: '2',
            label: 'Logout',
        },
    ];

    return (
        <header className="fixed top-0 w-full z-50 transition-all duration-300 glass h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
                {/* Logo Placeholder */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 p-[2px] shadow-lg hover:shadow-purple-500/20 transition-shadow">
                    <img src="https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg" alt="Elon Musk" className="w-full h-full object-cover rounded-full border-2 border-white dark:border-zinc-900" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/40')} />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight">ElonTweets.Live</span>
            </div>

            <div className="flex items-center gap-4">
                {/* Eastern Time Display */}
                <EasternTimeDisplay />

                <div className="h-6 w-px bg-border mx-2"></div>

                <Button
                    shape="circle"
                    type="text"
                    icon={isDarkMode ? <SunOutlined className="text-yellow-400" /> : <MoonOutlined className="text-slate-600" />}
                    onClick={toggleTheme}
                    className="flex justify-center items-center hover:bg-surface-highlight transition-colors"
                />

                <Button
                    type="primary"
                    shape="round"
                    icon={<BookOutlined />}
                    className="bg-primary hover:bg-purple-600 border-none font-medium shadow-md shadow-purple-500/20"
                >
                    Guide
                </Button>

                <Dropdown menu={{ items }}>
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-surface-highlight px-2 py-1 rounded-full transition-colors">
                        <Avatar icon={<UserOutlined />} size="small" className="bg-surface-highlight text-text-primary" />
                        <span className="text-sm font-medium text-text-primary hidden sm:block">User</span>
                        <DownOutlined className="text-xs text-text-tertiary" />
                    </div>
                </Dropdown>
            </div>
        </header>
    );
};

export default Header;



