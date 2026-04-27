import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, Clock, Zap, Timer, CheckCircle2, MapPin, CarFront, User, Navigation } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { backend } from '../../services/backendService';

const JOBS = [
  { id: 'taxi', name: 'Таксі', pay: 1200, time: 60, difficulty: 'Легко', minigame: 'taxi' },
  { id: 'hacker', name: 'Хакер', pay: 8000, time: 180, difficulty: 'Важко', minigame: 'sequence' },
  { id: 'pilot', name: 'Пілот', pay: 4500, time: 120, difficulty: 'Середньо', minigame: 'logic' },
  { id: 'mine', name: 'Шахта', pay: 900, time: 60, difficulty: 'Легко', minigame: 'tap' },
  { id: 'trucker', name: 'Далекобійник', pay: 3000, time: 150, difficulty: 'Середньо', minigame: 'tap' },
  { id: 'metro', name: 'Метрополітен', pay: 2000, time: 90, difficulty: 'Середньо', minigame: 'logic' },
  { id: 'builder', name: 'Будівельник', pay: 1500, time: 75, difficulty: 'Легко', minigame: 'tap' },
  { id: 'test', name: 'Тест', pay: 1000000000, time: 1, difficulty: 'Тест', minigame: 'none' },
];

export const JobsView: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { sendNotification } = useNotifications();
  const [workingJob, setWorkingJob] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [status, setStatus] = useState<'idle' | 'working' | 'minigame' | 'completing' | 'done'>('idle');
  
  // Mini-game state
  const [gameScore, setGameScore] = useState(0);
  const [gameTarget, setGameTarget] = useState(0);
  const [gameSequence, setGameSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [taxiGame, setTaxiGame] = useState<{
    carClass?: 'economy' | 'medium' | 'business';
    street?: string;
    phase: 'selecting_car' | 'selecting_street' | 'delivering';
    timeLeft?: number;
    pendingPay?: number;
  } | null>(null);

  useEffect(() => {
    let timer: any;
    if (taxiGame?.phase === 'delivering' && taxiGame.timeLeft && taxiGame.timeLeft > 0) {
      timer = setInterval(() => {
        setTaxiGame(prev => {
          if (!prev || !prev.timeLeft) return prev;
          if (prev.timeLeft <= 1) {
            clearInterval(timer);
            setStatus('completing');
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [taxiGame?.phase, taxiGame?.timeLeft]);

  useEffect(() => {
    const saved = localStorage.getItem('ua_rp_cooldowns');
    if (saved) {
      const parsed = JSON.parse(saved);
      const now = Date.now();
      const active = Object.entries(parsed).reduce((acc: Record<string, number>, [id, time]) => {
        if (typeof time === 'number' && time > now) acc[id] = time;
        return acc;
      }, {});
      setCooldowns(active);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      setCooldowns(prev => {
        const next = { ...prev };
        let changed = false;
        Object.entries(next).forEach(([id, time]) => {
          if ((time as number) <= now) {
            delete next[id];
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem('ua_rp_cooldowns', JSON.stringify(next));
          return next;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const startJob = useCallback((job: any) => {
    if (cooldowns[job.id]) return;
    setWorkingJob(job);
    setProgress(0);
    
    if (job.id === 'taxi') {
      startMiniGame(job);
      return;
    }
    
    if (job.minigame === 'none') {
      setStatus('completing');
      return;
    }

    setStatus('working');
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          startMiniGame(job);
          return 100;
        }
        return prev + (100 / job.time);
      });
    }, 1000);
  }, [cooldowns]);

  const startMiniGame = useCallback((job: any) => {
    if (job.minigame === 'none') {
      setStatus('completing');
      return;
    }
    setStatus('minigame');
    if (job.minigame === 'tap') {
      setGameScore(0);
      setGameTarget(15);
    } else if (job.minigame === 'sequence') {
      const seq = Array.from({ length: 5 }, () => Math.floor(Math.random() * 4));
      setGameSequence(seq);
      setUserSequence([]);
    } else if (job.minigame === 'taxi') {
      setTaxiGame({
        phase: 'selecting_car'
      });
    } else {
      setGameScore(0);
      setGameTarget(5);
    }
  }, []);

  const handleMiniGameAction = useCallback((type: string, value?: any) => {
    if (workingJob?.minigame === 'tap') {
      setGameScore(prev => {
        const next = prev + 1;
        if (next >= gameTarget) setStatus('completing');
        return next;
      });
    } else if (workingJob?.minigame === 'sequence') {
      setUserSequence(prev => {
        const next = [...prev, value];
        if (next[next.length - 1] !== gameSequence[next.length - 1]) {
          return []; // Reset on mistake
        } else if (next.length === gameSequence.length) {
          setStatus('completing');
        }
        return next;
      });
    } else if (workingJob?.minigame === 'logic') {
      setGameScore(prev => {
        const next = prev + 1;
        if (next >= gameTarget) setStatus('completing');
        return next;
      });
    }
  }, [workingJob, gameTarget, gameSequence]);

  const selectTaxiCar = useCallback((carClass: 'economy' | 'comfort' | 'business') => {
    let min = 0, max = 0;
    if (carClass === 'economy') { min = 500; max = 1000; }
    else if (carClass === 'comfort') { min = 800; max = 1200; }
    else if (carClass === 'business') { min = 1200; max = 2000; }
    
    const pay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTaxiGame(prev => prev ? { ...prev, carClass, phase: 'selecting_street', pendingPay: pay } : { carClass, phase: 'selecting_street', pendingPay: pay });
  }, []);

  const selectTaxiStreet = useCallback((street: string) => {
    setTaxiGame(prev => prev ? { ...prev, street, phase: 'delivering', timeLeft: 60 } : null);
  }, []);

  const taxiCars = useMemo(() => [
    { 
      id: 'economy', 
      name: 'Економ', 
      range: '500-1000₴',
      icon: <CarFront className="w-5 h-5 md:w-7 md:h-7 text-gray-400" />
    },
    { 
      id: 'comfort', 
      name: 'Комфорт Клас', 
      range: '800-1200₴',
      icon: <CarFront className="w-5 h-5 md:w-7 md:h-7 text-ukraine-blue" />
    },
    { 
      id: 'business', 
      name: 'Бізнес Клас', 
      range: '1200-2000₴',
      icon: <CarFront className="w-5 h-5 md:w-7 md:h-7 text-ukraine-yellow" />
    }
  ], []);

  const handleCollect = useCallback(async () => {
    if (!profile || !workingJob) return;
    
    try {
      const payout = (workingJob.id === 'taxi' && taxiGame?.pendingPay) ? taxiGame.pendingPay : workingJob.pay;
      
      const updatedProfile = {
        ...profile,
        balance: profile.balance + payout,
        socialRating: profile.socialRating + 5,
        updatedAt: new Date().toISOString()
      };

      await backend.saveProfile(updatedProfile);
      await refreshProfile();

      await sendNotification(
        profile.uid,
        'Робота завершена',
        `Ви успішно завершили зміну [${workingJob.name}] та отримали ₴${payout.toLocaleString()}`,
        'work'
      );

      if (workingJob.id !== 'test') {
        const nextCooldown = Date.now() + 180000; // 3 minutes cooldown
        const newCooldowns = { ...cooldowns, [workingJob.id]: nextCooldown };
        setCooldowns(newCooldowns);
        localStorage.setItem('ua_rp_cooldowns', JSON.stringify(newCooldowns));
      }

      setStatus('done');
      setTimeout(() => {
        setWorkingJob(null);
        setTaxiGame(null);
        setStatus('idle');
      }, 1500);
    } catch (error) {
      console.error('Error collecting job pay:', error);
      alert('Помилка при отриманні оплати');
    }
  }, [profile, workingJob, taxiGame, sendNotification, cooldowns, refreshProfile]);

  return (
    <div className="space-y-4 md:space-y-6 pb-24 md:pb-8">
      <header className="flex flex-col bg-card-dark p-4 md:p-6 rounded-2xl border border-border-dark gap-2">
        <h2 className="text-lg md:text-xl font-black uppercase tracking-[0.2em] text-white flex items-center gap-2 md:gap-3">
          <Briefcase className="w-5 h-5 md:w-6 md:h-6 text-ukraine-blue" />
          Біржа Праці
        </h2>
        <p className="text-[9px] md:text-[10px] text-text-muted uppercase tracking-widest leading-relaxed">Система працевлаштування. Кожна робота завершується міні-грою для підтвердження результату.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {JOBS.map((job, idx) => {
          const isCooldown = cooldowns[job.id];
          const cooldownTime = isCooldown ? Math.ceil((isCooldown - currentTime) / 1000) : 0;
          
          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-card-dark border p-5 relative overflow-hidden rounded-2xl transition-all shadow-xl ${workingJob?.id === job.id ? 'border-ukraine-blue' : 'border-border-dark'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-black text-base md:text-lg text-white mb-1">{job.name}</h3>
                  <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-secondary-dark border border-border-dark text-text-muted`}>
                    {job.difficulty}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-secondary-dark flex items-center justify-center border border-border-dark">
                  <Zap className="w-4 h-4 text-ukraine-yellow" />
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between items-center text-[11px] font-medium">
                  <span className="text-text-muted uppercase tracking-widest text-[9px]">Виплата</span>
                  <span className="text-ukraine-yellow font-black">₴{job.pay.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-medium">
                  <span className="text-text-muted uppercase tracking-widest text-[9px]">Тривалість</span>
                  <span className="text-[#E0E0E0] font-bold">{Math.floor(job.time / 60)}хв {job.time % 60}с</span>
                </div>
              </div>

              <button
                onClick={() => startJob(job)}
                disabled={!!workingJob || !!isCooldown}
                className="w-full py-4 bg-secondary-dark border border-border-dark rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-[#E0E0E0] hover:bg-ukraine-blue hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed transform active:scale-95"
              >
                {isCooldown ? `ПЕРЕЗАРЯДКА ${Math.floor(cooldownTime/60)}:${(cooldownTime%60).toString().padStart(2, '0')}` : 'РОЗПОЧАТИ'}
              </button>

              <AnimatePresence>
                {workingJob?.id === job.id && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-bg-dark/98 flex flex-col items-center justify-center p-3 md:p-6 backdrop-blur-md z-10"
                  >
                    {status === 'working' && (
                      <div className="w-full flex flex-col items-center">
                        <div className="relative mb-6">
                           <div className="absolute inset-0 bg-ukraine-blue/20 rounded-full blur-xl animate-pulse" />
                           <Timer className="w-14 h-14 text-ukraine-blue relative z-10" />
                        </div>
                        <div className="w-full bg-secondary-dark h-2 rounded-full overflow-hidden mb-6 border border-border-dark">
                          <motion.div 
                            animate={{ width: `${progress}%` }}
                            className="h-full bg-gradient-to-r from-ukraine-blue to-blue-400" 
                          />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white animate-pulse">ВИКОНАННЯ ОБОВ'ЯЗКІВ</p>
                        <p className="text-[9px] text-text-muted uppercase mt-3 tracking-widest">ЗАЛИШИЛОСЯ: {Math.ceil(job.time * (1 - progress/100))}с</p>
                      </div>
                    )}

                    {status === 'minigame' && (
                      <div className="w-full flex flex-col items-center">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-ukraine-yellow mb-6">ПІДТВЕРДЖЕННЯ РОБОТИ</h4>
                        
                        {job.minigame === 'taxi' && taxiGame && (
                          <div className="w-full flex flex-col gap-2 md:gap-4 max-h-[85vh] overflow-hidden">
                            {taxiGame.phase === 'selecting_car' && (
                              <div className="space-y-1.5 md:space-y-4 w-full max-w-sm">
                                <h5 className="text-[7.5px] md:text-[10px] font-black uppercase text-center text-ukraine-yellow tracking-[0.15em] animate-pulse">ВИБЕРІТЬ КЛАС ТАКСІ</h5>
                                
                                <div className="flex flex-col gap-0.5 md:gap-2">
                                  {taxiCars.map((car) => (
                                    <motion.button
                                      key={car.id}
                                      whileHover={{ scale: 1.01 }}
                                      whileTap={{ scale: 0.99 }}
                                      onClick={() => selectTaxiCar(car.id as any)}
                                      className="w-full bg-secondary-dark/60 border border-border-dark p-1.5 md:p-3 rounded-md md:rounded-xl flex items-center justify-between gap-1.5 hover:border-ukraine-yellow transition-all group relative overflow-hidden"
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-r from-ukraine-yellow/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                      
                                      <div className="flex items-center gap-1.5 md:gap-3 relative z-10">
                                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-sm md:rounded-lg bg-black/20 flex items-center justify-center border border-white/5 group-hover:border-ukraine-yellow/30 transition-colors shrink-0">
                                          {car.icon}
                                        </div>
                                        <div className="text-left">
                                          <h6 className="text-[8px] md:text-[12px] font-black uppercase tracking-tight text-white group-hover:text-ukraine-yellow transition-colors leading-tight">{car.name}</h6>
                                          <span className="text-[5.5px] md:text-[8px] text-text-muted font-bold block mt-0.5">{car.range}</span>
                                        </div>
                                      </div>

                                      <div className="flex flex-col items-end relative z-10 shrink-0">
                                        <div className="w-4 h-4 md:w-6 md:h-6 rounded-full border border-border-dark flex items-center justify-center text-text-muted group-hover:bg-ukraine-yellow group-hover:text-black group-hover:border-ukraine-yellow transition-all">
                                          <Navigation className="w-1.5 md:w-3" />
                                        </div>
                                      </div>
                                    </motion.button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {taxiGame.phase === 'selecting_street' && (
                              <div className="space-y-2 md:space-y-4 h-full flex flex-col">
                                <h5 className="text-[9px] md:text-[10px] font-black uppercase text-center text-text-muted tracking-[0.2em]">ВИБЕРІТЬ АДРЕСУ</h5>
                                <div className="grid grid-cols-2 md:grid-cols-2 gap-1 md:gap-3 overflow-y-auto pr-1 pb-4">
                                  {['вул. Шевченка, 12', 'пр. Незалежності, 5', 'вул. Хрещатик, 1', 'вул. Соборна, 44', 'вул. Перемоги, 18', 'пр. Свободи, 3'].map((street) => (
                                    <button
                                      key={street}
                                      onClick={() => selectTaxiStreet(street)}
                                      className="bg-secondary-dark/50 border border-border-dark py-1.5 md:py-4 px-2 md:px-5 rounded-lg md:rounded-xl text-left hover:bg-ukraine-blue/10 hover:border-ukraine-blue/50 transition-all flex items-center justify-between group"
                                    >
                                      <div className="flex items-center gap-1 md:gap-4">
                                        <div className="w-4 h-4 md:w-8 md:h-8 rounded-md md:rounded-lg bg-ukraine-yellow/20 flex items-center justify-center text-ukraine-yellow group-hover:bg-ukraine-yellow group-hover:text-black transition-all">
                                          <MapPin className="w-2.5 md:w-4" />
                                        </div>
                                        <span className="text-[7px] md:text-[10px] font-bold tracking-tighter md:tracking-wider leading-tight">{street}</span>
                                      </div>
                                      <div className="text-[6px] md:text-[8px] font-black text-ukraine-yellow opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all hidden sm:block">→</div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {taxiGame.phase === 'delivering' && (
                              <div className="flex flex-col items-center py-2 md:py-6">
                                <div className="relative mb-6 md:mb-10">
                                  <motion.div 
                                    animate={{ scale: [1, 1.05, 1], rotate: [0, 1, -1, 0] }}
                                    transition={{ repeat: Infinity, duration: 3 }}
                                    className="absolute inset-0 bg-ukraine-blue/10 rounded-full blur-[40px] md:blur-[60px]" 
                                  />
                                  <div className="w-24 h-24 xs:w-28 xs:h-28 md:w-40 md:h-40 flex items-center justify-center relative">
                                    <svg className="w-full h-full absolute -rotate-90" viewBox="0 0 100 100">
                                      <circle
                                        cx="50" cy="50" r="46"
                                        fill="none"
                                        stroke="white"
                                        strokeOpacity="0.05"
                                        strokeWidth="5 md:strokeWidth=6"
                                      />
                                      <motion.circle
                                        cx="50" cy="50" r="46"
                                        fill="none"
                                        stroke="url(#taxiGradient)"
                                        strokeWidth="5 md:strokeWidth=6"
                                        strokeLinecap="round"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: (taxiGame.timeLeft || 0) / 60 }}
                                        transition={{ duration: 1, ease: "linear" }}
                                      />
                                      <defs>
                                        <linearGradient id="taxiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                          <stop offset="0%" stopColor="#3b82f6" />
                                          <stop offset="100%" stopColor="#fbbf24" />
                                        </linearGradient>
                                      </defs>
                                    </svg>
                                    <div className="text-center z-10">
                                      <span className="text-2xl md:text-5xl font-black tabular-nums tracking-tighter text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                        {taxiGame.timeLeft}
                                      </span>
                                      <div className="text-[6px] md:text-[8px] text-text-muted font-black uppercase tracking-[0.3em] mt-1">секунд</div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="w-full max-w-sm space-y-3 md:space-y-4">
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3 md:p-5 bg-secondary-dark/80 border border-border-dark rounded-xl md:rounded-2xl flex items-center gap-3 md:gap-4 backdrop-blur-md relative overflow-hidden"
                                  >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-ukraine-yellow" />
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-ukraine-yellow/20 flex items-center justify-center">
                                      <Navigation className="w-4 h-4 md:w-5 md:h-5 text-ukraine-yellow animate-pulse" />
                                    </div>
                                    <div>
                                      <div className="text-[7px] md:text-[8px] text-text-muted font-black uppercase tracking-widest mb-0.5 md:mb-1">МАРШРУТ</div>
                                      <div className="text-[10px] md:text-[12px] font-black text-white">{taxiGame.street}</div>
                                    </div>
                                  </motion.div>
                                  
                                  <div className="flex items-center justify-center gap-2 md:gap-3">
                                    <div className="h-[1px] md:h-[2px] w-6 md:w-8 bg-gradient-to-r from-transparent to-ukraine-blue/50" />
                                    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-ukraine-blue animate-pulse text-center">ВИКОНАННЯ ЗАМОВЛЕННЯ</span>
                                    <div className="h-[1px] md:h-[2px] w-6 md:w-8 bg-gradient-to-l from-transparent to-ukraine-blue/50" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {job.minigame === 'tap' && (
                          <div className="flex flex-col items-center gap-6">
                            <p className="text-[9px] text-text-muted uppercase tracking-widest text-center">Швидко натискайте на кнопку!</p>
                            <button 
                              onClick={() => handleMiniGameAction('tap')}
                              className="w-24 h-24 rounded-full bg-ukraine-blue flex items-center justify-center text-white font-black text-xl shadow-lg active:scale-90 transition-transform select-none"
                            >
                              {gameTarget - gameScore}
                            </button>
                            <div className="w-full h-1 bg-secondary-dark rounded-full overflow-hidden">
                               <div className="h-full bg-white transition-all" style={{ width: `${(gameScore/gameTarget)*100}%` }} />
                            </div>
                          </div>
                        )}

                        {job.minigame === 'sequence' && (
                          <div className="grid grid-cols-2 gap-3 w-full max-w-[200px]">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <button
                                key={i}
                                onClick={() => handleMiniGameAction('sequence', i)}
                                className={`h-16 rounded-xl border-2 flex items-center justify-center font-black transition-all active:scale-95 ${
                                  userSequence.includes(i) ? 'bg-ukraine-blue border-ukraine-blue text-white' : 'bg-secondary-dark border-border-dark text-text-dim'
                                }`}
                              >
                                {i + 1}
                              </button>
                            ))}
                            <div className="col-span-2 text-center mt-4">
                               <p className="text-[8px] text-text-muted uppercase tracking-widest">Введіть послідовність: {userSequence.length}/{gameSequence.length}</p>
                            </div>
                          </div>
                        )}

                        {job.minigame === 'logic' && (
                          <div className="flex flex-col items-center gap-6">
                            <p className="text-[9px] text-text-muted uppercase tracking-widest text-center">Вирішіть {gameTarget - gameScore} завдань</p>
                            <div className="w-full grid grid-cols-2 gap-4">
                               <button 
                                onClick={() => handleMiniGameAction('logic')}
                                className="h-20 rounded-xl bg-secondary-dark border border-border-dark flex items-center justify-center text-[10px] font-black uppercase tracking-widest hover:border-ukraine-blue"
                               >
                                OK
                               </button>
                               <button 
                                onClick={() => {}}
                                className="h-20 rounded-xl bg-secondary-dark border border-border-dark flex items-center justify-center text-[10px] font-black uppercase tracking-widest opacity-30 cursor-not-allowed"
                               >
                                NO
                               </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {status === 'completing' && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center"
                      >
                         <div className="w-20 h-20 bg-green-400/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-10 h-10 text-green-400" />
                         </div>
                         <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">ЗАВДАННЯ ВИКОНАНО!</h3>
                         <button 
                          onClick={handleCollect}
                          className="w-full py-4 bg-ukraine-yellow text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-ukraine-yellow/20 active:scale-95 transition-transform"
                        >
                          ОТРИМАТИ ₴{((workingJob.id === 'taxi' && taxiGame?.pendingPay) ? taxiGame.pendingPay : workingJob.pay).toLocaleString()}
                        </button>
                      </motion.div>
                    )}

                    {status === 'done' && (
                      <div className="text-center font-black text-green-400 uppercase tracking-widest animate-bounce">
                         ГОТОВО! ₴{((workingJob.id === 'taxi' && taxiGame?.pendingPay) ? taxiGame.pendingPay : workingJob.pay).toLocaleString()} НА РАХУНКУ
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
