'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Store, Loader2 } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Automatically close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Auth protection guard
  useEffect(() => {
    if (mounted && !isLoading && !user && !isLoginPage) {
      router.push('/login');
    }
  }, [mounted, user, isLoading, isLoginPage, router]);

  if (isLoginPage) {
    return <main className="min-h-screen bg-[#FAF7EE]">{children}</main>;
  }

  if (!mounted || isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF7EE] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 bg-[#E87A18] rounded-2xl flex items-center justify-center shadow-lg shadow-[#E87A18]/20 animate-pulse">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#8C7361]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E87A18]" />
            <span>Loading Habesha Bakery ERP...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF7EE]">
      {/* Top Header */}
      <Header
        isMobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
      />

      <div className="flex flex-1 relative">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Slide-Over Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Off-canvas panel */}
            <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-transform ease-in-out duration-300">
              <Sidebar onCloseMobileMenu={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full min-w-0 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
