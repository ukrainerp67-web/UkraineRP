import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Wallet, 
  Briefcase, 
  ShoppingBag, 
  MessageSquare, 
  LogOut,
  Star,
  Building2,
  Landmark,
  VenetianMask,
  Gavel,
  Shield,
  Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { Bell } from 'lucide-react';
import { backend } from '../services/backendService';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onViewChange: (view: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange }) => {
  const { profile, onlinePlayers, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<number>(0);

  const onlineCount = onlinePlayers.length;

  const isAdmin = profile?.role === 'admin' || profile?.email?.toLowerCase() === 'ukrainerp67@gmail.com';
  
  const isGovLeader = isAdmin || 
                      profile?.role === 'rada' ||
                      ['Президент', "Прем'єр Міністр", "Прем'єр-міністр", 'Міністр фінансів'].includes(profile?.role || '') ||
                      ['Президент', "Прем'єр Міністр", "Прем'єр-міністр", 'Міністр фінансів'].includes(profile?.status || '');

  const isInGov = isGovLeader || 
                  ['Депутат', 'Працівник ВФБ'].includes(profile?.role || '') ||
                  ['Депутат', 'Працівник ВФБ'].includes(profile?.status || '');

  useEffect(() => {
    if (isGovLeader) {
      const unsubscribe = backend.onGlobalStateUpdate((state) => {
        setBudget(state.budget || 0);
      });
      return () => unsubscribe();
    }
  }, [isGovLeader]);

  const allNavItems = [
    { id: 'profile', icon: User, label: 'Профіль' },
    { id: 'jobs', icon: Briefcase, label: 'Робота' },
    { id: 'business', icon: Building2, label: 'Бізнес' },
    { id: 'bank', icon: Landmark, label: 'Банк' },
    { id: 'mafia', icon: VenetianMask, label: 'Мафія' },
    { id: 'rada', icon: Gavel, label: 'ВРУ' },
  ];

  const [navItems, setNavItems] = useState(allNavItems);

  useEffect(() => {
    if (isInGov) {
      setNavItems(allNavItems.filter(item => item.id !== 'mafia'));
    } else {
      setNavItems(allNavItems);
    }
  }, [profile?.role]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  React.useEffect(() => {
    const handleSwitch = (e: any) => {
      const { openPrivate } = e.detail;
      onViewChange('chat');
      if (openPrivate) {
        localStorage.setItem('openPrivateChat', JSON.stringify(openPrivate));
      }
    };

    const handleChangeView = (e: any) => {
      onViewChange(e.detail);
    };

    window.addEventListener('switchToChat', handleSwitch);
    window.addEventListener('changeView', handleChangeView);
    return () => {
      window.removeEventListener('switchToChat', handleSwitch);
      window.removeEventListener('changeView', handleChangeView);
    };
  }, [onViewChange]);

  return (
    <div className="h-[100dvh] bg-bg-dark text-text-light flex flex-col overflow-hidden">
      <header className="h-14 md:h-16 bg-card-dark/80 backdrop-blur-xl border-b border-border-dark flex items-center justify-between px-4 md:px-8 z-40 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
           <div className="w-8 h-8 md:w-10 md:h-10 bg-ukraine-blue rounded-lg flex items-center justify-center shadow-lg shadow-ukraine-blue/20 flex-shrink-0">
              <span className="text-white font-black text-sm md:text-lg">UA</span>
           </div>
           <div className="hidden xs:block">
              <h1 className="text-[10px] md:text-sm font-black uppercase tracking-[0.2em] leading-none">UKRAINE RP</h1>
              <div className="flex items-center gap-1.5 mt-1">
                 <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                 <p className="text-[8px] md:text-[9px] text-text-muted uppercase tracking-widest font-bold">онлайн: {onlineCount}</p>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          {isAdmin && (
            <button 
              onClick={() => !profile?.isFrozen && onViewChange('admin')}
              className={`p-1.5 md:p-2 rounded-lg transition-colors group active:scale-95 ${activeView === 'admin' ? 'bg-ukraine-blue/20 text-ukraine-blue' : 'hover:bg-white/5 text-text-dim hover:text-white'} ${profile?.isFrozen ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
            >
              {profile?.isFrozen ? (
                <Lock className="w-4 md:w-5 h-4 md:h-5" />
              ) : (
                <Shield className="w-4 md:w-5 h-4 md:h-5 transition-transform group-hover:rotate-12" />
              )}
            </button>
          )}

          <button 
            onClick={() => onViewChange('notifications')}
            className={`relative p-1.5 md:p-2 rounded-lg transition-colors group active:scale-95 ${activeView === 'notifications' ? 'bg-ukraine-blue/20 text-ukraine-blue' : 'hover:bg-white/5 text-text-dim hover:text-white'}`}
          >
            <Bell className="w-4 md:w-5 h-4 md:h-5 transition-transform group-hover:rotate-12" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-3 md:w-4 h-3 md:h-4 bg-red-500 text-white text-[7px] md:text-[8px] font-black rounded-full flex items-center justify-center border-2 border-card-dark">
                {unreadCount}
              </span>
            )}
          </button>

          <div className="flex flex-col items-end">
            {isGovLeader && (
              <div className="flex items-center gap-1.5 mb-0.5">
                <Landmark className="w-2.5 h-2.5 text-blue-400" />
                <span className="text-[10px] font-black text-ukraine-blue">₴{budget.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 md:gap-2">
              <Wallet className="w-3 md:w-3.5 h-3 md:h-3.5 text-ukraine-yellow" />
              <span className="text-xs md:text-sm font-black text-ukraine-yellow">₴{(profile?.balance ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-2 md:w-2.5 h-2 md:h-2.5 text-blue-400 fill-current" />
              <span className="text-[8px] md:text-[9px] font-bold text-text-muted uppercase tracking-tighter">Рейтинг: {profile?.socialRating ?? 0}</span>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="p-1.5 md:p-2 hover:bg-white/5 rounded-lg transition-colors group active:scale-95"
          >
            <LogOut className="w-4 md:w-5 h-4 md:h-5 text-text-dim group-hover:text-red-400 transition-colors" />
          </button>
        </div>
      </header>

      <main className="flex-1 bg-[radial-gradient(circle_at_50%_0%,rgba(0,102,255,0.05),transparent_50%)] overflow-y-auto custom-scrollbar scroll-smooth">
        <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
          {children}
        </div>
      </main>

      <nav className="h-16 md:h-20 bg-card-dark/95 backdrop-blur-2xl border-t border-border-dark z-40 flex-shrink-0">
        <Reorder.Group 
          axis="x" 
          values={navItems} 
          onReorder={setNavItems}
          className="flex items-center justify-around h-full px-2"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const isLocked = profile?.isFrozen && item.id !== 'profile' && item.id !== 'notifications';

            return (
              <Reorder.Item
                key={item.id}
                value={item}
                onClick={() => !isLocked && onViewChange(item.id)}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-colors relative group cursor-grab active:cursor-grabbing ${
                  isActive ? 'text-ukraine-blue' : 'text-text-dim hover:text-text-muted'
                } ${isLocked ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
              >
                <AnimatePresence>
                  {isActive && (
                    <motion.div 
                      layoutId="nav-bg"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute inset-0 bg-ukraine-blue/10 border border-ukraine-blue/20 rounded-xl"
                      transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
                    />
                  )}
                </AnimatePresence>
                
                <motion.div
                  animate={{ scale: isActive ? 1.15 : 1, y: isActive ? -2 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="relative z-10"
                >
                  {isLocked ? (
                    <Lock className="w-5 md:w-6 h-5 md:h-6 text-text-dim" />
                  ) : (
                    <item.icon className="w-5 md:w-6 h-5 md:h-6" />
                  )}
                  {item.id === 'notifications' && unreadCount > 0 && !isActive && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-card-dark" />
                  )}
                </motion.div>
                
                <span className={`text-[7px] md:text-[9px] font-black uppercase tracking-[0.2em] relative z-10 transition-transform ${isActive ? 'scale-105' : 'opacity-60'}`}>
                  {isLocked ? 'ЗАБЛОКОВАНО' : item.label}
                </span>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </nav>
    </div>
  );
};
