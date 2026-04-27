import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Car as CarIcon, ShoppingBag, Shield, Heart, Zap, Star, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { backend } from '../../services/backendService';

const PROPERTY = [
  { id: 'app_1', name: 'Квартира в ЖК', price: 150000, type: 'property', image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800' },
  { id: 'house_1', name: 'Заміський котедж', price: 500000, type: 'property', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800' },
  { id: 'villa_1', name: 'Вілла в Конча-Заспі', price: 2000000, type: 'property', image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800' },
];

const VEHICLES = [
  { id: 'car_1', brand: 'BMW', model: 'M5 CS', price: 250000, type: 'vehicles', image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=800' },
  { id: 'car_2', brand: 'Mercedes', model: 'G63 AMG', price: 350000, type: 'vehicles', image: 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?auto=format&fit=crop&q=80&w=800' },
  { id: 'car_3', brand: 'Audi', model: 'RS7', price: 280000, type: 'vehicles', image: 'https://images.unsplash.com/photo-1606152421685-69067ce212a1?auto=format&fit=crop&q=80&w=800' },
];

const DONATIONS = [
  { id: 'rating_pos', name: 'Позитивний Рейтинг', detail: '+100 очок', price: 500, type: 'donation', icon: TrendingUp, color: 'text-green-400', amount: 100 },
  { id: 'rating_neg', name: 'Негативний Рейтинг', detail: '-100 очок', price: 500, type: 'donation', icon: TrendingDown, color: 'text-red-400', amount: -100 },
];

export const ShopView: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { sendNotification } = useNotifications();
  const [category, setCategory] = useState<'property' | 'vehicles' | 'donations'>('property');
  const [loading, setLoading] = useState(false);

  const buyRating = React.useCallback(async (amount: number, price: number) => {
    if (!profile) return;
    if (profile.balance < price) {
      alert('Недостатньо коштів на балансі!');
      return;
    }

    setLoading(true);
    try {
      const updatedProfile = {
        ...profile,
        balance: profile.balance - price,
        socialRating: profile.socialRating + amount,
        updatedAt: new Date().toISOString()
      };
      
      await backend.saveProfile(updatedProfile);
      await refreshProfile();

      await sendNotification(
        profile.uid,
        'Оновлення статусу',
        `Ви успішно придбали [${amount > 0 ? 'Позитивний' : 'Негативний'} Рейтинг] за ₴${price.toLocaleString()}`,
        'success'
      );
    } catch (error) {
      console.error('Error buying rating:', error);
      alert('Помилка при покупці');
    } finally {
      setLoading(false);
    }
  }, [profile, sendNotification, refreshProfile]);

  const currentItems = category === 'property' ? PROPERTY : category === 'vehicles' ? VEHICLES : DONATIONS;

  return (
    <div className="space-y-4 md:space-y-6 pb-24 md:pb-8">
      <header className="flex flex-col bg-card-dark p-4 md:p-6 rounded-2xl border border-border-dark gap-3 md:gap-4">
        <div>
           <h2 className="text-lg md:text-xl font-black uppercase tracking-[0.2em] text-white">Державний Магазин</h2>
           <p className="text-[9px] md:text-[10px] text-text-muted uppercase tracking-widest mt-1">Купуйте майно, транспорт або змініть свій статус</p>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar -mx-1 px-1">
          <button 
            onClick={() => setCategory('property')}
            className={`flex-1 min-w-[100px] md:min-w-[120px] px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl flex items-center justify-center gap-1.5 md:gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border ${category === 'property' ? 'bg-ukraine-blue text-white border-ukraine-blue shadow-lg shadow-ukraine-blue/20' : 'bg-secondary-dark text-text-muted border-border-dark hover:text-white'}`}
          >
            <Home className="w-3.5 h-3.5 md:w-4 md:h-4" /> Майно
          </button>
          <button 
            onClick={() => setCategory('vehicles')}
            className={`flex-1 min-w-[100px] md:min-w-[120px] px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl flex items-center justify-center gap-1.5 md:gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border ${category === 'vehicles' ? 'bg-ukraine-blue text-white border-ukraine-blue shadow-lg shadow-ukraine-blue/20' : 'bg-secondary-dark text-text-muted border-border-dark hover:text-white'}`}
          >
            <CarIcon className="w-3.5 h-3.5 md:w-4 md:h-4" /> Авто
          </button>
          <button 
            onClick={() => setCategory('donations')}
            className={`flex-1 min-w-[100px] md:min-w-[120px] px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl flex items-center justify-center gap-1.5 md:gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border ${category === 'donations' ? 'bg-yellow-600/20 text-ukraine-yellow border-ukraine-yellow shadow-lg' : 'bg-secondary-dark text-text-muted border-border-dark hover:text-white'}`}
          >
            <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4" /> Донат
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {category === 'donations' ? (
          DONATIONS.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card-dark border border-border-dark p-6 rounded-2xl flex flex-col items-center text-center gap-4 hover:border-ukraine-yellow/50 transition-colors"
            >
              <div className={`w-16 h-16 rounded-full bg-secondary-dark flex items-center justify-center border border-border-dark ${item.color}`}>
                 <item.icon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-black text-white uppercase text-sm tracking-widest">{item.name}</h3>
                <p className="text-[10px] text-text-muted font-bold mt-1">{item.detail}</p>
              </div>
              <div className="text-xl font-black text-ukraine-yellow">₴ {item.price}</div>
              <button 
                onClick={() => buyRating(item.amount, item.price)}
                disabled={loading}
                className="w-full py-4 bg-secondary-dark border border-border-dark rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ukraine-yellow hover:text-black transition-all"
              >
                {loading ? 'ОБРОБКА...' : 'ПРИДБАТИ'}
              </button>
            </motion.div>
          ))
        ) : (
          currentItems.map((item: any, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card-dark border border-border-dark rounded-2xl overflow-hidden group shadow-xl hover:border-text-muted transition-colors"
            >
              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={item.image} 
                  alt={item.name || item.model} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[20%] group-hover:grayscale-0" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-dark p-4 flex justify-between items-end">
                  <div className="bg-bg-dark/80 backdrop-blur px-3 py-1 rounded-lg border border-border-dark">
                     <span className="text-sm font-black text-ukraine-yellow">₴ {item.price.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-[#E0E0E0] mb-1">{item.name || `${item.brand} ${item.model}`}</h3>
                <p className="text-[9px] text-text-dim uppercase tracking-widest">Серія: LUXURY ASSETS 2024</p>
                <button className="w-full mt-6 py-3.5 bg-secondary-dark border border-border-dark rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-[#E0E0E0] hover:bg-ukraine-blue hover:text-white hover:border-ukraine-blue transition-all">
                  Оглянути
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
