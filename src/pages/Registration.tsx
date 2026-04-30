import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { Passport } from '../components/Passport';
import { LogIn, UserPlus, Camera, Check, X, Key, Mail } from 'lucide-react';
import { backend } from '../services/backendService';

import { compressImage } from '../lib/imageUtils';

export const Registration: React.FC = () => {
  const { user, profile, login: contextLogin, register: contextRegister, logout, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    if (user && (!profile || !profile.firstName)) {
      setStep(2);
    } else if (!user) {
      setStep(1);
    }
  }, [user, profile]);

  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    sex: 'M' as 'M' | 'F',
    passportPhoto: '',
    signature: '',
  });
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<any>({ ok: true, checking: true });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        setDbStatus({ 
          ok: data.status === 'ok', 
          connecting: data.status === 'connecting',
          checking: false, 
          message: data.error || data.message 
        });
      } catch (e: any) {
        setDbStatus({ ok: false, checking: false, message: 'Сервер недоступний (' + e.message + ')' });
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      try {
        const compressed = await compressImage(file, 400, 500, 0.8);
        setFormData({ ...formData, passportPhoto: compressed });
        setShowPhotoModal(false);
      } catch (error) {
        console.error('Compression error:', error);
        alert('Помилка при обробці зображення. Спробуйте інше.');
      } finally {
        setLoading(false);
      }
    }
  };

  const deletePhoto = () => {
    setFormData({ ...formData, passportPhoto: '' });
    setShowPhotoModal(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.email || !authForm.password) {
        alert("Заповніть всі поля");
        return;
    }
    
    setLoading(true);
    try {
      if (authMode === 'login' || authMode === 'register') {
        const result = authMode === 'login' ? await contextLogin(authForm) : await contextRegister(authForm);
        
        if (result.error) {
            alert(result.error);
        } else if (result.user) {
            // If profile is already attached to the result or fetched by context
            // AuthContext.login/register now set profile and user together
            if (result.profile) {
                // Done. App.tsx will notice profile and switch to Dashboard
            } else {
                setStep(2);
            }
        }
      }
    } catch (error: any) {
      console.error('Auth Error:', error);
      alert('Помилка аутентифікації');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    if (formData.firstName && formData.lastName) {
      setStep(3);
    } else {
      alert('Будь ласка, заповніть ім\'я та прізвище');
    }
  };

  const handleCompleteRegistration = async () => {
    if (!user || loading) return;
    
    try {
      setLoading(true);
      const uid = user.uid;
      
      const profileData = {
        uid: uid,
        email: user.email,
        firstName: formData.firstName.trim().toUpperCase(),
        lastName: formData.lastName.trim().toUpperCase(),
        sex: formData.sex === 'M' ? 'Чоловіча' : 'Жіноча',
        passportPhoto: formData.passportPhoto,
        signature: formData.signature,
        birthDate: new Date().toLocaleDateString('uk-UA'),
        balance: 5000,
        socialRating: 0,
        businesses: [],
        status: 'Громадянин',
        role: 'user'
      };
      
      const result = await backend.saveProfile(profileData);
      if (result.success || result.uid) {
        await refreshProfile();
        setLoading(false);
        // The App.tsx will notice profile is no longer null and show Dashboard
      } else {
        throw new Error(result.error || 'Невідома помилка сервера');
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      let errorMsg = 'Помилка збереження профілю';
      try {
        const firestoreErr = JSON.parse(error.message);
        errorMsg += `: ${firestoreErr.error}`;
      } catch (e) {
        errorMsg += `: ${error.message}`;
      }
      alert(errorMsg);
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] bg-[#0A0A0C] flex flex-col items-center justify-start overflow-y-auto p-4 md:justify-center text-[#E0E0E0]">
      {/* Database Error Overlay */}
      {(!dbStatus.ok || dbStatus.connecting) && !dbStatus.checking && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-[#111114] border border-white/5 p-10 rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.5)]"
          >
            {dbStatus.connecting ? (
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 border-4 border-ukraine-blue/20 border-t-ukraine-blue rounded-full animate-spin mb-8" />
                <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4">ПІДКЛЮЧЕННЯ ДО БАЗИ...</h2>
                <p className="text-[10px] text-text-dim uppercase tracking-widest leading-loose max-w-sm">
                    Це може зайняти до 60 секунд під час першого запуску Railway PostgreSQL.
                </p>
              </div>
            ) : (
              <>
                <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(239,68,68,0.1)]">
                   <X className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-4">ПОМИЛКА З'ЄДНАННЯ</h2>
                
                <div className="bg-black/60 p-6 rounded-2xl border border-white/5 text-left mb-8 max-h-[200px] overflow-y-auto">
                    <p className="text-[9px] font-black text-ukraine-yellow uppercase mb-2">Технічна інформація:</p>
                    <p className="text-[10px] text-red-400/80 font-mono break-all leading-relaxed whitespace-pre-wrap">
                        {dbStatus.message || 'Невідома помилка підключення'}
                    </p>
                </div>

                <div className="space-y-4">
                  <button 
                      onClick={() => window.location.reload()}
                      className="w-full py-5 bg-white text-black font-black uppercase tracking-widest rounded-3xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                  >
                      ПОВТОРИТИ СПРОБУ
                  </button>
                  <p className="text-[9px] text-text-muted uppercase tracking-[0.3em]">Ukraine RP v0.9.5 Production</p>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Decorative gradient overlay */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
         <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-ukraine-blue rounded-full blur-[120px]" />
         <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-ukraine-yellow rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative z-10"
      >
        <div className="text-center mb-10">
          <div className="inline-block ukraine-border-gradient mb-4">
             <div className="bg-[#0A0A0C] px-6 py-2 font-black italic tracking-[0.3em] text-white text-3xl">
                UKRAINE RP
             </div>
          </div>
          <p className="text-text-muted text-sm uppercase tracking-widest font-medium">Світ твоїх можливостей</p>
        </div>

        {step === 1 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card-dark border border-border-dark p-8 rounded-2xl shadow-2xl"
          >
            <h2 className="text-xl font-bold mb-8 uppercase tracking-widest text-white text-center">
                {authMode === 'login' ? 'Вхід в систему' : 'Реєстрація'}
            </h2>
            
            <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] uppercase text-text-muted font-black tracking-widest block">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                        <input
                            type="email"
                            required
                            className="w-full bg-secondary-dark border border-border-dark rounded-xl p-3 pl-12 focus:border-ukraine-blue outline-none transition-all text-white"
                            value={authForm.email}
                            onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                            placeholder="your@email.com"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] uppercase text-text-muted font-black tracking-widest block">Пароль</label>
                    <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                        <input
                            type="password"
                            required
                            className="w-full bg-secondary-dark border border-border-dark rounded-xl p-3 pl-12 focus:border-ukraine-blue outline-none transition-all text-white"
                            value={authForm.password}
                            onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-ukraine-blue text-white font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-3 hover:bg-ukraine-blue/80 transition-all shadow-lg shadow-ukraine-blue/20 mt-6"
                >
                    {loading ? 'ЗАВАНТАЖЕННЯ...' : (authMode === 'login' ? 'Увійти' : 'Створити акаунт')}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-border-dark">
                <button
                    type="button"
                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                    className="w-full py-4 border border-ukraine-blue/50 text-white font-black uppercase tracking-widest rounded-xl hover:bg-ukraine-blue/10 transition-all mb-4"
                >
                    {authMode === 'login' ? 'Створити акаунт' : 'Перейти до входу'}
                </button>
            </div>
            
            <p className="mt-6 text-[10px] text-text-dim uppercase tracking-tighter text-center">Входячи в гру, ви погоджуєтесь з правилами сервера</p>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div className="bg-card-dark border border-border-dark p-8 rounded-2xl shadow-2xl">
              <div className="flex justify-between items-center mb-8 border-b border-border-dark pb-4">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3 text-white">
                  <UserPlus className="w-5 h-5 text-ukraine-blue" />
                  Створення Персонажу
                </h2>
                <button 
                  onClick={() => logout()}
                  className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-[10px] font-black tracking-widest transition-all"
                >
                  ВИЙТИ
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase text-text-muted font-black tracking-widest mb-2 block">Прізвище</label>
                    <input
                      type="text"
                      className="w-full bg-secondary-dark border border-border-dark rounded-xl p-3 focus:border-ukraine-blue outline-none transition-all text-white placeholder:text-text-dim"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      placeholder="ПЕТРЕНКО"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-text-muted font-black tracking-widest mb-2 block">Ім'я</label>
                    <input
                      type="text"
                      className="w-full bg-secondary-dark border border-border-dark rounded-xl p-3 focus:border-ukraine-blue outline-none transition-all text-white placeholder:text-text-dim"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      placeholder="ІВАН"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase text-text-muted font-black tracking-widest mb-2 block">Стать</label>
                    <div className="flex gap-2">
                      {['M', 'F'].map((gen) => (
                        <button
                          key={gen}
                          onClick={() => setFormData({...formData, sex: gen as 'M' | 'F'})}
                          className={`flex-1 py-3 rounded-xl border-2 font-black transition-all ${formData.sex === gen ? 'bg-ukraine-blue/10 border-ukraine-blue text-ukraine-blue' : 'bg-secondary-dark border-border-dark text-text-dim hover:border-text-muted'}`}
                        >
                          {gen === 'M' ? 'Ч' : 'Ж'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] uppercase text-text-muted font-black tracking-widest block">Підпис</label>
                      <span className="text-[9px] font-bold text-text-dim tracking-widest">{formData.signature.length}/12</span>
                    </div>
                    <input
                      type="text"
                      className="w-full bg-secondary-dark border border-border-dark rounded-xl p-3 focus:border-ukraine-blue outline-none transition-all italic font-serif text-white placeholder:text-text-dim"
                      value={formData.signature}
                      maxLength={12}
                      onChange={(e) => setFormData({...formData, signature: e.target.value})}
                      placeholder="Підпис"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase text-text-muted font-black tracking-widest mb-2 block">Фото Персонажу</label>
                  <div className="flex flex-col items-center gap-4">
                    <div 
                      onClick={() => setShowPhotoModal(true)}
                      className="w-32 h-40 bg-secondary-dark border-2 border-dashed border-border-dark rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-ukraine-blue transition-all overflow-hidden relative group"
                    >
                      {formData.passportPhoto ? (
                        <>
                          <img src={formData.passportPhoto} alt="Preview" className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Camera className="w-8 h-8 text-white" />
                          </div>
                        </>
                      ) : (
                        <>
                          <Camera className="w-8 h-8 text-text-dim group-hover:text-ukraine-blue mb-2 transition-colors" />
                          <span className="text-[8px] uppercase font-black text-text-dim text-center px-4">Натисніть для завантаження</span>
                        </>
                      )}
                    </div>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <button
                  onClick={handleNextStep}
                  disabled={loading}
                  className={`w-full py-4 bg-white text-black font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-all ${(!formData.firstName || !formData.lastName) ? 'opacity-50 cursor-not-allowed' : 'opacity-100'}`}
                >
                  {loading ? 'ЗАВАНТАЖЕННЯ...' : 'Далі'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <div className="text-center">
               <h2 className="text-lg font-black uppercase tracking-[0.2em] text-white mb-2">Ваш Паспорт Готовий</h2>
               <p className="text-xs text-text-muted">Перевірте правильність даних перед входом</p>
            </div>

            <div className="flex flex-col items-center gap-8">
              <div className="w-full">
                <Passport 
                  uid={user?.uid ? user.uid.slice(0, 8) : "NEW"}
                  firstName={formData.firstName}
                  lastName={formData.lastName}
                  sex={formData.sex}
                  birthDate={new Date().toLocaleDateString('uk-UA')}
                  balance={5000}
                  signature={formData.signature}
                  passportPhoto={formData.passportPhoto}
                  onPhotoClick={() => setShowPhotoModal(true)}
                />
              </div>

              <div className="w-full">
                 <button
                  onClick={handleCompleteRegistration}
                  disabled={loading}
                  className="w-full py-5 bg-gradient-to-r from-ukraine-blue to-ukraine-yellow rounded-2xl font-black text-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 transform hover:scale-[1.01] active:scale-98 transition-all shadow-xl"
                >
                  {loading ? 'Синхронізація...' : (
                    <>
                      <Check className="w-6 h-6" />
                      РОЗПОЧАТИ ГРУ
                    </>
                  )}
                </button>
                <div className="flex justify-center gap-4 mt-6">
                   <button 
                    onClick={() => setStep(2)}
                    className="text-[10px] uppercase font-black tracking-widest text-text-muted hover:text-white transition-colors"
                  >
                    Редагувати дані
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
      
      {/* Photo Management Modal */}
      <AnimatePresence>
        {showPhotoModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPhotoModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-card-dark border border-border-dark rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-widest">Керування фото</h3>
                  <p className="text-[9px] text-text-dim uppercase font-bold tracking-widest">Персоналізація вашого ID</p>
                </div>
                <button 
                  onClick={() => setShowPhotoModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-text-dim transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-center">
                <div className="w-32 h-40 bg-secondary-dark rounded-2xl mx-auto overflow-hidden border border-border-dark relative group">
                  {formData.passportPhoto ? (
                    <img src={formData.passportPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-12 h-12 text-white/5" />
                    </div>
                  )}
                  {loading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-ukraine-blue border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 pt-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="w-full py-4 bg-ukraine-blue text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-blue-600 disabled:opacity-50"
                  >
                    {formData.passportPhoto ? 'ЗМІНИТИ ФОТО' : 'ОБРАТИ ФОТО'}
                  </button>
                  
                  {formData.passportPhoto ? (
                    <button 
                      onClick={deletePhoto}
                      disabled={loading}
                      className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-red-500 hover:text-white disabled:opacity-50"
                    >
                      ВИДАЛИТИ ФОТО
                    </button>
                  ) : null}

                  <button 
                    onClick={() => setShowPhotoModal(false)}
                    className="w-full py-4 bg-white/5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-white/10"
                  >
                    ЗАКРИТИ
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
