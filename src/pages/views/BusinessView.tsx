import React from 'react';
import { motion } from 'motion/react';
import { Building2, TrendingUp, Users, DollarSign } from 'lucide-react';

export const BusinessView: React.FC = () => {
  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl md:text-3xl font-black uppercase tracking-tighter text-white">Мій Бізнес</h2>
        <p className="text-[10px] md:text-sm font-bold text-text-muted uppercase tracking-[0.2em]">Управління вашими активами та підприємствами</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Загальний Дохід', value: '₴0', icon: DollarSign, color: 'text-green-400' },
          { label: 'Активні Бізнеси', value: '0', icon: Building2, color: 'text-ukraine-blue' },
          { label: 'Співробітники', value: '0', icon: Users, color: 'text-purple-400' },
          { label: 'Рентабельність', value: '0%', icon: TrendingUp, color: 'text-ukraine-yellow' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card-dark/40 border border-border-dark p-4 md:p-6 rounded-2xl md:rounded-3xl"
          >
            <div className={`p-2 w-fit rounded-xl bg-white/5 mb-4 ${stat.color}`}>
              <stat.icon className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{stat.label}</p>
              <h4 className="text-lg md:text-2xl font-black text-white">{stat.value}</h4>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-card-dark/40 border border-border-dark p-8 rounded-3xl flex flex-col items-center justify-center text-center gap-4 min-h-[300px]">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-2">
          <Building2 className="w-8 h-8 text-text-dim" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white uppercase tracking-tight">У вас ще немає бізнесу</h3>
          <p className="text-sm text-text-muted max-w-xs">Придбайте своє перше підприємство в магазині або через аукціон, щоб почати пасивний заробіток.</p>
        </div>
        <button className="mt-4 px-8 py-4 bg-ukraine-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg shadow-ukraine-blue/20">
          Придбати Бізнес
        </button>
      </div>
    </div>
  );
};
