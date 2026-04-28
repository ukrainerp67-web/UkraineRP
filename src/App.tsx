import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Registration } from './pages/Registration';
import { Dashboard } from './pages/Dashboard';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [showBypass, setShowBypass] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setShowBypass(true);
    }, 10000); // 10 seconds timeout for very slow connections

    // Test Firestore connectivity (non-blocking)
    const testFirestore = async () => {
      try {
        const { doc, getDocFromServer } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        // Use a timeout for the health check
        const healthPromise = getDocFromServer(doc(db, '_health_', 'check'));
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
        
        await Promise.race([healthPromise, timeoutPromise]);
        console.log("Firestore connection: OK");
      } catch (e: any) {
        console.warn("Firestore connectivity check failed:", e.message);
        // Do NOT block the app by default unless loading is actually true for too long
      }
    };
    testFirestore();

    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !showBypass) {
    return (
      <div className="h-[100dvh] bg-[#0A0A0C] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-ukraine-blue animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-muted animate-pulse">
            Синхронізація з сервером...
        </p>
      </div>
    );
  }

  if (loading && showBypass) {
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

  if (!user || !profile) {
    return <Registration />;
  }

  return <Dashboard />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
