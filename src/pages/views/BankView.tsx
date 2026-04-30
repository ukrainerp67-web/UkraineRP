import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Landmark, ArrowUpRight, ArrowDownLeft, CreditCard, RefreshCw, Bitcoin, ShieldCheck, PenTool, CheckCircle2, X, Wallet, Gavel, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { backend } from '../../services/backendService';

export const BankView: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { sendNotification } = useNotifications();
  const [showCardCreator, setShowCardCreator] = useState(false);
  const [showFinePayment, setShowFinePayment] = useState(false);
  const [fines, setFines] = useState<any[]>([]);
  const [selectedFine, setSelectedFine] = useState<any>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [selectedCardType, setSelectedCardType] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [passportId, setPassportId] = useState('');
  const [signature, setSignature] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.uid) {
      const unsubscribe = backend.onFinesUpdate(profile.uid, (data) => {
        setFines(data.filter(f => f.status === 'pending'));
      });
      return () => unsubscribe();
    }
  }, [profile?.uid]);
  
  const handleAction = async (action: string) => {
    if (!profile) return;
    
    if (action === 'Перекази') {
      await sendNotification(
        profile.uid,
        'Вхідна транзакція',
        'Вам надійшов запит на переказ ₴15,000 від Державний Банк. Підтвердіть отримання.',
        'money',
        '',
        'bank_transfer',
        { amount: 15000, fromId: 'system' }
      );
    } else if (action === 'Карта') {
      const ownedTypes = profile.bankCards?.map((c: any) => c.type) || [];
      if (ownedTypes.length >= 5) {
        alert("Ви вже володієте всіма можливими типами карт Національного Банку.");
        return;
      }
      setShowCardCreator(true);
    } else if (action === 'Штрафи') {
      setShowFinePayment(true);
    } else {
      await sendNotification(
        profile.uid,
        'Банківська операція',
        `Запит на [${action}] прийнято в обробку.`,
        'info'
      );
    }
  };

  const CARD_TYPES = [
    { id: 'e-support', name: 'Є-Підтримка від держави', color: 'from-blue-600 to-blue-400', icon: '🇺🇦', desc: 'Для соціальних виплат та допомоги' },
    { id: 'pension', name: 'Пенсійний фонд', color: 'from-amber-600 to-yellow-500', icon: '🎖️', desc: 'Для пенсійних нарахувань', reqLevel: 35 },
    { id: 'standard', name: 'Звичайна гривнева карта', color: 'from-zinc-800 to-zinc-600', icon: '💳', desc: 'Універсальна карта для платежів' },
    { id: 'usd', name: 'Доларова карта', color: 'from-emerald-700 to-green-500', icon: '💵', desc: 'Валютні операції в USD' },
    { id: 'eur', name: 'Єврова карта', color: 'from-indigo-800 to-blue-700', icon: '💶', desc: 'Валютні операції в EUR' },
  ];

  const handleCreateCard = async () => {
    if (!profile || !selectedCardType) return;
    setCreationError(null);

    // Validation
    const expectedId = `UA-${profile.uid.slice(0, 8).toUpperCase()}`;
    if (passportId.toUpperCase() !== expectedId) {
      setCreationError('Помилка: Невірний ID документа. Перевірте дані у вашому паспорті.');
      return;
    }

    if (signature !== profile.signature) {
      setCreationError('Ваш підпис не відповідає дійсності, спробуйте ще раз');
      return;
    }

    setIsProcessing(true);
    try {
      const cardNumber = Array.from({length: 4}, () => Math.floor(Math.random() * 9000 + 1000)).join(' ');
      const currentCards = Array.isArray(profile.bankCards) ? profile.bankCards : [];
      const newCard = {
        type: selectedCardType.id,
        number: cardNumber,
        createdAt: new Date().toISOString(),
        passportId: expectedId,
        label: selectedCardType.name,
        balance: 0
      };

      const result = await backend.saveProfile({
        ...profile,
        bankCards: [...currentCards, newCard]
      });
      
      if (result.success) {
        await refreshProfile();
        await sendNotification(profile.uid, 'Банківська карта', `Вашу карту "${selectedCardType.name}" активовано!`, 'success');
        setShowCardCreator(false);
        resetCreator();
      } else {
        alert("Помилка при збереженні карти: " + (result.error || "Невідома помилка"));
      }
    } catch (error) {
      console.error('Card creation error:', error);
      alert('Сталася помилка при створенні карти.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCreator = () => {
    setSelectedCardType(null);
    setStep(1);
    setPassportId('');
    setSignature('');
    setCreationError(null);
  };

  const handlePayFine = async () => {
    if (!profile || !selectedFine || !selectedCardId) return;
    
    const card = profile.bankCards?.find((c: any) => c.number === selectedCardId);
    if (!card) {
      alert("Картку не знайдено");
      return;
    }

    if (card.balance < selectedFine.amount) {
      alert("Недостатньо коштів на цій карті");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await backend.payFine(profile.uid, selectedFine.id, selectedFine.amount, selectedCardId);
      
      if (result.success) {
        await refreshProfile();
        setShowFinePayment(false);
        setSelectedFine(null);
        setSelectedCardId('');
        alert("Штраф успішно оплачено! Гроші зараховані до Державного Бюджету.");
      } else {
        alert("Помилка при оплаті штрафу");
      }
    } catch (error: any) {
       console.error("Fine payment error", error);
       alert("Помилка при оплаті штрафу: " + (error.message || "Невідома помилка"));
    } finally {
      setIsProcessing(false);
    }
  };

  const actions = [
    { label: 'Карта', icon: CreditCard, desc: profile?.bankCards?.length ? `У вас активних карт: ${profile.bankCards.length}` : 'Створити банківську карту', color: 'text-ukraine-blue' },
    { label: 'Штрафи', icon: Gavel, desc: fines.length > 0 ? `Є несплачені штрафи: ${fines.length}` : 'Немає виписаних штрафів', color: fines.length > 0 ? 'text-red-400 animate-pulse' : 'text-green-400' },
    { label: 'Перекази', icon: CreditCard, desc: 'Переказ гравцям за ID чи Ім’ям', color: 'text-yellow-400' },
    { label: 'Кредит', icon: ArrowDownLeft, desc: 'До 1,000,000 ₴ під 15% застави', color: 'text-red-400' },
  ];

  const renderCard = (card: any) => {
    if (!card) return null;
    const cardData = CARD_TYPES.find(t => t.id === card.type);
    const balance = typeof card.balance === 'number' ? card.balance : 0;
    
    return (
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full max-w-[320px] aspect-[1.58/1] rounded-2xl p-4 md:p-6 text-white relative shadow-2xl overflow-hidden bg-gradient-to-br ${cardData?.color || 'from-gray-700 to-gray-500'}`}
      >
        <div className="absolute top-0 right-0 p-4 opacity-20">
          <Landmark className="w-16 h-16 md:w-20 md:h-20" />
        </div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest opacity-80">Національний Банк</p>
              <p className="text-[10px] md:text-xs font-bold leading-tight truncate max-w-[150px]">{card.label || 'Банківська карта'}</p>
            </div>
            <span className="text-xl md:text-2xl">{cardData?.icon || '💳'}</span>
          </div>
          
          <div className="mt-auto mb-2">
            <p className="text-xs md:text-sm font-mono tracking-widest mb-1 md:mb-2">{card.number || '**** **** **** ****'}</p>
          </div>

          <div className="flex justify-between items-end gap-2 pb-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] md:text-xs font-bold uppercase opacity-80 mb-1">Власник</p>
              <p className="text-[14px] md:text-base font-black uppercase tracking-tight truncate">
                {profile?.firstName || ''} {profile?.lastName || ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] md:text-xs font-bold uppercase opacity-80 mb-1">Баланс</p>
              <p className="text-[16px] md:text-xl font-black text-white whitespace-nowrap">
                ₴{balance.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 blur-sm" />
      </motion.div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-8">
      <header className="flex flex-col sm:flex-row justify-between items-center bg-card-dark p-5 md:p-6 rounded-xl border border-border-dark relative overflow-hidden gap-4">
        <div className="relative z-10 text-center sm:text-left">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter flex items-center justify-center sm:justify-start gap-3 text-white">
            <Landmark className="w-6 h-6 md:w-8 md:h-8 text-yellow-400" />
            Національний Банк
          </h2>
          <p className="text-gray-500 text-[10px] md:text-xs mt-1 uppercase font-bold tracking-widest leading-none">Фінансова безпека твого майбутнього</p>
        </div>
        <div className="text-center sm:text-right relative z-10 w-full sm:w-auto bg-bg-dark/50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-white/5">
          <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-500 mb-1">Головний баланс</p>
          <p className="text-2xl md:text-3xl font-black text-white">{profile?.balance.toLocaleString()} ₴</p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Ваші активи</h3>
          <div className="flex flex-col items-center">
            {profile?.bankCards && Array.isArray(profile.bankCards) && profile.bankCards.length > 0 ? (
              <div className="w-full flex overflow-x-auto gap-4 py-4 px-2 snap-x custom-scrollbar">
                {profile.bankCards.map((card: any, idx: number) => {
                  if (!card) return null;
                  return (
                    <div key={card.number || idx} className="snap-center shrink-0">
                      {renderCard(card)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="w-full aspect-[1.58/1] rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center bg-white/2 space-y-2 opacity-50 grayscale">
                <CreditCard className="w-8 h-8 text-white/20" />
                <p className="text-[10px] uppercase font-black tracking-widest text-white/20">Немає активних карт</p>
              </div>
            )}
          </div>

          <div className="grid gap-3 pt-4">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleAction(action.label)}
                className="game-card p-4 flex items-center gap-4 hover:bg-white/5 transition-all text-left w-full"
              >
                <div className={`p-3 rounded-xl bg-white/5 ${action.color}`}>
                  <action.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-sm">{action.label}</p>
                  <p className="text-[10px] text-gray-500">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Інвестиції та Крипто</h3>
          <div className="game-card p-6 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <Bitcoin className="w-6 h-6 text-orange-400" />
                <div>
                  <p className="text-xs font-bold">BitCoin (BTC)</p>
                  <p className="text-[10px] text-green-400">+2.4% за сьогодні</p>
                </div>
              </div>
              <p className="font-black text-sm">2,541,400 ₴</p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-6 h-6 text-blue-400" />
                <div>
                  <p className="text-xs font-bold">Ethereum (ETH)</p>
                  <p className="text-[10px] text-red-400">-0.8% за сьогодні</p>
                </div>
              </div>
              <p className="font-black text-sm">115,200 ₴</p>
            </div>
            <button className="w-full py-3 bg-yellow-400 text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-yellow-300 transition-all">
              Відкрити термінал
            </button>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showCardCreator && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => { if (!isProcessing) setShowCardCreator(false); }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card-dark border border-white/10 p-6 md:p-8 rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden"
            >
              <header className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6 text-ukraine-blue" />
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Створення банківської карти</h3>
                </div>
                <button onClick={() => setShowCardCreator(false)} disabled={isProcessing} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </header>

              {step === 1 ? (
                <div className="space-y-6">
                  <p className="text-xs text-text-muted">Виберіть тип карти, який ви бажаєте відкрити. Кожен тип карти можна мати лише в одному екземплярі:</p>
                  <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {CARD_TYPES.filter(t => !(profile.bankCards?.some((c: any) => c.type === t.id))).map(type => {
                      const isLocked = type.reqLevel && (profile.level || 0) < type.reqLevel;
                      return (
                        <button
                          key={type.id}
                          disabled={isLocked}
                          onClick={() => setSelectedCardType(type)}
                          className={`w-full p-4 rounded-2xl border transition-all text-left flex items-start gap-4 ${
                            selectedCardType?.id === type.id 
                              ? `bg-gradient-to-br ${type.color} border-white/20 text-white` 
                              : isLocked 
                                ? 'bg-white/2 border-white/5 opacity-50 grayscale cursor-not-allowed'
                                : 'bg-white/5 border-white/5 hover:bg-white/10 text-text-muted hover:text-white'
                          }`}
                        >
                          <span className="text-2xl mt-1">{type.icon}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <p className="font-black text-sm uppercase">{type.name}</p>
                              {type.reqLevel && (
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${isLocked ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                  Р-{type.reqLevel}+
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] opacity-80">
                              {isLocked ? `Необхідно досягти ${type.reqLevel} рівня для отримання` : type.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <button 
                    disabled={!selectedCardType}
                    onClick={() => setStep(2)}
                    className="w-full py-4 bg-white text-black font-black uppercase rounded-2xl tracking-widest disabled:opacity-50 transition-all hover:scale-[1.02]"
                  >
                    ПРОДОВЖИТИ
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex gap-4">
                    <ShieldCheck className="w-8 h-8 text-ukraine-blue shrink-0" />
                    <div>
                      <p className="text-xs font-black text-white uppercase mb-1">Безпека та верифікація</p>
                      <p className="text-[10px] text-text-muted leading-relaxed">Для закріплення вас як клієнта банку, введіть дані вашого цифрового паспорта та підпис.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-12 bg-zinc-800 rounded border border-white/10 flex items-center justify-center overflow-hidden grayscale">
                           {profile.passportPhoto ? (
                             <img src={profile.passportPhoto} className="w-full h-full object-cover opacity-50" alt="passport" />
                           ) : (
                             <Landmark className="w-4 h-4 text-white/20" />
                           )}
                         </div>
                         <div>
                           <p className="text-[10px] font-black text-white uppercase">Копія паспорта</p>
                           <p className="text-[8px] text-green-400 font-bold uppercase tracking-widest flex items-center gap-1">
                             <CheckCircle2 className="w-2 h-2" /> Прикріплено автоматично
                           </p>
                         </div>
                       </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-text-dim uppercase tracking-widest px-1">ID КАРТИ (З паспорта)</label>
                      <input 
                        type="text" 
                        placeholder="Наприклад: UA-A1B2C3D4"
                        value={passportId}
                        onChange={(e) => setPassportId(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold placeholder:text-white/10 uppercase"
                      />
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-text-dim uppercase tracking-widest px-1 flex justify-between">
                         ВЕРИФІКАЦІЯ ПІДПИСУ
                         <span className="text-ukraine-blue animate-pulse flex items-center gap-1"><PenTool className="w-2.5 h-2.5" /> Очікування введення...</span>
                       </label>
                       <div className="relative">
                         <input 
                            type="text" 
                            placeholder="Ваш унікальний підпис..."
                            value={signature}
                            onChange={(e) => setSignature(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-6 text-white font-serif italic text-lg placeholder:text-white/5 italic"
                          />
                          <PenTool className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10" />
                       </div>
                    </div>
                  </div>

                  {creationError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-bold uppercase tracking-wider text-center"
                    >
                      {creationError}
                    </motion.div>
                  )}

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setStep(1)}
                      disabled={isProcessing}
                      className="flex-1 py-4 bg-secondary-dark text-white font-black uppercase rounded-2xl tracking-widest transition-all"
                    >
                      НАЗАД
                    </button>
                    <button 
                      onClick={handleCreateCard}
                      disabled={isProcessing || !passportId || !signature}
                      className="flex-3 py-4 bg-ukraine-blue text-white font-black uppercase rounded-2xl tracking-widest shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 hover:bg-blue-400 transition-all active:scale-95"
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          АКТИВУВАТИ КАРТУ
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFinePayment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowFinePayment(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card-dark border border-white/10 p-6 md:p-8 rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden"
            >
              <header className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <Gavel className="w-6 h-6 text-red-400" />
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Сплата Штрафів ⚖️</h3>
                </div>
                <button onClick={() => setShowFinePayment(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </header>

              <div className="space-y-6">
                {fines.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-sm font-bold text-white uppercase tracking-widest">Немає активних штрафів</p>
                    <p className="text-[10px] text-text-dim">Ваша фінансова історія чиста. Ви законослухняний громадянин!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[10px] text-text-dim uppercase font-black tracking-widest">Виберіть штраф для оплати:</p>
                    <div className="grid gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      {fines.map(fine => (
                        <button
                          key={fine.id}
                          onClick={() => setSelectedFine(fine)}
                          className={`w-full p-4 rounded-2xl border transition-all text-left ${
                            selectedFine?.id === fine.id 
                              ? 'bg-red-500/10 border-red-500/30' 
                              : 'bg-white/5 border-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                             <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">₴{fine.amount.toLocaleString()}</p>
                             <div className="flex items-center gap-1 text-[8px] text-text-dim">
                               <Calendar className="w-2.5 h-2.5" />
                               {new Date(fine.deadline).toLocaleDateString()}
                             </div>
                          </div>
                          <p className="text-xs font-bold text-white mb-1">{fine.reason}</p>
                          <p className="text-[9px] text-text-dim">Виписано: {new Date(fine.issuedAt?.seconds ? fine.issuedAt.seconds * 1000 : fine.issuedAt).toLocaleString()}</p>
                        </button>
                      ))}
                    </div>

                    {selectedFine && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-4 pt-2 border-t border-white/5"
                      >
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-text-dim uppercase tracking-widest px-1">Виберіть карту для оплати</label>
                          <select 
                            value={selectedCardId}
                            onChange={(e) => setSelectedCardId(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-red-500/50"
                          >
                            <option value="">Оберіть карту...</option>
                            {profile.bankCards?.map((c: any) => (
                              <option key={c.number} value={c.number}>
                                {c.label} (₴{c.balance.toLocaleString()})
                              </option>
                            ))}
                          </select>
                        </div>

                        <button 
                          onClick={handlePayFine}
                          disabled={isProcessing || !selectedCardId}
                          className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-widest rounded-2xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                        >
                          {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Оплатити ₴{selectedFine.amount.toLocaleString()}</>}
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
