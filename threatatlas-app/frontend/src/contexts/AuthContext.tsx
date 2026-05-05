import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  role: 'admin' | 'standard' | 'read_only';
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (accessToken: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  canWrite: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { access_token } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);

    // Fetch user data immediately after login
    try {
      const userResponse = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      setUser(userResponse.data);
    } catch (error) {
      console.error('Failed to fetch user after login:', error);
      // Clean up on failure
      localStorage.removeItem('token');
      setToken(null);
      throw error;
    }
  };

  const loginWithToken = async (accessToken: string) => {
    localStorage.setItem('token', accessToken);
    setToken(accessToken);

    try {
      const userResponse = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setUser(userResponse.data);
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const canWrite = user?.role === 'admin' || user?.role === 'standard';

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      loginWithToken,
      logout,
      isAuthenticated: !!user,
      isLoading,
      isAdmin,
      canWrite
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
