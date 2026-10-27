'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { Smartphone, Lock, ShieldCheck, Eye, EyeOff, Store, X, KeyRound, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithPassword, company } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Password modal state
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetPhone, setResetPhone] = useState('');
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  const companyName = company?.name || 'Habesha Bakery';

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) {
      setError('Please provide your registered phone number and password.');
      return;
    }

    setError(null);
    setIsLoading(true);
    const res = await loginWithPassword(phone.trim(), password);
    setIsLoading(false);

    if (res.success && res.user) {
      const role = res.user.role;
      if (role === 'CASHIER') {
        router.push('/pos');
      } else if (role === 'STOREKEEPER' || role === 'STOCK_KEEPER') {
        router.push('/stock');
      } else if (
        role === 'BAKER' ||
        role === 'PRODUCTION_SUPERVISOR' ||
        role === 'CAKE_WORKER' ||
        role === 'SAMBUSA_WORKER'
      ) {
        router.push('/production');
      } else if (role === 'DRIVER') {
        router.push('/transfers');
      } else {
        router.push('/');
      }
    } else {
      setError(res.error || 'Invalid phone number or password.');
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPhone.trim()) {
      setResetError('Please enter your registered phone number.');
      return;
    }

    setIsResetSubmitting(true);
    setResetMsg(null);
    setResetError(null);

    const res = await apiRequest<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ phone: resetPhone.trim() }),
    });

    setIsResetSubmitting(false);

    if (res.data?.message) {
      setResetMsg(res.data.message);
    } else {
      setResetError(res.error || 'Failed to submit reset request. Please contact your manager.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF7EE] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#FFFDF8] rounded-3xl shadow-xl border border-[#EDE4D5] p-8 sm:p-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#E87A18] rounded-2xl text-white font-black text-2xl flex items-center justify-center mx-auto shadow-md mb-3">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-[#2C1B10] tracking-tight font-heading">{companyName}</h1>
          <p className="text-xs text-[#8C7361] font-semibold mt-1">Enterprise Management Portal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold leading-relaxed">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#8C7361]" />
              Phone Number
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="0911000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-sm font-bold text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#8C7361]" />
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetPhone(phone);
                  setResetMsg(null);
                  setResetError(null);
                  setIsResetOpen(true);
                }}
                className="text-xs font-bold text-[#E87A18] hover:text-[#D96B10] hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-sm font-bold text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8C7361] hover:text-[#2C1B10]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-[#E87A18] hover:bg-[#D96B10] active:scale-[0.99] text-white font-black rounded-xl shadow-md transition-all mt-3 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              'Sign In to Terminal'
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-[#EDE4D5] flex items-center justify-center gap-2 text-xs text-[#8C7361] font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Role-Governed Enterprise Access</span>
        </div>
      </div>

      {/* Forgot Password Request Modal */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] rounded-3xl p-6 w-full max-w-md shadow-2xl border border-[#EDE4D5] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE4D5]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#E87A18]" />
                <h3 className="text-base font-extrabold text-[#2C1B10]">Request Password Reset</h3>
              </div>
              <button
                onClick={() => setIsResetOpen(false)}
                className="text-[#8C7361] hover:text-[#4A2E1B] p-1 transition-colors rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8C7361] font-medium leading-relaxed">
              Enter your registered phone number. Your Branch Manager or Enterprise Administrator will receive the request to generate a temporary password for you.
            </p>

            {resetMsg ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 text-center space-y-3">
                <p>{resetMsg}</p>
                <button
                  onClick={() => setIsResetOpen(false)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                {resetError && (
                  <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                    {resetError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-[#8C7361]" />
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0911000000"
                    value={resetPhone}
                    onChange={(e) => setResetPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-sm font-bold text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResetOpen(false)}
                    className="flex-1 py-2.5 border border-[#EDE4D5] bg-white hover:bg-[#FAF7EE] text-[#4A2E1B] font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResetSubmitting}
                    className="flex-1 py-2.5 bg-[#E87A18] hover:bg-[#D96B10] text-white font-bold rounded-xl text-xs shadow-md transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isResetSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
