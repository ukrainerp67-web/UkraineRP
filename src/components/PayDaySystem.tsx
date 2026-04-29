import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { backend } from '../services/backendService';

export const PayDaySystem: React.FC = () => {
    const { profile } = useAuth();
    const [timeLeft, setTimeLeft] = useState(15 * 60);

    useEffect(() => {
        if (!profile) return;

        const syncTimer = () => {
            const lastPayDay = profile.lastPayDay ? (profile.lastPayDay.toMillis ? profile.lastPayDay.toMillis() : new Date(profile.lastPayDay).getTime()) : 0;
            const now = Date.now();
            const elapsed = now - lastPayDay;
            const fifteenMins = 15 * 60 * 1000;

            let initialTime = fifteenMins - elapsed;
            if (initialTime < 0) initialTime = 0;
            setTimeLeft(Math.floor(initialTime / 1000));
        };

        syncTimer();

        const interval = setInterval(() => {
            // ONLY tick if the page is visible (player is active in game)
            if (document.visibilityState !== 'visible') return;

            setTimeLeft(prev => {
                if (prev <= 0) {
                    backend.triggerPayDay(profile.uid);
                    return 15 * 60; // Reset timer
                }
                return prev - 1;
            });
        }, 1000);

        // Re-sync timer when tab becomes visible again
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncTimer();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [profile?.uid, profile?.lastPayDay]);

    // This component renders nothing but handles the logic
    // You could turn this into a HUD element later if needed
    return null;
};
