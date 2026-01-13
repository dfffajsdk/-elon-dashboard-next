'use client';
import React from 'react';

interface MilestoneGridProps {
    milestones: any[];
    currentCount: number;
}

const MilestoneGrid: React.FC<MilestoneGridProps> = () => {
    return (
        <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center h-64">
            <p className="text-text-secondary">Milestone Tracker Under Construction</p>
        </div>
    );
};

export default MilestoneGrid;
