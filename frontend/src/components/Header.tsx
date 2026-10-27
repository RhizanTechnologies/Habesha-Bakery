'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, Building2, LogOut, Menu, X, ChevronDown, Shield } from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Header({ onToggleMobileMenu, isMobileMenuOpen }: HeaderProps) {
  const { company, user, activeBranch, branches, switchBranch, logout } = useAuth();

  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const companyName = company?.name || 'Habesha Bakery';

  return (
    <header className="h-16 border-b border-[#EDE4D5] bg-[#FFFDF8]/95 backdrop-blur px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Mobile Toggle + Brand + Branch Context */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl text-[#4A2E1B] hover:bg-[#FAF7EE] transition-colors"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4A2E1B] to-[#E87A18] text-white flex items-center justify-center font-black text-lg shadow-2xs font-heading">
            H
          </div>
          <div className="hidden sm:block">
            <h1 className="font-black text-[#2C1B10] leading-tight tracking-tight text-sm sm:text-base font-heading">
              {companyName}
            </h1>
            <p className="text-[10px] text-[#E87A18] font-bold uppercase tracking-wider">Enterprise ERP</p>
          </div>
        </div>

        <div className="hidden md:block h-6 w-px bg-[#EDE4D5] mx-1" />

        {/* Current Active Branch Indicator & Switcher */}
        <div className="flex items-center gap-2 min-w-0">
          {activeBranch?.isHub ? (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-teal-50 text-teal-800 items-center gap-1.5 border border-teal-200 shrink-0">
              <Building2 className="w-3.5 h-3.5 text-teal-600" />
              Central Hub
            </span>
          ) : (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-[#F4ECE1] text-[#4A2E1B] items-center gap-1.5 border border-[#EDE4D5] shrink-0">
              <Store className="w-3.5 h-3.5 text-[#E87A18]" />
              Retail Spoke
            </span>
          )}

          {/* Branch Switcher for Owner / Admin */}
          {isOwnerOrAdmin && branches.length > 0 ? (
            <div className="relative inline-block max-w-[180px] sm:max-w-[240px]">
              <select
                value={activeBranch?.id || ''}
                onChange={(e) => switchBranch(e.target.value)}
                className="w-full text-xs font-bold text-[#2C1B10] bg-[#FAF7EE] hover:bg-white border border-[#EDE4D5] rounded-xl pl-2.5 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#E87A18] cursor-pointer truncate appearance-none"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code}) {b.isHub ? '★ Hub' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8C7361] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C1B10] bg-[#FAF7EE] border border-[#EDE4D5] px-2.5 py-1 rounded-xl truncate">
              <Store className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
              <span className="truncate">{activeBranch?.name || 'Loading...'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: User Profile & Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-[#2C1B10] leading-none">{user?.fullName || 'Staff User'}</p>
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="inline-block px-1.5 py-0.5 text-[9px] font-black tracking-wider rounded bg-[#F4ECE1] text-[#4A2E1B] border border-[#EDE4D5] uppercase">
              {user?.role?.replace('_', ' ') || 'STAFF'}
            </span>
            {user?.shift && (
              <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-50 text-[#E87A18] border border-amber-200 uppercase">
                {user.shift}
              </span>
            )}
          </div>
        </div>

        {/* User Avatar Circle */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4A2E1B] to-[#E87A18] text-white flex items-center justify-center font-bold text-xs ring-2 ring-[#EDE4D5] shadow-2xs">
          {user?.fullName?.charAt(0) || 'U'}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign Out"
          className="p-2 rounded-xl text-[#8C7361] hover:text-red-600 hover:bg-red-50 transition-colors"
          aria-label="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
