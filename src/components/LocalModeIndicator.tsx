import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, HardDrive, X } from 'lucide-react';
import { isLocalMode } from '../utils/localStorage';

export const LocalModeIndicator: React.FC = () => {
    const [isLocal, setIsLocal] = useState(false);
    const [isHidden, setIsHidden] = useState(() => {
        // Check if user has previously hidden the notice
        return localStorage.getItem('localModeNoticeDismissed') === 'true';
    });
    
    useEffect(() => {
        // Check mode on mount
        setIsLocal(isLocalMode());
        
        // Check periodically (in case it changes)
        const interval = setInterval(() => {
            setIsLocal(isLocalMode());
        }, 5000);
        
        return () => clearInterval(interval);
    }, []);
    
    const handleDismiss = () => {
        setIsHidden(true);
        localStorage.setItem('localModeNoticeDismissed', 'true');
    };
    
    if (!isLocal || isHidden) {
        return null; // Don't show anything in cloud mode or if dismissed
    }
    
    return (
        <div className="fixed top-4 right-4 z-50 bg-amber-100 border-2 border-amber-400 rounded-lg px-4 py-2 shadow-lg flex items-center gap-3 text-amber-900">
            <HardDrive className="w-4 h-4" />
            <div className="flex flex-col">
                <span className="text-sm font-semibold">Local Mode</span>
                <span className="text-xs">Data saved in browser only</span>
            </div>
            <button
                onClick={handleDismiss}
                className="ml-2 p-1 hover:bg-amber-200 rounded transition-colors"
                aria-label="Dismiss local mode notice"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};