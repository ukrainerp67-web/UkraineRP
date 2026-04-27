import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../../context/NotificationContext';
import { Bell, CheckCircle2, AlertCircle, TrendingUp, Wallet, Users, Info, X, Trash2, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';

export const NotificationsView: React.FC = () => {
  const { notifications, markAsRead, markAllAsRead, unreadCount, respondToFriendRequest, respondToBankTransfer, hasMore, loadMoreNotifications } = useNotifications();
  const [loadingMore, setLoadingMore] = React.useState(false);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await loadMoreNotifications();
    setLoadingMore(false);
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-24 md:pb-8 max-w-2xl mx-auto">
      <header className="flex items-center justify-between bg-card-dark p-6 rounded-2xl border border-border-dark shadow-xl">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Bell className="w-6 h-6 text-ukraine-blue" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-card-dark">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black uppercase tracking-[0.2em] text-white">Сповіщення</h2>
            <p className="text-[9px] md:text-[10px] text-text-muted uppercase tracking-widest">Ваша історія ігрових подій</p>
          </div>
        </div>
        
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#E0E0E0] transition-colors"
          >
            ПРОЧИТАТИ ВСЕ
          </button>
        )}
      </header>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {notifications.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 bg-card-dark/30 rounded-3xl border border-dashed border-border-dark"
            >
              <Bell className="w-12 h-12 text-text-muted/20 mx-auto mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">У вас поки немає сповіщень</p>
            </motion.div>
          ) : (
            notifications.map((n, idx) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                className={`group relative bg-card-dark border rounded-2xl p-4 md:p-5 flex gap-4 transition-all hover:bg-white/5 ${n.read ? 'border-border-dark opacity-70' : 'border-ukraine-blue/30 shadow-lg shadow-ukraine-blue/5'}`}
              >
                {!n.read && (
                  <div className="absolute top-4 right-4 w-2 h-2 bg-ukraine-blue rounded-full animate-pulse" />
                )}
                
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  n.type === 'money' ? 'bg-ukraine-yellow/10 text-ukraine-yellow' :
                  n.type === 'work' ? 'bg-ukraine-blue/10 text-ukraine-blue' :
                  n.type === 'success' ? 'bg-green-500/10 text-green-400' :
                  n.type === 'error' ? 'bg-red-500/10 text-red-400' :
                  'bg-white/5 text-text-dim'
                }`}>
                  {n.type === 'money' && <Wallet className="w-5 h-5" />}
                  {n.type === 'work' && <TrendingUp className="w-5 h-5" />}
                  {n.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                  {n.type === 'error' && <AlertCircle className="w-5 h-5" />}
                  {n.type === 'social' && <Users className="w-5 h-5" />}
                  {n.type === 'info' && <Info className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-xs md:text-sm font-black uppercase tracking-widest ${n.read ? 'text-text-muted' : 'text-white'}`}>
                      {n.title}
                    </h4>
                    <span className="text-[8px] md:text-[9px] font-bold text-text-muted uppercase">
                      {n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true, locale: uk }) : 'щойно'}
                    </span>
                  </div>
                  <p className={`text-[10px] md:text-xs leading-relaxed ${n.read ? 'text-text-dim' : 'text-text-muted'}`}>
                    {n.message}
                  </p>
                  
                  {n.actionType === 'friend_request' && !n.read && (
                    <div className="mt-4 flex gap-2">
                       <button 
                        onClick={() => respondToFriendRequest(n.actionData?.requestId, n.id, 'accepted')}
                        className="px-4 py-2 bg-ukraine-blue text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors"
                      >
                        Прийняти
                      </button>
                      <button 
                        onClick={() => respondToFriendRequest(n.actionData?.requestId, n.id, 'declined')}
                        className="px-4 py-2 bg-white/5 text-text-dim rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                      >
                        Відхилити
                      </button>
                    </div>
                  )}

                  {n.actionType === 'bank_transfer' && !n.read && (
                    <div className="mt-4 flex gap-2">
                       <button 
                        onClick={() => respondToBankTransfer(n.id, 'accepted')}
                        className="px-4 py-2 bg-ukraine-yellow text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-yellow-500 transition-colors"
                      >
                        Прийняти
                      </button>
                      <button 
                        onClick={() => respondToBankTransfer(n.id, 'declined')}
                        className="px-4 py-2 bg-white/5 text-text-dim rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                      >
                        Скасувати
                      </button>
                    </div>
                  )}

                  {!n.read && !n.actionType && (
                    <button 
                      onClick={() => markAsRead(n.id)}
                      className="mt-3 text-[8px] font-black uppercase tracking-widest text-ukraine-blue hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3 h-3" /> ПОЗНАЧИТИ ЯК ПРОЧИТАНЕ
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>

        {hasMore && (
          <div className="pt-4 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-6 py-3 bg-card-dark hover:bg-white/5 border border-border-dark rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {loadingMore ? (
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : null}
              {loadingMore ? 'ЗАВАНТАЖЕННЯ...' : 'ЗАВАНТАЖИТИ ЩЕ'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
