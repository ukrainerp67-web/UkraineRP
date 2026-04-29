import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { backend } from '../services/backendService';

export const PayDaySystem: React.FC = () => {
    const { profile } = useAuth();
    const [timeLeft, setTimeLeft] = useState(15 * 60);

    useEffect(() => {
        if (!profile) return;

        // Calculate time since last payday to sync initial timer
        const lastPayDay = profile.lastPayDay ? (profile.lastPayDay.toMillis ? profile.lastPayDay.toMillis() : new Date(profile.lastPayDay).getTime()) : 0;
        const now = Date.now();
        const elapsed = now - lastPayDay;
        const fifteenMins = 15 * 60 * 1000;

        let initialTime = fifteenMins - elapsed;
        if (initialTime < 0) initialTime = 0;
        
        setTimeLeft(Math.floor(initialTime / 1000));

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // Trigger PayDay
                    backend.triggerPayDay(profile.uid);
                    return 15 * 60; // Reset
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [profile?.uid, profile?.lastPayDay]);

    // This component renders nothing but handles the logic
    // You could turn this into a HUD element later if needed
    return null;
};
