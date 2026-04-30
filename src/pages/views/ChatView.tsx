import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Users, Shield, MessageCircle, Search, X, Check, CheckCheck, UserPlus, Fingerprint, Award, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services/backendService';

export const ChatView: React.FC = () => {
  const { profile, onlinePlayers } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [privateRecipient, setPrivateRecipient] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onlineCount = onlinePlayers.length;

  useEffect(() => {
    // Initial history
    backend.getChatHistory().then(setMessages);

    // Listen for new messages
    backend.onNewMessage((msg) => {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.find(m => m.id === msg.id)) return prev;
        const updated = [...prev, msg];
        return updated.slice(-200); // Limit locally too
      });
      setTimeout(scrollToBottom, 50);
    });
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const isMuted = profile?.muteUntil ? new Date(profile.muteUntil) > new Date() : false;
  const muteTimeLeft = isMuted ? Math.ceil((new Date(profile.muteUntil).getTime() - new Date().getTime()) / (1000 * 60)) : 0;
  const isFrozen = profile?.isFrozen;
  const shouldBlockChat = isMuted || isFrozen;

  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    if (shouldBlockChat) {
      if (isFrozen) alert("Ваш акаунт заморожено!");
      else alert(`Ваш чат заблоковано ще на ${muteTimeLeft} хв. Причина: ${profile.muteReason || 'Не вказана'}`);
      return;
    }

    const command = newMessage.toLowerCase().trim();
    if (command === 'payday' || command === 'час зарплати') {
        const res = await backend.triggerPayDay(profile.uid);
        if (res.success) {
            setNewMessage('');
            return;
        } else {
            alert(res.message || 'Помилка отримання зарплати');
            setNewMessage('');
            return;
        }
    }

    const messageData: any = {
      senderId: profile.uid,
      senderName: `${profile.firstName} ${profile.lastName}`,
      senderPhoto: profile.passportPhoto || '',
      content: newMessage,
    };

    if (privateRecipient) {
      messageData.recipientId = privateRecipient.uid;
    }

    backend.sendMessage(messageData);
    setNewMessage('');
    
    // Trigger GM AI processing
    import('../../services/gameMasterService').then(({ gmService }) => {
      gmService.processMessage(newMessage, profile);
    });

    setTimeout(scrollToBottom, 50);
  }, [newMessage, profile, privateRecipient]);

  const handleOpenProfile = async (userId: string) => {
    const data = await backend.getProfile(userId);
    if (data) {
        setSelectedUser(data);
        setShowProfileModal(true);
    }
  };

  const filteredMessages = (Array.isArray(messages) ? messages : []).filter(msg => {
    const queryStr = searchQuery.toLowerCase();
    
    // Simple filter for public messages in this basic logic
    // (Actual private filtering should be on server side for security)
    if (msg.recipientId && !privateRecipient) return false;
    if (privateRecipient && (msg.recipientId !== privateRecipient.uid && msg.senderId !== privateRecipient.uid)) return false;

    return (
      msg.content.toLowerCase().includes(queryStr) ||
      msg.senderName.toLowerCase().includes(queryStr)
    );
  });

  return (
    <div className="flex flex-col h-full bg-bg-dark/20 rounded-3xl overflow-hidden relative">
      <header className="mb-4 flex flex-shrink-0 justify-between items-center bg-secondary-dark/50 p-3 md:p-4 rounded-2xl border border-border-dark backdrop-blur-md">
        <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-ukraine-blue/20 rounded-lg md:rounded-xl flex-shrink-0 flex items-center justify-center border border-ukraine-blue/40">
            <MessageCircle className="w-4 h-4 md:w-5 md:h-5 text-ukraine-blue" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[10px] md:text-sm font-black text-white uppercase tracking-widest leading-none truncate">
              {privateRecipient ? `Чат з ${privateRecipient.firstName}` : 'Загальний чат'}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[8px] md:text-[9px] text-text-muted uppercase tracking-tighter truncate font-bold">
                {privateRecipient ? 'Приватний канал' : `На зв'язку • ${onlineCount} ${onlineCount === 1 ? 'гравець' : onlineCount < 5 ? 'гравці' : 'гравців'}`}
              </span>
            </div>
          </div>
        </div>

        {privateRecipient && (
          <button 
            onClick={() => setPrivateRecipient(null)}
            className="p-1.5 md:p-2 bg-white/5 text-text-dim hover:text-white rounded-lg transition-colors border border-white/5 flex items-center gap-1.5 text-[7px] md:text-[9px] font-black uppercase tracking-widest"
          >
            <X className="w-3 h-3" />
            Всі чати
          </button>
        )}

        <div className="flex items-center gap-2">
          {showSearch ? (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              className="relative flex items-center bg-bg-dark/40 rounded-lg border border-border-dark px-2 py-1"
            >
              <Search className="w-3 h-3 text-text-dim mr-1" />
              <input 
                autoFocus
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук..."
                className="bg-transparent border-none outline-none text-[10px] text-white w-24 md:w-40"
              />
              <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
                <X className="w-3 h-3 text-text-dim hover:text-white" />
              </button>
            </motion.div>
          ) : (
            <button 
              onClick={() => setShowSearch(true)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <Search className="w-4 h-4 text-text-dim" />
            </button>
          )}

          <div className="flex -space-x-1.5 md:-space-x-2 flex-shrink-0">
             <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-bg-dark bg-secondary-dark flex items-center justify-center text-[7px] md:text-[10px] font-black uppercase text-text-dim shadow-lg">UA</div>
             <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-bg-dark bg-ukraine-blue flex items-center justify-center text-[7px] md:text-[10px] font-black uppercase text-white shadow-lg">RP</div>
          </div>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto pr-1 md:pr-2 space-y-3 md:space-y-4 custom-scrollbar scroll-smooth"
      >
        {filteredMessages.map((msg, idx) => {
          const isOwn = msg.senderId === profile?.uid;
          const isPrivate = !!msg.recipientId;

          return (
            <motion.div 
              key={msg.id || `msg-${idx}-${msg.timestamp}`}
              layout
              initial={{ opacity: 0, scale: 0.8, x: isOwn ? 20 : -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20
              }}
              className={`flex items-end gap-2 md:gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className="flex-shrink-0 mb-1">
                <button 
                  onClick={() => handleOpenProfile(msg.senderId)}
                  className={`w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden border transition-transform active:scale-90 ${isOwn ? 'border-ukraine-blue' : 'border-border-dark shadow-sm hover:border-ukraine-blue'}`}
                >
                  {msg.senderPhoto ? (
                    <img src={msg.senderPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-secondary-dark flex items-center justify-center text-[6px] md:text-[8px] font-black uppercase">
                      {msg.senderName?.charAt(0) || '?'}
                    </div>
                  )}
                </button>
              </div>

              <div className={`flex flex-col max-w-[85%] md:max-w-[80%] ${isOwn ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-0.5 px-1">
                  <button 
                    onClick={() => !isOwn && handleOpenProfile(msg.senderId)}
                    className="text-[8px] md:text-[9px] font-black text-text-muted uppercase tracking-tighter hover:text-ukraine-blue transition-colors"
                  >
                    {msg.senderName}
                  </button>
                  {isPrivate && <span className="text-[7px] bg-red-500/20 text-red-400 px-1 rounded border border-red-500/20">PRIVATE</span>}
                  {msg.isBot && <span className="text-[7px] bg-ukraine-blue/20 text-ukraine-blue px-1 rounded border border-ukraine-blue/20 font-black">AI GM</span>}
                </div>
                <div 
                  className={`px-3 md:px-4 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[10px] md:text-xs leading-relaxed shadow-md relative group/msg ${
                    isOwn 
                      ? 'bg-ukraine-blue text-white rounded-br-none' 
                      : 'bg-card-dark border border-border-dark text-text-light rounded-bl-none'
                  }`}
                  onClick={() => !isOwn && setNewMessage(`@${msg.senderName} `)}
                >
                  {msg.content}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 px-1 font-bold">
                  <span className="text-[7px] md:text-[8px] text-text-dim uppercase tracking-tighter">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                  </span>
                  {isOwn && (
                    <span className="text-white/30">
                      {msg.isRead ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Check className="w-3 h-3" />}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Typing indicator placeholder */}
      </div>

      <form 
        onSubmit={sendMessage} 
        className={`mt-3 md:mt-4 p-1.5 bg-secondary-dark rounded-xl md:rounded-2xl border border-border-dark flex items-center gap-2 shadow-xl flex-shrink-0 ${shouldBlockChat ? 'opacity-60 grayscale cursor-not-allowed' : ''}`}
      >
        {isFrozen && <Lock className="w-4 h-4 text-blue-500 ml-2" />}
        <input
          disabled={shouldBlockChat}
          type="text"
          value={isFrozen ? 'АКАУНТ ЗАМОРОЖЕНО ✨' : isMuted ? `ЧАТ ЗАБЛОКОВАНО (${muteTimeLeft} ХВ)` : newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={shouldBlockChat ? "" : "Твоє повідомлення..."}
          className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-[11px] md:text-sm text-white placeholder:text-text-dim"
        />
        <button 
          type="submit" 
          disabled={!newMessage.trim() || shouldBlockChat}
          className="bg-ukraine-blue text-white p-2 md:p-3 rounded-lg md:rounded-xl hover:bg-opacity-80 transition-all active:scale-90 disabled:grayscale disabled:opacity-30 flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </button>
      </form>

      {/* User Profile Modal */}
      <AnimatePresence>
        {showProfileModal && selectedUser && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-card-dark border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Profile Header */}
              <div className="relative h-24 bg-gradient-to-r from-ukraine-blue to-ukraine-yellow/50">
                <button 
                  onClick={() => setShowProfileModal(false)}
                  className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 pb-6 relative">
                <div className="absolute -top-12 left-6">
                  <div className="w-24 h-24 rounded-2xl border-4 border-card-dark bg-secondary-dark overflow-hidden shadow-xl">
                    {selectedUser.passportPhoto ? (
                      <img src={selectedUser.passportPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl font-black text-text-dim">
                        {selectedUser.firstName[0]}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-14">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white uppercase tracking-wider">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </h3>
                    <Shield className="w-4 h-4 text-ukraine-blue" />
                  </div>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">ID: {selectedUser.uid.slice(0, 8)}</p>

                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[8px] font-bold text-text-dim uppercase tracking-widest mb-1">Соціальний рейтинг</p>
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-ukraine-yellow" />
                        <span className="text-sm font-black text-white">{selectedUser.socialRating}</span>
                      </div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[8px] font-bold text-text-dim uppercase tracking-widest mb-1">Статус</p>
                      <div className="flex items-center gap-2">
                        <Fingerprint className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-black text-white">Громадянин</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {profile?.uid !== selectedUser.uid && (
                      <button 
                        disabled={isFrozen}
                        onClick={() => {
                          if (isFrozen) return;
                          // TODO: Migrate friend requests to backend
                          alert("Запити у друзі тимчасово недоступні (триває міграція)");
                        }}
                        className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${isFrozen ? 'bg-white/5 text-text-dim cursor-not-allowed' : 'bg-ukraine-blue text-white hover:bg-blue-600'}`}
                      >
                         {isFrozen ? <Lock className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />} 
                         {isFrozen ? 'ДОСТУП ОБМЕЖЕНО' : 'ДОДАТИ В ДРУЗІ'}
                      </button>
                    )}
                    
                    <button 
                      disabled={isFrozen}
                      onClick={() => {
                        if (isFrozen) return;
                        setShowProfileModal(false);
                        setNewMessage(`@${selectedUser.firstName}_${selectedUser.lastName} `);
                      }}
                      className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isFrozen ? 'bg-white/5 text-text-dim cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                      {isFrozen && <Lock className="w-4 h-4" />}
                      {isFrozen ? 'ЗАБЛОКОВАНО' : 'НАПИСАТИ ПОВІДОМЛЕННЯ'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
);

