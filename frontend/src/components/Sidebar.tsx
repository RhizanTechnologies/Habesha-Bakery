'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  Wheat,
  Flame,
  Truck,
  ShoppingCart,
  Receipt,
  CircleDollarSign,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { company, user } = useAuth();

  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const isLinkActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const navSection = (
    title: string,
    items: Array<{ label: string; href: string; icon: React.ReactNode; tag?: string }>
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
        <div className="space-y-1">
          {items.map((item) => {
            const active = isLinkActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={active ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.tag && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      active ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {item.tag}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  // Foundation items: Only Owner/Admin can see other branches
  const foundationItems = [
    { label: 'System Overview', href: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
    ...(isOwnerOrAdmin
      ? [{ label: 'Branches', href: '/branches', icon: <Building2 className="w-4 h-4" /> }]
      : []),
    { label: 'Staff Roster', href: '/users', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <div>
        {navSection('Foundation', foundationItems)}

        {navSection('Dev 1: Baking & Supply', [
          { label: 'Raw Stock & Flour', href: '/stock', icon: <Wheat className="w-4 h-4" />, tag: 'Dev 1' },
          { label: 'Baking & Yields', href: '/production', icon: <Flame className="w-4 h-4" />, tag: 'Dev 1' },
          { label: 'Crate Transfers', href: '/transfers', icon: <Truck className="w-4 h-4" />, tag: 'Dev 1' },
        ])}

        {navSection('Dev 2: Sales & Money', [
          { label: 'Product Catalog', href: '/products', icon: <ShoppingCart className="w-4 h-4" />, tag: 'Dev 2' },
          { label: 'Counter POS', href: '/pos', icon: <Receipt className="w-4 h-4" />, tag: 'Dev 2' },
          { label: 'Evening Closeout', href: '/daily-tracking/closeout', icon: <CircleDollarSign className="w-4 h-4" />, tag: 'Dev 2' },
        ])}
      </div>

      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-xs text-amber-900">
        <p className="font-bold">{company?.name || 'Enterprise Bakery ERP'}</p>
        <p className="text-[11px] text-amber-700 mt-0.5">
          {user?.branch?.name || (isOwnerOrAdmin ? 'HQ Administration' : 'Assigned Branch')}
        </p>
      </div>
    </aside>
  );
}
