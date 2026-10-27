'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Store,
  Users,
  ShieldCheck,
  Wheat,
  Receipt,
  Truck,
  ArrowRight,
  Flame,
  Wallet,
  CheckCircle2,
} from 'lucide-react';

export default function DashboardPage() {
  const { company, activeBranch, branches } = useAuth();

  const hubBranches = branches.filter((b) => b.isHub);
  const spokeBranches = branches.filter((b) => !b.isHub);
  const companyName = company?.name || 'Bakery Enterprise';

  return (
    <div className="space-y-8">
      {/* Top Welcome / Hero */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-4 h-4" />
              {companyName} &bull; Management Platform
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Enterprise Hub &amp; Spoke Architecture
            </h1>
            <p className="mt-2 text-amber-100 max-w-2xl text-sm sm:text-base leading-relaxed">
              Active across {branches.length} locations ({hubBranches.length} Production Hub{hubBranches.length === 1 ? '' : 's'} and {spokeBranches.length} Retail Spoke{spokeBranches.length === 1 ? '' : 's'}) with branch-scoped access,
              continuous business-date tracking, and clean developer separation.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 min-w-[260px]">
            <p className="text-xs uppercase font-bold text-amber-200">Current Context</p>
            <p className="text-lg font-bold mt-1 text-white flex items-center gap-2">
              {activeBranch?.isHub ? (
                <Building2 className="w-5 h-5 text-teal-300" />
              ) : (
                <Store className="w-5 h-5 text-amber-300" />
              )}
              {activeBranch?.name || 'Loading Context...'}
            </p>
            <p className="text-xs text-amber-200/80 mt-1">
              Code: {activeBranch?.code || '---'} &bull; {activeBranch?.isHub ? 'Hub Production Facility' : 'Retail Spoke'}
            </p>
          </div>
        </div>
      </div>

      {/* Foundation Status Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {branches.length} Registered Outlets
            </span>
            <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {hubBranches.length} Hub{hubBranches.length === 1 ? '' : 's'} + {spokeBranches.length} Spoke{spokeBranches.length === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-slate-500 mt-1 truncate">
            {branches.map((b) => b.name).join(', ') || 'Synchronizing with database...'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Security Guard</span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">Branch-Scoped Auth</p>
          <p className="text-xs text-slate-500 mt-1">Automatic branch binding on staff login</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Workflow Model</span>
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">Continuous Daily</p>
          <p className="text-xs text-slate-500 mt-1">Zero terminal lockouts or session blockages</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Staff Personnel</span>
            <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {company?.totalUsers ?? branches.reduce((acc, b) => acc + (b._count?.users ?? 0), 0)} Assigned
          </p>
          <p className="text-xs text-slate-500 mt-1">Role-governed terminal access</p>
        </div>
      </div>

      {/* The Branches Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Configured Bakery Branches</h2>
            <p className="text-xs text-slate-500">Live locations loaded dynamically from database</p>
          </div>
          <Link
            href="/branches"
            className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
          >
            Manage Branches <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Central Hubs Cards */}
          {hubBranches.map((hub) => (
            <div key={hub.id} className="rounded-xl border-2 border-teal-500 bg-teal-50/40 p-4 relative">
              <span className="absolute top-3 right-3 text-[10px] font-black uppercase px-2 py-0.5 rounded bg-teal-700 text-white">
                Central Hub
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center mb-3">
                <Building2 className="w-4 h-4" />
              </div>
              <p className="font-bold text-slate-900 text-sm">{hub.name}</p>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Code: {hub.code}</p>
              <p className="text-xs text-slate-600 mt-2">{hub.address || 'Central production facility & flour warehouse'}</p>
            </div>
          ))}

          {/* Spokes Cards */}
          {spokeBranches.map((spoke) => (
            <div key={spoke.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                  Spoke
                </span>
              </div>
              <p className="font-bold text-slate-900 text-sm">{spoke.name}</p>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Code: {spoke.code}</p>
              <p className="text-xs text-slate-600 mt-2">{spoke.address || 'Retail counter & local stock receiving'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Developer Classification & Handoff Track */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-black text-slate-900">Developer Classification Tracks</h2>
          <p className="text-xs text-slate-500">
            Two completely non-interfering modules built on top of this clean foundation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Developer 1 Work Card */}
          <div className="bg-white border-2 border-amber-200 rounded-2xl p-6 shadow-sm hover:border-amber-400 transition-colors">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                <Wheat className="w-3.5 h-3.5" />
                DEVELOPER 1 &bull; BACK-OF-HOUSE
              </div>
              <span className="text-xs font-semibold text-slate-400">Production &amp; Logistics</span>
            </div>

            <h3 className="text-xl font-black text-slate-900 mt-4">
              Baking Pipeline, Yield Physics &amp; Crate Transfers
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Owns everything from flour entering the central hub warehouse to crates handed to drivers.
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <Wheat className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Raw Material Warehouse:</span> Flour bags, yeast, salt, oil intake &amp; deduction.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <Flame className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Baking Physics Engine:</span> 1 quintal (100kg) &rarr; standard 1,362 loaf yield formula.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <Truck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">40-Loaf Crate Transfers:</span> Manifest creation, driver dispatch, and spoke receiving handshake.
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-500 font-mono">
                Scope: modules/stock, modules/production, modules/transfers
              </div>
              <Link
                href="/production"
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
              >
                View Screen Specs <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Developer 2 Work Card */}
          <div className="bg-white border-2 border-teal-200 rounded-2xl p-6 shadow-sm hover:border-teal-400 transition-colors">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                <Receipt className="w-3.5 h-3.5" />
                DEVELOPER 2 &bull; FRONT-OF-HOUSE
              </div>
              <span className="text-xs font-semibold text-slate-400">Retail POS &amp; Cash Flow</span>
            </div>

            <h3 className="text-xl font-black text-slate-900 mt-4">
              Counter POS, Multi-Tender &amp; Daily Closeout
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Owns the cashier touchscreen, sales receipts, customer credit, and evening cash reconciliation.
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <Receipt className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Touchscreen POS:</span> Fast-tap bread tiles, quantity selector, customer selection.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <Wallet className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Multi-Tender Payments:</span> Cash, CBE Birr, Telebirr, Mobile Banking, and Credit Ledger.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Evening Closeout Math:</span> Actual counted cash vs system calculated cash &amp; variance tracking.
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-500 font-mono">
                Scope: modules/products, modules/pos, modules/daily-tracking
              </div>
              <Link
                href="/pos"
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                View Screen Specs <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
