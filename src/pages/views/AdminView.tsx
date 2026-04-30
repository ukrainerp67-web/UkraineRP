import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Shield, TrendingUp, Search, Edit3, Trash2, Crown, Activity, Database, MessageSquare, AlertTriangle, Clock, Snowflake, Lock, BadgeCheck } from 'lucide-react';
import { backend } from '../../services/backendService';
import { useAuth } from '../../context/AuthContext';

const HryvniaSign = ({ className }: { className?: string }) => (
  <span className={`${className} flex items-center justify-center font-black select-none`}>₴</span>
);

export const AdminView: React.FC = () => {
  const { profile: adminProfile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isMuting, setIsMuting] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);
  const [muteDuration, setMuteDuration] = useState('15');
  const [muteReason, setMuteReason] = useState('Порушення правил чату');
  const [freezeDuration, setFreezeDuration] = useState('60');
  const [freezeReason, setFreezeReason] = useState('Порушення правил сервера');
  const [moneyAction, setMoneyAction] = useState({ amount: '', reason: '' });

  useEffect(() => {
    setLoading(true);
    let interval: any;
    
    const update = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/admin/users', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
          if (res.ok) {
            const data = await res.json();
            const usersArray = Array.isArray(data) ? data : [];
            setUsers(usersArray);
            
            // Calculate stats
            const totalPlayers = usersArray.length;
            const totalEconomy = usersArray.reduce((acc: number, u: any) => acc + (Number(u.balance) || 0), 0);
            const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
            const onlineNow = usersArray.filter((u: any) => {
              if (!u.lastActive) return false;
              const time = new Date(u.lastActive).getTime();
              return time > fiveMinsAgo;
            }).length;

            setStats({
              totalPlayers,
              totalEconomy,
              onlineNow,
              avgSocialRating: usersArray.length > 0 ? usersArray.reduce((acc: number, u: any) => acc + (Number(u.socialRating) || 0), 0) / usersArray.length : 0
            });
          } else {
           const errText = await res.text();
           console.warn('Admin users fetch not ok:', res.status, errText);
        }
      } catch (e) {
        console.error('Fetch admin users error:', e);
      } finally {
        setLoading(false);
      }
    };

    update();
    interval = setInterval(update, 4000);

    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !adminProfile) return;

    const balance = Number(selectedUser.balance);
    const socialRating = Number(selectedUser.socialRating);

    if (isNaN(balance) || isNaN(socialRating)) {
      alert('Будь ласка, введіть коректні числові значення');
      return;
    }

        const isSuperAdmin = adminProfile.email === 'ukrainerp67@gmail.com';
        const originalUser = users.find(u => u.uid === selectedUser.uid);
        const roleChanged = selectedUser.role !== originalUser?.role;
        const verificationChanged = selectedUser.isVerified !== originalUser?.isVerified;

        try {
            const adminName = `${adminProfile.firstName || 'Admin'} ${adminProfile.lastName || ''}`.trim();
            
            const updateData: any = {
                balance: balance,
                socialRating: socialRating,
                isVerified: !!selectedUser.isVerified
            };

            // Only allow super admin to change roles
            if (isSuperAdmin && roleChanged) {
                updateData.role = selectedUser.role;
            }

            await backend.adminUpdateUser(selectedUser.uid, updateData, adminName);

            if (isSuperAdmin && roleChanged) {
                await backend.sendNotification(selectedUser.uid, {
                    title: 'Оновлення статусу',
                    message: selectedUser.role === 'admin' 
                        ? 'Вітаємо в нашій команді! 🥳 Вас назначено адміністратором. Тепер ви один з нас!'
                        : 'На жаль... ви покинули пост адміністратора, дякуємо за ваш вклад!',
                    type: 'social'
                });
            }

            if (verificationChanged) {
                await backend.sendNotification(selectedUser.uid, {
                    title: selectedUser.isVerified ? 'Акаунт верифіковано' : 'Статус верифікації змінено',
                    message: selectedUser.isVerified 
                        ? 'Ваш акаунт успішно пройшов верифікацію. Ви отримали офіційну відмітку!' 
                        : 'Статус верифікації вашого акаунта було знято.',
                    type: 'success'
                });
            }

      alert('Дані оновлено!');
      setIsEditing(false);
      await fetchData();
    } catch (error) {
      console.error('Update error:', error);
      alert('Помилка оновлення');
    }
  };

  const handleMute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !adminProfile) return;

    if (!muteReason.trim()) {
      alert('Вкажіть причину муту');
      return;
    }

    try {
      const adminName = `${adminProfile.firstName || 'Admin'} ${adminProfile.lastName || ''}`.trim();
      await backend.adminMuteUser(
        selectedUser.uid, 
        Number(muteDuration), 
        muteReason, 
        adminName
      );
      alert(`Мут видано на ${muteDuration} хв!`);
      setIsMuting(false);
      await fetchData();
    } catch (error) {
      console.error('Mute error:', error);
      alert('Помилка видачі муту');
    }
  };

  const handleFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !adminProfile) return;

    if (!freezeReason.trim()) {
      alert('Вкажіть причину заморозки');
      return;
    }

    try {
      const adminName = `${adminProfile.firstName || 'Admin'} ${adminProfile.lastName || ''}`.trim();
      await backend.adminFreezeUser(
        selectedUser.uid, 
        Number(freezeDuration), 
        freezeReason, 
        adminName
      );
      alert(`Акаунт заморожено!`);
      setIsFreezing(false);
      await fetchData();
    } catch (error) {
      console.error('Freeze error:', error);
      alert('Помилка заморозки акаунта');
    }
  };

  const handleUnfreeze = async (uid: string) => {
    if (!adminProfile) return;
    try {
      const adminName = `${adminProfile.firstName || 'Admin'} ${adminProfile.lastName || ''}`.trim();
      await backend.adminUnfreezeUser(uid, adminName);
      alert('Акаунт розморожено!');
      await fetchData();
    } catch (error) {
      console.error('Unfreeze error:', error);
      alert('Помилка розморозки');
    }
  };

  const handleDelete = async (uid: string) => {
    if (!window.confirm('ВИ ВПЕВНЕНІ, що хочете ПОВНІСТЮ ВИДАЛИТИ акаунт? Цю дію неможливо скасувати!')) return;

    try {
      const result = await backend.adminDeleteUser(uid);
      if (result && result.success) {
        alert('Акаунт видалено');
        await fetchData();
      } else {
        alert(`Помилка: ${result?.error || 'Невідома помилка'}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Помилка видалення (мережа)');
    }
  };

  const handleAdjustMoney = async (type: 'add' | 'remove') => {
    if (!selectedUser || !adminProfile || !moneyAction.amount) return;
    
    const amount = Number(moneyAction.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Введіть коректну суму');
      return;
    }

    const newBalance = type === 'add' 
      ? Number(selectedUser.balance) + amount 
      : Math.max(0, Number(selectedUser.balance) - amount);

    try {
      const adminName = `${adminProfile.firstName || 'Admin'} ${adminProfile.lastName || ''}`.trim();
      await backend.adminUpdateUser(selectedUser.uid, {
        balance: newBalance
      }, adminName);
      
      await backend.sendNotification(selectedUser.uid, {
        title: type === 'add' ? 'Нарахування коштів' : 'Зняття коштів',
        message: `Адміністратор ${adminName} ${type === 'add' ? 'видав вам' : 'зняв з вашого рахунку'} ₴${amount.toLocaleString()}. Причина: ${moneyAction.reason || 'Не вказана'}`,
        type: type === 'add' ? 'success' : 'error'
      });

      alert('Баланс оновлено');
      setMoneyAction({ amount: '', reason: '' });
      setIsEditing(false);
      fetchData();
    } catch (error) {
      console.error('Money adjust error:', error);
      alert('Помилка оновлення балансу');
    }
  };

  const isOnline = (user: any) => {
    if (!user.lastActive) return false;
    const now = Date.now();
    const lastActive = new Date(user.lastActive).getTime();
    // Since presence polls every 3s, being inactive for > 15s usually means offline/tab closed
    return (now - lastActive) < 15000;
  };

  const filteredUsers = users.filter(u => 
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.uid.includes(searchQuery)
  );

  const adminUsers = filteredUsers
    .filter(u => u.role === 'admin' || u.email === 'ukrainerp67@gmail.com')
    .sort((a, b) => (isOnline(b) ? 1 : 0) - (isOnline(a) ? 1 : 0));

  const regularUsers = filteredUsers
    .filter(u => u.role !== 'admin' && u.email !== 'ukrainerp67@gmail.com')
    .sort((a, b) => (isOnline(b) ? 1 : 0) - (isOnline(a) ? 1 : 0));

  const renderUserTable = (usersList: any[], title: string, icon: React.ReactNode) => (
    <div className={`bg-card-dark border ${title.includes("Адміністратори") ? "border-ukraine-yellow/20 shadow-[0_0_30px_rgba(255,221,0,0.05)]" : "border-white/5"} rounded-3xl overflow-hidden shadow-2xl mb-8`}>
      <div className={`p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${title.includes("Адміністратори") ? 'bg-gradient-to-r from-ukraine-yellow/[0.03] to-transparent' : 'bg-gradient-to-r from-white/[0.02] to-transparent'}`}>
        <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
          {icon}
          {title}
          <div className="flex items-center gap-2 ml-4">
             <span className="px-2 py-0.5 rounded-full bg-black/40 text-[10px] text-text-dim border border-white/5 font-mono">
               УСЬОГО: {usersList.length}
             </span>
             <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-[10px] text-green-400 border border-green-500/20 font-mono">
               ОНЛАЙН: {usersList.filter(u => isOnline(u)).length}
             </span>
          </div>
        </h3>
        {title === "Всі Гравці" && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input 
              type="text"
              placeholder="Пошук за ім'ям або ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:border-ukraine-blue w-full md:w-80 transition-all focus:ring-2 focus:ring-ukraine-blue/20"
            />
          </div>
        )}
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 text-[9px] md:text-[10px] font-black text-text-dim uppercase tracking-widest">
              <th className="px-6 py-4">Гравець</th>
              <th className="px-6 py-4 font-mono">Фінанси</th>
              <th className="px-6 py-4">Рейтинг</th>
              <th className="px-6 py-4">Статус / Роль</th>
              <th className="px-6 py-4 text-right">Управління</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {usersList.map((user) => {
              const online = isOnline(user);
              return (
                <tr key={user.uid} className={`hover:bg-white/[0.03] transition-all group ${online ? 'bg-green-500/[0.01]' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative group-hover:scale-110 transition-transform duration-300">
                        <div className={`w-11 h-11 rounded-full bg-white/5 flex items-center justify-center font-bold overflow-hidden border-2 ${online ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-white/10'}`}>
                          {user.passportPhoto ? <img src={user.passportPhoto} className="w-full h-full object-cover" /> : user.firstName?.charAt(0) || '?'}
                        </div>
                        {online && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-card-dark rounded-full flex items-center justify-center">
                            <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse" title="В мережі" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-black text-white flex items-center gap-1.5">
                          {user.firstName} {user.lastName}
                          {user.isVerified && <BadgeCheck className="w-4 h-4 text-ukraine-blue fill-ukraine-blue/10" />}
                          {user.role === 'admin' && (
                            <Crown 
                              className={`w-4 h-4 drop-shadow-[0_0_8px_rgba(255,221,0,0.5)] ${user.email === 'ukrainerp67@gmail.com' ? 'text-ukraine-yellow scale-125' : 'text-ukraine-yellow opacity-70'}`} 
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="text-[10px] text-text-dim font-mono tracking-tight opacity-60">ID: {user.uid.slice(0, 12)}...</div>
                           {online && (
                             <span className="flex items-center gap-1">
                               <span className="w-1 h-1 bg-green-500 rounded-full animate-ping" />
                               <span className="text-[8px] font-black text-green-500 uppercase tracking-widest leading-none">Online</span>
                             </span>
                           )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-ukraine-yellow font-black">₴{user.balance?.toLocaleString()}</span>
                      <span className="text-[9px] text-text-dim uppercase font-bold tracking-tighter">На руках</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-12 bg-white/5 rounded-full overflow-hidden border border-white/5`}>
                         <div className={`h-full rounded-full ${user.socialRating >= 50 ? 'bg-green-500' : user.socialRating > 0 ? 'bg-ukraine-blue' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Math.max(10, Math.abs(user.socialRating)))}%` }} />
                      </div>
                      <span className="text-xs font-black text-white">{user.socialRating}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg inline-block w-fit tracking-tighter ${user.role === 'admin' ? (user.email === 'ukrainerp67@gmail.com' ? 'bg-ukraine-yellow/20 text-ukraine-yellow border border-ukraine-yellow/30 shadow-[0_0_15px_rgba(255,221,0,0.2)]' : 'bg-ukraine-blue/20 text-ukraine-blue border border-ukraine-blue/30') : 'bg-white/5 text-text-dim border border-white/10'}`}>
                        {user.email === 'ukrainerp67@gmail.com' ? 'HEAD ADMIN' : (user.role || 'GUEST')}
                      </span>
                      {user.isFrozen && (
                        <div className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md w-fit">
                           <span className="text-[8px] font-black uppercase text-red-500 flex items-center gap-1.5 leading-none">
                            <Lock className="w-2.5 h-2.5" /> ЗАБЛОКОВАНО
                           </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                        onClick={() => {
                          if (user.isFrozen) {
                            handleUnfreeze(user.uid);
                          } else {
                            setSelectedUser(user);
                            setIsFreezing(true);
                          }
                        }}
                        className={`p-2.5 rounded-xl transition-all border ${user.isFrozen ? 'bg-ukraine-blue text-white shadow-lg border-ukraine-blue shadow-ukraine-blue/30' : 'bg-white/5 text-text-dim hover:bg-ukraine-blue/20 hover:text-white border-white/5 hover:border-ukraine-blue/30'}`}
                        title={user.isFrozen ? "Розморозити" : "Заморозити"}
                      >
                        <Snowflake className={`w-4 h-4 ${user.isFrozen ? 'animate-pulse' : ''}`} />
                      </button>
                       <button 
                        onClick={() => { setSelectedUser(user); setIsMuting(true); }}
                        className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-text-dim hover:bg-red-500/20 hover:text-red-400 transition-all hover:border-red-500/30"
                        title="Мут"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                       <button 
                        onClick={() => { setSelectedUser(user); setIsEditing(true); }}
                        className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-text-dim hover:bg-ukraine-yellow/20 hover:text-ukraine-yellow transition-all hover:border-ukraine-yellow/30"
                        title="Редагувати"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {adminProfile?.email === 'ukrainerp67@gmail.com' && (
                        <button 
                          onClick={() => handleDelete(user.uid)}
                          className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-text-dim hover:bg-red-600 hover:text-white transition-all hover:shadow-[0_0_15px_rgba(220,38,38,0.3)] shadow-none"
                          title="Остаточно видалити"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {usersList.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center opacity-30">
                    <Users className="w-12 h-12 mb-3" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">Користувачів не знайдено</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading && !users.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-ukraine-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card-dark border border-white/5 p-4 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-ukraine-blue/20 flex items-center justify-center text-ukraine-blue">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase text-text-dim tracking-tighter">Гравців</span>
          </div>
          <div className="text-xl font-black text-white">{stats?.totalPlayers || 0}</div>
        </div>
        <div className="bg-card-dark border border-white/5 p-4 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-ukraine-yellow/20 flex items-center justify-center text-ukraine-yellow">
              <HryvniaSign className="w-4 h-4 text-xs" />
            </div>
            <span className="text-[10px] font-black uppercase text-text-dim tracking-tighter">Економіка</span>
          </div>
          <div className="text-xl font-black text-white">₴{(stats?.totalEconomy || 0).toLocaleString()}</div>
        </div>
        <div className="bg-card-dark border border-white/5 p-4 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase text-text-dim tracking-tighter">Онлайн</span>
          </div>
          <div className="text-xl font-black text-white">{stats?.onlineNow || 0}</div>
        </div>
        <div className="bg-card-dark border border-white/5 p-4 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase text-text-dim tracking-tighter">Сер. Рейтинг</span>
          </div>
          <div className="text-xl font-black text-white">{Math.round(stats?.avgSocialRating || 0)}</div>
        </div>
      </div>

      {/* User Management */}
      <div className="space-y-8">
        {renderUserTable(adminUsers, "Закріплені Адміністратори", <Crown className="w-5 h-5 text-ukraine-yellow" />)}
        {renderUserTable(regularUsers, "Всі Гравці", <Users className="w-5 h-5 text-ukraine-blue" />)}
      </div>

      {/* Edit Modal */}
      {isEditing && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card-dark border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Редагування гравця</h3>
              <button onClick={() => setIsEditing(false)} className="text-text-dim hover:text-white">✕</button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                 <p className="text-[10px] font-black uppercase text-ukraine-blue mb-2">Швидкі фінанси</p>
                 <div className="flex gap-2">
                    <input 
                      type="number"
                      placeholder="Сума"
                      value={moneyAction.amount}
                      onChange={(e) => setMoneyAction({...moneyAction, amount: e.target.value})}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs"
                    />
                    <button 
                      type="button" 
                      onClick={() => handleAdjustMoney('add')}
                      className="px-4 bg-green-600/20 text-green-400 border border-green-600/30 rounded-xl text-[10px] font-black"
                    >
                      +
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleAdjustMoney('remove')}
                      className="px-4 bg-red-600/20 text-red-400 border border-red-600/30 rounded-xl text-[10px] font-black"
                    >
                      -
                    </button>
                 </div>
                 <input 
                    type="text"
                    placeholder="Причина операції..."
                    value={moneyAction.reason}
                    onChange={(e) => setMoneyAction({...moneyAction, reason: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs"
                 />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-text-dim block mb-1">Точний Баланс (₴)</label>
                <input 
                  type="number"
                  value={selectedUser.balance}
                  onChange={(e) => setSelectedUser({...selectedUser, balance: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-text-dim block mb-1">Соціальний Рейтинг</label>
                <input 
                  type="number"
                  value={selectedUser.socialRating}
                  onChange={(e) => setSelectedUser({...selectedUser, socialRating: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm"
                />
              </div>
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                <label className="text-[10px] font-black uppercase text-text-dim">Верифікація</label>
                <button
                  type="button"
                  onClick={() => setSelectedUser({...selectedUser, isVerified: !selectedUser.isVerified})}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedUser.isVerified ? 'bg-ukraine-blue text-white' : 'bg-white/10 text-text-dim'}`}
                >
                  {selectedUser.isVerified ? 'ВЕРИФІКОВАНО' : 'НІ'}
                </button>
              </div>
              {adminProfile?.email === 'ukrainerp67@gmail.com' && (
                <div>
                  <label className="text-[10px] font-black uppercase text-text-dim block mb-1">Роль</label>
                  <select 
                    value={selectedUser.role || 'user'}
                    onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm"
                  >
                    <option value="user">Гравець</option>
                    <option value="admin">Адміністратор</option>
                    <option value="Президент">Президент</option>
                    <option value="Прем'єр Міністр">Прем'єр Міністр</option>
                    <option value="Міністр фінансів">Міністр фінансів</option>
                  </select>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 rounded-xl font-black uppercase tracking-tighter text-xs bg-white/5 text-white hover:bg-white/10 transition-all"
                >
                  Скасувати
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-black uppercase tracking-tighter text-xs bg-ukraine-blue text-white shadow-lg shadow-ukraine-blue/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Зберегти
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Mute Modal */}
      {isMuting && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card-dark border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
                    <MessageSquare className="w-5 h-5" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Видати Мут</h3>
                    <p className="text-[10px] text-text-dim font-bold uppercase tracking-widest">{selectedUser.firstName} {selectedUser.lastName}</p>
                 </div>
              </div>
              <button onClick={() => setIsMuting(false)} className="text-text-dim hover:text-white">✕</button>
            </div>

            <form onSubmit={handleMute} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-text-dim block mb-1">Тривалість (хвилини)</label>
                <select 
                  value={muteDuration}
                  onChange={(e) => setMuteDuration(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm"
                >
                  <option value="5">5 хвилин</option>
                  <option value="15">15 хвилин</option>
                  <option value="30">30 хвилин</option>
                  <option value="60">1 година</option>
                  <option value="120">2 години</option>
                  <option value="1440">1 доба</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-text-dim block mb-1">Причина</label>
                <textarea 
                  value={muteReason}
                  onChange={(e) => setMuteReason(e.target.value)}
                  placeholder="Вкажіть причину покарання..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm h-24 resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsMuting(false)}
                  className="flex-1 py-3 rounded-xl font-black uppercase tracking-tighter text-xs bg-white/5 text-white hover:bg-white/10 transition-all"
                >
                  Скасувати
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-black uppercase tracking-tighter text-xs bg-red-600 text-white shadow-lg shadow-red-600/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Видати покарання
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Freeze Modal */}
      {isFreezing && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card-dark border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                    <Snowflake className="w-5 h-5" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Заморозити акаунт</h3>
                    <p className="text-[10px] text-text-dim font-bold uppercase tracking-widest">{selectedUser.firstName} {selectedUser.lastName}</p>
                 </div>
              </div>
              <button onClick={() => setIsFreezing(false)} className="text-text-dim hover:text-white">✕</button>
            </div>

            <form onSubmit={handleFreeze} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-text-dim block mb-1">Термін заморозки</label>
                <select 
                  value={freezeDuration}
                  onChange={(e) => setFreezeDuration(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm"
                >
                  <option value="60">1 година</option>
                  <option value="180">3 години</option>
                  <option value="1440">1 доба</option>
                  <option value="4320">3 доби</option>
                  <option value="10080">1 тиждень</option>
                  <option value="-1">Назавжди</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-text-dim block mb-1">Причина заморозки</label>
                <textarea 
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder="Вкажіть вагому причину..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm h-24 resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsFreezing(false)}
                  className="flex-1 py-3 rounded-xl font-black uppercase tracking-tighter text-xs bg-white/5 text-white hover:bg-white/10 transition-all"
                >
                  Скасувати
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-black uppercase tracking-tighter text-xs bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Заморозити
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
