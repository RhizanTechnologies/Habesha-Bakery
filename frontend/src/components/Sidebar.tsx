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
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  onCloseMobileMenu?: () => void;
}

export function Sidebar({ onCloseMobileMenu }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const isLinkActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const navSection = (
    title: string,
    items: Array<{
      label: string;
      href: string;
      icon: React.ReactNode;
      badge?: string;
      isStub?: boolean;
    }>
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-5">
        <p className="px-3 text-[10px] font-black text-[#8C7361] uppercase tracking-wider mb-1.5">{title}</p>
        <div className="space-y-1">
          {items.map((item) => {
            const active = isLinkActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobileMenu}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? 'bg-[#4A2E1B] text-white shadow-xs'
                    : 'text-[#4A2E1B] hover:text-[#2C1B10] hover:bg-[#FAF7EE]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={active ? 'text-[#E87A18]' : 'text-[#8C7361]'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      active
                        ? 'bg-[#5A3A23] text-[#F4ECE1]'
                        : 'bg-[#F4ECE1] text-[#4A2E1B] border border-[#EDE4D5]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  // 1. Foundation: Real active modules
  const foundationItems = [
    { label: 'System Overview', href: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
    ...(isOwnerOrAdmin
      ? [{ label: 'Branches & Outlets', href: '/branches', icon: <Building2 className="w-4 h-4" /> }]
      : []),
    { label: 'Staff & Roles', href: '/users', icon: <Users className="w-4 h-4" /> },
  ];

  // 2. Modular Plug-in Roadmap (Stubs pending activation)
  const bakingSupplyItems = [
    { label: 'Flour & Raw Stock', href: '/stock', icon: <Wheat className="w-4 h-4" />, badge: 'Plugin' },
    { label: 'Baking & Yields', href: '/production', icon: <Flame className="w-4 h-4" />, badge: 'Plugin' },
    { label: 'Crate Transfers', href: '/transfers', icon: <Truck className="w-4 h-4" />, badge: 'Plugin' },
  ];

  const salesMoneyItems = [
    { label: 'Product Catalog', href: '/products', icon: <ShoppingCart className="w-4 h-4" />, badge: 'Plugin' },
    { label: 'Evening Closeout', href: '/daily-tracking/closeout', icon: <CircleDollarSign className="w-4 h-4" />, badge: 'Plugin' },
  ];

  return (
    <aside className="w-64 bg-[#FFFDF8] border-r border-[#EDE4D5] h-full p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar">
      <div>
        {/* Core Foundation Section */}
        {navSection('Core Management', foundationItems)}

        {/* Plugin Preview Sections */}
        {navSection('Baking & Supply (Plugins)', bakingSupplyItems)}
        {navSection('Sales & Daily Tracking', salesMoneyItems)}
      </div>

      {/* Footer Info Box */}
      <div className="mt-6 pt-4 border-t border-[#EDE4D5]">
        <div className="p-3.5 bg-[#FAF7EE] rounded-2xl border border-[#EDE4D5] text-xs text-[#2C1B10]">
          <div className="flex items-center gap-1.5 font-black text-[#4A2E1B]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#E87A18]" />
            <span>Habesha Bakery</span>
          </div>
          <p className="text-[11px] text-[#8C7361] mt-1 leading-snug">
            Enterprise Hub &amp; Spoke isolation. Step-by-step modular expansion ready.
          </p>
        </div>
      </div>
    </aside>
  );
}
