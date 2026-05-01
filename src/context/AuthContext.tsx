import React, { createContext, useContext, useEffect, useState } from 'react';
import { backend } from '../services/backendService';

interface BankCard {
  type: 'e-support' | 'pension' | 'standard' | 'usd' | 'eur';
  number: string;
  createdAt: string;
  passportId: string;
  label: string;
  balance: number;
}

interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  sex: 'M' | 'F';
  birthDate: string;
  passportPhoto: string;
  signature: string;
  balance: number;
  socialRating: number;
  status: string;
  role?: string;
  partnerId?: string;
  taxDebt?: number;
  dailyTax?: number;
  lastTaxUpdate?: any;
  isFrozen?: boolean;
  isVerified?: boolean;
  bankCards?: BankCard[];
  businesses?: {
    businessId: string;
    purchasedAt: any;
    customName?: string;
    isStocked?: boolean;
    lastActionAt?: any;
    lastProfitAt?: any;
    stockReady?: boolean; 
    stockPurchasedAt?: string;
    lastOpexAt?: string;
  }[];
  muteUntil?: string | null;
  freezeUntil?: string;
  freezeReason?: string;
  updatedAt?: any;
}

const getTaxPercent = (sr: number) => {
  if (sr >= 500) return 0.25;
  if (sr >= 301) return 0.15;
  if (sr >= 101) return 0.10;
  return 0.05;
};

interface OnlinePlayer {
  uid: string;
  name: string;
  lastActive: any;
  status?: string;
}

interface AuthUser {
  uid: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isRecovering: boolean;
  onlinePlayers: OnlinePlayer[];
  refreshProfile: () => Promise<void>;
  updateProfile: (newProfile: UserProfile) => void;
  login: (credentials: any) => Promise<any>;
  register: (credentials: any) => Promise<any>;
  logout: () => void;
  updateBusinessState: (businessId: string, updates: Partial<any>) => Promise<void>;
  collectProfits: (businessId: string, gross: number, evade?: boolean) => Promise<{ netProfit: number; taxAmount: number; evade: boolean } | undefined>;
  buyGlobalStock: () => Promise<number>;
  endDay: () => Promise<number>;
  taxRate: number;
  globalBudget: number;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true,
  isRecovering: false,
  onlinePlayers: [],
  refreshProfile: async () => {},
  updateProfile: () => {},
  login: async () => ({}),
  register: async () => ({}),
  logout: () => {},
  updateBusinessState: async () => {},
  collectProfits: async () => undefined,
  buyGlobalStock: async () => 0,
  endDay: async () => 0,
  taxRate: 0.20,
  globalBudget: 1000000
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [globalTaxRate, setGlobalTaxRate] = useState(0.20);
  const [globalBudget, setGlobalBudget] = useState(1000000);

  const updateProfile = (newProfile: UserProfile) => {
    if (newProfile) {
      setProfile(newProfile);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const data = await backend.getProfile(user.uid, user.email || undefined);
      if (data) {
        setProfile(data);
      }
    }
  };

  const handleSetUser = (u: AuthUser | null, token?: string) => {
    setUser(u);
    if (u) {
      localStorage.setItem("user", JSON.stringify(u));
      if (token) localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  };

  const login = async (credentials: any) => {
    const data = await backend.login(credentials);
    if (data.success && data.user) {
      handleSetUser(data.user, data.token);
      // Use profile from response if available, otherwise fetch
      if (data.profile) {
        setProfile(data.profile);
      } else {
        const profileData = await backend.getProfile(data.user.uid, data.user.email || undefined);
        setProfile(profileData);
      }
    }
    return data;
  };

  const registerUser = async (credentials: any) => {
    const data = await backend.register(credentials);
    if (data.success && data.user) {
      handleSetUser(data.user, data.token);
      if (data.profile) {
        setProfile(data.profile);
      } else {
        setProfile(null);
      }
    }
    return data;
  };

  const logout = () => {
    handleSetUser(null);
    setProfile(null);
    backend.disconnect();
    window.location.href = '/'; // Simple redirect on logout
  };

  const updateBusinessState = async (businessId: string, updates: Partial<any>) => {
    if (!profile) return;
    const newBusinesses = profile.businesses?.map(b => 
      b.businessId === businessId ? { ...b, ...updates } : b
    );
    const updatedProfile = { ...profile, businesses: newBusinesses, updatedAt: new Date().toISOString() };
    await backend.saveProfile(updatedProfile);
  };

  const collectProfits = async (businessId: string, gross: number, evade: boolean = false) => {
    if (!profile) return;
    
    try {
      const res = await backend.authFetch('/api/business/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, amount: gross, payTax: !evade })
      });
      
      const data = await res.json();
      if (data.success) {
        await refreshProfile();
        return { netProfit: data.netProfit, taxAmount: data.taxPaid, evade };
      } else {
        alert(`Помилка при зборі прибутку: ${data.error || 'Невідома помилка'}`);
      }
    } catch (error) {
      console.error('Collect error:', error);
      alert('Помилка мережі при зборі прибутку');
    }
  };

