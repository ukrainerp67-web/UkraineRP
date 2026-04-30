import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services/backendService';
import { LogOut, Trash2, Volume2, Monitor, Settings } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { profile, logout } = useAuth();

  const handleLogout = () => logout();
  
  const handleDeleteAccount = async () => {
    if (!profile) return;
    const confirm = window.confirm('Ви впевнені, що хочете видалити акаунт? Цю дію неможливо скасувати.');
    if (confirm) {
      try {
        await backend.deleteProfile(profile.uid);
        logout();
      } catch (error) {
        console.error('Error deleting account', error);
        logout();
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24">
      <header className="flex justify-between items-center bg-card-dark p-4 rounded-xl border border-border-dark">
        <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
          <Settings className="w-6 h-6 text-gray-400" />
          Налаштування
        </h2>
      </header>

      <section className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Графіка та Звук</h3>
        <div className="game-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm font-bold">Якість графіки</p>
                <p className="text-[10px] text-gray-500">Висока роздільна здатність активна</p>
              </div>
            </div>
            <select className="bg-black border border-border-dark rounded p-1 text-xs">
              <option>Ultra</option>
              <option>High</option>
              <option>Medium</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm font-bold">Ефекти та музика</p>
                <p className="text-[10px] text-gray-500">Гучність 80%</p>
              </div>
            </div>
            <input type="range" className="accent-blue-400 w-32" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Акаунт</h3>
        <div className="game-card p-6 space-y-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-yellow-400" />
              <span className="text-sm font-bold">Вийти з акаунту</span>
            </div>
          </button>

          <button
            onClick={handleDeleteAccount}
            className="w-full flex items-center justify-between p-4 bg-red-400/5 border border-red-400/10 rounded-xl hover:bg-red-400/20 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-500" />
              <span className="text-sm font-bold text-red-100">Видалити акаунт назавжди</span>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};
