import React, { createContext, useContext, useEffect, useState } from 'react';
import { backend } from '../services/backendService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

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
  businesses?: {
    businessId: string;
    purchasedAt: any;
    customName?: string;
    isStocked?: boolean;
    lastActionAt?: any;
    lastProfitAt?: any;
    stockReady?: boolean; // Готовність до збору прибутку
  }[];

  // ... rest of the interface
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
  onlinePlayers: OnlinePlayer[];
  refreshProfile: () => Promise<void>;
  login: (credentials: any) => Promise<any>;
  register: (credentials: any) => Promise<any>;
  logout: () => void;
  updateBusinessState: (businessId: string, updates: Partial<any>) => Promise<void>;
  collectProfits: (businessId: string, gross: number, evade?: boolean) => Promise<{ netProfit: number; taxAmount: number; evade: boolean } | undefined>;
  endDay: () => Promise<number>;
  taxRate: number;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true,
  onlinePlayers: [],
  refreshProfile: async () => {},
  login: async () => ({}),
  register: async () => ({}),
  logout: () => {},
  updateBusinessState: async () => {},
  collectProfits: async () => undefined,
  endDay: async () => 0,
  taxRate: 0.05
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);

  const refreshProfile = async () => {
    if (user) {
      const data = await backend.getProfile(user.uid);
      if (data) {
        setProfile(data);
      }
    }
  };

  const handleSetUser = (u: AuthUser | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem("user", JSON.stringify(u));
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  };

  const login = async (credentials: any) => {
    const data = await backend.login(credentials);
    if (data.user) {
      handleSetUser(data.user);
      const profileData = await backend.getProfile(data.user.uid);
      setProfile(profileData);
    }
    return data;
  };

  const registerUser = async (credentials: any) => {
    const data = await backend.register(credentials);
    if (data.user) {
      handleSetUser(data.user);
      setProfile(null);
    }
    return data;
  };

  const logout = async () => {
    try {
      await backend.logout();
      setUser(null);
      setProfile(null);
      backend.disconnect();
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const updateBusinessState = async (businessId: string, updates: Partial<any>) => {
    if (!profile) return;
    const newBusinesses = profile.businesses?.map(b => 
      b.businessId === businessId ? { ...b, ...updates } : b
    );
    const updatedProfile = { ...profile, businesses: newBusinesses, updatedAt: new Date().toISOString() };
    await backend.saveProfile(updatedProfile);
    // Profile is updated via listener
  };

  const collectProfits = async (businessId: string, gross: number, evade: boolean = false) => {
    if (!profile) return;
    const taxRate = getTaxPercent(profile.socialRating);
    const taxAmount = evade ? 0 : Math.floor(gross * taxRate);
    const netProfit = gross - taxAmount;

    const newBusinesses = profile.businesses?.map(b => 
      b.businessId === businessId ? { 
        ...b, 
        isStocked: false, 
        stockReady: false, 
        lastProfitAt: new Date().toISOString(),
        lastActionAt: null 
      } : b
    );

    const updatedProfile = { 
      ...profile, 
      balance: profile.balance + netProfit,
      socialRating: evade ? Math.max(0, profile.socialRating - 20) : profile.socialRating + 5,
      businesses: newBusinesses,
      updatedAt: new Date().toISOString()
    };

    if (!evade && taxAmount > 0) {
      await backend.addToBudget(taxAmount);
    }
    await backend.saveProfile(updatedProfile);
    return { netProfit, taxAmount, evade };
  };

  const endDay = async () => {
    if (!profile) return 0;
    const { BUSINESS_TYPES } = await import('../constants');
    const totalOpex = profile.businesses?.reduce((acc, b) => {
      const meta = BUSINESS_TYPES.find(m => m.id === b.businessId);
      return acc + (meta?.opex || 0);
    }, 0) || 0;

    const updatedProfile = {
      ...profile,
      balance: profile.balance - totalOpex,
      updatedAt: new Date().toISOString()
    };

    await backend.saveProfile(updatedProfile);
    return totalOpex;
  };

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let playersUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.uid);
      // Cleanup previous subscriptions
      if (profileUnsubscribe) profileUnsubscribe();
      if (playersUnsubscribe) playersUnsubscribe();

      try {
        if (firebaseUser) {
          const authUser: AuthUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
          };
          setUser(authUser);
          localStorage.setItem("user", JSON.stringify(authUser));

          // 1. Profile real-time listener
          profileUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
            if (snapshot.exists()) {
              let profileData = snapshot.data() as UserProfile;
              const isAdminEmail = firebaseUser.email === 'ukrainerp67@gmail.com'; 
              if (isAdminEmail && profileData.role !== 'admin') {
                  try {
                    await updateDoc(doc(db, 'users', firebaseUser.uid), {
                      role: 'admin',
                      status: 'Головний Адмін',
                      updatedAt: serverTimestamp()
                    });
                  } catch (error) {
                    console.warn("Auto-admin promotion delayed", error);
                  }
              }

              // Ensure data defaults
              profileData = {
                businesses: [],
                taxDebt: 0,
                ...profileData
              };

              setProfile(profileData);
              
              // Re-join game with presence
              backend.joinGame({
                uid: firebaseUser.uid,
                name: `${profileData.firstName} ${profileData.lastName}`,
                status: 'online'
              });
            } else {
              const profileData = await backend.getProfile(firebaseUser.uid, firebaseUser);
              if (profileData) setProfile(profileData as UserProfile);
              else setProfile(null);
            }
          }, (error) => {
            console.error("Profile sync error:", error);
            // Even if profile fails, we are "logged in" as auth user
          });

          // 2. Global players listener
          playersUnsubscribe = backend.onPlayersUpdate((players) => {
            setOnlinePlayers(players);
          });

        } else {
          setUser(null);
          setProfile(null);
          setOnlinePlayers([]);
          localStorage.removeItem("user");
          localStorage.removeItem("token");
        }
      } catch (err) {
        console.error("Error in onAuthStateChanged wrapper:", err);
      } finally {
        setLoading(false);
      }
    });

    // Failsafe: force loading false after 8 seconds if it's still stuck
    const failsafe = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn("Auth loading failsafe triggered");
          return false;
        }
        return prev;
      });
    }, 8000);

    return () => {
      unsubscribe();
      clearTimeout(failsafe);
      if (profileUnsubscribe) profileUnsubscribe();
      if (playersUnsubscribe) playersUnsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
        user, 
        profile, 
        loading, 
        onlinePlayers, 
        refreshProfile, 
        login, 
        register: registerUser, 
        logout,
        updateBusinessState,
        collectProfits,
        endDay,
        taxRate: profile ? getTaxPercent(profile.socialRating) : 0.05
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