  const buyGlobalStock = async () => {
    if (!profile) return 0;
    const { BUSINESS_TYPES } = await import('../constants');
    const totalStockCost = profile.businesses?.reduce((acc, b) => {
      const meta = BUSINESS_TYPES.find(m => m.id === b.businessId);
      return acc + (meta?.stockCost || 0);
    }, 0) || 0;

    const now = new Date().toISOString();
    const newBusinesses = profile.businesses?.map(b => ({
      ...b,
      isStocked: true,
      stockReady: true,
      stockPurchasedAt: now,
      lastProfitAt: now,
      lastActionAt: now
    }));

    const updatedProfile = {
      ...profile,
      balance: profile.balance - totalStockCost,
      businesses: newBusinesses,
      updatedAt: now
    };

    await backend.saveProfile(updatedProfile);
    return totalStockCost;
  };

  const endDay = async () => {
    if (!profile) return 0;
    const { BUSINESS_TYPES } = await import('../constants');
    const totalOpex = profile.businesses?.reduce((acc, b) => {
      const meta = BUSINESS_TYPES.find(m => m.id === b.businessId);
      return acc + (meta?.opex || 0);
    }, 0) || 0;

    const now = new Date().toISOString();
    const newBusinesses = profile.businesses?.map(b => ({
      ...b,
      lastOpexAt: now
    }));

    const updatedProfile = {
      ...profile,
      balance: profile.balance - totalOpex,
      businesses: newBusinesses,
      updatedAt: now
    };

    await backend.saveProfile(updatedProfile);
    return totalOpex;
  };

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let playersUnsubscribe: (() => void) | null = null;
    let globalUnsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      const token = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");

      if (token && savedUser) {
        try {
          // Verify with backend
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!res.ok) {
            if (res.status === 401) {
              handleSetUser(null);
              setLoading(false);
              return;
            }
            // For 502, 503 etc, don't logout immediately, just stop loading and let it retry
            setLoading(false);
            return;
          }
          
          const data = await res.json();
          setUser(data.user);
          
          // Subscriptions
          globalUnsubscribe = backend.onGlobalStateUpdate((state) => {
            if (state) {
              setGlobalTaxRate(state.taxRate || 0.20);
              setGlobalBudget(state.budget || 0);
            }
          });

          profileUnsubscribe = backend.onProfileUpdate(data.user.uid, data.user.email, (profileData) => {
            if (profileData) {
              setProfile(profileData);
              setLoading(false);
              
              if (profileData.firstName) {
                backend.joinGame({
                  uid: data.user.uid,
                  name: `${profileData.firstName} ${profileData.lastName}`,
                  status: 'online'
                });
              }
            } else {
              // Only stop loading if we get a definitive "null" (no profile in DB)
              setProfile(null);
              setLoading(false);
            }
          });

          playersUnsubscribe = backend.onPlayersUpdate((players) => {
            setOnlinePlayers(players);
          });

        } catch (e) {
          console.warn("Auth init failed", e);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      if (profileUnsubscribe) profileUnsubscribe();
      if (playersUnsubscribe) playersUnsubscribe();
      if (globalUnsubscribe) globalUnsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
        user, 
        profile, 
        loading, 
        isRecovering,
        onlinePlayers, 
        refreshProfile, 
        updateProfile,
        login, 
        register: registerUser, 
        logout,
        updateBusinessState,
        collectProfits,
        buyGlobalStock,
        endDay,
        taxRate: globalTaxRate,
        globalBudget
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
