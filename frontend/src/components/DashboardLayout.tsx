'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getImageUrl } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import NotificationBell from '@/components/NotificationBell';
import {
  LogOut,
  LayoutDashboard,
  Users,
  MapPin,
  Boxes,
  ChefHat,
  Truck,
  Utensils,
  Menu,
  X,
  UserCheck,
} from 'lucide-react';

export const DashboardLayoutContext = React.createContext<{ isNested: boolean }>({ isNested: false });

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

interface SidebarNavProps {
  user: any;
  activeHref: string | undefined;
  pendingHref: string | null;
  menuItems: MenuItem[];
  onNavigate: (href: string) => void;
  onCloseMobile?: () => void;
  logout: () => void;
  logoutLabel: string;
  menuLabel: string;
}

// ── Memoized Persistent Sidebar Component ─────────────────────────────
const SidebarNav = React.memo(function SidebarNav({
  user,
  activeHref,
  pendingHref,
  menuItems,
  onNavigate,
  onCloseMobile,
  logout,
  logoutLabel,
  menuLabel,
}: SidebarNavProps) {
  return (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="pt-6 pb-5 px-6 flex items-center justify-between border-b border-[#5A3A23]/60 shrink-0">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-[#E87A18] rounded-2xl flex items-center justify-center mr-3 shadow-md shrink-0">
            <Utensils className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <span className="text-xl font-extrabold tracking-tight text-white block leading-tight truncate">
              Habesha Bakery
            </span>
            <span className="text-[10px] uppercase font-bold text-[#E2C7B4] tracking-widest block truncate">
              {user?.role} PORTAL
            </span>
          </div>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-[#E2C7B4] hover:text-white p-1 cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3.5 py-5 overflow-y-auto space-y-1 sidebar-scrollbar">
        <div className="text-[11px] font-bold text-[#CBB29F] uppercase tracking-widest mb-3 px-3">
          {menuLabel}
        </div>
        <ul className="space-y-1.5">
          {menuItems.map((item) => {
            const isTarget = item.href === (pendingHref || activeHref);
            const isPendingThis = pendingHref === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                      e.preventDefault();
                      onNavigate(item.href);
                    } else {
                      onCloseMobile?.();
                    }
                  }}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 cursor-pointer ${
                    isTarget
                      ? 'bg-[#E87A18] text-white shadow-[0_4px_16px_rgba(232,122,24,0.45)] font-bold scale-[1.01]'
                      : 'text-[#E2C7B4] hover:bg-[#5A3A23] hover:text-white'
                  }`}
                >
                  <item.icon className={`w-4 h-4 shrink-0 ${isTarget ? 'text-white' : 'text-[#E2C7B4]'}`} />
                  <span className="truncate flex-1">{item.label}</span>
                  {isPendingThis && (
                    <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info & Logout Button */}
      <div className="p-4 m-3 bg-[#3D2314] rounded-2xl border border-[#5A3A23] shrink-0">
        <div className="mb-3 px-1">
          <p className="text-sm font-bold text-white truncate">{user?.fullName}</p>
          <p className="text-xs text-[#CBB29F] truncate">{user?.phone}</p>
        </div>
        <Button
          className="w-full justify-center shadow-md bg-[#E87A18] hover:bg-[#D96B10] text-white font-bold cursor-pointer"
          onClick={logout}
        >
          <LogOut className="w-4 h-4 mr-1.5" /> {logoutLabel}
        </Button>
      </div>
    </div>
  );
});

// ── Dashboard Layout ──────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isNested } = React.useContext(DashboardLayoutContext);
  if (isNested) {
    return <>{children}</>;
  }

  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { branches, selectedBranchId, setSelectedBranchId } = useBranch();
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [headerAvatarError, setHeaderAvatarError] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [, startTransition] = React.useTransition();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isMounted, isLoading, isAuthenticated, router]);

  // Sync state and finish navigation as soon as route changes
  useEffect(() => {
    setPendingHref(null);
    setIsNavigating(false);
    setIsMobileOpen(false);
  }, [pathname]);

  // Safety fallback in case route transition stalls
  useEffect(() => {
    if (!isNavigating) return;
    const timer = setTimeout(() => {
      setIsNavigating(false);
      setPendingHref(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [isNavigating]);

  const handleNavigate = React.useCallback((href: string) => {
    if (pathname === href) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setIsMobileOpen(false);
      return;
    }
    // Instantly mark the sidebar item active
    setPendingHref(href);
    setIsNavigating(true);
    setIsMobileOpen(false);

    // Trigger router navigation inside transition
    startTransition(() => {
      router.push(href);
    });
  }, [pathname, router]);

  const role = user?.role;
  const isOwner = role === 'OWNER';
  const isAdmin = role === 'ADMIN';

  const menuItems = useMemo<MenuItem[]>(() => [
    ...(isOwner || isAdmin ? [{ icon: LayoutDashboard, label: t('nav.dashboard') || 'Dashboard', href: '/' }] : []),
    { icon: UserCheck, label: t('nav.profileSalary') || 'My Profile', href: '/my-profile' },
    ...(isOwner ? [{ icon: MapPin, label: t('nav.branches') || 'Branches', href: '/branches' }] : []),
    ...((isOwner || isAdmin) ? [{ icon: Users, label: t('nav.users') || 'Staff Management', href: '/users' }] : []),
    ...((isOwner || isAdmin || role === 'BAKER' || role === 'PRODUCTION_SUPERVISOR' || role === 'CAKE_WORKER' || role === 'SAMBUSA_WORKER') ? [
      { icon: ChefHat, label: t('nav.production') || 'Baking & Yields', href: '/production' },
    ] : []),
    ...((isOwner || isAdmin || role === 'STOREKEEPER' || role === 'STOCK_KEEPER') ? [
      { icon: Boxes, label: t('nav.stock') || 'Flour & Raw Stock', href: '/stock' }
    ] : []),
    ...((isOwner || isAdmin || role === 'DRIVER' || role === 'STOREKEEPER' || role === 'PRODUCTION_SUPERVISOR') ? [
      { icon: Truck, label: 'Crate Transfers', href: '/transfers' }
    ] : []),
  ], [isOwner, isAdmin, role, t]);

  // Find the most specific active route match
  const activeHref = useMemo(() => {
    const matchingItems = menuItems.filter(
      (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`))
    );
    return [...matchingItems].sort((a, b) => b.href.length - a.href.length)[0]?.href;
  }, [menuItems, pathname]);

  if (!isMounted || isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF7EE] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-[#E87A18] rounded-2xl flex items-center justify-center animate-bounce shadow-lg">
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <p className="text-[#4A2E1B] font-bold text-sm tracking-wide">Loading Bakery ERP Portal...</p>
        </div>
      </div>
    );
  }

  const logoutLabel = t('nav.logout') || 'Logout';
  const menuLabel = t('nav.menuNavigation') || 'Menu Navigation';

  return (
    <DashboardLayoutContext.Provider value={{ isNested: true }}>
      {/* Top Global Indeterminate Navigation Progress Bar */}
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-[#FAF7EE]/60 overflow-hidden shadow-sm pointer-events-none">
          <div className="h-full bg-gradient-to-r from-[#E87A18] via-[#FFB067] to-[#E87A18] animate-progress-indeterminate" />
        </div>
      )}

      <div className="min-h-screen bg-[#FAF7EE] text-[#2C1B10] flex p-1.5 xs:p-2.5 sm:p-3 md:p-6 font-sans w-full max-w-full overflow-x-hidden">
        {/* Mobile & Tablet Drawer Overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Mobile & Tablet Sidebar Drawer */}
        <aside
          className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#4A2E1B] text-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SidebarNav
            user={user}
            activeHref={activeHref}
            pendingHref={pendingHref}
            menuItems={menuItems}
            onNavigate={handleNavigate}
            onCloseMobile={() => setIsMobileOpen(false)}
            logout={logout}
            logoutLabel={logoutLabel}
            menuLabel={menuLabel}
          />
        </aside>

        {/* Persistent Desktop Sidebar (Never re-mounts on page change) */}
        <aside className="w-64 bg-[#4A2E1B] text-white rounded-3xl min-h-[calc(100vh-3rem)] hidden lg:flex flex-col fixed left-6 top-6 bottom-6 z-20 shadow-[0_10px_30px_rgba(74,46,27,0.25)] border border-[#5A3A23]">
          <SidebarNav
            user={user}
            activeHref={activeHref}
            pendingHref={pendingHref}
            menuItems={menuItems}
            onNavigate={handleNavigate}
            logout={logout}
            logoutLabel={logoutLabel}
            menuLabel={menuLabel}
          />
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col w-full max-w-full pl-0 lg:pl-72 min-h-screen min-w-0 overflow-x-hidden">
          {/* Top Header Bar */}
          <header className="h-14 xs:h-16 bg-[#FFFDF8]/90 backdrop-blur-md border border-[#EDE4D5] rounded-2xl sticky top-1.5 xs:top-3 md:top-6 z-30 px-2.5 xs:px-4 md:px-6 flex items-center justify-between shadow-[0_4px_20px_rgba(74,46,27,0.04)] mb-5 xs:mb-7 md:mb-14 gap-2">
            <div className="flex items-center space-x-2 xs:space-x-3 md:space-x-4 min-w-0">
              <button
                onClick={() => setIsMobileOpen(true)}
                className="lg:hidden p-1.5 xs:p-2 rounded-xl bg-[#F4ECE1] text-[#4A2E1B] hover:bg-[#E0D5C3] transition-colors shrink-0 cursor-pointer"
                aria-label="Open menu"
              >
                <Menu className="w-4 h-4 xs:w-5 xs:h-5" />
              </button>

              {isOwner && (
                <div className="hidden md:flex items-center space-x-2 min-w-0">
                  <span className="text-xs font-bold text-[#8C7361] uppercase tracking-wider hidden lg:inline">
                    {t('common.branch') || 'Branch'}:
                  </span>
                  <select
                    value={selectedBranchId || 'ALL'}
                    onChange={(e) => setSelectedBranchId(e.target.value === 'ALL' ? null : e.target.value)}
                    className="bg-[#F4ECE1] border border-[#E0D5C3] text-[#2C1B10] text-xs md:text-sm rounded-xl focus:ring-[#E87A18] focus:border-[#E87A18] px-2.5 py-1.5 font-bold truncate max-w-[120px] sm:max-w-[170px] md:max-w-none cursor-pointer"
                  >
                    <option value="ALL">🌐 {t('dashboard.allBranches') || 'All Branches'}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        📍 {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-1.5 xs:space-x-2.5 md:space-x-4 shrink-0">
              {/* Live Route Loading Indicator Badge */}
              {isNavigating && (
                <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#E87A18]/10 text-[#E87A18] border border-[#E87A18]/20 text-xs font-bold animate-pulse shrink-0">
                  <span className="w-2 h-2 rounded-full bg-[#E87A18] animate-ping" />
                  <span>Loading...</span>
                </div>
              )}

              {/* Notification Bell */}
              <NotificationBell />

              {/* Language Selector Dropdown */}
              <LanguageSelector variant="header" />

              {/* Role Badge */}
              <span className="hidden md:inline-block px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#E87A18]/10 text-[#E87A18] border border-[#E87A18]/20 uppercase tracking-wider">
                {user?.role}
              </span>

              {/* Profile Avatar */}
              <Link href="/my-profile" className="flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0">
                {(user?.avatarUrl || (user?.filesUrl && !user.filesUrl.toLowerCase().endsWith('.pdf'))) && !headerAvatarError ? (
                  <img
                    src={getImageUrl(user.avatarUrl || user.filesUrl)!}
                    alt={user.fullName || 'User'}
                    onError={() => setHeaderAvatarError(true)}
                    className="w-8 h-8 xs:w-9 xs:h-9 rounded-xl object-cover border border-[#E87A18]/30 shadow-md"
                  />
                ) : (
                  <div className="w-8 h-8 xs:w-9 xs:h-9 rounded-xl bg-gradient-to-tr from-[#4A2E1B] to-[#E87A18] text-white flex items-center justify-center font-extrabold text-xs xs:text-sm shadow-md border border-white/20">
                    {user?.fullName?.charAt(0) || 'H'}
                  </div>
                )}
              </Link>
            </div>
          </header>

          {/* Dynamic Page Content (Smoothly fades while route loads) */}
          <main className={`flex-1 px-0.5 xs:px-1 sm:px-2 w-full max-w-full min-w-0 transition-opacity duration-200 ${isNavigating ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
            <div className="max-w-7xl mx-auto space-y-4 xs:space-y-6 w-full max-w-full min-w-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </DashboardLayoutContext.Provider>
  );
}
