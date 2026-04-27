import React, { createContext, useContext, useEffect, useState } from 'react';
import { backend } from '../services/backendService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

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
  createdAt: any;
  updatedAt: any;
}

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

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let playersUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Cleanup previous subscriptions
      if (profileUnsubscribe) profileUnsubscribe();
      if (playersUnsubscribe) playersUnsubscribe();

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
                profileData = { ...profileData, role: 'admin', status: 'Головний Адмін' };
                await backend.saveProfile(profileData);
            }
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
          }
        }, (error) => {
          console.error("Profile sync error:", error);
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
      setLoading(false);
    });

    return () => {
      unsubscribe();
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
        logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
