import React, { useState, useEffect } from 'react';
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
import { Snowflake, Lock, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [lastTab, setLastTab] = useState('profile');
  const { profile } = useAuth();

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

  const handleViewChange = (newTab: string) => {
    // Prevent navigating to other tabs if frozen
    if (profile?.isFrozen && newTab !== 'profile' && newTab !== 'notifications') {
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
               <p className="text-text-dim text-sm mb-6 leading-relaxed">
                  Ваш акаунт було тимчасово обмежено адміністрацією.<br/>
                  <span className="text-blue-400 font-bold mt-2 block">ПРИЧИНА: {profile.freezeReason || 'Порушення правил'}</span>
                  {profile.freezeUntil && profile.freezeUntil !== 'permanent' && (
                    <span className="text-[10px] text-text-muted mt-2 block">ДО: {new Date(profile.freezeUntil).toLocaleString('uk-UA')}</span>
                  )}
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
