import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Registration } from './pages/Registration';
import { Dashboard } from './pages/Dashboard';
import { Loader2, AlertTriangle } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="h-[100dvh] bg-[#0A0A0C] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">Стався збій</h2>
      <p className="text-text-muted text-[10px] uppercase tracking-widest max-w-md mb-8">
        Виникла помилка в ігровому інтерфейсі.
        <br />
        <span className="opacity-50 mt-2 block">{error.message}</span>
      </p>
      <button 
        onClick={resetErrorBoundary}
        className="px-8 py-4 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-opacity-90 transition-all active:scale-95"
      >
        Спробувати знову
      </button>
    </div>
  );
}

const AppContent: React.FC = () => {
  const { user, profile, loading, isRecovering } = useAuth();
  const [showBypass, setShowBypass] = useState(false);

  // Fallback if stuck in loading for too long
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading || isRecovering) {
        console.warn('App: Loading timeout reached, showing bypass option');
        setShowBypass(true);
      }
    }, 12000); // 12 seconds

    return () => clearTimeout(timer);
  }, [loading, isRecovering]);

  if ((loading || isRecovering) && !showBypass) {
    return (
      <div className="h-[100dvh] bg-[#0A0A0C] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-ukraine-blue animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-muted animate-pulse">
            {isRecovering ? 'Відновлення вашого профілю за email...' : 'Синхронізація з сервером...'}
        </p>
      </div>
    );
  }

  if (loading && showBypass) {
    console.log('App: Stuck in loading, showing bypass. User:', !!user, 'Profile:', !!profile);
    return (
      <div className="h-[100dvh] bg-[#0A0A0C] flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
           <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
        </div>
        <div className="space-y-2">
            <h1 className="text-xl font-black text-white uppercase tracking-widest">Проблема підключення</h1>
            <p className="text-[10px] text-text-muted uppercase tracking-widest max-w-xs mx-auto">Сервер занадто довго не відповідає. Спробуйте оновити сторінку або перевірити інтернет.</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-xl"
        >
          Оновити
        </button>
      </div>
    );
  }

  if (!user || !profile || !profile.firstName) {
    if (user && !loading && (!profile || !profile.firstName)) {
       console.log('App: User exists but profile/firstName missing, showing Registration');
    }
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
        <Registration />
      </ErrorBoundary>
    );
  }

  console.log('App: Rendering Dashboard');
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
      <Dashboard />
    </ErrorBoundary>
  );
};

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
