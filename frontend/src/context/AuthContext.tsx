'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../lib/api';

export interface Company {
  id: string;
  name: string;
  currency?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  totalBranches?: number;
  totalUsers?: number;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  isHub: boolean;
  address?: string;
  isActive: boolean;
  _count?: {
    users: number;
    productStocks: number;
  };
}

export interface User {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  branchId: string | null;
  branch?: Branch | null;
  salary?: number | null;
  shift?: string | null;
  avatarUrl?: string | null;
  filesUrl?: string | null;
  isActive?: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

interface AuthContextType {
  company: Company | null;
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  branches: Branch[];
  activeBranch: Branch | null;
  isLoading: boolean;
  login: (data: LoginResponse) => void;
  loginWithPassword: (phone: string, pass: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  switchBranch: (branchId: string) => void;
  logout: () => void;
  updateUser: (updated: Partial<User>) => void;
  refreshBranches: () => Promise<void>;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updateUser = useCallback((updated: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('erp_user', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const refreshCompany = useCallback(async () => {
    try {
      const res = await apiRequest<{ company: Company }>('/company');
      if (res.data?.company) {
        setCompany(res.data.company);
      }
    } catch {}
  }, []);

  const refreshBranches = useCallback(async () => {
    try {
      const res = await apiRequest<{ branches: Branch[] }>('/branches');
      if (res.data?.branches) {
        setBranches(res.data.branches);

        if (user?.branch) {
          setActiveBranch(user.branch);
        } else {
          const savedBranchId =
            localStorage.getItem('selectedBranchId') ||
            localStorage.getItem('habesha_active_branch_id');
          const targetBranch =
            res.data.branches.find((b) => b.id === savedBranchId) ||
            res.data.branches[0] ||
            null;

          setActiveBranch(targetBranch);
        }
      }
    } catch {}
  }, [user]);

  // Load initial session from localStorage
  useEffect(() => {
    refreshCompany();

    const savedToken =
      localStorage.getItem('token') || localStorage.getItem('habesha_token');
    const storedUser = localStorage.getItem('erp_user');

    if (savedToken) {
      setToken(savedToken);

      // Rehydrate user immediately to prevent flicker
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          if (parsed.branch) {
            setActiveBranch(parsed.branch);
          }
        } catch {}
      }

      // Re-validate session with backend
      apiRequest<{ user: User }>('/auth/me')
        .then((res) => {
          const fetchedUser = res.data?.user || (res.data as any);
          if (fetchedUser && fetchedUser.id) {
            setUser(fetchedUser);
            localStorage.setItem('erp_user', JSON.stringify(fetchedUser));
            if (fetchedUser.branch) {
              setActiveBranch(fetchedUser.branch);
            }
          } else {
            // Token is invalid
            localStorage.removeItem('token');
            localStorage.removeItem('habesha_token');
            localStorage.removeItem('erp_user');
            setToken(null);
            setUser(null);
          }
        })
        .catch(() => {
          // If offline or network error, keep stored user state
        })
        .finally(() => setIsLoading(false));
    } else {
      localStorage.removeItem('erp_user');
      setIsLoading(false);
    }

    const handleAuthError = () => {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('habesha_token');
      localStorage.removeItem('erp_user');
    };

    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, [refreshCompany]);

  // Fetch branches once authenticated
  useEffect(() => {
    if (user && token) {
      refreshBranches();
    }
  }, [user, token, refreshBranches]);

  const login = useCallback((data: LoginResponse) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('habesha_token', data.token);
    try {
      localStorage.setItem('erp_user', JSON.stringify(data.user));
    } catch {}
    setToken(data.token);
    setUser(data.user);
    if (data.user.branch) {
      setActiveBranch(data.user.branch);
      localStorage.setItem('selectedBranchId', data.user.branch.id);
      localStorage.setItem('habesha_active_branch_id', data.user.branch.id);
    }
  }, []);

  const loginWithPassword = async (phone: string, pass: string) => {
    const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password: pass }),
    });

    const userObj = res.data?.user || (res.data as any);
    const tokenStr = res.data?.token;

    if (tokenStr && userObj && userObj.id) {
      login({ token: tokenStr, user: userObj });
      return { success: true, user: userObj };
    }

    return { success: false, error: res.error || 'Login failed' };
  };

  const switchBranch = (branchId: string) => {
    if (user?.role !== 'OWNER' && user?.role !== 'ADMIN') {
      return;
    }
    const found = branches.find((b) => b.id === branchId);
    if (found) {
      setActiveBranch(found);
      localStorage.setItem('selectedBranchId', found.id);
      localStorage.setItem('habesha_active_branch_id', found.id);
    }
  };

  const logout = () => {
    apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('habesha_token');
    localStorage.removeItem('erp_user');
    localStorage.removeItem('selectedBranchId');
    localStorage.removeItem('habesha_active_branch_id');
    setToken(null);
    setUser(null);
    setActiveBranch(null);
  };

  return (
    <AuthContext.Provider
      value={{
        company,
        user,
        token,
        isAuthenticated: !!user,
        branches,
        activeBranch,
        isLoading,
        login,
        loginWithPassword,
        switchBranch,
        logout,
        updateUser,
        refreshBranches,
        refreshCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
