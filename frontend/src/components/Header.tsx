'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, Building2, LogOut } from 'lucide-react';

export function Header() {
  const { company, user, activeBranch, branches, switchBranch, logout } = useAuth();

  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const companyName = company?.name || 'Bakery ERP';
  const initial = companyName.charAt(0).toUpperCase();

  return (
    <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Active Branch */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
            {initial}
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-tight">{companyName}</h1>
            <p className="text-[11px] text-slate-500 font-medium">Enterprise Management Platform</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-2" />

        {/* Current Active Branch Indicator */}
        <div className="flex items-center gap-2">
          {activeBranch?.isHub ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 flex items-center gap-1 border border-teal-200">
              <Building2 className="w-3.5 h-3.5" />
              CENTRAL HUB
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1 border border-amber-200">
              <Store className="w-3.5 h-3.5" />
              RETAIL SPOKE
            </span>
          )}

          {/* Branch Switcher for Owner / Admin */}
          {isOwnerOrAdmin && branches.length > 0 ? (
            <select
              value={activeBranch?.id || ''}
              onChange={(e) => switchBranch(e.target.value)}
              className="text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code}) {b.isHub ? '★ Hub' : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-bold text-slate-800">{activeBranch?.name || 'No Branch Selected'}</span>
          )}
        </div>
      </div>

      {/* User Info & Logout */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-800 leading-none">{user?.fullName || 'Staff User'}</p>
          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold tracking-wider rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
            {user?.role?.replace('_', ' ') || 'STAFF'}
          </span>
        </div>

        <button
          onClick={logout}
          title="Sign Out"
          className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors ml-2"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
