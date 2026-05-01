import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, ReceiptText, Briefcase, TrendingUp, Package, Wallet, Landmark, Clock, CheckCircle2, Lock, Trash2, Send, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services/backendService';
import { useNotifications } from '../../context/NotificationContext';
import { BUSINESS_TYPES } from '../../constants';

export const BusinessView: React.FC = () => {
  const { profile, updateBusinessState, collectProfits, buyGlobalStock, endDay, taxRate } = useAuth();
  const { sendNotification } = useNotifications();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [budget, setBudget] = useState<number>(0);
  const [showEndDayConfirm, setShowEndDayConfirm] = useState(false);
  const [showStockConfirm, setShowStockConfirm] = useState(false);
  const [collectingBusiness, setCollectingBusiness] = useState<any | null>(null);

  useEffect(() => {
    const unsubscribe = backend.onGlobalStateUpdate((state) => {
      setBudget(state.budget || 0);
    });
    return () => unsubscribe();
  }, []);

  const ownedBusinesses = profile?.businesses?.map(b => {
    const meta = BUSINESS_TYPES.find(m => m.id === b.businessId);
    return { ...b, meta };
  }).filter(b => b.meta) || [];

  const totalOpex = ownedBusinesses.reduce((acc, b) => acc + (b.meta?.opex || 0), 0);
  const totalStockCost = ownedBusinesses.reduce((acc, b) => acc + (b.meta?.stockCost || 0), 0);
  
  const isAllPaid = ownedBusinesses.length > 0 && ownedBusinesses.every(b => {
    if (!b.lastOpexAt) return false;
    const elapsed = Date.now() - new Date(b.lastOpexAt).getTime();
    return elapsed < 24 * 60 * 60 * 1000;
  });

  const isAllStocked = ownedBusinesses.length > 0 && ownedBusinesses.every(b => {
    if (!b.stockPurchasedAt) return false;
    const elapsed = Date.now() - new Date(b.stockPurchasedAt).getTime();
    return elapsed < 24 * 60 * 60 * 1000;
  });
  
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const calculateCurrentProfit = (b: any) => {
    if (!b.stockPurchasedAt || b.isBlocked) return 0;
    
    const stockStartTime = new Date(b.stockPurchasedAt).getTime();
    const lastCollectTime = new Date(b.lastProfitAt || b.stockPurchasedAt).getTime();
    const now = Date.now();
    const maxDuration = 24 * 60 * 60 * 1000;
    const expiryTime = stockStartTime + maxDuration;

    // Use either now or expiry time, whichever is earlier
    const effectiveNow = Math.min(now, expiryTime);
    
    if (effectiveNow <= lastCollectTime) return 0;

    const elapsedMs = effectiveNow - lastCollectTime;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const hourlyProfit = (b.meta?.gross || 0) / 24;
    
    return Math.floor(elapsedHours * hourlyProfit);
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

  const handleBuyStock = async () => {
    if (!profile) return;
    if (!isAllPaid) {
      alert("Спершу сплатіть утримання (OPEX)!");
      return;
    }
    if (profile.balance < totalStockCost) {
      alert("Недостатньо коштів для закупівлі товару!");
      return;
    }

    setLoadingAction('buyStock');
    try {
      const paid = await buyGlobalStock();
      setShowStockConfirm(false);
      sendNotification(profile.uid, 'Товар закуплено', `Списано ₴${paid.toLocaleString()} на закупівлю товару для всіх підприємств.`, 'success');
    } catch (error) {
      console.error('Buy stock error:', error);
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

  const handleSellBusiness = async (businessId: string) => {
    if (!profile) return;
    const b = profile.businesses?.find(biz => biz.businessId === businessId);
    const meta = BUSINESS_TYPES.find(m => m.id === businessId);
    if (!b || !meta) return;

    const sellPrice = Math.floor(meta.price * 0.7);
    if (!window.confirm(`Ви впевнені, що хочете продати ${meta.name} за ₴${sellPrice.toLocaleString()}?`)) return;

    setLoadingAction(`sell-${businessId}`);
    try {
      const updatedBusinesses = profile.businesses.filter(biz => biz.businessId !== businessId);
      const newBalance = profile.balance + sellPrice;
      
      const res = await backend.saveProfile({
        ...profile,
        balance: newBalance,
        businesses: updatedBusinesses
      });

      if (res.success) {
        sendNotification(profile.uid, 'Бізнес продано', `Ви продали ${meta.name} за ₴${sellPrice.toLocaleString()}.`, 'money');
      }
    } catch (e) {
      console.error('Sell error:', e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBuyProtection = async (businessId: string) => {
    if (!profile) return;
    if (profile.balance < 50000) {
      alert("Недостатньо коштів для криші (потрібно ₴50,000)");
      return;
    }
    if (!window.confirm("Ви впевнені, що хочете купити мафіозну кришу? Це захистить вас від частих атак, але понизить соц.рейтинг.")) return;

    setLoadingAction(`protect-${businessId}`);
    try {
      const res = await backend.buyProtection(businessId);
      if (res.success) {
        sendNotification(profile.uid, 'Мафіозна криша', 'Ваш бізнес тепер під захистом Сім\'ї.', 'mafia');
        // We use refreshProfile since it's already in the parent scope or we can just hope the back-end update was enough
        // but it's better to reload. 
        // Note: refreshProfile is available from useAuth() in line 10
      } else {
        alert(res.error || "Помилка при купівлі захисту");
      }
    } catch (e) {
      console.error('Protect error:', e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTransferBusiness = async (businessId: string) => {
    if (!profile) return;
    const targetEmail = prompt('Вкажіть Email гравця, якому хочете ПЕРЕДАТИ бізнес:');
    if (!targetEmail) return;

    const targetProfile = await backend.getProfileByEmail(targetEmail);
    if (!targetProfile) {
      alert('Гравця з таким Email не знайдено');
      return;
    }

    if (targetProfile.uid === profile.uid) {
      alert('Не можна передати бізнес самому собі');
      return;
    }

    if (!window.confirm(`Ви впевнені, що хочете ПЕРЕДАТИ бізнес ${businessId} гравцеві ${targetProfile.firstName} ${targetProfile.lastName}?`)) return;

    setLoadingAction(`transfer-${businessId}`);
    try {
      const businessToTransfer = profile.businesses.find(b => b.businessId === businessId);
      if (!businessToTransfer) return;

      // 1. Remove from source
      const updatedSourceBusinesses = profile.businesses.filter(b => b.businessId !== businessId);
      await backend.saveProfile({ ...profile, businesses: updatedSourceBusinesses });

      // 2. Add to target
      const updatedTargetBusinesses = [...(targetProfile.businesses || []), businessToTransfer];
      await backend.saveProfile({ ...targetProfile, uid: targetProfile.uid, businesses: updatedTargetBusinesses });

      sendNotification(profile.uid, 'Бізнес передано', `Ви передали бізнес ${businessId} успішно.`, 'info');
      sendNotification(targetProfile.uid, 'Отримано бізнес', `${profile.firstName} передав вам бізнес ${businessId}!`, 'success');
    } catch (e) {
      console.error('Transfer error:', e);
    } finally {
      setLoadingAction(null);
    }
  };

  const renderOpexTimer = (lastOpexAt?: string) => {
    if (!lastOpexAt) return <span className="text-red-400">ПОТРІБНА ОПЛАТА</span>;
    const elapsed = Date.now() - new Date(lastOpexAt).getTime();
    const remaining = 24 * 60 * 60 * 1000 - elapsed;
    if (remaining <= 0) return <span className="text-red-400">ТЕРМІН ВИЙШОВ</span>;
    
    const h = Math.floor(remaining / (1000 * 60 * 60));
    const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((remaining % (1000 * 60)) / 1000);
    return <span className="text-ukraine-yellow font-mono">{h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}</span>;
  };

  const renderStockTimer = (stockPurchasedAt?: string) => {
    if (!stockPurchasedAt) return null;
    const elapsed = Date.now() - new Date(stockPurchasedAt).getTime();
    const remaining = 24 * 60 * 60 * 1000 - elapsed;
    if (remaining <= 0) return null;
    
    const h = Math.floor(remaining / (1000 * 60 * 60));
    const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((remaining % (1000 * 60)) / 1000);
    return <span className="text-white/40 font-mono text-[9px]">{h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}</span>;
  };

  if (!profile) return null;

  return (
    <div className="space-y-6 md:space-y-8 pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-white">Імперія Бізнесу</h2>
          <p className="text-[10px] md:text-sm font-bold text-text-muted uppercase tracking-[0.2em]">Управління активами, закупівлями та прибутком</p>
        </header>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          {ownedBusinesses.length > 0 && (
            <button 
              onClick={() => setShowEndDayConfirm(true)}
              disabled={isAllPaid || loadingAction !== null}
              className={`group relative flex items-center gap-3 px-6 py-4 rounded-2xl transition-all overflow-hidden border ${
                isAllPaid 
                  ? 'bg-green-500/10 border-green-500/20 cursor-default' 
                  : 'bg-white/5 hover:bg-white/10 border-white/10'
              }`}
            >
              {!isAllPaid && (
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/10 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              )}
              {isAllPaid ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <Clock className="w-5 h-5 text-ukraine-yellow" />
              )}
              <div className="text-left">
                <p className="text-[8px] font-black text-text-dim uppercase tracking-widest">
                  {isAllPaid ? 'Ліцензії активні' : 'Продовжити ліцензії'}
                </p>
                <p className={`text-xs font-black ${isAllPaid ? 'text-green-400' : 'text-white'}`}>
                  {isAllPaid ? 'Сплачено на 24г' : `Сплатити OPEX: ₴${totalOpex.toLocaleString()}`}
                </p>
              </div>
            </button>
          )}

          {ownedBusinesses.length > 0 && (
            <button 
              onClick={() => setShowStockConfirm(true)}
              disabled={isAllStocked || loadingAction !== null || !isAllPaid}
              className={`group relative flex items-center gap-3 px-6 py-4 rounded-2xl transition-all overflow-hidden border ${
                isAllStocked 
                  ? 'bg-blue-500/10 border-blue-500/20 cursor-default' 
                  : 'bg-white/5 hover:bg-white/10 border-white/10'
              } disabled:opacity-50`}
            >
              {!isAllStocked && isAllPaid && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              )}
              {isAllStocked ? (
                <CheckCircle2 className="w-5 h-5 text-blue-400" />
              ) : (
                <Package className="w-5 h-5 text-ukraine-blue" />
              )}
              <div className="text-left">
                <p className="text-[8px] font-black text-text-dim uppercase tracking-widest">
                  {isAllStocked ? 'Товар в наявності' : 'Закупити товар'}
                </p>
                <p className={`text-xs font-black ${isAllStocked ? 'text-blue-400' : 'text-white'}`}>
                  {isAllStocked ? 'Завезено на 24г' : `Сплатити STOCK: ₴${totalStockCost.toLocaleString()}`}
                </p>
              </div>
            </button>
          )}
        </div>
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
                  {b.isBlocked && (
                    <span className="px-3 py-1.5 bg-red-600/90 backdrop-blur-md rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-red-500/50 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> ЗАБЛОКОВАНО
                    </span>
                  )}
                  {b.isStocked && !b.isBlocked && (
                    <div className="px-3 py-1.5 bg-ukraine-blue/80 backdrop-blur-md rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-ukraine-blue/30 flex items-center gap-1.5 animate-pulse">
                      <TrendingUp className="w-3 h-3" /> ₴{calculateCurrentProfit(b).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="absolute top-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-[-10px] group-hover:translate-y-0">
                  <button 
                    onClick={() => handleTransferBusiness(b.businessId)}
                    disabled={loadingAction !== null}
                    className="p-3 bg-black/60 backdrop-blur-md rounded-2xl text-white hover:bg-ukraine-blue transition-all border border-white/10 hover:border-ukraine-blue/50 group/btn"
                    title="Передати бізнес"
                  >
                    <Send className="w-4 h-4 group-hover/btn:scale-110" />
                  </button>
                  <button 
                    onClick={() => handleSellBusiness(b.businessId)}
                    disabled={loadingAction !== null}
                    className="p-3 bg-black/60 backdrop-blur-md rounded-2xl text-white hover:bg-red-600 transition-all border border-white/10 hover:border-red-500/50 group/btn"
                    title="Продати бізнес"
                  >
                    <Trash2 className="w-4 h-4 group-hover/btn:scale-110" />
                  </button>
                  {!b.hasMafiaProtection && (
                    <button 
                      onClick={() => handleBuyProtection(b.businessId)}
                      disabled={loadingAction !== null}
                      className="p-3 bg-black/60 backdrop-blur-md rounded-2xl text-red-500 hover:bg-red-900 transition-all border border-red-500/30 hover:border-red-500 group/btn"
                      title="Мафіозна криша (₴50k)"
                    >
                      <Shield className="w-4 h-4 group-hover/btn:scale-110" />
                    </button>
                  )}
                </div>
                <div className="absolute bottom-6 left-6 right-6">
                  <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight leading-none mb-1">{b.meta?.name}</h3>
                  <p className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em]">Мережевий Актив</p>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-text-muted uppercase mb-1">Max прибуток</p>
                    <p className="text-xs md:text-base font-black text-white">₴{b.meta?.gross.toLocaleString()}</p>
                    <p className="text-[7px] font-bold text-text-dim/60 uppercase">₴{Math.floor(b.meta?.gross / 24).toLocaleString()} / год</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-text-muted uppercase mb-1">OPEX Таймер</p>
                    <div className="text-[9px] md:text-[10px] font-black">
                      {renderOpexTimer(b.lastOpexAt)}
                    </div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-text-muted uppercase mb-1">STOCK Таймер</p>
                    <div className="text-[9px] md:text-[10px] font-black">
                      {renderStockTimer(b.stockPurchasedAt) || <span className="text-red-400">ПОТРІБЕН ТОВАР</span>}
                    </div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-text-muted uppercase mb-1">ПДФО ({(taxRate * 100).toFixed(0)}%)</p>
                    <p className="text-xs md:text-base font-black text-ukraine-blue">₴{Math.floor((calculateCurrentProfit(b) || 0) * taxRate).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                    <button 
                      onClick={() => setCollectingBusiness({ ...b, calculatedProfit: calculateCurrentProfit(b) })}
                      disabled={loadingAction !== null || calculateCurrentProfit(b) <= 0 || b.isBlocked}
                      className={`flex-1 py-4 ${b.isBlocked ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-green-500 text-white'} rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg ${b.isBlocked ? '' : 'shadow-green-500/20'} transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                      {b.isBlocked ? (
                        <>
                          <Lock className="w-4 h-4" />
                          АКТИВ ЗАБЛОКОВАНО
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-4 h-4" />
                          ЗІБРАТИ ПРИБУТОК (₴{calculateCurrentProfit(b).toLocaleString()})
                        </>
                      )}
                    </button>
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
                  onClick={() => handleCollect(collectingBusiness.businessId, collectingBusiness.calculatedProfit, false)}
                  className="w-full p-6 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-2xl transition-all text-left flex justify-between items-center group"
                >
                  <div>
                    <p className="text-xs font-black text-green-400 uppercase mb-1">Сплатити податок (ПДФО)</p>
                    <p className="text-[10px] text-text-dim lowercase">Чесний заробіток, +5 рейтинг</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">₴{(collectingBusiness.calculatedProfit - Math.floor(collectingBusiness.calculatedProfit * taxRate)).toLocaleString()}</p>
                    <p className="text-[8px] font-bold text-red-400">Податок: ₴{Math.floor(collectingBusiness.calculatedProfit * taxRate).toLocaleString()}</p>
                  </div>
                </button>

                <button 
                  onClick={() => handleCollect(collectingBusiness.businessId, collectingBusiness.calculatedProfit, true)}
                  className="w-full p-6 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-2xl transition-all text-left flex justify-between items-center group"
                >
                  <div>
                    <p className="text-xs font-black text-red-400 uppercase mb-1">Ухилитися (Тінь)</p>
                    <p className="text-[10px] text-text-dim lowercase">Забрати все собі, -20 рейтинг</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-white">₴{collectingBusiness.calculatedProfit.toLocaleString()}</p>
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

        {showStockConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStockConfirm(false)}
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
                  <Package className="w-8 h-8 text-ukraine-blue" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase">Закупити товар?</h3>
                <p className="text-sm text-text-muted">Закупівля товару дозволить вашим підприємствам працювати та приносити прибуток протягом наступних 24 годин.</p>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                <span className="text-xs font-bold text-text-dim uppercase tracking-widest">Сума до сплати:</span>
                <span className="text-lg font-black text-ukraine-blue">₴{totalStockCost.toLocaleString()}</span>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowStockConfirm(false)}
                  className="flex-1 py-4 bg-secondary-dark text-white rounded-2xl font-black text-xs uppercase transition-all"
                >
                  Скасувати
                </button>
                <button 
                  onClick={handleBuyStock}
                  disabled={loadingAction === 'buyStock'}
                  className="flex-1 py-4 bg-ukraine-blue text-white rounded-2xl font-black text-xs uppercase transition-all hover:scale-105 active:scale-95 shadow-lg shadow-ukraine-blue/20"
                >
                  {loadingAction === 'buyStock' ? '...' : 'Закупити'}
                </button>
              </div>
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
                <h3 className="text-2xl font-black text-white uppercase">Продовжити роботу?</h3>
                <p className="text-sm text-text-muted">З вашого балансу буде списано вартість утримання (OPEX) для всіх підприємств. Це дозволить їм працювати наступні 24 години.</p>
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
