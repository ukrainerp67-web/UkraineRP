import React, { useState } from 'react';
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

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [lastTab, setLastTab] = useState('profile');
  const { profile } = useAuth();

  const handleViewChange = (newTab: string) => {
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
      <div className="flex gap-6 lg:gap-8 min-h-[calc(100vh-14rem)]">
        <div className="flex-1 min-w-0">
          {renderView()}
        </div>
        
        {/* Persistent Chat for Desktop */}
        {activeTab !== 'chat' && (
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
