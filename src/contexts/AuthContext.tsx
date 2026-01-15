import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

import { API_BASE_URL } from "@/lib/config";
const API_BASE = API_BASE_URL;

export interface User {
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  institution?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<boolean>;
  signup: (email: string, pass: string, name: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Initialize: Check local storage for persistent session
  useEffect(() => {
    const saved = localStorage.getItem('vectorix_user');
    if (saved) {
      try { 
        setUser(JSON.parse(saved)); 
      } catch (e) { 
        localStorage.removeItem('vectorix_user'); 
      }
    }
    setIsLoading(false);
  }, []);

  // 2. Real Login
  const login = async (email: string, pass: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");

      // Success: Save user
      setUser(data.user);
      localStorage.setItem('vectorix_user', JSON.stringify(data.user));
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    }
  };

  // 3. Real Signup
  const signup = async (email: string, pass: string, name: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, name })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Signup failed");

      setUser(data.user);
      localStorage.setItem('vectorix_user', JSON.stringify(data.user));
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    }
  };

  // 4. Logout
  const logout = () => {
    setUser(null);
    localStorage.removeItem('vectorix_user');
    toast.info("Logged out");
  };

  // 5. Update Profile
  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/auth/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, ...updates })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);

      const newUser = data.user;
      setUser(newUser);
      localStorage.setItem('vectorix_user', JSON.stringify(newUser));
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error("Update failed");
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};