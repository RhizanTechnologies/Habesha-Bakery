'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Smartphone, Lock, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithPassword, company } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const companyName = company?.name || 'Bakery ERP';
  const initial = companyName.charAt(0).toUpperCase();

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) {
      setError('Please provide phone number and password.');
      return;
    }

    setError(null);
    setIsLoading(true);
    const res = await loginWithPassword(phone.trim(), password);
    setIsLoading(false);

    if (res.success) {
      router.push('/');
    } else {
      setError(res.error || 'Invalid phone or password.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#fbf9f5] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-amber-600 rounded-2xl text-white font-black text-2xl flex items-center justify-center mx-auto shadow-md mb-3">
            {initial}
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{companyName}</h1>
          <p className="text-sm text-slate-500 font-medium">Enterprise Management Portal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              Phone Number
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="0911000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md transition-all mt-3 disabled:opacity-50"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Role-Governed Enterprise Access</span>
        </div>
      </div>
    </div>
  );
}
