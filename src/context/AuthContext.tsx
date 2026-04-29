import React, { createContext, useContext, useEffect, useState } from 'react';
import { backend } from '../services/backendService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

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
  onlinePlayers: OnlinePlayer[];
  refreshProfile: () => Promise<void>;
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
  onlinePlayers: [],
  refreshProfile: async () => {},
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
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [globalTaxRate, setGlobalTaxRate] = useState(0.20);
  const [globalBudget, setGlobalBudget] = useState(1000000);

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
    
    // Use global tax rate instead of local SR-based one for business
    const taxRate = globalTaxRate;
    const taxAmount = evade ? 0 : Math.floor(gross * taxRate);
    const netProfit = gross - taxAmount;

    const now = new Date().toISOString();
    const newBusinesses = profile.businesses?.map(b => 
      b.businessId === businessId ? { 
        ...b, 
        lastProfitAt: now,
        lastActionAt: now 
      } : b
    );

    const updatedProfile = { 
      ...profile, 
      balance: profile.balance + netProfit,
      socialRating: evade ? Math.max(0, profile.socialRating - 20) : profile.socialRating + 5,
      businesses: newBusinesses,
      updatedAt: now
    };

    // If card exists, update card balance instead of global balance
    if (updatedProfile.bankCards && updatedProfile.bankCards.length > 0) {
       const cardIdx = updatedProfile.bankCards.findIndex(c => c.type === 'standard');
       const actualIdx = cardIdx !== -1 ? cardIdx : 0;
       updatedProfile.bankCards[actualIdx].balance = (Number(updatedProfile.bankCards[actualIdx].balance) || 0) + netProfit;
    }

    if (!evade && taxAmount > 0) {
      // THIS IS THE CRITICAL LINE: Ensure it waits for the budget update
      const budgetResult = await backend.addToBudget(taxAmount);
      if (!budgetResult.success) {
          console.error("Failed to add to budget", budgetResult.error);
      }
      
      await backend.logEvent({
        type: 'tax',
        player: `${profile.firstName} ${profile.lastName}`,
        message: `сплачено податків на суму ₴${taxAmount.toLocaleString()} до держбюджету (Виручка: ₴${gross.toLocaleString()})`
      });
    } else if (evade) {
      await backend.logEvent({
        type: 'evade',
        player: `${profile.firstName} ${profile.lastName}`,
        message: `ризикнув та забрав весь прибуток ₴${gross.toLocaleString()} собі в кишеню`
      });
    }

    await backend.saveProfile(updatedProfile);
    return { netProfit, taxAmount, evade };
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
    
    await backend.logEvent({
      type: 'stock',
      player: `${profile.firstName} ${profile.lastName}`,
      message: `закупив товар для всіх своїх підприємств на суму ₴${totalStockCost.toLocaleString()}!`
    });

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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth State Changed: Firebase UID =", firebaseUser?.uid);
      // Cleanup previous subscriptions
      if (profileUnsubscribe) profileUnsubscribe();
      if (playersUnsubscribe) playersUnsubscribe();
      if (globalUnsubscribe) globalUnsubscribe();

      try {
        if (firebaseUser) {
          const authUser: AuthUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
          };
          setUser(authUser);
          localStorage.setItem("user", JSON.stringify(authUser));

          // 0. Global state listener
          globalUnsubscribe = backend.onGlobalStateUpdate((state) => {
            if (state) {
              setGlobalTaxRate(state.taxRate || 0.20);
              setGlobalBudget(state.budget || 0);
            }
          });

          // 1. Profile real-time polling replacement for onSnapshot
          profileUnsubscribe = backend.onProfileUpdate(firebaseUser.uid, async (profileData) => {
            console.log("AuthContext: Received profile data from backend:", profileData ? 'Found' : 'Null');
            
            // Set loading false once we've attempted to fetch the profile
            setLoading(false);

            if (!profileData) {
                return;
            }
            
            const isAdminEmail = firebaseUser.email === 'ukrainerp67@gmail.com'; 
            let needsUpdate = false;
            const updates: any = {};

            // --- MIGRATION: Old single card to array ---
            if ((profileData as any).bankCard && !profileData.bankCards) {
                const oldCard = (profileData as any).bankCard;
                profileData.bankCards = [{
                    type: oldCard.type || 'standard',
                    number: oldCard.number || '0000 0000 0000 0000',
                    balance: oldCard.balance || profileData.balance || 0,
                    createdAt: oldCard.createdAt || new Date().toISOString(),
                    passportId: oldCard.passportId || '',
                    label: oldCard.label || 'Основна карта'
                }];
                needsUpdate = true;
                updates.bankCards = profileData.bankCards;
                updates.bankCard = null; // Cleanup
            }

            if (isAdminEmail && (profileData.role !== 'admin' || !profileData.isVerified)) {
                profileData.role = 'admin';
                profileData.status = 'Головний Адмін';
                profileData.isVerified = true;
                needsUpdate = true;
                updates.role = 'admin';
                updates.status = 'Головний Адмін';
                updates.isVerified = true;
            }

            if (needsUpdate) {
               await backend.patchProfile(firebaseUser.uid, updates);
            }

            // Ensure data defaults
            profileData = {
              businesses: [],
              taxDebt: 0,
              ...profileData
            };

            // Super admin omni-privileges and immunity
            if (isAdminEmail) {
              profileData.role = 'admin';
              profileData.status = 'Головний Адмін';
              profileData.isFrozen = false;
              profileData.muteUntil = null;
              profileData.isVerified = true;
            }

            setProfile(profileData);
            setLoading(false); // Successfully loaded profile
            
            // Re-join game with presence
            backend.joinGame({
              uid: firebaseUser.uid,
              name: `${profileData.firstName} ${profileData.lastName}`,
              status: 'online'
            });
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
          setLoading(false); // Immediate for non-logged users
        }
      } catch (err) {
        console.error("Error in onAuthStateChanged wrapper:", err);
        setLoading(false); // Cleanup on error
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
      if (globalUnsubscribe) globalUnsubscribe();
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
