'use client';
import React, { useState, useRef, useEffect } from 'react';
import { SendOutlined, CloseOutlined, LoadingOutlined, DeleteOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AIAssistantProps {
    dashboardData: {
        tweetCount: number;
        periodStart: Date;
        periodEnd: Date;
        tweets: any[];
        progress: number;
        milestones?: any[]; // Added milestones
        pacing?: any[];    // Added pacing info
    };
    isDarkMode?: boolean;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ dashboardData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Load history from LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem('ai_chat_history');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const fixed = parsed.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                setMessages(fixed);
            } catch (e) {
                console.error('Failed to load chat history', e);
            }
        }
    }, []);

    // Save history to LocalStorage
    useEffect(() => {
        // Only save if we have messages (or save empty if cleared)
        localStorage.setItem('ai_chat_history', JSON.stringify(messages));
    }, [messages]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Build context from dashboard data
    const buildContext = () => {
        const now = new Date();
        const timeRemaining = Math.max(0, dashboardData.periodEnd.getTime() - now.getTime());
        const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
        const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        // Get recent tweets timestamps for context - use timestr if available
        const recentTweets = dashboardData.tweets.slice(0, 15).map(t => {
            let timeStr = 'Unknown time';
            if (t.timestr) {
                const date = new Date(t.timestr * 1000);
                timeStr = date.toLocaleString('zh-CN', { timeZone: 'America/New_York', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            } else if (t.timestamp) {
                const ts = typeof t.timestamp === 'number' ? t.timestamp : parseInt(t.timestamp);
                if (!isNaN(ts)) {
                    const date = new Date(ts * 1000);
                    timeStr = date.toLocaleString('zh-CN', { timeZone: 'America/New_York', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                }
            }
            const content = t.msg || t.text || 'No text';
            return `[${timeStr}] ${content.substring(0, 50)}...`;
        });

        // Calculate daily rate
        const elapsedMs = now.getTime() - dashboardData.periodStart.getTime();
        const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
        const dailyRate = elapsedDays > 0 ? (dashboardData.tweetCount / elapsedDays).toFixed(1) : 0;

        // Hourly Distribution (Intraday) for the latest active day
        const hourlyCounts: Record<string, number> = {};
        if (dashboardData.tweets.length > 0) {
            // Assume tweets are sorted desc, take the first one's date as "Subject Day"
            const latestTweet = dashboardData.tweets[0];
            let latestDateStr = '';

            // Helper to get date string ET
            const getEtDate = (t: any) => {
                let ts = t.timestr || t.timestamp;
                if (typeof ts === 'string' && /^\d+$/.test(ts)) ts = parseInt(ts);
                if (typeof ts === 'number') {
                    return new Date(ts * 1000).toLocaleDateString("en-US", { timeZone: 'America/New_York' });
                }
                return '';
            };

            latestDateStr = getEtDate(latestTweet);

            dashboardData.tweets.forEach(t => {
                const dateStr = getEtDate(t);
                if (dateStr === latestDateStr) {
                    let ts = t.timestr || t.timestamp;
                    if (typeof ts === 'string' && /^\d+$/.test(ts)) ts = parseInt(ts);
                    if (typeof ts === 'number') {
                        const date = new Date(ts * 1000);
                        const hour = date.toLocaleTimeString("en-US", { timeZone: 'America/New_York', hour: '2-digit', hour12: false });
                        const key = `${hour}:00`;
                        hourlyCounts[key] = (hourlyCounts[key] || 0) + 1;
                    }
                }
            });
        }

        const hourlyStats = Object.entries(hourlyCounts)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([hour, count]) => `- ${hour} ET: ${count} 条`)
            .join('\n');

        // Milestones
        const currentMilestone = dashboardData.milestones?.find((m: any) => m.status === 'current');
        const nextMilestone = dashboardData.milestones?.find((m: any) => m.status === 'future');
        const milestoneInfo = currentMilestone
            ? `当前目标: ${currentMilestone.target}, 缺口: ${currentMilestone.deficit}`
            : (nextMilestone ? `下一个目标: ${nextMilestone.target}` : '所有目标已完成');

        // Pacing
        const pacingInfo = dashboardData.pacing?.map((p: any) => `${p.label}: ${p.value}`).join('\n- ');

        return `
你是一个专业的Elon Musk推文数据分析师。根据实时看板数据回答用户问题。

## 📊 核心看板数据 (截止目前)
- **当前周期**: ${dashboardData.periodStart.toLocaleDateString('zh-CN')} 至 ${dashboardData.periodEnd.toLocaleDateString('zh-CN')}
- **已发推文**: ${dashboardData.tweetCount} 条
- **时间进度**: ${dashboardData.progress}%
- **剩余时间**: ${daysRemaining}天 ${hoursRemaining}小时
- **当前速率**: ${dailyRate} 条/天

## 📈 今日分时活跃度 (Latest Day ET)
${hourlyStats || '暂无今日数据'}

## 🎯 里程碑追踪
- ${milestoneInfo}

## ⏱️ 活跃度节奏
- ${pacingInfo || '暂无数据'}

## 📝 最近15条推文 (美东时间)
${recentTweets.join('\n')}

## 回答原则
1. **数据驱动**: 必须引用具体数字(如分时统计)来支持你的分析。
2. **简明扼要**: 直接回答问题，不要废话。
3. **预测逻辑**: 如果预测，基于当前速率 (${dailyRate}条/天) 和剩余时间进行估算。
4. **格式**: 使用 Markdown，重点数字加粗。
`;
    };

    const sendMessage = async (customMessage?: string) => {
        const textToSend = customMessage || input.trim();
        if (!textToSend || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: textToSend,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: textToSend,
                    context: buildContext(),
                    history: messages.slice(-6).map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            const assistantMessage: Message = {
                role: 'assistant',
                content: data.response || '抱歉，我无法生成回复。',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('AI request failed:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: error instanceof Error ? `Error: ${error.message}` : '抱歉，连接服务商超时，请稍后再试。',
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearHistory = () => {
        setMessages([]);
    };

    // Dynamic Suggestions
    const currentMilestone = dashboardData.milestones?.find((m: any) => m.status === 'current');
    const suggestions = [
        `📊 预测本周能发多少条？`,
        currentMilestone ? `🎯 还需要发多少条达到 ${currentMilestone.target}？` : `📈 分析当前发推节奏`,
        `🕒 今天什么时候最活跃？`
    ];

    // Draggable Logic - Optimized for Performance
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; isDragging: boolean }>({
        startX: 0, startY: 0, initialX: 0, initialY: 0, isDragging: false
    });

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only allow dragging on desktop (sm breakpoint)
        if (window.innerWidth < 640) return;

        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: position.x,
            initialY: position.y,
            isDragging: true
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragRef.current.isDragging || !panelRef.current) return;

            // Calculate new position
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            const newX = dragRef.current.initialX + dx;
            const newY = dragRef.current.initialY + dy;

            // Direct DOM update for 60fps performance
            panelRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!dragRef.current.isDragging) return;
            dragRef.current.isDragging = false;

            // Calculate final position
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            const finalX = dragRef.current.initialX + dx;
            const finalY = dragRef.current.initialY + dy;

            // Sync with React state to preserve position on re-renders
            setPosition({ x: finalX, y: finalY });

            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Theme-aware styles
    // Mobile: Solid background for better readability/immersion
    // Desktop: Glassmorphism
    const panelBg = 'glass-card border-none';
    const headerBg = 'bg-surface/30 border-b-0 cursor-move active:cursor-grabbing';
    const textPrimary = 'text-text-primary';
    const textSecondary = 'text-text-secondary';
    const inputBg = 'bg-surface-highlight/50 hover:bg-surface-highlight transition-colors border border-white/10 focus:border-primary/50';

    // Message Bubbles
    const userBubble = 'bg-primary text-white shadow-md shadow-primary/20';
    const aiBubble = 'bg-surface-highlight text-text-primary shadow-sm';

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-2xl shadow-primary/30 transform hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center z-50 overflow-hidden ${isOpen ? 'hidden' : ''}`}
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)' }}
            >
                <img src="/ai_icon.png" alt="AI" className="w-8 h-8 object-contain drop-shadow-md" />
            </button>

            {/* Chat Panel */}
            <div
                ref={panelRef}
                className={`fixed z-50 flex flex-col transition-opacity duration-300 ${panelBg} bg-surface dark:bg-zinc-900 sm:bg-transparent sm:dark:bg-transparent
                ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                inset-0 w-full h-full rounded-none
                sm:bottom-6 sm:right-6 sm:w-96 sm:h-[600px] sm:inset-auto sm:rounded-3xl sm:origin-bottom-right
                ${!isOpen && 'sm:scale-95'}
            `}
                style={{
                    transform: window.innerWidth >= 640 ? `translate(${position.x}px, ${position.y}px)` : 'none'
                }}
            >
                {/* Header */}
                <div
                    onMouseDown={handleMouseDown}
                    className={`flex items-center justify-between p-5 ${headerBg} sm:rounded-t-3xl pt-safe-top shrink-0 select-none`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-inner" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)' }}>
                            <img src="/ai_icon.png" alt="AI" className="w-6 h-6 object-contain" />
                        </div>
                        <div>
                            <h3 className={`font-bold text-base ${textPrimary}`}>Elon Insight</h3>
                            <p className={`text-[10px] uppercase tracking-wider font-semibold ${textSecondary} opacity-70`}>Powered by Qwen</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={clearHistory}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-text-tertiary hover:text-text-primary transition-all`}
                            title="清除历史"
                        >
                            <DeleteOutlined style={{ fontSize: '14px' }} />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-text-tertiary hover:text-text-primary transition-all`}
                        >
                            <CloseOutlined style={{ fontSize: '14px' }} />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-surface-highlight scrollbar-track-transparent min-h-0">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full space-y-6 animate-fade-in">
                            <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl mb-2" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)' }}>
                                <img src="/ai_icon.png" alt="AI" className="w-12 h-12 object-contain drop-shadow-lg" />
                            </div>
                            <div className="text-center space-y-1">
                                <h4 className={`text-lg font-bold ${textPrimary}`}>有什么可以帮您？</h4>
                                <p className={`text-sm ${textSecondary}`}>基于实时数据分析 Elon Musk 的推文趋势</p>
                            </div>

                            <div className="w-full space-y-2.5">
                                {suggestions.map((suggestion, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => sendMessage(suggestion)}
                                        className="w-full text-left p-3.5 rounded-xl bg-surface/50 hover:bg-surface-highlight border border-white/5 hover:border-white/10 transition-all duration-200 text-sm font-medium text-text-secondary hover:text-text-primary hover:shadow-md group flex items-center justify-between"
                                    >
                                        <span>{suggestion}</span>
                                        <SendOutlined className="opacity-0 group-hover:opacity-50 -translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
                        >
                            <div
                                className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                    ? `${userBubble} rounded-br-none`
                                    : `${aiBubble} rounded-bl-none`
                                    }`}
                            >
                                {msg.role === 'assistant' ? (
                                    <div className="markdown-content">
                                        <ReactMarkdown
                                            components={{
                                                strong: ({ children }) => <span className="font-bold text-current opacity-90">{children}</span>,
                                                h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1 opacity-90">{children}</h1>,
                                                p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                                                ul: ({ children }) => <ul className="list-disc list-inside mb-1.5 space-y-0.5 opacity-90">{children}</ul>,
                                                li: ({ children }) => <li className="ml-1">{children}</li>,
                                                code: ({ children }) => <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p>{msg.content}</p>
                                )}
                                <p className={`text-[10px] mt-1.5 text-right opacity-60`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className={`p-4 rounded-2xl rounded-bl-none ${aiBubble} flex items-center gap-3`}>
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                                </div>
                                <span className="text-xs opacity-70">思考中...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 pt-2 shrink-0">
                    <div className={`flex items-end gap-2 rounded-2xl p-2 transition-colors ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="输入问题..."
                            className={`flex-1 bg-transparent px-3 py-3 text-sm resize-none focus:outline-none max-h-32 text-text-primary placeholder-text-tertiary ${inputBg} rounded-xl`}
                            rows={1}
                            style={{ minHeight: '48px' }}
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isLoading}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md ${input.trim()
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg hover:scale-105'
                                : 'bg-surface-highlight text-text-tertiary cursor-not-allowed'
                                }`}
                        >
                            {isLoading ? <LoadingOutlined /> : <SendOutlined />}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AIAssistant;


