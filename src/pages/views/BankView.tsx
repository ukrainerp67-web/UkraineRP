import React from 'react';
import { motion } from 'motion/react';
import { Landmark, ArrowUpRight, ArrowDownLeft, CreditCard, RefreshCw, Bitcoin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

export const BankView: React.FC = () => {
  const { profile } = useAuth();
  const { sendNotification } = useNotifications();
  
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
    } else {
      await sendNotification(
        profile.uid,
        'Банківська операція',
        `Запит на [${action}] прийнято в обробку.`,
        'info'
      );
    }
  };

  const actions = [
    { label: 'Депозит', icon: ArrowUpRight, desc: '4% річних в ігровій валюті', color: 'text-blue-400' },
    { label: 'Кредит', icon: ArrowDownLeft, desc: 'До 1,000,000 ₴ під 15% застави', color: 'text-red-400' },
    { label: 'Перекази', icon: CreditCard, desc: 'Переказ гравцям за ID чи Ім’ям', color: 'text-yellow-400' },
    { label: 'Обмін', icon: RefreshCw, desc: 'Курс: 1$ = 41.5 ₴ / 1€ = 45.2 ₴', color: 'text-green-400' },
  ];

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
          <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-500 mb-1">Твій баланс</p>
          <p className="text-2xl md:text-3xl font-black text-white">{profile?.balance.toLocaleString()} ₴</p>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Банківські послуги</h3>
          <div className="grid gap-3">
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
    </div>
  );
};
