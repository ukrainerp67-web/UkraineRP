import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, ReceiptText, Briefcase, TrendingUp, Package, Wallet, Landmark, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services/backendService';
import { useNotifications } from '../../context/NotificationContext';
import { BUSINESS_TYPES } from '../../constants';

export const BusinessView: React.FC = () => {
  const { profile, updateBusinessState, collectProfits, endDay, taxRate } = useAuth();
  const { sendNotification } = useNotifications();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [budget, setBudget] = useState<number>(0);
  const [showEndDayConfirm, setShowEndDayConfirm] = useState(false);
  const [collectingBusiness, setCollectingBusiness] = useState<any | null>(null);

  useEffect(() => {
    const fetchBudget = async () => {
      const b = await backend.getBudget();
      setBudget(b || 0);
    };
    fetchBudget();
    const interval = setInterval(fetchBudget, 10000);
    return () => clearInterval(interval);
  }, []);

  const ownedBusinesses = profile?.businesses?.map(b => {
    const meta = BUSINESS_TYPES.find(m => m.id === b.businessId);
    return { ...b, meta };
  }).filter(b => b.meta) || [];

  const totalOpex = ownedBusinesses.reduce((acc, b) => acc + (b.meta?.opex || 0), 0);
  
  const handleStock = async (businessId: string, cost: number) => {
    if (!profile || profile.balance < cost) {
      alert("Недостатньо коштів для закупівлі!");
      return;
    }

    setLoadingAction(`stock-${businessId}`);
    try {
      const newBusinesses = profile.businesses?.map(b => 
        b.businessId === businessId ? { 
          ...b, 
          isStocked: true, 
          stockReady: true, 
          lastActionAt: new Date().toISOString() 
        } : b
      );

      const updatedProfile = { 
        ...profile, 
        balance: profile.balance - cost, 
        businesses: newBusinesses,
        updatedAt: new Date().toISOString() 
      };

      await backend.saveProfile(updatedProfile);
      sendNotification(profile.uid, 'Бізнес запущено', 'Процес виробництва/торгівлі розпочато', 'success');
    } catch (error) {
      console.error('Stock error:', error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCollect = async (businessId: string, gross: number, evade: boolean = false) => {
    setLoadingAction(`collect-${businessId}`);
    try {
      const result = await collectProfits(businessId, gross, evade);
      if (result) {
        if (result.evade) {
          sendNotification(
            profile?.uid || '', 
            'Податки не сплачено', 
            `Ви отримали повний прибуток ₴${result.netProfit.toLocaleString()}, але втратили Соціальний Рейтинг.`, 
            'warning'
          );
        } else {
          sendNotification(
            profile?.uid || '', 
            'Прибуток зібрано', 
            `Чистий прибуток: ₴${result.netProfit.toLocaleString()}. Податок (ПДФО): ₴${result.taxAmount.toLocaleString()} відправлено в бюджет.`, 
            'money'
          );
          setBudget(prev => prev + (result.taxAmount || 0));
        }
        setCollectingBusiness(null);
      }
    } catch (error) {
      console.error('Collect error:', error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEndDay = async () => {
    if (!profile) return;
    if (profile.balance < totalOpex) {
      alert("Недостатньо коштів на балансі для оплати утримання (OPEX)!");
      return;
    }

    setLoadingAction('endDay');
    try {
      const paid = await endDay();
      setShowEndDayConfirm(false);
      sendNotification(profile.uid, 'День завершено', `Списано ₴${paid.toLocaleString()} на утримання бізнесів (OPEX).`, 'info');
    } catch (error) {
      console.error('End day error:', error);
    } finally {
      setLoadingAction(null);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-6 md:space-y-8 pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-white">Імперія Бізнесу</h2>
          <p className="text-[10px] md:text-sm font-bold text-text-muted uppercase tracking-[0.2em]">Управління активами, закупівлями та прибутком</p>
        </header>

        {ownedBusinesses.length > 0 && (
          <button 
            onClick={() => setShowEndDayConfirm(true)}
            className="group relative flex items-center gap-3 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/10 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <Clock className="w-5 h-5 text-ukraine-yellow" />
            <div className="text-left">
              <p className="text-[8px] font-black text-text-dim uppercase tracking-widest">Завершити день</p>
              <p className="text-xs font-black text-white">Сплатити OPEX: ₴{totalOpex.toLocaleString()}</p>
            </div>
          </button>
        )}
      </div>

      {ownedBusinesses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {ownedBusinesses.map((b, idx) => (
            <motion.div
              key={b.businessId + idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-card-dark border border-border-dark rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl relative group"
            >
              <div className="h-48 md:h-56 relative overflow-hidden">
                <img src={b.meta?.image} alt={b.meta?.name} className="w-full h-full object-cover grayscale-[40%] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-card-dark via-card-dark/20 to-transparent" />
                <div className="absolute top-6 left-6 flex gap-2">
                  <span className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-white/10">
                    {b.meta?.category === 'retail' ? '🛒 Ритейл' : b.meta?.category === 'gas' ? '⛽ АЗС' : b.meta?.category === 'auto' ? '🚗 Авто' : b.meta?.category === 'football' ? '⚽ Спорт' : '✈️ Логістика'}
                  </span>
                  {b.isStocked && (
                    <span className="px-3 py-1.5 bg-green-500/80 backdrop-blur-md rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-green-400/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" /> В ПРОЦЕСІ
                    </span>
                  )}
                </div>
                <div className="absolute bottom-6 left-6 right-6">
                  <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight leading-none mb-1">{b.meta?.name}</h3>
                  <p className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em]">Мережевий Актив</p>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-text-muted uppercase mb-1">Прибуток</p>
                    <p className="text-sm md:text-base font-black text-green-400">₴{b.meta?.gross.toLocaleString()}</p>
                    <p className="text-[7px] font-bold text-text-dim/60 uppercase">₴{Math.floor(b.meta?.gross / 24).toLocaleString()} / год</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-text-muted uppercase mb-1">Утримання</p>
                    <p className="text-sm md:text-base font-black text-red-400/80">₴{b.meta?.opex.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-text-muted uppercase mb-1">ПДФО ({(taxRate * 100).toFixed(0)}%)</p>
                    <p className="text-sm md:text-base font-black text-ukraine-blue">₴{Math.floor((b.meta?.gross || 0) * taxRate).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  {!b.isStocked ? (
                    <button 
                      onClick={() => handleStock(b.businessId, b.meta?.stockCost || 0)}
                      disabled={loadingAction !== null || profile.balance < (b.meta?.stockCost || 0)}
                      className="flex-1 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Package className="w-4 h-4" />
                      {loadingAction === `stock-${b.businessId}` ? 'ОБРОБКА...' : b.meta?.actionText} (₴{b.meta?.stockCost.toLocaleString()})
                    </button>
                  ) : (
                    <button 
                      onClick={() => setCollectingBusiness(b)}
                      disabled={loadingAction !== null || !b.stockReady}
                      className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <TrendingUp className="w-4 h-4" />
                      {loadingAction === `collect-${b.businessId}` ? 'ОБРОБКА...' : b.meta?.collectText}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-card-dark/40 border border-border-dark p-12 rounded-[3rem] flex flex-col items-center justify-center text-center gap-6 min-h-[400px]">
          <div className="w-20 h-20 bg-ukraine-blue/10 rounded-full flex items-center justify-center mb-2">
            <Building2 className="w-10 h-10 text-ukraine-blue" />
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Ваш офіс порожній</h3>
            <p className="text-sm md:text-base text-text-muted max-w-sm font-medium">Станьте частиною економіки України. Придбайте свій перший бізнес та почніть заробляти капітал.</p>
          </div>
          <button 
            onClick={() => {
              const event = new CustomEvent('changeView', { detail: 'shop' });
              window.dispatchEvent(event);
            }}
            className="px-10 py-5 bg-ukraine-blue text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all hover:scale-110 active:scale-95 shadow-xl shadow-ukraine-blue/30"
          >
            Відкрити Магазин
          </button>
        </div>
      )}

      <AnimatePresence>
        {collectingBusiness && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCollectingBusiness(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card-dark border border-border-dark p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-ukraine-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ReceiptText className="w-8 h-8 text-ukraine-blue" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase">Вибір Оподаткування</h3>
                <p className="text-sm text-text-muted">Зібрати прибуток з підприємства: <span className="text-white font-bold">{collectingBusiness.meta?.name}</span></p>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => handleCollect(collectingBusiness.businessId, collectingBusiness.meta?.gross, false)}
                  className="w-full p-6 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-2xl transition-all text-left flex justify-between items-center group"
                >
                  <div>
                    <p className="text-xs font-black text-green-400 uppercase mb-1">Сплатити податок (ПДФО)</p>
                    <p className="text-[10px] text-text-dim lowercase">Чесний заробіток, +5 рейтинг</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">₴{(collectingBusiness.meta?.gross - Math.floor(collectingBusiness.meta?.gross * taxRate)).toLocaleString()}</p>
                    <p className="text-[8px] font-bold text-red-400">Податок: ₴{Math.floor(collectingBusiness.meta?.gross * taxRate).toLocaleString()}</p>
                  </div>
                </button>

                <button 
                  onClick={() => handleCollect(collectingBusiness.businessId, collectingBusiness.meta?.gross, true)}
                  className="w-full p-6 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-2xl transition-all text-left flex justify-between items-center group"
                >
                  <div>
                    <p className="text-xs font-black text-red-400 uppercase mb-1">Ухилитися (Тінь)</p>
                    <p className="text-[10px] text-text-dim lowercase">Забрати все собі, -20 рейтинг</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-white">₴{collectingBusiness.meta?.gross.toLocaleString()}</p>
                    <p className="text-[8px] font-bold text-red-400">Ризик перевірки</p>
                  </div>
                </button>
              </div>

              <button 
                onClick={() => setCollectingBusiness(null)}
                className="w-full py-4 text-[10px] font-black text-text-dim uppercase tracking-widest"
              >
                Скасувати
              </button>
            </motion.div>
          </div>
        )}

        {showEndDayConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEndDayConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card-dark border border-border-dark p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-ukraine-yellow/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-ukraine-yellow" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase">Завершити день?</h3>
                <p className="text-sm text-text-muted">З вашого балансу буде списано вартість утримання всіх ваших підприємств (OPEX).</p>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                <span className="text-xs font-bold text-text-dim uppercase tracking-widest">Сума до сплати:</span>
                <span className="text-lg font-black text-red-400">₴{totalOpex.toLocaleString()}</span>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowEndDayConfirm(false)}
                  className="flex-1 py-4 bg-secondary-dark text-white rounded-2xl font-black text-xs uppercase transition-all"
                >
                  Скасувати
                </button>
                <button 
                  onClick={handleEndDay}
                  disabled={loadingAction === 'endDay'}
                  className="flex-1 py-4 bg-ukraine-yellow text-black rounded-2xl font-black text-xs uppercase transition-all hover:scale-105 active:scale-95"
                >
                  {loadingAction === 'endDay' ? '...' : 'Підтвердити'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
