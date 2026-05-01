import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Skull, Target, Users, Zap, ShieldAlert, X, Eye, Crosshair } from 'lucide-react';
import { backend } from '../../services/backendService';
import { motion, AnimatePresence } from 'motion/react';

export const MafiaView: React.FC = () => {
  const { profile } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [mafiaActionReason, setMafiaActionReason] = useState('');
  
  const isSuperAdmin = profile?.email === 'ukrainerp67@gmail.com';
  const canJoin = isSuperAdmin || (profile && profile.socialRating <= -15);

  const isMafia = profile?.role === 'mafia' || profile?.role === 'admin' || [
    'Дон (Бос мафії)',
    'Консильєрі (Радник)',
    'Капо (Капітан)',
    'Бойовик (Силовик)'
  ].includes(profile?.status || '');

  useEffect(() => {
    let interval: any;
    
    if (isMafia) {
      const fetchData = async () => {
        try {
          const [playersList, targetList] = await Promise.all([
            backend.searchUsers(''),
            backend.getMafiaTargets()
          ]);
          setPlayers(playersList);
          setTargets(targetList);
        } catch (e) {
          console.error("Error fetching mafia data:", e);
        }
      };
      
      fetchData();
      // Polling every 5 seconds for "immediate" updates as requested
      interval = setInterval(fetchData, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMafia]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [playersList, targetList] = await Promise.all([
        backend.searchUsers(''),
        backend.getMafiaTargets()
      ]);
      setPlayers(playersList);
      setTargets(targetList);
    } finally {
      setLoading(false);
    }
  };

  const mafiaMembers = players.filter(p => p.role === 'mafia' || [
    'Дон (Бос мафії)', 'Консильєрі (Радник)', 'Капо (Капітан)', 'Бойовик (Силовик)'
  ].includes(p.status));

  const handleFireMember = async (targetId: string) => {
    if (!profile) return;
    const reason = prompt("Причина вигнання з сім'ї:");
    if (!reason) return;
    
    setLoading(true);
    const res = await backend.fireMafiaMember(profile.uid, targetId, reason);
    if (res.success) {
      alert('Гравця вигнано з сім\'ї!');
      // Refresh list
      const list = await backend.searchUsers('');
      setPlayers(list);
    } else {
      alert(`Помилка: ${(res as any).error}`);
    }
    setLoading(false);
  };

  const handleMafiaAction = async (actionType: string) => {
    if (!profile) return;
    setLoading(true);
    const res = await backend.performMafiaAction(
      profile.uid,
      actionType,
      selectedTargetId,
      mafiaActionReason
    );
    if (res.success) {
      alert(`Операцію [${actionType}] розпочато!`);
      setMafiaActionReason('');
    } else {
      alert(`Помилка: ${(res as any).error}`);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-8 text-gray-200">
      <header className="bg-gradient-to-br from-gray-900 to-black p-6 md:p-8 rounded-2xl md:rounded-3xl border border-red-900/50 relative overflow-hidden">
        <div className="relative z-10 text-center sm:text-left">
          <h2 className="text-xl md:text-3xl font-black italic tracking-tighter text-white flex items-center justify-center sm:justify-start gap-4">
            <Skull className="w-8 h-8 md:w-10 md:h-10 text-red-600" />
            ТІНЬОВИЙ СЕКТОР
          </h2>
          <p className="text-red-900 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-2 underline decoration-red-600 underline-offset-4">Тут правила диктує сила</p>
        </div>
        <Skull className="absolute -bottom-8 -right-8 w-32 md:w-48 h-32 md:h-48 text-red-900/5 rotate-12 pointer-events-none" />
      </header>

      {isMafia && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-card-dark border border-white/5 p-6 rounded-3xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-900/20 rounded-lg">
                <Skull className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Панель Управління Сім'єю</h3>
                <p className="text-[10px] text-text-dim uppercase tracking-widest">{profile?.status || profile?.role}</p>
              </div>
            </div>

            <div className="space-y-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-text-dim uppercase tracking-widest px-1">Вибір цілі операції</label>
                 <select 
                   value={selectedTargetId}
                   onChange={(e) => setSelectedTargetId(e.target.value)}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none"
                 >
                   <option value="">Оберіть ціль...</option>
                   {players.map(p => (
                     <option key={p.uid} value={p.uid}>{p.firstName} {p.lastName} (Рейтинг: {p.socialRating})</option>
                   ))}
                 </select>
               </div>

               <div className="space-y-1">
                 <label className="text-[9px] text-text-dim uppercase font-bold px-1">Опис / Деталі наказу</label>
                 <input 
                    placeholder="Наприклад: Вимагання відсотка..."
                    value={mafiaActionReason}
                    onChange={(e) => setMafiaActionReason(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
                 />
               </div>

               <div className="grid gap-2 border-t border-white/5 pt-4">
                  {(profile?.status === 'Дон (Бос мафії)' || profile?.role === 'admin') && (
                    <>
                      <button 
                        onClick={() => handleMafiaAction('money_laundering')}
                        disabled={loading}
                        className="w-full p-4 bg-yellow-600/10 hover:bg-yellow-600/20 border border-yellow-500/20 rounded-2xl text-left transition-all flex items-center gap-3"
                      >
                        <Zap className="w-5 h-5 text-yellow-400" />
                        <div>
                          <p className="text-xs font-bold text-white uppercase">Запит на відмивання</p>
                          <p className="text-[9px] text-text-dim">Легалізація брудних гривень через Банк</p>
                        </div>
                      </button>
                      <button 
                        onClick={() => handleMafiaAction('hit_order')}
                        disabled={loading || !selectedTargetId}
                        className="w-full p-4 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-2xl text-left transition-all flex items-center gap-3"
                      >
                        <Crosshair className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="text-xs font-bold text-white uppercase">Замовити Гравця</p>
                          <p className="text-[9px] text-text-dim">Блокування дій цілі на 1 ігровий цикл</p>
                        </div>
                      </button>

                      <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-2xl space-y-3">
                         <div className="flex items-center gap-2 mb-1">
                           <Users className="w-4 h-4 text-red-500" />
                           <p className="text-[10px] font-black text-white uppercase">Клан: Управління Бійцями</p>
                         </div>
                         <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                           {mafiaMembers.map(m => (
                             <div key={m.uid} className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/5">
                               <div className="flex flex-col">
                                 <span className="text-[10px] font-bold text-white">{m.firstName} {m.lastName}</span>
                                 <span className="text-[8px] text-text-dim uppercase font-bold">{m.status}</span>
                               </div>
                               <button 
                                 onClick={() => handleFireMember(m.uid)}
                                 disabled={loading}
                                 className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[8px] font-black uppercase rounded"
                               >
                                 Вигнати
                               </button>
                             </div>
                           ))}
                           {mafiaMembers.length === 0 && <p className="text-[9px] text-text-dim italic text-center">Ви один у сім'ї</p>}
                         </div>
                      </div>
                    </>
                  )}
                  {(profile?.status === 'Капо (Капітан)' || profile?.role === 'admin') && (
                    <>
                      <button 
                         onClick={() => handleMafiaAction('racketeering')}
                         disabled={loading || !selectedTargetId}
                         className="w-full p-4 bg-orange-600/10 hover:bg-orange-600/20 border border-orange-500/20 rounded-2xl text-left transition-all flex items-center gap-3"
                      >
                        <ShieldAlert className="w-5 h-5 text-orange-400" />
                        <div>
                          <p className="text-xs font-bold text-white uppercase">Кришування бізнесу</p>
                          <p className="text-[9px] text-text-dim">Встановлення регулярної данини</p>
                        </div>
                      </button>
                      <button 
                        onClick={() => handleMafiaAction('war_for_business')}
                        disabled={loading || !selectedTargetId}
                        className="w-full p-4 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-2xl text-left transition-all flex items-center gap-3"
                      >
                        <Users className="w-5 h-5 text-red-600" />
                        <div>
                          <p className="text-xs font-bold text-white uppercase">Війна за бізнес</p>
                          <p className="text-[9px] text-text-dim">Атака на сферу впливу іншої сім'ї</p>
                        </div>
                      </button>
                    </>
                  )}
                  {(profile?.status === 'Консильєрі (Радник)' || profile?.role === 'admin') && (
                    <button 
                      onClick={() => handleMafiaAction('diplomacy')}
                      disabled={loading || !selectedTargetId}
                      className="w-full p-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-2xl text-left transition-all flex items-center gap-3"
                    >
                      <Eye className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-xs font-bold text-white uppercase">Таємні Перемовини</p>
                        <p className="text-[9px] text-text-dim">Зменшення розшуку або інтриги проти ворогів</p>
                      </div>
                    </button>
                  )}
               </div>
            </div>
          </section>

          <section className="bg-card-dark border border-white/5 p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-2">
                 <Target className="w-5 h-5 text-red-600" />
                 <h3 className="text-sm font-black text-white uppercase tracking-wider">Об'єкти для рекету</h3>
               </div>
               <button 
                 onClick={handleRefresh}
                 disabled={loading}
                 className={`p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${loading ? 'animate-spin' : ''}`}
                 title="Оновити список"
               >
                 <Zap className="w-3 h-3 text-red-500" />
               </button>
            </div>
            
            <p className="text-[10px] text-text-dim uppercase tracking-widest font-bold">Бізнеси з ухиленням від податків:</p>
            
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {targets.map((target, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={`${target.ownerUid}-${target.id}`}
                  className="p-4 bg-red-900/5 border border-red-600/10 rounded-2xl hover:bg-red-900/10 transition-all group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${target.isOnline ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`} />
                        <p className="text-xs font-black text-white">{target.name}</p>
                      </div>
                      <p className="text-[9px] text-text-dim uppercase tracking-tighter">Власник: {target.ownerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-red-500">{target.evasions} ухилень</p>
                      <p className="text-[8px] text-text-dim">Система "Тінь"</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setSelectedTargetId(target.ownerUid);
                        alert(`Ціль ${target.ownerName} обрана для операції`);
                      }}
                      className="flex-1 py-1 px-2 bg-red-600/20 text-red-500 text-[8px] font-black uppercase rounded border border-red-500/20"
                    >
                      Обрати Ціль
                    </button>
                  </div>
                </motion.div>
              ))}
              {targets.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center opacity-30 text-center">
                  <Eye className="w-8 h-8 mb-2" />
                  <p className="text-[10px] italic">Усі бізнеси поки що чисті...</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {(!canJoin && !isMafia) ? (
        <div className="game-card p-6 md:p-10 text-center border-red-500/20 bg-red-500/5">
          <ShieldAlert className="w-10 h-10 md:w-12 md:h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg md:text-xl font-bold mb-2 text-white">ДОСТУП ЗАБОРОНЕНО</h3>
          <p className="text-[10px] md:text-sm text-gray-500 max-w-sm mx-auto">
            Для вступу або створення мафії твій соціальний рейтинг має бути <span className="text-red-500 font-bold">-15</span> або нижче.
            Зараз твій рейтинг: <span className="font-bold">{profile?.socialRating}</span>
          </p>
          <div className="mt-6 p-4 bg-black/40 rounded-xl text-[10px] md:text-xs text-left inline-block w-full sm:w-auto">
            <p className="text-gray-400 font-bold mb-2 uppercase tracking-widest">Як знизити рейтинг:</p>
            <ul className="list-disc list-inside space-y-1 text-red-900/80">
              <li>Порушуйте закон</li>
              <li>Працюйте на "брудних" роботах</li>
              <li>Нападайте на інкасаторів</li>
            </ul>
          </div>
        </div>
      ) : !isMafia && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
           <div className="game-card p-5 md:p-6 border-red-600/30">
             <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2 text-white">
               <Target className="w-5 h-5 text-red-600" /> Створити Клан
             </h3>
             <p className="text-[10px] md:text-xs text-gray-400 mb-6 font-mono tracking-tighter">Вартість: 800,000 ₴</p>
             <button className="w-full py-4 bg-red-600 text-black font-black uppercase tracking-widest rounded-xl hover:bg-red-500 transition-all active:scale-95">
               ЗАСНУВАТИ МАФІЮ
             </button>
           </div>
           
           <div className="game-card p-5 md:p-6 border-red-600/30">
             <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2 text-white">
               <Users className="w-5 h-5 text-red-600" /> Знайти Клан
             </h3>
             <p className="text-[10px] md:text-xs text-gray-400 mb-6">Станьте частиною існуючої сім'ї</p>
             <button className="w-full py-4 bg-white/5 border border-red-600/20 text-red-500 font-black uppercase tracking-widest rounded-xl hover:bg-white/5 transition-all active:scale-95">
               СПИСОК МАФІЙ
             </button>
           </div>
        </div>
      )}

      {!isMafia && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 opacity-40">
          {['Наркотики', 'Кришування', 'Напад на банк'].map(upgrade => (
            <div key={upgrade} className="game-card p-3 md:p-4 text-center">
              <Zap className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-2 text-red-900" />
              <p className="text-[9px] md:text-[10px] font-bold uppercase">{upgrade}</p>
              <p className="text-[7px] md:text-[8px] text-gray-600 mt-1">Доступно після вступу</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
