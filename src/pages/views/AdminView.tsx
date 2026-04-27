import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Shield, TrendingUp, DollarSign, Search, Edit3, Trash2, Crown, Activity, Database, MessageSquare } from 'lucide-react';
import { backend } from '../../services/backendService';

export const AdminView: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([
        backend.getAdminUsers(),
        backend.getAdminStats()
      ]);
      setUsers(usersData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      await backend.adminUpdateUser(selectedUser.uid, {
        balance: Number(selectedUser.balance),
        socialRating: Number(selectedUser.socialRating),
        role: selectedUser.role
      });
      alert('Дані оновлено!');
      setIsEditing(false);
      fetchData();
    } catch (error) {
      alert('Помилка оновлення');
    }
  };

  const filteredUsers = users.filter(u => 
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.uid.includes(searchQuery)
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
              <DollarSign className="w-4 h-4" />
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
      <div className="bg-card-dark border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <Shield className="w-5 h-5 text-ukraine-blue" />
            Керування гравцями
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input 
              type="text"
              placeholder="Пошук за ім'ям або ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-ukraine-blue w-full md:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black text-text-dim uppercase tracking-widest">
                <th className="px-6 py-4">Гравець</th>
                <th className="px-6 py-4">Баланс</th>
                <th className="px-6 py-4">Рейтинг</th>
                <th className="px-6 py-4">Роль</th>
                <th className="px-6 py-4 text-right">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold overflow-hidden border border-white/5">
                        {user.passportPhoto ? <img src={user.passportPhoto} className="w-full h-full object-cover" /> : user.firstName[0]}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{user.firstName} {user.lastName}</div>
                        <div className="text-[10px] text-text-dim font-mono">{user.uid.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-ukraine-yellow">₴{user.balance.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs font-bold text-ukraine-blue">{user.socialRating}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-ukraine-blue/20 text-ukraine-blue' : 'bg-white/10 text-white'}`}>
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => { setSelectedUser(user); setIsEditing(true); }}
                      className="p-2 hover:bg-white/10 rounded-lg text-text-dim hover:text-white transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
              <div>
                <label className="text-[10px] font-black uppercase text-text-dim block mb-1">Баланс (₴)</label>
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
              <div>
                <label className="text-[10px] font-black uppercase text-text-dim block mb-1">Роль</label>
                <select 
                  value={selectedUser.role || 'user'}
                  onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm"
                >
                  <option value="user">Гравець</option>
                  <option value="admin">Адміністратор</option>
                </select>
              </div>

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
    </div>
  );
};
