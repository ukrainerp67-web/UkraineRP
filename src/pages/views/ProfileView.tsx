import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { Passport } from '../../components/Passport';
import { Shield, TrendingUp, Wallet, Star, UserCheck, MapPin, Users, Search, UserPlus, Check, X, UserMinus, MessageSquare, Clock, ShoppingBag, Fingerprint, Lock } from 'lucide-react';
import { backend } from '../../services/backendService';
import { useNotifications } from '../../context/NotificationContext';
import { ChatView } from './ChatView';
import { ShopView } from './ShopView';

import { compressImage } from '../../lib/imageUtils';

export const ProfileView: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { sendNotification } = useNotifications();
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'friends' | 'chat'>('info');
  const [showWelcome, setShowWelcome] = useState(false);
  const [offlineEarnings, setOfflineEarnings] = useState(0);

  useEffect(() => {
    // Welcome back logic
    if (profile && profile.businesses?.length && !showWelcome) {
      const totalEarned = profile.businesses.reduce((acc, b) => {
        if (!b.isStocked || !b.stockPurchasedAt) return acc;
        const elapsedMs = Date.now() - new Date(b.stockPurchasedAt).getTime();
        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        const hourlyProfit = (b.meta?.gross || 0) / 24;
        const earned = Math.min(b.meta?.gross || 0, Math.floor(elapsedHours * hourlyProfit));
        return acc + earned;
      }, 0);
      
      if (totalEarned > 100) {
        setOfflineEarnings(totalEarned);
        setShowWelcome(true);
      }
    }
  }, [profile?.uid]);
  const [loading, setLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<any>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [friendProfiles, setFriendProfiles] = useState<Record<string, any>>({});
  const friendsList: any[] = Object.values(friendProfiles);

  useEffect(() => {
    if (!profile) return;
    // Listening logic removed as it was Firebase-dependent
  }, [profile?.uid]);

  const isFrozen = profile?.isFrozen;

  const handleSearch = async () => {
    if (isFrozen) return;
    if (searchQuery.length < 3) return;
    setLoading(true);
    try {
      const results = await backend.searchUsers(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (requestId: string, status: 'accepted' | 'declined') => {
    alert("Керування друзями тимчасово недоступне");
  };

  const removeFriend = async () => {
    alert("Видалення друзів тимчасово недоступне");
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFrozen) return;
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setPhotoLoading(true);
    try {
      const compressed = await compressImage(file, 400, 500, 0.8);
      const updatedProfile = { 
        ...profile, 
        passportPhoto: compressed,
        updatedAt: new Date().toISOString()
      };
      await backend.saveProfile(updatedProfile);
      await refreshProfile();
      setShowPhotoModal(false);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Помилка завантаження фото');
    } finally {
      setPhotoLoading(false);
    }
  };

  const deletePhoto = async () => {
    if (!profile) return;
    setPhotoLoading(true);
    try {
      const updatedProfile = { 
        ...profile, 
        passportPhoto: '',
        updatedAt: new Date().toISOString()
      };
      await backend.saveProfile(updatedProfile);
      await refreshProfile();
      setShowPhotoModal(false);
    } catch (error) {
      console.error('Error deleting photo:', error);
    } finally {
      setPhotoLoading(false);
    }
  };

  const sendFriendRequest = async (targetUser: any) => {
    if (!profile) return;
    alert('Запити у друзі тимчасово недоступні (триває міграція)');
  };

  const handleTrade = async () => {
    if (!profile || !selectedFriend || !tradeAmount) return;
    const amount = parseInt(tradeAmount);
    if (isNaN(amount) || amount <= 0) return alert('Введіть коректну суму');
    if (amount > profile.balance) return alert('Недостатньо коштів');

    if (!showConfirmStep) {
      setShowConfirmStep(true);
      return;
    }

    setTradeLoading(true);
    try {
      const result = await backend.transferMoney(profile.uid, selectedFriend.uid, amount);
      
      if (result.success) {
        await refreshProfile();

        await sendNotification(
          selectedFriend.uid,
          'Отримано переказ',
          `Гравець ${profile.firstName} переказав вам ₴${amount.toLocaleString()} через Трейд`,
          'money'
        );

        alert(`Ви успішно передали ₴${amount.toLocaleString()}!`);
        setShowTradeModal(false);
        setShowConfirmStep(false);
        setTradeAmount('');
      } else {
        alert(result.error || 'Помилка при переказі');
      }
    } catch (error) {
      console.error('Trade error:', error);
      alert('Помилка при переказі');
    } finally {
      setTradeLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-6 md:space-y-8 pb-24 md:pb-8">
      {/* Navigation Tabs */}
      <div className="flex gap-4 p-1 bg-card-dark/50 border border-border-dark rounded-2xl w-fit backdrop-blur-md">
        {[
          { id: 'info', label: 'Профіль', icon: UserCheck },
          { id: 'friends', label: 'Друзі', icon: Users, count: pendingRequests.length },
          { id: 'chat', label: 'Чат', icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-ukraine-blue text-white shadow-lg shadow-ukraine-blue/20' 
                : 'text-text-dim hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count ? (
              <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full pulse-red">
                {tab.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'info' && (
          <motion.div 
            key="info"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 md:space-y-8"
          >
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
              {[
                { label: 'Баланс', value: `₴${profile.balance.toLocaleString()}`, icon: Wallet, color: 'text-ukraine-yellow' },
                { label: 'Рейтинг', value: profile.socialRating, icon: Star, color: 'text-blue-400' },
                { label: 'Статус', value: 'Громадянин', icon: UserCheck, color: 'text-green-400' },
                { label: 'Регіон', value: 'Україна', icon: MapPin, color: 'text-ukraine-blue' },
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-card-dark border border-border-dark p-2.5 md:p-5 rounded-xl md:rounded-2xl flex flex-col gap-1 md:gap-2 shadow-xl overflow-hidden min-w-0"
                >
                  <div className="flex justify-between items-start">
                    <stat.icon className={`w-3 md:w-5 h-3 md:h-5 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[7px] md:text-[10px] text-text-muted font-black uppercase tracking-widest truncate">{stat.label}</p>
                    <h4 className="text-[10px] md:text-lg font-black text-white truncate">{stat.value}</h4>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              {/* Passport Section */}
              <div className="lg:col-span-2 space-y-4 md:space-y-6">
                 <header className="flex items-center justify-between px-2">
                    <h2 className="text-lg md:text-xl font-black uppercase tracking-[0.2em] text-white">ID-КАРТА</h2>
                    <span className="text-[10px] md:text-[10px] text-text-muted font-bold uppercase tracking-widest truncate">Документ #UA-{profile.uid.slice(0, 8).toUpperCase()}</span>
                 </header>
                 
                 <div className="w-full">
                    <Passport 
                      uid={profile.uid}
                      firstName={profile.firstName}
                      lastName={profile.lastName}
                      sex={profile.sex}
                      birthDate={
                        profile.createdAt?.toDate 
                          ? profile.createdAt.toDate().toLocaleDateString('uk-UA') 
                          : profile.createdAt?.seconds 
                            ? new Date(profile.createdAt.seconds * 1000).toLocaleDateString('uk-UA')
                            : profile.birthDate || new Date().toLocaleDateString('uk-UA')
                      }
                      balance={profile.balance}
                      signature={profile.signature}
                      passportPhoto={profile.passportPhoto}
                      onPhotoClick={() => !isFrozen && setShowPhotoModal(true)}
                    />
                    {isFrozen && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-blue-500 font-black uppercase text-[10px] tracking-widest bg-blue-500/10 py-3 rounded-xl border border-blue-500/20">
                            <Lock className="w-4 h-4" /> Доступ обмежено
                        </div>
                    )}
                 </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-4 md:space-y-6">
                <header className="flex items-center px-2">
                  <h2 className="text-lg md:text-xl font-black uppercase tracking-[0.2em] text-white">ДОСЯГНЕННЯ</h2>
                </header>

                <div className="bg-card-dark border border-border-dark rounded-xl md:rounded-2xl p-4 md:p-6 space-y-5 md:space-y-6 shadow-xl">
                  <div className="flex items-center gap-3 md:gap-4 font-black">
                     <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-ukraine-blue/10 flex items-center justify-center border border-ukraine-blue/20">
                        <Shield className="w-5 h-5 md:w-6 md:h-6 text-ukraine-blue" />
                     </div>
                     <div>
                        <h3 className="font-black text-[12px] md:text-sm uppercase tracking-widest text-[#E0E0E0]">Патріот</h3>
                        <p className="text-[10px] text-text-muted leading-tight">Ваш внесок у розвиток держави є неоціненним.</p>
                     </div>
                  </div>

                  <div className="space-y-2 md:space-y-3">
                     <div className="flex justify-between items-end">
                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-text-muted">Прогрес до рівня 2</span>
                        <span className="text-[10px] md:text-xs font-black text-ukraine-blue">65%</span>
                     </div>
                     <div className="w-full bg-secondary-dark h-1.5 md:h-2 rounded-full overflow-hidden border border-border-dark">
                        <div className="h-full bg-ukraine-blue w-[65%] shadow-[0_0_10px_rgba(0,102,255,0.3)]" />
                     </div>
                  </div>

                  <div className="pt-3 md:pt-4 border-t border-white/5 space-y-3 md:space-y-4">
                     <div className="flex items-center gap-3">
                        <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-400" />
                        <span className="text-[9px] md:text-[10px] font-bold text-text-dim uppercase tracking-widest">Продуктивність праці: +12%</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <Star className="w-3.5 h-3.5 md:w-4 md:h-4 text-ukraine-yellow" />
                        <span className="text-[9px] md:text-[10px] font-bold text-text-dim uppercase tracking-widest">Авторитет у чаті: Високий</span>
                     </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-ukraine-blue/20 to-transparent border border-ukraine-blue/20 rounded-xl md:rounded-2xl p-5 md:p-6 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-3 md:p-4 opacity-10 transition-opacity group-hover:opacity-20">
                      <Shield className="w-16 h-16 md:w-20 md:h-20" />
                   </div>
                   <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-white relative z-10 mb-2">ПРЕМІУМ-СТАТУС</h3>
                   <p className="text-[9px] md:text-[10px] text-text-muted uppercase tracking-widest relative z-10 leading-relaxed">Відкриває доступ до ексклюзивних робіт та автопарку преміум-класу.</p>
                   <button 
                     disabled={isFrozen}
                     className={`mt-4 md:mt-6 w-full py-3 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-colors relative z-10 active:scale-95 flex items-center justify-center gap-2 ${isFrozen ? 'bg-white/5 text-text-dim cursor-not-allowed' : 'bg-ukraine-blue text-white hover:bg-blue-600'}`}
                   >
                      {isFrozen && <Lock className="w-3.5 h-3.5" />}
                      {isFrozen ? 'РОЗБЛОКУВАТИ' : 'ДІЗНАТИСЬ БІЛЬШЕ'}
                   </button>
                </div>

                <div className="bg-card-dark border border-border-dark rounded-xl md:rounded-2xl p-4 md:p-6 space-y-3 shadow-xl">
                  <div className="flex items-center gap-3 md:gap-4 font-black">
                     <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-ukraine-yellow/10 flex items-center justify-center border border-ukraine-yellow/20">
                        <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-ukraine-yellow" />
                     </div>
                     <div>
                        <h3 className="font-black text-[12px] md:text-sm uppercase tracking-widest text-[#E0E0E0]">Магазин</h3>
                        <p className="text-[10px] text-text-muted leading-tight">Купуйте унікальні товари та покращення.</p>
                     </div>
                  </div>
                  
                  <button 
                    disabled={isFrozen}
                    onClick={() => {
                      if (isFrozen) return;
                      const event = new CustomEvent('changeView', { detail: 'shop' });
                      window.dispatchEvent(event);
                    }}
                    className={`w-full py-3 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isFrozen ? 'bg-white/5 text-text-dim cursor-not-allowed border border-white/5' : 'bg-ukraine-yellow/10 border border-ukraine-yellow/20 text-ukraine-yellow hover:bg-ukraine-yellow hover:text-black'}`}
                  >
                     {isFrozen && <Lock className="w-3.5 h-3.5" />}
                     ВІДКРИТИ МАГАЗИН
                  </button>
                </div>
              </div>
            </div>

            {/* Welcome Back Modal Integration */}
            <AnimatePresence>
              {showWelcome && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/90 backdrop-blur-md"
                    onClick={() => setShowWelcome(false)}
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-sm bg-card-dark border border-blue-500/30 rounded-[2.5rem] p-8 shadow-2xl shadow-blue-500/20 text-center overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ukraine-blue via-ukraine-yellow to-ukraine-blue" />
                    
                    <div className="w-20 h-20 bg-ukraine-blue/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-ukraine-blue/20">
                      <TrendingUp className="w-10 h-10 text-ukraine-blue animate-bounce" />
                    </div>

                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">З поверненням!</h2>
                    <p className="text-text-muted text-xs font-bold uppercase tracking-widest mb-6">Гра продовжувалась, поки вас не було</p>

                    <div className="bg-white/5 rounded-3xl p-6 border border-white/5 mb-8">
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Нараховано прибутку</p>
                      <h4 className="text-3xl font-black text-green-400">₴{offlineEarnings.toLocaleString()}</h4>
                      <div className="flex items-center justify-center gap-2 mt-3">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black text-green-500/80 uppercase tracking-widest">Пасивний дохід активовано</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowWelcome(false)}
                      className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
                    >
                      ПРОДОВЖИТИ ГРУ
                    </button>
                    
                    <p className="text-[8px] text-text-dim font-bold uppercase mt-6 tracking-widest">Система розрахувала прибуток на основі часу вашої відсутності</p>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === 'friends' && (
          <motion.div 
            key="friends"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Friends List & Requests */}
            <div className="lg:col-span-2 space-y-6">
              {pendingRequests.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-ukraine-yellow uppercase tracking-[0.2em] flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Запити у друзі ({pendingRequests.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pendingRequests.map((req) => (
                      <div key={req.id} className="bg-ukraine-blue/10 border border-ukraine-blue/20 p-4 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-ukraine-blue/20 flex items-center justify-center border border-ukraine-blue/30 text-xs font-black">
                            {req.fromName?.[0] || '?'}
                          </div>
                          <div>
                            <p className="text-xs font-black text-white">{req.fromName}</p>
                            <p className="text-[8px] text-text-dim uppercase font-bold">Бажає додати вас</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleRespond(req.id, 'accepted')}
                            className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleRespond(req.id, 'declined')}
                            className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Users className="w-4 h-4" /> Мої друзі ({friendsList.length})
                </h3>
                {friendsList.length === 0 ? (
                  <div className="bg-card-dark border border-border-dark border-dashed p-12 rounded-3xl flex flex-col items-center justify-center text-center">
                    <Users className="w-12 h-12 text-white/5 mb-4" />
                    <p className="text-[11px] font-black text-text-dim uppercase tracking-widest">У вас ще немає друзів</p>
                    <p className="text-[9px] text-text-muted mt-2 uppercase font-bold">Знайдіть гравців за допомогою пошуку</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {friendsList.map((friend) => (
                      <motion.div 
                        layout
                        key={friend.uid} 
                        className="bg-card-dark border border-border-dark p-4 rounded-3xl flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-border-dark shadow-xl bg-secondary-dark">
                              {friend.passportPhoto ? (
                                <img src={friend.passportPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl font-black text-text-dim">
                                  {friend.firstName?.[0]}
                                </div>
                              )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-card-dark rounded-full" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-black text-white leading-none">{friend.firstName} {friend.lastName}</p>
                              <Shield className="w-3 h-3 text-ukraine-blue" />
                            </div>
                            <p className="text-[8px] text-text-muted font-black uppercase tracking-widest mt-1">ID: {friend.uid.slice(0, 8)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setSelectedFriend(friend)}
                            className="p-2 bg-white/5 text-text-dim rounded-xl hover:bg-white/10 transition-all"
                            title="Профіль"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              // Use an event or similar to switch tab, but for now just window location or similar pattern
                              // Actually the Layout handles tabs. We can use a simple trick.
                              const event = new CustomEvent('switchToChat', { detail: { openPrivate: friend } });
                              window.dispatchEvent(event);
                            }}
                            className="p-2 bg-white/5 text-text-dim rounded-xl hover:bg-ukraine-blue hover:text-white transition-all transform hover:scale-110"
                            title="Повідомлення"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedFriend(friend);
                              setShowTradeModal(true);
                            }}
                            className="p-2 bg-white/5 text-ukraine-yellow/50 rounded-xl hover:bg-ukraine-yellow hover:text-black transition-all"
                            title="Трейд"
                          >
                            <Wallet className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setFriendToRemove(friend);
                              setShowRemoveModal(true);
                            }}
                            className="p-2 bg-white/5 text-text-dim rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                            title="Видалити"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* User Search & Discovery */}
            <div className="space-y-6">
              <div className="bg-card-dark border border-border-dark p-6 rounded-3xl shadow-xl space-y-4">
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                  <Search className="w-4 h-4" /> Пошук гравців
                </h3>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                    <input 
                      type="text" 
                      placeholder="Ім'я або ID..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full bg-secondary-dark border border-border-dark rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white focus:outline-none focus:border-ukraine-blue transition-colors"
                    />
                  </div>
                  <button 
                    onClick={handleSearch}
                    disabled={loading}
                    className="p-3 bg-ukraine-blue text-white rounded-xl hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? (
                       <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : <Search className="w-5 h-5" />}
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  {searchResults.map((user) => (
                    <div key={user.uid} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                      <div 
                        className="flex items-center gap-3 cursor-pointer group/item"
                        onClick={() => setSelectedFriend(user)}
                      >
                        <div className="w-8 h-8 rounded-lg bg-secondary-dark border border-border-dark overflow-hidden group-hover/item:border-ukraine-blue transition-colors">
                          {user.passportPhoto && <img src={user.passportPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-white group-hover/item:text-ukraine-blue transition-colors">{user.firstName} {user.lastName}</p>
                          <p className="text-[7px] text-text-muted font-bold">ID: {user.uid.slice(0, 8)}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => sendFriendRequest(user)}
                        className="p-2 bg-ukraine-blue/20 text-ukraine-blue rounded-lg hover:bg-ukraine-blue hover:text-white transition-all transform active:scale-90"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {searchQuery.length > 0 && searchResults.length === 0 && !loading && (
                    <p className="text-[9px] text-center text-text-dim uppercase font-bold py-4">Нікого не знайдено</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'chat' && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-[calc(100vh-20rem)] min-h-[500px] bg-card-dark/40 border border-border-dark rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl"
          >
            <ChatView />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friend Profile Modal */}
      <AnimatePresence>
        {selectedFriend && !showTradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFriend(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-card-dark border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="relative h-24 bg-gradient-to-r from-ukraine-blue to-ukraine-yellow/50">
                <button 
                  onClick={() => setSelectedFriend(null)}
                  className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 pb-6 relative">
                {(() => {
                  const friendData = friendProfiles[selectedFriend.uid] || selectedFriend;
                  return (
                    <>
                      <div className="absolute -top-12 left-6">
                        <div className="w-24 h-24 rounded-2xl border-4 border-card-dark bg-secondary-dark overflow-hidden shadow-xl">
                          {friendData.passportPhoto ? (
                            <img src={friendData.passportPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl font-black text-text-dim">
                              {friendData.firstName?.[0]}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-14">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black text-white uppercase tracking-wider">
                            {friendData.firstName} {friendData.lastName}
                          </h3>
                          <Shield className="w-4 h-4 text-ukraine-blue" />
                        </div>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">Громадянин | ID: {friendData.uid.slice(0, 8)}</p>

                        <div className="grid grid-cols-2 gap-3 mt-6">
                          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <p className="text-[8px] font-bold text-text-dim uppercase tracking-widest mb-1">Баланс</p>
                            <span className="text-sm font-black text-ukraine-yellow">₴{friendData.balance?.toLocaleString()}</span>
                          </div>
                          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <p className="text-[8px] font-bold text-text-dim uppercase tracking-widest mb-1">Рейтинг</p>
                            <span className="text-sm font-black text-blue-400">{friendData.socialRating}</span>
                          </div>
                        </div>

                        <div className="mt-6 space-y-4">
                          <div className="w-full h-full flex items-center justify-center">
                            <Passport 
                              uid={friendData.uid}
                              firstName={friendData.firstName}
                              lastName={friendData.lastName}
                              sex={friendData.sex}
                              birthDate={
                                friendData.createdAt?.toDate 
                                  ? friendData.createdAt.toDate().toLocaleDateString('uk-UA') 
                                  : friendData.createdAt?.seconds 
                                    ? new Date(friendData.createdAt.seconds * 1000).toLocaleDateString('uk-UA')
                                    : friendData.birthDate || new Date().toLocaleDateString('uk-UA')
                              }
                              balance={friendData.balance}
                              signature={friendData.signature}
                              passportPhoto={friendData.passportPhoto}
                            />
                          </div>
                          
                          <button 
                            onClick={() => {
                              const event = new CustomEvent('switchToChat', { detail: { openPrivate: friendData } });
                              window.dispatchEvent(event);
                              setSelectedFriend(null);
                            }}
                            className="w-full py-4 bg-ukraine-blue text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-blue-600"
                          >
                            НАПИСАТИ ПОВІДОМЛЕННЯ
                          </button>
                          <button 
                            onClick={() => {
                              setShowTradeModal(true);
                            }}
                            className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                          >
                            ВІДКРИТИ ТРЕЙД
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Remove Friend Modal */}
      <AnimatePresence>
        {showRemoveModal && friendToRemove && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowRemoveModal(false);
                setFriendToRemove(null);
              }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-card-dark border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-widest">Видалення</h3>
                  <p className="text-[9px] text-text-dim uppercase font-bold tracking-widest">Дія незворотна</p>
                </div>
                <button 
                  onClick={() => {
                    setShowRemoveModal(false);
                    setFriendToRemove(null);
                  }}
                  className="p-2 hover:bg-white/5 rounded-full text-text-dim transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-white/5 mx-auto overflow-hidden border border-white/10">
                  {friendToRemove.passportPhoto && <img src={friendToRemove.passportPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                </div>
                <p className="text-sm font-bold text-white uppercase tracking-wide">
                  Ви впевнені, що хочете видалити гравця <span className="text-ukraine-blue">{friendToRemove.firstName} {friendToRemove.lastName}</span> зі списку друзів?
                </p>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => {
                    setShowRemoveModal(false);
                    setFriendToRemove(null);
                  }}
                  className="flex-1 py-4 bg-white/5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-white/10"
                >
                  СКАСУВАТИ
                </button>
                <button 
                  onClick={removeFriend}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-red-600 active:scale-95"
                >
                  ПІДТВЕРДИТИ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trade Modal */}
      <AnimatePresence>
        {showTradeModal && selectedFriend && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowTradeModal(false);
                setShowConfirmStep(false);
              }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-card-dark border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-widest">
                    {showConfirmStep ? 'Підтвердження' : 'Трейд'}
                  </h3>
                  <p className="text-[9px] text-text-dim uppercase font-bold tracking-widest">
                    {showConfirmStep ? 'Перевірте дані перед відправкою' : 'Переказ коштів другу'}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowTradeModal(false);
                    setShowConfirmStep(false);
                  }}
                  className="p-2 hover:bg-white/5 rounded-full text-text-dim transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 mb-6">
                <div className="w-12 h-12 rounded-xl bg-secondary-dark overflow-hidden">
                  {selectedFriend.passportPhoto && <img src={selectedFriend.passportPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                </div>
                <div>
                  <p className="text-xs font-black text-white">{selectedFriend.firstName} {selectedFriend.lastName}</p>
                  <p className="text-[8px] text-text-muted font-bold uppercase">Отримувач</p>
                </div>
              </div>

              <div className="space-y-4">
                {showConfirmStep ? (
                  <div className="space-y-4">
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-5 rounded-2xl space-y-4">
                      <div className="text-center pb-2 border-b border-white/5">
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">Запит на переказ</p>
                        <h4 className="text-2xl font-black text-ukraine-yellow">₴{parseInt(tradeAmount).toLocaleString()}</h4>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">Отримувач</span>
                          <span className="text-[10px] font-black text-white uppercase truncate ml-4">{selectedFriend.firstName} {selectedFriend.lastName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">Комісія</span>
                          <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">₴0 (0%)</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <p className="text-[8px] text-center text-text-dim font-bold uppercase leading-relaxed px-2">
                          Ви впевнені, що хочете переказати кошти гравцю <span className="text-white">{selectedFriend.firstName}</span>? Цю операцію неможливо буде скасувати після підтвердження.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] font-black text-text-dim uppercase tracking-widest mb-1.5 block">Сума переказу</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(e.target.value)}
                        placeholder="Вкажіть суму..."
                        className="w-full bg-secondary-dark border border-border-dark rounded-xl py-4 px-4 text-sm font-black text-ukraine-yellow focus:outline-none focus:border-ukraine-yellow transition-colors"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ukraine-yellow font-black">₴</span>
                    </div>
                    <p className="text-[8px] text-text-muted mt-2 uppercase font-bold">Доступно: ₴{profile.balance.toLocaleString()}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  {showConfirmStep && (
                    <button 
                      onClick={() => setShowConfirmStep(false)}
                      className="flex-1 py-4 bg-white/5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-white/10"
                    >
                      СКАСУВАТИ
                    </button>
                  )}
                  <button 
                    onClick={handleTrade}
                    disabled={tradeLoading || !tradeAmount}
                    className={`flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${
                      showConfirmStep ? 'bg-ukraine-blue text-white hover:bg-blue-600' : 'bg-ukraine-yellow text-black hover:bg-yellow-500'
                    }`}
                  >
                    {tradeLoading ? 'ОБРОБКА...' : showConfirmStep ? 'ПІДТВЕРДИТИ' : 'ДАЛІ'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Photo Management Modal */}
      <AnimatePresence>
        {showPhotoModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !photoLoading && setShowPhotoModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-card-dark border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-widest">Керування фото</h3>
                  <p className="text-[9px] text-text-dim uppercase font-bold tracking-widest">Оновлення фото профілю</p>
                </div>
                <button 
                  onClick={() => !photoLoading && setShowPhotoModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-text-dim transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handlePhotoUpload} 
                  accept="image/*" 
                  className="hidden" 
                />

                <div className="w-32 h-40 bg-secondary-dark rounded-2xl mx-auto overflow-hidden border border-white/10 relative group">
                  {profile.passportPhoto ? (
                    <img src={profile.passportPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Fingerprint className="w-12 h-12 text-white/5" />
                    </div>
                  )}
                  {photoLoading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-ukraine-blue border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 pt-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoLoading}
                    className="w-full py-4 bg-ukraine-blue text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    {profile.passportPhoto ? 'ЗМІНИТИ ФОТО' : 'ДОДАТИ ФОТО'}
                  </button>
                  
                  {profile.passportPhoto && (
                    <button 
                      onClick={deletePhoto}
                      disabled={photoLoading}
                      className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-red-500 hover:text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <UserMinus className="w-4 h-4" />
                      ВИДАЛИТИ ФОТО
                    </button>
                  )}

                  <button 
                    onClick={() => setShowPhotoModal(false)}
                    disabled={photoLoading}
                    className="w-full py-4 bg-white/5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-white/10 disabled:opacity-50"
                  >
                    СКАСУВАТИ
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
