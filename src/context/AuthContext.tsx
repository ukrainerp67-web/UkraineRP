import React, { createContext, useContext, useEffect, useState } from 'react';
import { backend } from '../services/backendService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const authUser: AuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
        };
        setUser(authUser);
        localStorage.setItem("user", JSON.stringify(authUser));

        try {
          // Clear legacy short IDs from localStorage if they exist
          if (authUser.uid.length < 10 && !authUser.uid.includes('-')) {
             console.warn("Legacy UID detected, forcing logout");
             await backend.logout();
             return;
          }

          let profileData = await backend.getProfile(firebaseUser.uid, firebaseUser);
          
          // Promote yourself to admin automatically for testing
          const isAdminEmail = firebaseUser.email === 'ukrainerp67@gmail.com'; 
          if (isAdminEmail) {
              if (!profileData || profileData.role !== 'admin') {
                 // Ensure profile object exists and has admin role
                 profileData = {
                   ...(profileData || {}),
                   uid: firebaseUser.uid,
                   email: firebaseUser.email || '',
                   role: 'admin',
                   firstName: (profileData as any)?.firstName || 'Admin',
                   lastName: (profileData as any)?.lastName || 'RP',
                   balance: (profileData as any)?.balance || 1000000,
                   socialRating: (profileData as any)?.socialRating || 999,
                   status: 'Головний Адмін'
                 };
                 await backend.saveProfile(profileData);
              }
          }

          setProfile(profileData as UserProfile);

          if (profileData) {
            backend.joinGame({
              uid: firebaseUser.uid,
              name: `${(profileData as any).firstName} ${(profileData as any).lastName}`,
              status: 'online'
            });
          }
          
          backend.onPlayersUpdate((players) => {
            setOnlinePlayers(players);
          });

        } catch (e) {
          console.error("Profile fetch error:", e);
        }
      } else {
        setUser(null);
        setProfile(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
