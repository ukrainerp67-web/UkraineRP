import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, Gavel, Award, Search, HelpCircle, Briefcase } from 'lucide-react';

export const RadaView: React.FC = () => {
  const { profile } = useAuth();
  const canJoin = profile && profile.socialRating >= 15;

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-8 text-gray-200">
      <header className="bg-gradient-to-br from-blue-900/30 to-black p-6 md:p-8 rounded-2xl md:rounded-3xl border border-blue-500/20 relative overflow-hidden">
        <div className="relative z-10 text-center sm:text-left">
          <h2 className="text-xl md:text-3xl font-black italic tracking-tighter text-white flex items-center justify-center sm:justify-start gap-4">
            <Building2 className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
            ВЕРХОВНА РАДА УКРАЇНИ
          </h2>
          <p className="text-blue-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-2 underline decoration-yellow-400 underline-offset-4">Законотворчість та Розбудова</p>
        </div>
        <Building2 className="absolute -bottom-8 -right-8 w-32 md:w-48 h-32 md:h-48 text-blue-400/5 rotate-12 pointer-events-none" />
      </header>

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
    </div>
  );
};
