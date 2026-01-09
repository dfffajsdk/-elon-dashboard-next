'use client';
import React from 'react';

const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#141414] transition-opacity duration-500">
            {/* Animated Logo/Spinner */}
            <div className="relative w-24 h-24 mb-8">
                {/* Outer ring */}
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping"></div>
                {/* Spinning ring */}
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
                {/* Inner glow */}
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 animate-pulse"></div>
                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-10 h-10 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                </div>
            </div>

            {/* Loading Text */}
            <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-2">Loading Dashboard</h2>
                <p className="text-gray-400 text-sm">Fetching real-time data...</p>
            </div>

            {/* Loading bar */}
            <div className="w-48 h-1 mt-6 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-loading-bar"></div>
            </div>

            {/* Floating particles effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-blue-500/30 rounded-full animate-float"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${3 + Math.random() * 4}s`
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default LoadingScreen;


