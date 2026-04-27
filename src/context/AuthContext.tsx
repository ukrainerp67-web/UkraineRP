import React, { createContext, useContext, useEffect, useState } from 'react';
import { backend } from '../services/backendService';

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

  const logout = () => {
    handleSetUser(null);
    setProfile(null);
    backend.disconnect();
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = backend.getToken();
      if (token) {
        try {
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            
            let profileData = await backend.getProfile(parsedUser.uid);
            
            // Promote yourself to admin automatically for testing
            const isAdminEmail = parsedUser.email === 'ukrainerp67@gmail.com'; 
            if (profileData && isAdminEmail && profileData.role !== 'admin') {
                profileData.role = 'admin';
                await backend.saveProfile(profileData);
            }

            setProfile(profileData);

            if (profileData) {
              backend.joinGame({
                uid: parsedUser.uid,
                name: `${profileData.firstName} ${profileData.lastName}`,
                status: 'online'
              });
            }
            backend.onPlayersUpdate((players) => {
              setOnlinePlayers(players);
            });
          }
        } catch (e) {
          console.error("Auth check error:", e);
        }
      }
      setLoading(false);
    };

    checkAuth();
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
