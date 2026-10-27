'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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
}

interface AuthContextType {
  company: Company | null;
  user: User | null;
  token: string | null;
  branches: Branch[];
  activeBranch: Branch | null;
  isLoading: boolean;
  loginWithPassword: (phone: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  switchBranch: (branchId: string) => void;
  logout: () => void;
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

  const refreshCompany = async () => {
    const res = await apiRequest<{ company: Company }>('/company');
    if (res.data?.company) {
      setCompany(res.data.company);
    }
  };

  // Load initial session and company profile
  useEffect(() => {
    refreshCompany();

    const savedToken = localStorage.getItem('habesha_token');
    if (savedToken) {
      setToken(savedToken);
      apiRequest<{ user: User }>('/auth/me')
        .then((res) => {
          if (res.data?.user) {
            setUser(res.data.user);
            if (res.data.user.branch) {
              setActiveBranch(res.data.user.branch);
            }
          } else {
            localStorage.removeItem('habesha_token');
            setToken(null);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Fetch branches once authenticated
  const refreshBranches = async () => {
    const res = await apiRequest<{ branches: Branch[] }>('/branches');
    if (res.data?.branches) {
      setBranches(res.data.branches);

      // For staff, their active branch is always their own assigned branch
      if (user?.branch) {
        setActiveBranch(user.branch);
      } else {
        // For OWNER/ADMIN with no fixed branch, check saved preference or pick first
        const savedBranchId = localStorage.getItem('habesha_active_branch_id');
        const targetBranch =
          res.data.branches.find((b) => b.id === savedBranchId) ||
          res.data.branches[0] ||
          null;

        setActiveBranch(targetBranch);
      }
    }
  };

  useEffect(() => {
    if (user && token) {
      refreshBranches();
    }
  }, [user, token]);

  const loginWithPassword = async (phone: string, pass: string) => {
    const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password: pass }),
    });

    if (res.data) {
      localStorage.setItem('habesha_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);

      // Automatically assign user's own branch immediately
      if (res.data.user.branch) {
        setActiveBranch(res.data.user.branch);
        localStorage.setItem('habesha_active_branch_id', res.data.user.branch.id);
      }

      return { success: true };
    }

    return { success: false, error: res.error || 'Login failed' };
  };

  const switchBranch = (branchId: string) => {
    // Only allowed if user is OWNER or ADMIN
    if (user?.role !== 'OWNER' && user?.role !== 'ADMIN') {
      return;
    }
    const found = branches.find((b) => b.id === branchId);
    if (found) {
      setActiveBranch(found);
      localStorage.setItem('habesha_active_branch_id', found.id);
    }
  };

  const logout = () => {
    localStorage.removeItem('habesha_token');
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
        branches,
        activeBranch,
        isLoading,
        loginWithPassword,
        switchBranch,
        logout,
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
