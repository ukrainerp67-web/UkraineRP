import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Skull, Target, Users, Zap, ShieldAlert } from 'lucide-react';

export const MafiaView: React.FC = () => {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.email === 'ukrainerp67@gmail.com';
  const canJoin = isSuperAdmin || (profile && profile.socialRating <= -15);

  const isMafia = profile?.role === 'mafia' || profile?.role === 'admin' || [
    'Дон (Бос мафії)',
    'Консильєрі (Радник)',
    'Капо (Капітан)',
    'Бойовик (Силовик)'
  ].includes(profile?.status || '');

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            <div className="space-y-3">
              {(profile?.status === 'Дон (Бос мафії)' || profile?.role === 'admin') && (
                <>
                  <button className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-left hover:bg-white/10 transition-all flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-xs font-bold text-white uppercase">Запит на відмивання</p>
                      <p className="text-[9px] text-text-dim">Легалізація брудних гривень через Банк</p>
                    </div>
                  </button>
                  <button className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-left hover:bg-white/10 transition-all flex items-center gap-3">
                    <Target className="w-5 h-5 text-red-400" />
                    <div>
                      <p className="text-xs font-bold text-white uppercase">Замовити гравця</p>
                      <p className="text-[9px] text-text-dim">Блокування дій цілі на 1 цикл</p>
                    </div>
                  </button>
                </>
              )}
              {(profile?.status === 'Капо (Капітан)' || profile?.role === 'admin') && (
                <>
                  <button className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-left hover:bg-white/10 transition-all flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-orange-400" />
                    <div>
                      <p className="text-xs font-bold text-white uppercase">Кришування бізнесу</p>
                      <p className="text-[9px] text-text-dim">Встановлення данини для ухилянтів</p>
                    </div>
                  </button>
                  <button className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-left hover:bg-white/10 transition-all flex items-center gap-3">
                    <Users className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-xs font-bold text-white uppercase">Війна за бізнес</p>
                      <p className="text-[9px] text-text-dim">Атака на кришу іншої мафії</p>
                    </div>
                  </button>
                </>
              )}
            </div>
            <p className="text-[10px] text-text-dim italic text-center">Використовуйте ігрові команди в чаті для виконання обов'язків</p>
          </section>

          <section className="bg-card-dark border border-white/5 p-6 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
            <Target className="w-12 h-12 text-white/5 animate-pulse" />
            <p className="text-xs text-text-dim uppercase font-black tracking-widest">Перегляд активних цілей та бізнесів...</p>
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
      ) : (
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 opacity-40">
        {['Наркотики', 'Кришування', 'Напад на банк'].map(upgrade => (
          <div key={upgrade} className="game-card p-3 md:p-4 text-center">
            <Zap className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-2 text-red-900" />
            <p className="text-[9px] md:text-[10px] font-bold uppercase">{upgrade}</p>
            <p className="text-[7px] md:text-[8px] text-gray-600 mt-1">Доступно після вступу</p>
          </div>
        ))}
      </div>
    </div>
  );
};
