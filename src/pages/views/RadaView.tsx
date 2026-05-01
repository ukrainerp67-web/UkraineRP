import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { Building2, Gavel, Award, Search, HelpCircle, Briefcase, Landmark, ReceiptText, AlertCircle, ShieldAlert, TrendingUp, HandCoins, UserSearch, Ban, FileWarning, Wallet, Lock, Users } from 'lucide-react';
import { backend } from '../../services/backendService';

export const RadaView: React.FC = () => {
  const { profile } = useAuth();
  const [countryState, setCountryState] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [supportAmount, setSupportAmount] = useState(1000);
  
  const isSuperAdmin = profile?.email === 'ukrainerp67@gmail.com';
  const canJoin = isSuperAdmin || (profile && profile.socialRating >= 15);

  const isGovLeader = profile?.role === 'admin' || 
                      profile?.role === 'rada' ||
                      [
                        'Президент', 
                        "Прем'єр Міністр", 
                        "Прем'єр міністр", 
                        "Прем'єр-міністр", 
                        'Міністр фінансів'
                      ].includes(profile?.role || '') ||
                      [
                        'Президент', 
                        "Прем'єр Міністр", 
                        "Прем'єр міністр", 
                        "Прем'єр-міністр", 
                        'Міністр фінансів'
                      ].includes(profile?.status || '');

  const isInGov = isGovLeader || 
                  profile?.role === 'Депутат' || 
                  profile?.role === 'Працівник ВФБ' ||
                  profile?.status === 'Депутат' ||
                  profile?.status === 'Працівник ВФБ';

  const [auditResult, setAuditResult] = useState<any>(null);
  const [partyName, setPartyName] = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [dismissalReason, setDismissalReason] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [taxInput, setTaxInput] = useState<string>('20');
  const [speech, setSpeech] = useState<string>('');
  const [bonusReason, setBonusReason] = useState<string>('');
  const [bonusAmount, setBonusAmount] = useState<string>('1000');
  const [fineDeadline, setFineDeadline] = useState<string>('24');
  const [fundAmount, setFundAmount] = useState<string>('50000');
  const [targetBusinesses, setTargetBusinesses] = useState<any[]>([]);
  const [fundSphere, setFundSphere] = useState<string>('Медицина');

  useEffect(() => {
    const unsubscribe = backend.onGlobalStateUpdate((state) => {
      setCountryState(state);
      if (state && state.taxRate !== undefined) {
          setTaxInput((state.taxRate * 100).toFixed(0));
      }
    });

    const fetchPlayers = async () => {
       try {
         const playersList = await backend.searchUsers('');
         setPlayers(playersList);
       } catch (err) {
         console.error("Error fetching players", err);
       }
    };
    fetchPlayers();

    return () => unsubscribe();
  }, []);

  const govtEmployees = players.filter(p => p.role === 'rada' || [
    'Президент', "Прем'єр-міністр", 'Міністр фінансів', 'Депутат', 'Працівник ВФБ'
  ].includes(p.status));

  const handlePresidentVeto = async () => {
    if (!profile) return;
    setLoadingAction('veto');
    await backend.applyVeto(profile.uid, 'Остання зміна бюджету');
    setLoadingAction(null);
  };

  const handleFireEmployee = async (targetId: string) => {
    if (!profile || !dismissalReason) {
      alert('Вкажіть причину звільнення');
      return;
    }
    setLoadingAction(`fire-${targetId}`);
    const res = await backend.fireEmployee(profile.uid, targetId, dismissalReason);
    if (res.success) {
      alert('Працівника звільнено!');
      setDismissalReason('');
      // Refresh list
      const playersList = await backend.searchUsers('');
      setPlayers(playersList);
    }
    setLoadingAction(null);
  };

  const handlePresidentSpeech = async () => {
    if (!profile || !speech) return;
    setLoadingAction('speech');
    const res = await backend.addressThePeople(profile.uid, speech);
    if (res.success) {
      alert(`Ваша промова опублікована! Рейтинг довіри зріс на ${res.trustChange}%`);
      setSpeech('');
    } else {
      alert('Помилка при публікації промови.');
    }
    setLoadingAction(null);
  };

  const handleTaxChange = async () => {
    if (!profile) return;
    setLoadingAction('tax');
    const res = await backend.setTaxRate(profile.uid, parseInt(taxInput) / 100);
    if (res.success) {
      alert(`Нову ставку оподаткування (${taxInput}%) успішно затверджено!`);
    } else {
      alert(`Помилка: ${(res as any).message || (res as any).error || 'Не вдалося змінити податок'}`);
    }
    setLoadingAction(null);
  };

  const handleRaid = async () => {
    if (!profile) return;
    setLoadingAction('raid');
    await backend.businessRaid(profile.uid);
    setLoadingAction(null);
  };

  const handleAudit = async () => {
    if (!profile || !selectedPlayer) return;
    setLoadingAction('audit');
    const res = await backend.shadowAudit(profile.uid, selectedPlayer);
    if (res.success) {
      setAuditResult(res);
    }
    setLoadingAction(null);
  };

  const handleDeputyAction = async (action: string) => {
    if (!profile) return;
    setLoadingAction(action);
    await backend.sendMessage({
      senderName: profile.firstName + ' ' + profile.lastName,
      senderPhoto: profile.passportPhoto,
      content: `[Депутатська Дія: ${action}] ${action === 'bill' ? billDescription : partyName}`,
      role: profile.status,
      uid: profile.uid
    });
    alert('Запит надіслано до системи!');
    setLoadingAction(null);
  };

  const handleBonus = async () => {
    if (!profile || !selectedPlayer || !bonusReason) return;
    const amount = parseInt(bonusAmount);
    setLoadingAction('bonus');
    const res = await backend.applyBonusOrPenalty(profile.uid, selectedPlayer, amount, bonusReason);
    if (res.success) {
      alert(`Премія ₴${amount.toLocaleString()} успішно виплачена!`);
      setBonusReason('');
    } else {
      alert(`Помилка: ${(res as any).message || (res as any).error || 'Не вдалося виплатити премію'}`);
    }
    setLoadingAction(null);
  };

  const handleIssueFine = async () => {
    if (!profile || !selectedPlayer || !bonusReason) return;
    const amount = Math.abs(parseInt(bonusAmount));
    setLoadingAction('fine');
    const res = await backend.issueFine(profile.uid, selectedPlayer, amount, bonusReason, parseInt(fineDeadline));
    if (res.success) {
      alert(`Штраф ₴${amount.toLocaleString()} успішно виписано!`);
      setBonusReason('');
    } else {
      alert(`Помилка: ${(res as any).message || (res as any).error || 'Не вдалося виписати штраф'}`);
    }
    setLoadingAction(null);
  };

  const handleToggleBlock = async (businessId: string, currentlyBlocked: boolean) => {
    if (!profile || !selectedPlayer) return;
    setLoadingAction(`block-${businessId}`);
    await backend.toggleBusinessBlock(profile.uid, selectedPlayer, businessId, !currentlyBlocked);
    const target = await backend.getProfile(selectedPlayer);
    if (target && target.businesses) setTargetBusinesses(target.businesses);
    setLoadingAction(null);
  };

  const handleFund = async () => {
    if (!profile || !fundAmount) return;
    setLoadingAction('fund');
    const res = await backend.fundSphere(profile.uid, fundSphere, parseInt(fundAmount));
    if (res.success) {
      alert(`Успішно виділено ₴${parseInt(fundAmount).toLocaleString()} на сферу "${fundSphere}"`);
    } else {
      alert(`Помилка: ${(res as any).message || (res as any).error || 'Не вдалося виділити кошти'}`);
    }
    setLoadingAction(null);
  };

  const handleDistribute = async (type: 'support' | 'pension') => {
    if (!profile) return;
    const amount = type === 'support' ? supportAmount : Math.floor(supportAmount * 1.5);
    setLoadingAction(type);
    try {
      const res = await backend.distributeSocialSupport(amount, type) as any;
      if (res.success) {
        if (res.count > 0) {
          alert(`Успішно нараховано по ₴${amount.toLocaleString()} для ${res.count} громадян!`);
        } else {
          alert(res.message || 'Немає громадян, які мають відповідну банківську карту для отримання цієї виплати.');
        }
      } else {
        alert('Помилка: ' + (res.error?.message || 'Невідома помилка'));
      }
    } catch (error) {
      console.error('Distribution error:', error);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-8 text-gray-200">
      <header className="bg-gradient-to-br from-blue-900/30 to-black p-6 md:p-8 rounded-2xl md:rounded-3xl border border-blue-500/20 relative overflow-hidden">
        <div className="relative z-10 text-center sm:text-left flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl md:text-3xl font-black italic tracking-tighter text-white flex items-center justify-center sm:justify-start gap-4">
              <Building2 className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
              ВЕРХОВНА РАДА УКРАЇНИ
            </h2>
            <p className="text-blue-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-2 underline decoration-yellow-400 underline-offset-4">Законотворчість та Розбудова</p>
          </div>

          {isGovLeader && countryState && (
            <div className="flex flex-wrap gap-3 md:gap-4 justify-center sm:justify-end">
               <div className="bg-white/5 border border-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl backdrop-blur-md min-w-[120px]">
                  <div className="flex items-center gap-2 mb-1">
                     <Landmark className="w-3.5 h-3.5 text-blue-400" />
                     <p className="text-[8px] md:text-[9px] font-black text-text-dim uppercase tracking-widest">Держбюджет</p>
                  </div>
                  <p className="text-lg md:text-xl font-black text-white">₴{(countryState.budget || 0).toLocaleString()}</p>
               </div>

               <div className="bg-white/5 border border-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl backdrop-blur-md min-w-[100px]">
                  <div className="flex items-center gap-2 mb-1">
                     <ReceiptText className="w-3.5 h-3.5 text-yellow-400" />
                     <p className="text-[8px] md:text-[9px] font-black text-text-dim uppercase tracking-widest">Податок</p>
                  </div>
                  <p className="text-lg md:text-xl font-black text-white">{((countryState.taxRate || 0) * 100).toFixed(0)}%</p>
               </div>

               <div className="bg-white/5 border border-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl backdrop-blur-md min-w-[100px]">
                  <div className="flex items-center gap-2 mb-1">
                     <Award className="w-3.5 h-3.5 text-green-400" />
                     <p className="text-[8px] md:text-[9px] font-black text-text-dim uppercase tracking-widest">Довіра</p>
                  </div>
                  <p className={`text-lg md:text-xl font-black ${countryState.trustRating < 20 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {countryState.trustRating || 0}%
                  </p>
               </div>
            </div>
          )}
        </div>
        <Building2 className="absolute -bottom-8 -right-8 w-32 md:w-48 h-32 md:h-48 text-blue-400/5 rotate-12 pointer-events-none" />
      </header>

      {/* Dynamics Role Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left Column: Role Interaction */}
        <div className="bg-card-dark border border-white/5 p-6 rounded-3xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Панель Управління Посадою</h3>
              <p className="text-[10px] text-text-dim uppercase tracking-widest">{profile?.status || profile?.role}</p>
            </div>
          </div>

          <div className="space-y-4">
            {(profile?.role === 'Президент' || profile?.status === 'Президент') && (
              <div className="space-y-4">
                <button 
                  onClick={handlePresidentVeto}
                  disabled={loadingAction === 'veto'}
                  className="w-full flex items-center justify-between p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <Ban className="w-5 h-5 text-red-400" />
                    <div className="text-left">
                      <p className="text-xs font-bold text-white uppercase">Накласти ВЕТО</p>
                      <p className="text-[9px] text-text-dim">Скасувати останнє рішення уряду</p>
                    </div>
                  </div>
                  <Gavel className="w-4 h-4 text-red-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>

                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <p className="text-[10px] font-bold text-white uppercase">Звернення до народу</p>
                  </div>
                  <textarea 
                    value={speech}
                    onChange={(e) => setSpeech(e.target.value)}
                    placeholder="Ваша промова до громадян..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500/50 min-h-[80px]"
                  />
                  <button 
                    onClick={handlePresidentSpeech}
                    disabled={loadingAction === 'speech' || !speech}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                  >
                    Виступити {loadingAction === 'speech' && '...'}
                  </button>
                </div>

                <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-2xl space-y-3">
                   <div className="flex items-center gap-2 mb-1">
                     <Users className="w-4 h-4 text-red-500" />
                     <p className="text-[10px] font-black text-white uppercase">Звільнення працівників ВР</p>
                   </div>
                   <input 
                      placeholder="Причина звільнення..."
                      value={dismissalReason}
                      onChange={(e) => setDismissalReason(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none"
                   />
                   <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                      {govtEmployees.map(emp => (
                        <div key={emp.uid} className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/5">
                           <div className="flex flex-col">
                             <span className="text-[10px] font-bold text-white">{emp.firstName} {emp.lastName}</span>
                             <span className="text-[8px] text-text-dim uppercase font-bold">{emp.status}</span>
                           </div>
                           <button 
                             onClick={() => handleFireEmployee(emp.uid)}
                             disabled={loadingAction?.startsWith('fire')}
                             className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[8px] font-black uppercase rounded"
                           >
                             Звільнити
                           </button>
                        </div>
                      ))}
                      {govtEmployees.length === 0 && <p className="text-[9px] text-text-dim italic text-center py-2">Працівників не знайдено</p>}
                   </div>
                </div>
              </div>
            )}

            {(profile?.role === 'Депутат' || profile?.status === 'Депутат') && (
              <div className="space-y-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                   <div className="flex items-center gap-2 mb-1">
                     <Briefcase className="w-4 h-4 text-blue-400" />
                     <p className="text-[10px] font-black text-white uppercase">Депутатська Діяльність</p>
                   </div>
                   
                   <div className="space-y-2">
                     <button 
                       onClick={() => handleDeputyAction('party')}
                       className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-left hover:bg-white/10 flex items-center gap-3"
                     >
                       <Award className="w-4 h-4 text-yellow-400" />
                       <div className="flex-1">
                         <p className="text-[10px] font-bold text-white uppercase">Створити партію</p>
                         <p className="text-[8px] text-text-dim">Офіційна реєстрація політичної сили</p>
                       </div>
                     </button>

                     <div className="p-3 bg-black/30 rounded-xl border border-white/5 space-y-2">
                       <input 
                         placeholder="Опис законопроєкту..."
                         value={billDescription}
                         onChange={(e) => setBillDescription(e.target.value)}
                         className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-[10px] outline-none"
                       />
                       <button 
                         onClick={() => handleDeputyAction('bill')}
                         className="w-full py-2 bg-blue-600 rounded-lg text-[9px] font-black uppercase"
                       >
                         Ініціювати Законопроєкт
                       </button>
                     </div>

                     <div className="grid grid-cols-2 gap-2">
                       <button 
                          onClick={() => handleDeputyAction('vote_yes')}
                          className="py-2 bg-green-600/20 text-green-400 border border-green-500/20 text-[9px] font-black uppercase rounded-lg"
                       >
                         Голосувати: ЗА
                       </button>
                       <button 
                          onClick={() => handleDeputyAction('vote_no')}
                          className="py-2 bg-red-600/20 text-red-400 border border-red-500/20 text-[9px] font-black uppercase rounded-lg"
                       >
                         Голосувати: ПРОТИ
                       </button>
                     </div>

                     <button 
                        onClick={() => handleDeputyAction('lobby')}
                        className="w-full py-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-white/10 rounded-xl text-[10px] font-bold text-white uppercase"
                     >
                       Лобіювати інтереси бізнесу
                     </button>
                   </div>
                </div>
              </div>
            )}

            {(profile?.role === "Прем'єр-міністр" || profile?.role === "Прем'єр Міністр" || profile?.status === "Прем'єр-міністр" || profile?.status === "Прем'єр Міністр") && (
              <div className="space-y-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <HandCoins className="w-4 h-4 text-yellow-400" />
                    <p className="text-[10px] font-bold text-white uppercase">Фінансування сфер</p>
                  </div>
                  <div className="flex gap-2">
                    <select 
                      value={fundSphere}
                      onChange={(e) => setFundSphere(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none"
                    >
                      <option value="Медицина">Медицина</option>
                      <option value="Оборона">Оборона</option>
                      <option value="Освіта">Освіта</option>
                      <option value="Інфраструктура">Інфраструктура</option>
                    </select>
                    <input 
                      type="number"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none"
                    />
                  </div>
                  <button 
                    onClick={handleFund}
                    disabled={loadingAction === 'fund'}
                    className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                  >
                    Виділити Кошти
                  </button>
                </div>
              </div>
            )}

            {(profile?.role === 'Міністр фінансів' || profile?.status === 'Міністр фінансів') && (
              <div className="space-y-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ReceiptText className="w-4 h-4 text-green-400" />
                    <p className="text-[10px] font-bold text-white uppercase">Ставка Оподаткування</p>
                  </div>
                  <div className="flex gap-3 items-center">
                    <input 
                      type="range"
                      min="1"
                      max="50"
                      value={taxInput}
                      onChange={(e) => setTaxInput(e.target.value)}
                      className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-green-400"
                    />
                    <span className="text-xs font-black text-white w-8">{taxInput}%</span>
                  </div>
                  <button 
                    onClick={handleTaxChange}
                    disabled={loadingAction === 'tax'}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                  >
                    Затвердити Податок
                  </button>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4 text-ukraine-blue" />
                    <p className="text-[10px] font-bold text-white uppercase">Фінансові Санкції та Заохочення</p>
                  </div>
                  <select 
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none"
                  >
                    <option value="">Оберіть громадянина/посадовця...</option>
                    {players.map(p => (
                      <option key={p.uid} value={p.uid}>{p.firstName} {p.lastName} ({p.status || 'Цивільний'})</option>
                    ))}
                  </select>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[8px] text-text-dim uppercase font-bold px-1">Сума (₴)</label>
                      <input 
                        placeholder="1000"
                        type="number"
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-text-dim uppercase font-bold px-1">Термін (год) *Лише для штрафу</label>
                      <input 
                        placeholder="24"
                        type="number"
                        value={fineDeadline}
                        onChange={(e) => setFineDeadline(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] text-text-dim uppercase font-bold px-1">Причина дії</label>
                    <input 
                      placeholder="За плідну працю / Порушення статуту..."
                      value={bonusReason}
                      onChange={(e) => setBonusReason(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button 
                      onClick={handleBonus}
                      disabled={loadingAction !== null || !selectedPlayer || !bonusReason}
                      className="py-3 bg-green-600 hover:bg-green-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex flex-col items-center justify-center gap-1 shadow-lg shadow-green-500/10"
                    >
                      <Award className="w-3.5 h-3.5" />
                      Виплатити Премію
                    </button>
                    <button 
                      onClick={handleIssueFine}
                      disabled={loadingAction !== null || !selectedPlayer || !bonusReason}
                      className="py-3 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex flex-col items-center justify-center gap-1 shadow-lg shadow-red-500/10"
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      Виписати Штраф
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(profile?.role === 'Працівник ВФБ' || profile?.status === 'Працівник ВФБ') && (
              <div className="space-y-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <UserSearch className="w-4 h-4 text-purple-400" />
                    <p className="text-[10px] font-bold text-white uppercase">Фінансовий Аудит</p>
                  </div>
                  <select 
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none"
                  >
                    <option value="">Оберіть об'єкт розслідування...</option>
                    {players.map(p => (
                      <option key={p.uid} value={p.uid}>{p.firstName} {p.lastName} ({p.status})</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleAudit}
                    disabled={loadingAction === 'audit' || !selectedPlayer}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Search className="w-3 h-3" />
                    Тіньовий Аудит
                  </button>
                  
                  {auditResult && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-3 bg-black/40 border border-purple-500/20 rounded-xl space-y-2 mt-4"
                    >
                       <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Звіт для: {auditResult.targetName}</p>
                       <div className="space-y-1.5">
                          {auditResult.auditData.map((b: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-white/5 rounded-lg text-[10px]">
                               <span className="font-bold text-white">{b.name}</span>
                               <div className="flex items-center gap-3">
                                 <span className={`font-black ${b.evasions >= 5 ? 'text-red-500' : 'text-text-dim'}`}>
                                   Ухилення: {b.evasions}
                                 </span>
                                 <span className={b.isBlocked ? 'text-red-400' : 'text-green-400'}>
                                   {b.isBlocked ? 'Блок' : 'ОК'}
                                 </span>
                               </div>
                            </div>
                          ))}
                          {auditResult.auditData.length === 0 && <p className="text-[9px] text-text-dim italic">Бізнесів не виявлено</p>}
                       </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {(profile?.role === 'Працівник оподаткування' || profile?.status === 'Працівник оподаткування') && (
              <div className="space-y-4">
                <button 
                  onClick={handleRaid}
                  disabled={loadingAction === 'raid'}
                  className="w-full p-6 bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all group"
                >
                  <FileWarning className="w-8 h-8 text-orange-400 mb-3 mx-auto group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-black text-white uppercase tracking-widest">Провести Рейд на Бізнес</p>
                  <p className="text-[9px] text-orange-400/70 uppercase font-bold mt-1">Ризик падіння рейтингу довіри</p>
                </button>
              </div>
            )}

            {!isInGov && (
              <div className="py-12 text-center space-y-3">
                 <Lock className="w-8 h-8 text-white/20 mx-auto" />
                 <p className="text-xs text-text-dim uppercase font-black tracking-widest leading-relaxed">
                   Управління недоступне.<br/>
                   Ви не обіймаєте державну посаду.
                 </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Global Stats Info */}
        <div className="bg-card-dark border border-white/5 p-6 rounded-3xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Landmark className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Макроекономічні Показники</h3>
              <p className="text-[10px] text-text-dim uppercase tracking-widest">Жива статистика сервера</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <p className="text-[8px] font-black text-text-dim uppercase tracking-widest mb-1">Резерви</p>
                <p className="text-lg font-black text-white">₴{(countryState?.budget || 0).toLocaleString()}</p>
             </div>
             <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <p className="text-[8px] font-black text-text-dim uppercase tracking-widest mb-1">Податкова Ставка</p>
                <p className="text-lg font-black text-white">{((countryState?.taxRate || 0) * 100).toFixed(0)}%</p>
             </div>
             <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <p className="text-[8px] font-black text-text-dim uppercase tracking-widest mb-1">Довіра Народу</p>
                <p className={`text-lg font-black ${countryState?.trustRating < 20 ? 'text-red-500' : 'text-green-400'}`}>
                  {countryState?.trustRating || 0}%
                </p>
             </div>
             <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <p className="text-[8px] font-black text-text-dim uppercase tracking-widest mb-1">Наступний PayDay</p>
                <p className="text-lg font-black text-white">~15 хв</p>
             </div>
          </div>

          <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
             <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
               <AlertCircle className="w-3 h-3" /> Статус Уряду
             </h4>
             <p className="text-xs text-text-dim leading-relaxed">
               {countryState?.trustRating < 20 ? (
                 <span className="text-red-400 font-bold">УВАГА: В країні Майдани! Держава паралізована. Необхідно терміново підняти рейтинг або виділити кошти на соціалку.</span>
               ) : (
                 "Ситуація в країні стабільна. Уряд працює в штатному режимі. Протестна активність мінімальна."
               )}
             </p>
          </div>
        </div>
      </div>

      {isGovLeader && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div className="bg-card-dark border border-white/5 p-6 rounded-3xl space-y-6">
            <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-3">
              <Award className="w-5 h-5 text-ukraine-blue" />
              Соціальна Підтримка
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest mb-1 block">Сума виплати на 1 особу (₴)</label>
                <input 
                  type="number"
                  value={supportAmount}
                  onChange={(e) => setSupportAmount(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleDistribute('support')}
                  disabled={loadingAction !== null}
                  className="p-4 bg-ukraine-blue hover:bg-ukraine-blue/80 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {loadingAction === 'support' ? 'ОБРОБКА...' : 'Є-ПІДТРИМКА'}
                </button>
                <button 
                  onClick={() => handleDistribute('pension')}
                  disabled={loadingAction !== null}
                  className="p-4 bg-ukraine-yellow hover:bg-ukraine-yellow/80 text-black rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {loadingAction === 'pension' ? 'ОБРОБКА...' : 'ПЕНСІЇ'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-card-dark border border-white/5 p-6 rounded-3xl space-y-4">
             <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-3">
              <Gavel className="w-5 h-5 text-ukraine-blue" />
              Державне Управління
            </h3>
            <p className="text-xs text-text-muted font-medium">Ви як представник влади маєте право керувати державними коштами. Виплати здійснюються всім громадянам одночасно та автоматично списуються з бюджету.</p>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black text-text-dim uppercase mb-1">Прогнозовані витрати:</p>
              <p className="text-sm font-bold text-white italic">₴{(supportAmount * 10).toLocaleString()} (орієнтовно на 10 гравців)</p>
            </div>
          </div>
        </motion.div>
      )}

      {!isInGov && (
        <>
          {!canJoin ? (
            <div className="game-card p-6 md:p-10 text-center border-blue-500/20 bg-blue-500/5">
              <HelpCircle className="w-10 h-10 md:w-12 md:h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg md:text-xl font-bold mb-2 text-white">ПОТРІБЕН АВТОРИТЕТ</h3>
              <p className="text-[10px] md:text-sm text-gray-500 max-w-sm mx-auto">
                Для вступу до партії або балотування на посаду твій рейтинг має бути <span className="text-blue-400 font-bold">+15</span> або вище.
                Зараз твій рейтинг: <span className="font-bold">{profile?.socialRating}</span>
              </p>
              <div className="mt-6 p-4 bg-black/40 rounded-xl text-[10px] md:text-xs text-left inline-block w-full sm:w-auto">
                <p className="text-gray-400 font-bold mb-2 uppercase tracking-widest">Як підвищити рейтинг:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-400/80">
                  <li>Допомагайте громадянам</li>
                  <li>Працюйте на державних роботах</li>
                  <li>Сплачуйте податки вчасно</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
               <div className="game-card p-5 md:p-6 border-blue-600/30">
                 <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2 text-white">
                   <Award className="w-5 h-5 text-blue-400" /> Створити Партію
                 </h3>
                 <p className="text-[10px] md:text-xs text-gray-400 mb-6 font-mono tracking-tighter">Вартість: 800,000 ₴</p>
                 <button className="w-full py-4 ukraine-gradient text-black font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-lg shadow-blue-400/10 active:scale-95">
                   ЗАРЕЄСТРУВАТИ ПАРТІЮ
                 </button>
               </div>
               
               <div className="game-card p-5 md:p-6 border-blue-600/30">
                 <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2 text-white">
                   <Search className="w-5 h-5 text-blue-400" /> Знайти Партію
                 </h3>
                 <p className="text-[10px] md:text-xs text-gray-400 mb-6">Приєднуйтесь до політичного руху</p>
                 <button className="w-full py-4 bg-white/5 border border-blue-600/20 text-blue-400 font-black uppercase tracking-widest rounded-xl hover:bg-white/5 transition-all active:scale-95">
                   РЕЄСТР ПАРТІЙ
                 </button>
               </div>
            </div>
          )}
    
          <div className="space-y-4">
            <h3 className="text-[9px] md:text-xs font-black uppercase tracking-widest text-gray-500">Політична активність</h3>
            <div className="grid gap-3">
              <div className="game-card p-4 flex items-center justify-between opacity-50">
                 <div className="flex items-center gap-3">
                   <Gavel className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                   <div>
                      <p className="text-xs md:text-sm font-bold text-white">Вибори Президента</p>
                      <p className="text-[9px] md:text-[10px] text-gray-500">Заплановано через 3 дні</p>
                   </div>
                 </div>
                 <button className="px-3 md:px-4 py-1.5 md:py-2 bg-white/5 rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Деталі</button>
              </div>
              <div className="game-card p-4 flex items-center justify-between opacity-50">
                 <div className="flex items-center gap-3">
                   <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                   <div>
                      <p className="text-xs md:text-sm font-bold text-white">Вакансії в Службі Безпеки</p>
                      <p className="text-[9px] md:text-[10px] text-yellow-400 uppercase font-black">Секретно</p>
                   </div>
                 </div>
                 <button className="px-3 md:px-4 py-1.5 md:py-2 bg-white/5 rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Перевірка</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
