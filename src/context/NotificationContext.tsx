import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CheckCircle2, AlertCircle, TrendingUp, Wallet, Users, Info, X } from 'lucide-react';

export type NotificationType = 'info' | 'success' | 'error' | 'warning' | 'money' | 'work' | 'social';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: any;
  link?: string;
  actionType?: 'friend_request' | 'bank_transfer';
  actionData?: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  hasMore: boolean;
  loadMoreNotifications: () => Promise<void>;
  sendNotification: (userId: string, title: string, message: string, type: NotificationType, link?: string, actionType?: string, actionData?: any) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  respondToFriendRequest: (requestId: string, notificationId: string, status: 'accepted' | 'declined') => Promise<void>;
  respondToBankTransfer: (notificationId: string, status: 'accepted' | 'declined') => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeToast, setActiveToast] = useState<Notification | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const sendNotification = async (
    userId: string, 
    title: string, 
    message: string, 
    type: NotificationType, 
    link?: string, 
    actionType?: string, 
    actionData?: any
  ) => {
    const newNotif: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      link: link || '',
      actionType: actionType as any || null,
      actionData: actionData || null
    };

    if (userId === profile?.uid) {
        setNotifications(prev => [newNotif, ...prev]);
        setActiveToast(newNotif);
        setTimeout(() => setActiveToast(null), 5000);
    }
  };

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const loadMoreNotifications = async () => {
    // Session only for now
  };

  const respondToFriendRequest = async () => {
    alert('Тимчасово недоступно');
  };

  const respondToBankTransfer = async () => {
    alert('Тимчасово недоступно');
  };

  return (
    <NotificationContext.Provider value={{ 
        notifications, 
        unreadCount, 
        hasMore: false, 
        loadMoreNotifications, 
        sendNotification, 
        markAsRead, 
        markAllAsRead, 
        respondToFriendRequest, 
        respondToBankTransfer 
    }}>
      {children}
      
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-20 right-4 z-[60] w-full max-w-sm"
          >
            <div className="bg-card-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex gap-4 overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-ukraine-blue/5 to-transparent pointer-events-none" />
              
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                activeToast.type === 'money' ? 'bg-ukraine-yellow/20 text-ukraine-yellow' :
                activeToast.type === 'work' ? 'bg-ukraine-blue/20 text-ukraine-blue' :
                activeToast.type === 'success' ? 'bg-green-500/20 text-green-400' :
                activeToast.type === 'error' ? 'bg-red-500/20 text-red-400' :
                'bg-white/10 text-white'
              }`}>
                {activeToast.type === 'money' && <Wallet className="w-6 h-6" />}
                {activeToast.type === 'work' && <TrendingUp className="w-6 h-6" />}
                {activeToast.type === 'success' && <CheckCircle2 className="w-6 h-6" />}
                {activeToast.type === 'error' && <AlertCircle className="w-6 h-6" />}
                {activeToast.type === 'social' && <Users className="w-6 h-6" />}
                {activeToast.type === 'info' && <Info className="w-6 h-6" />}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-white uppercase tracking-widest">{activeToast.title}</h4>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">{activeToast.message}</p>
              </div>

              <button 
                onClick={() => setActiveToast(null)}
                className="self-start text-text-dim hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
