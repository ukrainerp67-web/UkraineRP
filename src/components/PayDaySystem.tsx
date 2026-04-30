import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { backend } from '../services/backendService';

export const PayDaySystem: React.FC = () => {
    const { profile } = useAuth();
    const [timeLeft, setTimeLeft] = useState(15 * 60);

    useEffect(() => {
        if (!profile) return;

        const checkGlobalState = async () => {
            const state = await backend.getGlobalState();
            if (state.trustRating < 20) {
                // Maidan logic or blocking - we'll just show a global warning for now
                console.warn("МАЙДАН: Рейтинг довіри критично низький!");
            }
        };

        checkGlobalState();
        const stateUnsub = backend.onGlobalStateUpdate((state) => {
            if (state.trustRating < 20) {
                // Logic to block payments could be here
            }
        });

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
            if (document.visibilityState !== 'visible') return;

            setTimeLeft(prev => {
                if (prev <= 0) {
                        // Check rating before paying
                        backend.getGlobalState().then(state => {
                            const isGovRole = profile.role === 'Президент' || 
                                              profile.role === "Прем'єр Міністр" || 
                                              profile.role === "Прем'єр міністр" || 
                                              profile.role === "Прем'єр-міністр" || 
                                              profile.role === 'Міністр фінансів' ||
                                              profile.role === 'Депутат' || 
                                              profile.role === 'Працівник ВФБ' ||
                                              profile.role === 'rada';

                            if (state.trustRating >= 20 || !isGovRole) {
                                 backend.triggerPayDay(profile.uid);
                            } else {
                                 backend.sendNotification(profile.uid, {
                                    title: '❌ Виплата заблокована',
                                    message: 'Через критично низький рейтинг довіри (Майдан), виплати зарплат для посадовців тимчасово призупинено!',
                                    type: 'error'
                                 });
                            }
                        });
                    
                    return 15 * 60; 
                }
                return prev - 1;
            });
        }, 1000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncTimer();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            stateUnsub();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [profile?.uid, profile?.lastPayDay, profile?.role]);

    // This component renders nothing but handles the logic
    // You could turn this into a HUD element later if needed
    return null;
};
