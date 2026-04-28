import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { ProfileView } from './views/ProfileView';
import { ShopView } from './views/ShopView';
import { JobsView } from './views/JobsView';
import { CasinoView } from './views/CasinoView';
import { BankView } from './views/BankView';
import { MafiaView } from './views/MafiaView';
import { RadaView } from './views/RadaView';
import { SettingsView } from './views/SettingsView';
import { ChatView } from './views/ChatView';
import { NotificationsView } from './views/NotificationsView';
import { BusinessView } from './views/BusinessView';
import { AdminView } from './views/AdminView';
import { Snowflake, Lock, Bell, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [lastTab, setLastTab] = useState('profile');
  const [showLockedMessage, setShowLockedMessage] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.freezeUntil || profile.freezeUntil === 'permanent') {
      setTimeLeft(profile?.freezeUntil === 'permanent' ? 'НАЗАВЖДИ' : '');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(profile.freezeUntil!);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('00:00:00');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      let timeStr = '';
      if (days > 0) timeStr += `${days}д `;
      timeStr += `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      setTimeLeft(timeStr);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [profile?.freezeUntil]);

  useEffect(() => {
    // Admin revocation check: If user was in admin panel but role changed, kick back to profile
    if (profile?.role !== 'admin' && activeTab === 'admin') {
      setActiveTab('profile');
    }

    // Frozen state check: If user is frozen, only allow Profile and Notifications
    if (profile?.isFrozen && activeTab !== 'profile' && activeTab !== 'notifications') {
      setActiveTab('profile');
    }
  }, [profile?.role, profile?.isFrozen, activeTab]);

  useEffect(() => {
    const handleViewChangeEvent = (e: any) => {
      if (e.detail) {
        handleViewChange(e.detail);
      }
    };
    window.addEventListener('changeView', handleViewChangeEvent);
    return () => window.removeEventListener('changeView', handleViewChangeEvent);
  }, [profile]);

  const handleViewChange = (newTab: string) => {
    // Prevent navigating to other tabs if frozen
    if (profile?.isFrozen && newTab !== 'profile' && newTab !== 'notifications') {
      setShowLockedMessage(true);
      setTimeout(() => setShowLockedMessage(false), 3000);
      return;
    }

    if (newTab === activeTab && newTab === 'notifications') {
      setActiveTab(lastTab);
    } else {
      if (activeTab !== 'notifications') {
        setLastTab(activeTab);
      }
      setActiveTab(newTab);
    }
  };

  const renderView = () => {
    switch (activeTab) {
      case 'profile': return <ProfileView />;
      case 'shop': return <ShopView />;
      case 'jobs': return <JobsView />;
      case 'casino': return <CasinoView />;
      case 'bank': return <BankView />;
      case 'mafia': return <MafiaView />;
      case 'rada': return <RadaView />;
      case 'business': return <BusinessView />;
      case 'settings': return <SettingsView />;
      case 'chat': return <ChatView />;
      case 'notifications': return <NotificationsView />;
      case 'admin': return <AdminView />;
      default: return <ProfileView />;
    }
  };

  return (
    <Layout activeView={activeTab} onViewChange={handleViewChange}>
      <div className="flex gap-6 lg:gap-8 min-h-[calc(100vh-14rem)] relative">
        {profile?.isFrozen && activeTab !== 'notifications' && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="relative bg-card-dark border border-blue-500/30 p-8 rounded-3xl shadow-2xl shadow-blue-500/20 max-w-sm text-center"
            >
               <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500 mx-auto mb-6">
                  <Snowflake className="w-10 h-10 animate-pulse" />
               </div>
               <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">АКАУНТ ЗАМОРОЖЕНО</h2>
               <div className="bg-blue-600/20 py-2 px-4 rounded-xl mb-4 border border-blue-500/30">
                  <span className="text-blue-400 font-black text-xl tracking-widest block font-mono">{timeLeft}</span>
                  <span className="text-[10px] text-blue-400/80 font-bold uppercase tracking-widest">до розморозки</span>
               </div>
               <p className="text-text-dim text-sm mb-6 leading-relaxed">
                  Ваш акаунт було тимчасово обмежено адміністрацією.<br/>
                  <span className="text-blue-400 font-bold mt-2 block">ПРИЧИНА: {profile.freezeReason || 'Порушення правил'}</span>
               </p>
               <button 
                  onClick={() => handleViewChange('notifications')}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-white font-black uppercase text-xs transition-all"
               >
                  <Bell className="w-4 h-4" />
                  ПЕРЕГЛЯНУТИ СПОВІЩЕННЯ
               </button>
            </motion.div>
          </div>
        )}

        <div className={`flex-1 min-w-0 ${profile?.isFrozen && activeTab !== 'notifications' ? 'pointer-events-none filter blur-[1px]' : ''}`}>
          {renderView()}
        </div>

        <AnimatePresence>
          {showLockedMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-red-600/40 flex items-center gap-3 border border-red-500"
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                 <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-sm uppercase tracking-tighter">Акаунт заблокований</p>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                   <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">Залишилось: {timeLeft}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Persistent Chat for Desktop */}
        {activeTab !== 'chat' && !profile?.isFrozen && (
          <div className="hidden xl:block w-96 flex-shrink-0">
            <div className="sticky top-6 h-[calc(100vh-12rem)] bg-card-dark/40 border border-border-dark rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl">
              <ChatView />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
