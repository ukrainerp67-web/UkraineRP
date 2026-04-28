import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, Clock, Zap, Timer, CheckCircle2, MapPin, CarFront, User, Navigation } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { backend } from '../../services/backendService';

const JOBS = [
  { id: 'taxi', name: 'Таксі', pay: 1200, time: 60, difficulty: 'Легко', minigame: 'taxi' },
  { id: 'hacker', name: 'Хакер', pay: 8000, time: 180, difficulty: 'Важко', minigame: 'sequence' },
  { id: 'pilot', name: 'Пілот', pay: 4500, time: 120, difficulty: 'Середньо', minigame: 'pilot' },
  { id: 'mine', name: 'Шахта', pay: 900, time: 60, difficulty: 'Легко', minigame: 'mine' },
  { id: 'trucker', name: 'Далекобійник', pay: 3000, time: 150, difficulty: 'Середньо', minigame: 'trucker' },
  { id: 'metro', name: 'Метрополітен', pay: 2000, time: 90, difficulty: 'Середньо', minigame: 'metro' },
  { id: 'builder', name: 'Будівельник', pay: 1500, time: 75, difficulty: 'Легко', minigame: 'builder' },
];

export const JobsView: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { sendNotification } = useNotifications();
  const [workingJob, setWorkingJob] = useState<any>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [status, setStatus] = useState<'idle' | 'working' | 'minigame' | 'completing' | 'done' | 'failed'>('idle');
  
  // Mini-game state
  const [mineDepth, setMineDepth] = useState(0);
  const [mineMultiplier, setMineMultiplier] = useState(1);
  const [pilotStep, setPilotStep] = useState(0);
  const [pilotFailureMessage, setPilotFailureMessage] = useState('');
  const [gameScore, setGameScore] = useState(0);
  const [gameTarget, setGameTarget] = useState(0);
  const [gameSequence, setGameSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [minigameTimer, setMinigameTimer] = useState<number | null>(null);
  const [metroGame, setMetroGame] = useState<{
    step: number;
    hasOncoming: boolean;
    currentStation: string;
    nextStation: string;
    warningTime: number | null;
  } | null>(null);
  const [builderGame, setBuilderGame] = useState<{
    floors: number;
    weight: number;
    strength: number;
    history: string[];
  } | null>(null);
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
    let timer: any;
    if (status === 'minigame' && workingJob?.id === 'trucker' && minigameTimer !== null && minigameTimer > 0) {
      timer = setInterval(() => {
        setMinigameTimer(prev => {
          if (prev === null || prev <= 0.1) {
            clearInterval(timer);
            setPilotFailureMessage("Ви потрапили в ДТП! Сонливість за кермом призвела до аварії.");
            setStatus('failed');
            if (workingJob) {
              const nextCooldown = Date.now() + 180000;
              setCooldowns(curr => {
                const updated = { ...curr, [workingJob.id]: nextCooldown };
                localStorage.setItem('ua_rp_cooldowns', JSON.stringify(updated));
                return updated;
              });
            }
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
    }
    
    // Metro Emergency Timer Logic
    if (status === 'minigame' && workingJob?.minigame === 'metro' && metroGame?.hasOncoming && metroGame.warningTime !== null) {
      timer = setInterval(() => {
        setMetroGame(prev => {
          if (!prev || prev.warningTime === null) return prev;
          if (prev.warningTime <= 0.1) {
             clearInterval(timer);
             setPilotFailureMessage("Ви зіткнулися із зустрічним потягом! Потрібно було вчасно загальмувати.");
             setStatus('failed');
             if (workingJob) {
               const nextCooldown = Date.now() + 180000;
               setCooldowns(curr => {
                 const updated = { ...curr, [workingJob.id]: nextCooldown };
                 localStorage.setItem('ua_rp_cooldowns', JSON.stringify(updated));
                 return updated;
               });
             }
             return { ...prev, warningTime: 0 };
          }
          return { ...prev, warningTime: prev.warningTime - 0.1 };
        });
      }, 100);
    }

    return () => clearInterval(timer);
  }, [status, workingJob, minigameTimer, metroGame?.hasOncoming, metroGame?.warningTime]);

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
    } else if (job.minigame === 'pilot') {
      setPilotStep(0);
      setPilotFailureMessage('');
    } else if (job.minigame === 'mine') {
      setMineDepth(1);
      setMineMultiplier(1);
    } else if (job.minigame === 'metro') {
      setMetroGame({
        step: 0,
        hasOncoming: false,
        currentStation: 'Центральна',
        nextStation: 'Арсенальна',
        warningTime: null
      });
    } else if (job.minigame === 'builder') {
      setBuilderGame({
        floors: 0,
        weight: 0,
        strength: 35,
        history: []
      });
    } else if (job.minigame === 'trucker') {
      setGameScore(0);
      setGameTarget(20);
      setMinigameTimer(5); // 5 seconds to tap 20 times
    } else {
      setGameScore(0);
      setGameTarget(5);
    }
  }, []);

  const startJob = useCallback((job: any) => {
    if (cooldowns[job.id]) return;
    setWorkingJob(job);
    
    if (job.minigame === 'none') {
      setStatus('completing');
      return;
    }

    startMiniGame(job);
  }, [cooldowns, startMiniGame]);

  const handleMiniGameAction = useCallback((type: string, value?: any) => {
    if (status !== 'minigame') return;

    const currentJob = workingJob;
    if (!currentJob) return;

    if (currentJob.minigame === 'tap') {
      setGameScore(prev => {
        const next = prev + 1;
        if (next >= gameTarget) setStatus('completing');
        return next;
      });
    } else if (currentJob.minigame === 'trucker') {
      setGameScore(prev => {
        const next = prev + 1;
        if (next >= gameTarget) {
          setMinigameTimer(null);
          setStatus('completing');
        }
        return next;
      });
    } else if (currentJob.minigame === 'sequence') {
      setUserSequence(prev => {
        const next = [...prev, value];
        if (next[next.length - 1] !== gameSequence[next.length - 1]) {
          return [];
        } else if (next.length === gameSequence.length) {
          setStatus('completing');
        }
        return next;
      });
    } else if (currentJob.minigame === 'pilot') {
      const correctAnswers = [1, 2, 0];
      if (Number(value) === correctAnswers[pilotStep]) {
        if (pilotStep >= 2) {
          setStatus('completing');
        } else {
          setPilotStep(prev => prev + 1);
        }
      } else {
        const failureMessages = [
          "Ви не скинули паливо, і літак став занадто важким для маневру!",
          "Без закрилок літак втратив підйомну силу і зіткнувся з землею!",
          "Ви не потягнули штурвал, і літак врізався у смугу на посадці!"
        ];
        setPilotFailureMessage(failureMessages[pilotStep]);
        setStatus('failed');
        const nextCooldown = Date.now() + 180000;
        setCooldowns(prev => {
          const next = { ...prev, [currentJob.id]: nextCooldown };
          localStorage.setItem('ua_rp_cooldowns', JSON.stringify(next));
          return next;
        });
      }
    } else if (currentJob.minigame === 'mine') {
      if (type === 'mine_deeper') {
        const nextDepth = mineDepth + 1;
        if (Math.random() < 0.5) {
          setPilotFailureMessage("Стався завал! Ви дивом врятувалися, але весь видобуток залишився під завалами.");
          setStatus('failed');
          const nextCooldown = Date.now() + 180000;
          setCooldowns(prev => {
            const next = { ...prev, [currentJob.id]: nextCooldown };
            localStorage.setItem('ua_rp_cooldowns', JSON.stringify(next));
            return next;
          });
        } else {
          if (nextDepth > 5) {
            setStatus('completing');
          } else {
            setMineDepth(nextDepth);
            const randomBonus = 0.4 + (Math.random() * 0.4);
            setMineMultiplier(prev => prev + randomBonus);
          }
        }
      } else if (type === 'mine_collect') {
        setStatus('completing');
      }
    } else if (currentJob.minigame === 'metro') {
        const stations = ['Центральна', 'Арсенальна', 'Вокзальна', 'Театральна', 'Парк'];
        if (type === 'brake') {
          setMetroGame(prev => {
            if (!prev || !prev.hasOncoming) return prev;
            const nextStep = prev.step + 1;
            if (nextStep >= 3) {
              setStatus('completing');
              return { ...prev, hasOncoming: false, warningTime: null, step: nextStep };
            }
            const nextIdx = Math.min(nextStep, stations.length - 2);
            return {
              ...prev,
              step: nextStep,
              currentStation: stations[nextIdx],
              nextStation: stations[nextIdx + 1],
              hasOncoming: Math.random() < 0.4,
              warningTime: null 
            };
          });
        } else if (type === 'left' || type === 'right') {
           setMetroGame(prev => {
              if (!prev) return null;
              if (prev.hasOncoming) {
                setPilotFailureMessage("Ви зіткнулися із зустрічним потягом! Потрібно було гальмувати.");
                setStatus('failed');
                const nextCooldown = Date.now() + 180000;
                setCooldowns(curr => {
                  const updated = { ...curr, [currentJob.id]: nextCooldown };
                  localStorage.setItem('ua_rp_cooldowns', JSON.stringify(updated));
                  return updated;
                });
                return prev;
              }
              const nextStep = prev.step + 1;
              if (nextStep >= 3) {
                setStatus('completing');
                return { ...prev, step: nextStep };
              }
              const nextOncoming = Math.random() < 0.4;
              return {
                ...prev,
                step: nextStep,
                currentStation: stations[nextStep],
                nextStation: stations[nextStep + 1],
                hasOncoming: nextOncoming,
                warningTime: nextOncoming ? 2.5 : null
              }
           });
        }
    } else if (currentJob.minigame === 'builder') {
        const brickWeight = 12;
        const brickStrength = 8;
        const woodWeight = 5;
        const woodStrength = 2;
        const concreteWeight = 20;
        const concreteStrength = 18;

        setBuilderGame(prev => {
            if (!prev) return null;
            
            let w = 0, s = 0;
            if (type === 'brick') { w = brickWeight; s = brickStrength; }
            else if (type === 'wood') { w = woodWeight; s = woodStrength; }
            else if (type === 'concrete') { w = concreteWeight; s = concreteStrength; }

            const nextWeight = prev.weight + w;
            const nextStrength = prev.strength + s;
            const nextFloors = prev.floors + 1;
            const nextHistory = [...prev.history, type];

            if (nextWeight > prev.strength) {
                setPilotFailureMessage("Будинок рухнув! Конструкція не витримала ваги поверхів.");
                setStatus('failed');
                const nextCooldown = Date.now() + 180000;
                setCooldowns(curr => {
                    const updated = { ...curr, [currentJob.id]: nextCooldown };
                    localStorage.setItem('ua_rp_cooldowns', JSON.stringify(updated));
                    return updated;
                });
                return prev;
            }

            if (nextFloors >= 6) {
                setStatus('completing');
            }

            return {
                ...prev,
                weight: nextWeight,
                strength: nextStrength,
                floors: nextFloors,
                history: nextHistory
            };
        });
    } else if (currentJob.minigame === 'logic') {
      setGameScore(prev => {
        const next = prev + 1;
        if (next >= gameTarget) setStatus('completing');
        return next;
      });
    }
  }, [status, workingJob, gameTarget, gameSequence, pilotStep, mineDepth, cooldowns, metroGame, builderGame, taxiGame, userSequence, gameScore, mineMultiplier]);


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
      let payout = (workingJob.id === 'taxi' && taxiGame?.pendingPay) ? taxiGame.pendingPay : workingJob.pay;
      
      if (workingJob.minigame === 'mine') {
        payout = Math.floor(payout * mineMultiplier);
      }
      
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

      const nextCooldown = Date.now() + 180000; // 3 minutes cooldown
      const newCooldowns = { ...cooldowns, [workingJob.id]: nextCooldown };
      setCooldowns(newCooldowns);
      localStorage.setItem('ua_rp_cooldowns', JSON.stringify(newCooldowns));

      setStatus('done');
      setTimeout(() => {
        setWorkingJob(null);
        setTaxiGame(null);
        setMetroGame(null);
        setBuilderGame(null);
        setGameScore(0);
        setPilotStep(0);
        setMineDepth(0);
        setMineMultiplier(1);
        setMinigameTimer(null);
        setStatus('idle');
      }, 1500);
    } catch (error) {
      console.error('Error collecting job pay:', error);
      alert('Помилка при отриманні оплати');
    }
  }, [profile, workingJob, taxiGame, sendNotification, cooldowns, refreshProfile, mineMultiplier]);

  return (
    <div className="space-y-3 md:space-y-5 pb-20 md:pb-6">
      <header className="flex flex-col bg-card-dark p-2.5 md:p-4 rounded-2xl border border-border-dark gap-1">
        <h2 className="text-sm md:text-base font-black uppercase tracking-[0.2em] text-white flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 md:w-4.5 h-4.5 text-ukraine-blue" />
          Біржа Праці
        </h2>
        <p className="text-[7.5px] md:text-[8.5px] text-text-muted uppercase tracking-widest leading-tight">Система працевлаштування. Кожна робота завершується міні-грою.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-3.5">
        {JOBS.map((job, idx) => {
          const isCooldown = cooldowns[job.id];
          const cooldownTime = isCooldown ? Math.ceil((isCooldown - currentTime) / 1000) : 0;
          
          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-card-dark border p-3 md:p-4 relative overflow-hidden rounded-2xl transition-all shadow-xl ${workingJob?.id === job.id ? 'border-ukraine-blue min-h-[280px]' : 'border-border-dark'}`}
            >
              <div className="flex justify-between items-start mb-2.5">
                <div>
                  <h3 className="font-black text-xs md:text-sm text-white mb-0.5">{job.name}</h3>
                  <span className={`text-[6.5px] md:text-[7.5px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border transition-colors ${
                    job.difficulty === 'Легко' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    job.difficulty === 'Середньо' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                    job.difficulty === 'Важко' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    'bg-secondary-dark border-border-dark text-text-muted'
                  }`}>
                    {job.difficulty}
                  </span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-secondary-dark flex items-center justify-center border border-border-dark">
                  <Zap className="w-3 h-3 text-ukraine-yellow" />
                </div>
              </div>

              <div className="space-y-1 mb-3">
                <div className="flex justify-between items-center text-[9px] font-medium">
                  <span className="text-text-muted uppercase tracking-widest text-[7.5px]">Виплата</span>
                  <span className="text-ukraine-yellow font-black">₴{job.pay.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => startJob(job)}
                disabled={!!workingJob || !!isCooldown}
                className="w-full py-2.5 bg-secondary-dark border border-border-dark rounded-xl text-[8.5px] font-black uppercase tracking-[0.2em] text-[#E0E0E0] hover:bg-ukraine-blue hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed transform active:scale-95"
              >
                {isCooldown ? `${Math.floor(cooldownTime/60)}:${(cooldownTime%60).toString().padStart(2, '0')}` : 'ПОЧАТИ'}
              </button>

              <AnimatePresence>
                {workingJob?.id === job.id && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-bg-dark/98 flex flex-col items-center justify-center p-0.5 md:p-1.5 backdrop-blur-md z-10"
                  >
                    {status === 'minigame' && (
                      <div className="w-full flex flex-col items-center text-center px-1">
                        <h4 className="text-[6.5px] font-black uppercase tracking-[0.2em] text-ukraine-yellow mb-0.5">ПІДТВЕРДЖЕННЯ</h4>
                        
                        {job.minigame === 'taxi' && taxiGame && (
                          <div className="w-full flex flex-col gap-1.5 md:gap-3 max-h-[85vh] overflow-hidden">
                            {taxiGame.phase === 'selecting_car' && (
                              <div className="space-y-1 md:space-y-3 w-full max-w-sm">
                                <h5 className="text-[7px] md:text-[9px] font-black uppercase text-center text-ukraine-yellow tracking-[0.15em] animate-pulse">ВИБЕРІТЬ КЛАС</h5>
                                
                                <div className="flex flex-col gap-0.5 md:gap-1.5">
                                  {taxiCars.map((car) => (
                                    <motion.button
                                      key={car.id}
                                      whileHover={{ scale: 1.01 }}
                                      whileTap={{ scale: 0.99 }}
                                      onClick={() => selectTaxiCar(car.id as any)}
                                      className="w-full bg-secondary-dark/60 border border-border-dark p-1 md:p-2 rounded-md md:rounded-lg flex items-center justify-between gap-1 hover:border-ukraine-yellow transition-all group relative overflow-hidden"
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-r from-ukraine-yellow/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                      
                                      <div className="flex items-center gap-1 md:gap-2 relative z-10">
                                        <div className="w-5 h-5 md:w-7 md:h-7 rounded-sm md:rounded-lg bg-black/20 flex items-center justify-center border border-white/5 group-hover:border-ukraine-yellow/30 transition-colors shrink-0">
                                          {car.icon}
                                        </div>
                                        <div className="text-left">
                                          <h6 className="text-[7.5px] md:text-[10px] font-black uppercase tracking-tight text-white group-hover:text-ukraine-yellow transition-colors leading-tight">{car.name}</h6>
                                          <span className="text-[5px] md:text-[7px] text-text-muted font-bold block mt-0.5">{car.range}</span>
                                        </div>
                                      </div>

                                      <div className="flex flex-col items-end relative z-10 shrink-0">
                                        <div className="w-3.5 h-3.5 md:w-5 md:h-5 rounded-full border border-border-dark flex items-center justify-center text-text-muted group-hover:bg-ukraine-yellow group-hover:text-black group-hover:border-ukraine-yellow transition-all">
                                          <Navigation className="w-1 md:w-2.5" />
                                        </div>
                                      </div>
                                    </motion.button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {taxiGame.phase === 'selecting_street' && (
                              <div className="space-y-1 md:space-y-3 h-full flex flex-col">
                                <h5 className="text-[8px] md:text-[9px] font-black uppercase text-center text-text-muted tracking-[0.2em]">ВИБЕРІТЬ АДРЕСУ</h5>
                                <div className="grid grid-cols-2 gap-1 overflow-y-auto pr-1 pb-2">
                                  {['вул. Шевченка, 12', 'пр. Незалежності, 5', 'вул. Хрещатик, 1', 'вул. Соборна, 44', 'вул. Перемоги, 18', 'пр. Свободи, 3'].map((street) => (
                                    <button
                                      key={street}
                                      onClick={() => selectTaxiStreet(street)}
                                      className="bg-secondary-dark/50 border border-border-dark py-1 md:py-3 px-1.5 md:px-4 rounded-lg text-left hover:bg-ukraine-blue/10 hover:border-ukraine-blue/50 transition-all flex items-center justify-between group"
                                    >
                                      <div className="flex items-center gap-1 md:gap-3">
                                        <div className="w-3.5 h-3.5 md:w-7 md:h-7 rounded-md bg-ukraine-yellow/20 flex items-center justify-center text-ukraine-yellow group-hover:bg-ukraine-yellow group-hover:text-black transition-all">
                                          <MapPin className="w-2 md:w-3.5" />
                                        </div>
                                        <span className="text-[6.5px] md:text-[9px] font-bold tracking-tighter leading-tight">{street}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {taxiGame.phase === 'delivering' && (
                              <div className="flex flex-col items-center py-1 md:py-4">
                                <div className="relative mb-4 md:mb-8">
                                  <motion.div 
                                    animate={{ scale: [1, 1.05, 1], rotate: [0, 1, -1, 0] }}
                                    transition={{ repeat: Infinity, duration: 3 }}
                                    className="absolute inset-0 bg-ukraine-blue/10 rounded-full blur-[30px] md:blur-[50px]" 
                                  />
                                  <div className="w-20 h-20 xs:w-24 xs:h-24 md:w-36 md:h-36 flex items-center justify-center relative">
                                    <svg className="w-full h-full absolute -rotate-90" viewBox="0 0 100 100">
                                      <circle
                                        cx="50" cy="50" r="46"
                                        fill="none"
                                        stroke="white"
                                        strokeOpacity="0.05"
                                        strokeWidth="4"
                                      />
                                      <motion.circle
                                        cx="50" cy="50" r="46"
                                        fill="none"
                                        stroke="url(#taxiGradient)"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: (taxiGame.timeLeft || 0) / 60 }}
                                        transition={{ duration: 1, ease: "linear" }}
                                      />
                                    </svg>
                                    <div className="text-center z-10">
                                      <span className="text-xl md:text-4xl font-black tabular-nums tracking-tighter text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                                        {taxiGame.timeLeft}
                                      </span>
                                      <div className="text-[5px] md:text-[7px] text-text-muted font-black uppercase tracking-[0.3em] mt-0.5">сек</div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="w-full max-w-[280px] space-y-2 md:space-y-3">
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-2 md:p-4 bg-secondary-dark/80 border border-border-dark rounded-xl flex items-center gap-2 md:gap-3 backdrop-blur-md relative overflow-hidden"
                                  >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-ukraine-yellow" />
                                    <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg bg-ukraine-yellow/20 flex items-center justify-center">
                                      <Navigation className="w-3.5 h-3.5 md:w-4 md:h-4 text-ukraine-yellow animate-pulse" />
                                    </div>
                                    <div>
                                      <div className="text-[6.5px] md:text-[7.5px] text-text-muted font-black uppercase tracking-widest leading-none">МАРШРУТ</div>
                                      <div className="text-[9px] md:text-[11px] font-black text-white">{taxiGame.street}</div>
                                    </div>
                                  </motion.div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {job.minigame === 'pilot' && (
                          <div className="w-full space-y-1.5">
                            <div className="bg-black/40 p-1.5 rounded-xl border border-white/5 text-center min-h-[36px] flex items-center justify-center">
                               <p className="text-[6.5px] md:text-[7.5px] text-[#E0E0E0] leading-tight font-medium italic">
                                  {pilotStep === 0 && "КРИТИЧНО: Паливні баки перегріті! Літак занадто важкий."}
                                  {pilotStep === 1 && "УВАГА: Швидкість занадто висока! Збільшіть підйомну силу."}
                                  {pilotStep === 2 && "ФІНАЛ: Посадка. Вирівняйте ніс літака перед торканням!"}
                               </p>
                            </div>

                            <div className="grid grid-cols-1 gap-0.5">
                               <button 
                                onClick={() => handleMiniGameAction('pilot', 0)}
                                className="py-1.5 bg-secondary-dark border border-border-dark rounded-lg text-[7px] font-black uppercase tracking-widest text-white hover:border-ukraine-blue transition-all active:scale-[0.98]"
                               >
                                Тягнути штурвал
                               </button>
                               <button 
                                onClick={() => handleMiniGameAction('pilot', 1)}
                                className="py-1.5 bg-secondary-dark border border-border-dark rounded-lg text-[7px] font-black uppercase tracking-widest text-white hover:border-ukraine-blue transition-all active:scale-[0.98]"
                               >
                                Скинути паливо
                               </button>
                               <button 
                                onClick={() => handleMiniGameAction('pilot', 2)}
                                className="py-1.5 bg-secondary-dark border border-border-dark rounded-lg text-[7px] font-black uppercase tracking-widest text-white hover:border-ukraine-blue transition-all active:scale-[0.98]"
                               >
                                Випустити закрилки
                               </button>
                            </div>
                            <div className="flex justify-center gap-1">
                               {[0, 1, 2].map(i => (
                                 <div key={i} className={`h-0.5 w-3 rounded-full ${i <= pilotStep ? 'bg-ukraine-blue' : 'bg-secondary-dark border border-border-dark'}`} />
                               ))}
                            </div>
                          </div>
                        )}

                        {job.minigame === 'mine' && (
                          <div className="w-full space-y-1">
                            <div className="bg-black/40 p-1 rounded-xl border border-white/5 text-center min-h-[30px] flex flex-col items-center justify-center">
                               <p className="text-[7px] font-black text-ukraine-yellow uppercase tracking-widest leading-none">ГЛИБИНА: {mineDepth}/5</p>
                               <p className="text-[6px] text-[#E0E0E0] uppercase tracking-widest font-bold mt-0.5">
                                   Видобуток: <span className="text-ukraine-blue font-black">₴{Math.floor(job.pay * mineMultiplier).toLocaleString()}</span>
                               </p>
                            </div>

                            <div className="grid grid-cols-1 gap-0.5">
                               <button 
                                onClick={() => handleMiniGameAction('mine_deeper')}
                                className="py-1 bg-secondary-dark border border-border-dark rounded text-[6px] font-black uppercase tracking-widest text-white hover:border-ukraine-blue transition-all active:scale-[0.98] flex items-center justify-center gap-1"
                               >
                                ⛏️ Копати далі
                               </button>
                               <button 
                                onClick={() => handleMiniGameAction('mine_collect')}
                                className="py-1 bg-ukraine-blue text-white rounded text-[6px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-[0.98] flex items-center justify-center gap-1 shadow-lg shadow-blue-600/20"
                               >
                                💰 Забрати гроші
                               </button>
                            </div>

                            <div className="flex justify-center gap-0.5 mt-0.5">
                               {[1, 2, 3, 4, 5].map(i => (
                                 <div key={i} className={`h-0.5 w-2 rounded-full ${i <= mineDepth ? 'bg-ukraine-yellow' : 'bg-secondary-dark border border-border-dark/50'}`} />
                               ))}
                            </div>

                            {mineDepth > 1 && (
                              <p className="text-[6px] text-red-500 uppercase tracking-widest text-center font-black animate-pulse leading-none pt-0.5">
                                РИЗИК ОБВАЛУ!
                              </p>
                            )}
                          </div>
                        )}

                        {job.minigame === 'trucker' && (
                          <div className="flex flex-col items-center gap-3 w-full">
                            <p className="text-[7.5px] text-text-muted uppercase tracking-widest text-center">Випийте каву, щоб не заснути!</p>
                            <button 
                               onClick={() => handleMiniGameAction('trucker')}
                               className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-orange-900 border-2 border-orange-200 flex items-center justify-center text-white font-black text-xl md:text-2xl shadow-lg active:scale-90 transition-transform select-none relative overflow-hidden"
                            >
                               <div className="absolute bottom-0 left-0 right-0 bg-orange-200/20 transition-all duration-300" style={{ height: `${(gameScore/gameTarget)*100}%` }} />
                               <span className="relative z-10">☕</span>
                            </button>
                            <div className="w-full space-y-1 mt-1">
                               <p className="text-[6px] text-text-muted uppercase tracking-widest text-center">Залишилось часу</p>
                               <div className="w-full h-1 bg-secondary-dark rounded-full overflow-hidden">
                                 <div 
                                   className={`h-full transition-all duration-100 ${minigameTimer && minigameTimer < 2 ? 'bg-red-500' : 'bg-ukraine-yellow'}`} 
                                   style={{ width: `${((minigameTimer || 0) / 5) * 100}%` }} 
                                 />
                               </div>
                            </div>
                          </div>
                        )}

                         {job.minigame === 'metro' && metroGame && (
                          <div className="flex flex-col items-center gap-3 w-full">
                            <p className="text-[7.5px] text-text-muted uppercase tracking-widest text-center">Проведіть потяг безпечно</p>
                            
                            <div className="bg-black/40 p-2 md:p-3 rounded-xl border border-white/5 w-full flex flex-col items-center min-h-[60px] justify-center relative overflow-hidden">
                              {metroGame.hasOncoming ? (
                                <motion.div 
                                  animate={{ scale: [1, 1.1, 1], opacity: [1, 0.8, 1] }} 
                                  transition={{ repeat: Infinity, duration: 0.5 }}
                                  className="text-center"
                                >
                                  <p className="text-red-500 font-black text-[10px] md:text-xs tracking-widest">⚠️ ЗУСТРІЧНИЙ ПОТЯГ! ⚠️</p>
                                  <p className="text-white text-[7px] uppercase mt-1">ЧАС: {metroGame.warningTime?.toFixed(1)}с</p>
                                </motion.div>
                              ) : (
                                <div className="flex items-center gap-2 md:gap-4">
                                  <div className="px-1.5 py-0.5 md:px-2 md:py-1 bg-ukraine-blue/20 border border-ukraine-blue/50 rounded text-ukraine-blue text-[7px] md:text-[9px] font-black">
                                    [{metroGame.currentStation}]
                                  </div>
                                  <div className="text-text-muted text-[8px] md:text-sm tracking-widest font-mono">
                                    --- 🚆 ---
                                  </div>
                                  <div className="px-1.5 py-0.5 md:px-2 md:py-1 bg-white/5 border border-white/10 rounded text-text-muted text-[7px] md:text-[9px] font-black">
                                    [{metroGame.nextStation}]
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-1 w-full">
                               <button 
                                onClick={() => handleMiniGameAction('left')}
                                className="h-9 rounded bg-secondary-dark border border-border-dark flex items-center justify-center text-lg hover:border-ukraine-blue active:scale-95 transition-all"
                               >
                                ←
                               </button>
                               <button 
                                onClick={() => handleMiniGameAction('brake')}
                                className={`h-9 rounded border flex items-center justify-center text-lg active:scale-95 transition-all ${metroGame.hasOncoming ? 'bg-red-600 border-red-500 animate-pulse text-white' : 'bg-secondary-dark border-border-dark text-text-muted opacity-50'}`}
                               >
                                🛑
                               </button>
                               <button 
                                onClick={() => handleMiniGameAction('right')}
                                className="h-9 rounded bg-secondary-dark border border-border-dark flex items-center justify-center text-lg hover:border-ukraine-blue active:scale-95 transition-all"
                               >
                                →
                               </button>
                            </div>
                            
                            <div className="flex justify-center gap-1">
                               {[0, 1, 2].map(i => (
                                 <div key={i} className={`h-0.5 w-4 rounded-full ${i < metroGame.step ? 'bg-ukraine-blue' : 'bg-secondary-dark border border-border-dark'}`} />
                               ))}
                            </div>
                          </div>
                        )}

                        {job.minigame === 'builder' && builderGame && (
                          <div className="flex flex-col items-center gap-1.5 w-full">
                            <p className="text-[7px] text-text-muted uppercase tracking-widest text-center mb-0.5">Зведіть 6 поверхів</p>
                            
                             <div className="bg-black/40 p-1.5 rounded-xl border border-white/5 w-full flex flex-col items-center justify-end min-h-[90px] relative overflow-hidden gap-0.5">
                               {[5, 4, 3, 2, 1, 0].map((i) => {
                                 const material = builderGame.history && builderGame.history[i];
                                 const config = material === 'wood' ? { icon: '🪵', color: 'bg-amber-900/40 border-amber-800' } :
                                                material === 'brick' ? { icon: '🧱', color: 'bg-red-900/40 border-red-800' } :
                                                material === 'concrete' ? { icon: '🏗️', color: 'bg-ukraine-blue/40 border-ukraine-blue' } :
                                                { icon: '', color: 'bg-white/5 border-white/5' };

                                 return (
                                   <motion.div 
                                     key={i} 
                                     initial={false}
                                     animate={{ 
                                        scale: i < builderGame.floors ? 1 : 0.95,
                                        opacity: i < builderGame.floors ? 1 : 0.3
                                     }}
                                     className={`h-2.5 w-18 border rounded transition-all duration-300 flex items-center justify-center relative ${config.color}`}
                                   >
                                     {i < builderGame.floors && (
                                       <span className="text-[7.5px] pointer-events-none drop-shadow-md select-none">{config.icon}</span>
                                     )}
                                   </motion.div>
                                 );
                               })}
                               <div className="w-20 h-1 bg-ukraine-yellow rounded-full mt-1 shadow-lg shadow-ukraine-yellow/20" />
                            </div>

                            <div className="w-full space-y-0.5 mt-0.5">
                               <div className="flex justify-between text-[5.5px] text-text-muted uppercase tracking-widest">
                                  <span>Вага: {builderGame.weight}</span>
                                  <span>Міцність: {builderGame.strength}</span>
                               </div>
                               <div className="w-full h-0.5 bg-secondary-dark rounded-full overflow-hidden">
                                 <div 
                                   className={`h-full transition-all ${builderGame.weight > builderGame.strength * 0.8 ? 'bg-red-500' : 'bg-ukraine-yellow'}`} 
                                   style={{ width: `${Math.min((builderGame.weight / builderGame.strength) * 100, 100)}%` }} 
                                 />
                               </div>
                            </div>

                            <div className="grid grid-cols-3 gap-0.5 w-full mt-1 relative z-20">
                               <button 
                                onClick={(e) => { e.stopPropagation(); handleMiniGameAction('wood'); }}
                                className="py-1 bg-secondary-dark border border-border-dark rounded text-[5.5px] font-black uppercase tracking-widest text-white hover:border-ukraine-blue active:scale-95 transition-all flex flex-col items-center p-0.5 cursor-pointer"
                               >
                                <span className="text-[9px] mb-0.5">🪵</span>
                                Дерево
                               </button>
                               <button 
                                onClick={(e) => { e.stopPropagation(); handleMiniGameAction('brick'); }}
                                className="py-1 bg-secondary-dark border border-border-dark rounded text-[5.5px] font-black uppercase tracking-widest text-white hover:border-ukraine-blue active:scale-95 transition-all flex flex-col items-center p-0.5 cursor-pointer"
                               >
                                <span className="text-[9px] mb-0.5">🧱</span>
                                Цегла
                               </button>
                               <button 
                                onClick={(e) => { e.stopPropagation(); handleMiniGameAction('concrete'); }}
                                className="py-1 bg-secondary-dark border border-border-dark rounded text-[5.5px] font-black uppercase tracking-widest text-white hover:border-ukraine-blue active:scale-95 transition-all flex flex-col items-center p-0.5 cursor-pointer"
                               >
                                <span className="text-[9px] mb-0.5">🏗️</span>
                                Бетон
                               </button>
                            </div>
                          </div>
                        )}

                        {job.minigame === 'tap' && (
                          <div className="flex flex-col items-center gap-3 w-full">
                            <p className="text-[7.5px] text-text-muted uppercase tracking-widest text-center">Швидко натискайте!</p>
                            <button 
                               onClick={() => handleMiniGameAction('tap')}
                               className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-ukraine-blue flex items-center justify-center text-white font-black text-base md:text-lg shadow-lg active:scale-90 transition-transform select-none"
                            >
                               {gameTarget - gameScore}
                            </button>
                            <div className="w-full h-1 bg-secondary-dark rounded-full overflow-hidden mt-1">
                               <div className="h-full bg-white transition-all" style={{ width: `${(gameScore/gameTarget)*100}%` }} />
                            </div>
                          </div>
                        )}

                        {job.minigame === 'sequence' && (
                          <div className="flex flex-col items-center w-full">
                            <p className="text-[7.5px] text-text-muted uppercase tracking-widest text-center mb-1.5">Введіть код</p>
                            <div className="grid grid-cols-2 gap-1 w-full max-w-[100px]">
                              {Array.from({ length: 4 }).map((_, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleMiniGameAction('sequence', i)}
                                  className={`h-7 rounded border flex items-center justify-center text-[8px] font-black transition-all active:scale-95 ${
                                    userSequence.includes(i) ? 'bg-ukraine-blue border-ukraine-blue text-white' : 'bg-secondary-dark border-border-dark text-text-dim'
                                  }`}
                                >
                                  {i + 1}
                                </button>
                              ))}
                            </div>
                            <div className="text-center mt-1.5">
                               <p className="text-[6px] text-text-muted uppercase tracking-widest">Крок: {userSequence.length}/{gameSequence.length}</p>
                            </div>
                          </div>
                        )}

                        {job.minigame === 'logic' && (
                          <div className="flex flex-col items-center gap-2 w-full">
                            <p className="text-[7.5px] text-text-muted uppercase tracking-widest text-center">Вирішіть {gameTarget - gameScore} завдання</p>
                            <div className="grid grid-cols-2 gap-1 w-full">
                               <button 
                                onClick={() => handleMiniGameAction('logic')}
                                className="h-9 rounded bg-secondary-dark border border-border-dark flex items-center justify-center text-[8px] font-black uppercase tracking-widest hover:border-ukraine-blue active:scale-95 transition-all"
                               >
                                OK
                               </button>
                               <button 
                                onClick={() => {}}
                                className="h-9 rounded bg-secondary-dark border border-border-dark flex items-center justify-center text-[8px] font-black uppercase tracking-widest opacity-30 cursor-not-allowed"
                               >
                                NO
                               </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                     {status === 'failed' && (
                      <div className="text-center w-full px-1">
                         <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-1">
                            <span className="text-sm">💥</span>
                         </div>
                         <h3 className="text-[8px] font-black text-white uppercase tracking-widest mb-0">Невдача!</h3>
                         <p className="text-[6px] text-text-muted uppercase tracking-[0.05em] mb-1.5 leading-tight max-h-[35px] overflow-y-auto">{pilotFailureMessage}</p>
                         <button 
                          onClick={() => {
                            setWorkingJob(null);
                            setStatus('idle');
                          }}
                          className="w-full py-1 bg-red-600 text-white font-black text-[7px] uppercase tracking-[0.2em] rounded shadow-lg shadow-red-600/20 active:scale-95 transition-transform"
                        >
                          ЗРОЗУМІЛО
                        </button>
                      </div>
                    )}

                    {status === 'completing' && (
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center w-full px-1"
                          >
                             <div className="w-8 h-8 bg-green-400/20 rounded-full flex items-center justify-center mx-auto mb-1.5">
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                             </div>
                             <h3 className="text-[8px] font-black text-white uppercase tracking-widest mb-2">ГОТОВО!</h3>
                             <button 
                              onClick={handleCollect}
                              className="w-full py-1.5 bg-ukraine-yellow text-black font-black text-[7.5px] uppercase tracking-[0.2em] rounded shadow-lg shadow-ukraine-yellow/20 active:scale-95 transition-transform"
                            >
                              ОТРИМАТИ ₴{((workingJob?.id === 'taxi' && taxiGame?.pendingPay) ? taxiGame.pendingPay : (workingJob?.minigame === 'mine' ? Math.floor(workingJob.pay * mineMultiplier) : workingJob?.pay || 0)).toLocaleString()}
                            </button>
                          </motion.div>
                    )}

                    {status === 'done' && (
                      <div className="text-center font-black text-green-400 uppercase tracking-widest animate-bounce">
                         ГОТОВО! ₴{((workingJob.id === 'taxi' && taxiGame?.pendingPay) ? taxiGame.pendingPay : (workingJob.minigame === 'mine' ? Math.floor(workingJob.pay * mineMultiplier) : workingJob.pay)).toLocaleString()} НА РАХУНКУ
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
