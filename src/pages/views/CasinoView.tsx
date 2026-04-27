import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Dice5, CircleDot, PlayCircle, Trophy, Coins } from 'lucide-react';

const GAMES = [
  { id: 'durak', name: 'Карти Дурак', icon: PlayCircle, min: 1000, max: 1000000 },
  { id: 'roulette', name: 'Прокрут рулетки', icon: CircleDot, min: 1000, max: 1000000 },
  { id: 'slots', name: 'Прокрут Слотів', icon: Coins, min: 1000, max: 1000000 },
  { id: 'dice', name: 'Кості', icon: Dice5, min: 1000, max: 1000000 },
  { id: 'poker', name: 'Покер (Texas Holdem)', icon: Trophy, min: 1000, max: 1000000 },
];

export const CasinoView: React.FC = () => {
  const [bet, setBet] = useState(1000);

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-8">
      <header className="bg-gradient-to-br from-red-600/20 to-black p-6 md:p-8 rounded-2xl md:rounded-3xl border border-red-500/20 text-center relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl md:text-4xl font-black italic tracking-tighter text-white mb-1 md:mb-2 leading-none">GOLDEN CASINO UA</h2>
          <p className="text-red-400 text-[9px] md:text-xs font-bold uppercase tracking-widest leading-none">Азарт в межах дозволеного</p>
        </div>
        {/* Decorative chips */}
        <Coins className="absolute top-4 left-4 w-8 md:w-12 h-8 md:h-12 text-yellow-400/10 rotate-12" />
        <Dice5 className="absolute bottom-4 right-4 w-10 md:w-16 h-10 md:h-16 text-white/5 -rotate-12" />
      </header>

      <div className="game-card p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="w-full md:flex-1">
          <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-500 mb-2">Твоя ставка (₴)</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <input 
              type="number" 
              value={bet} 
              onChange={(e) => setBet(Number(e.target.value))}
              className="bg-black border border-border-dark rounded-xl px-4 py-3 w-full sm:w-48 font-black text-lg md:text-xl outline-none focus:border-red-500 text-white"
            />
            <div className="flex gap-2 w-full sm:w-auto">
              {[1000, 10000, 100000].map(val => (
                <button 
                  key={val} 
                  onClick={() => setBet(val)}
                  className="flex-1 sm:flex-none px-2 md:px-3 py-2 sm:py-1 bg-white/5 border border-white/10 rounded text-[9px] md:text-[10px] font-bold hover:bg-white/10 active:scale-95 transition-all text-white/80"
                >
                  +{val >= 1000 ? `${val/1000}k` : val}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[10px] md:text-xs text-gray-500 max-w-[200px] text-center md:text-right hidden sm:block">
          Чим більше ставка, тим більша напруга. Шанси 50/50. Грай відповідально.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {GAMES.map((game, idx) => (
          <motion.button
            key={game.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="game-card p-5 md:p-6 flex flex-col items-center justify-center gap-4 group hover:border-red-500/40 relative overflow-hidden transition-all h-56 md:h-64"
          >
            <div className="p-3 md:p-4 rounded-full bg-red-500/10 group-hover:scale-110 transition-transform">
              <game.icon className="w-10 h-10 md:w-12 md:h-12 text-red-500" />
            </div>
            <div className="text-center">
              <h3 className="font-black text-base md:text-lg text-white mb-1">{game.name}</h3>
              <p className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest">Мін: {game.min.toLocaleString()} ₴</p>
            </div>
            <div className="absolute inset-x-0 bottom-0 py-3 bg-red-600 sm:translate-y-full group-hover:translate-y-0 transition-transform">
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-black">ГРАТИ ЗА {bet.toLocaleString()} ₴</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
