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
  const companyName = company?.name || 'Habesha Bakery';

  return (
    <div className="space-y-8">
      {/* Top Welcome / Hero */}
      <div className="bg-gradient-to-r from-[#4A2E1B] via-[#5A3A23] to-[#E87A18] text-white rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-4 h-4 text-[#F4ECE1]" />
              {companyName} &bull; Enterprise Operations Platform
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-heading">
              Enterprise Hub &amp; Spoke Architecture
            </h1>
            <p className="mt-2 text-[#F4ECE1] max-w-2xl text-sm sm:text-base leading-relaxed">
              Operating across {branches.length} locations ({hubBranches.length} Central Hub{hubBranches.length === 1 ? '' : 's'} and {spokeBranches.length} Retail Spoke{spokeBranches.length === 1 ? '' : 's'}) with branch-scoped data isolation,
              personnel document verification, and modular feature expansion.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[260px]">
            <p className="text-xs uppercase font-extrabold text-[#F4ECE1]">Current Branch Context</p>
            <p className="text-lg font-extrabold mt-1 text-white flex items-center gap-2">
              {activeBranch?.isHub ? (
                <Building2 className="w-5 h-5 text-teal-300" />
              ) : (
                <Store className="w-5 h-5 text-amber-300" />
              )}
              {activeBranch?.name || 'Loading Context...'}
            </p>
            <p className="text-xs text-[#F4ECE1]/80 mt-1">
              Code: {activeBranch?.code || '---'} &bull; {activeBranch?.isHub ? 'Hub Production Facility' : 'Retail Distribution Spoke'}
            </p>
          </div>
        </div>
      </div>

      {/* Foundation Status Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8C7361]">
              Registered Outlets
            </span>
            <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-[#2C1B10] mt-2">
            {hubBranches.length} Hub{hubBranches.length === 1 ? '' : 's'} + {spokeBranches.length} Spoke{spokeBranches.length === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-[#8C7361] mt-1 truncate">
            {branches.map((b) => b.name).join(', ') || 'Synchronizing with database...'}
          </p>
        </div>

        <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8C7361]">Branch Security</span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-[#E87A18] flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-[#2C1B10] mt-2">Zero-Trust Isolation</p>
          <p className="text-xs text-[#8C7361] mt-1">Automatic branch scoping on staff authentication</p>
        </div>

        <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8C7361]">Personnel Documentation</span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-[#2C1B10] mt-2">Verified Roster</p>
          <p className="text-xs text-[#8C7361] mt-1">Official Kebele ID &amp; contract PDF storage active</p>
        </div>

        <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8C7361]">Enterprise Staff</span>
            <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-[#2C1B10] mt-2">
            {company?.totalUsers ?? branches.reduce((acc, b) => acc + (b._count?.users ?? 0), 0)} Assigned
          </p>
          <p className="text-xs text-[#8C7361] mt-1">8 Enterprise roles configured across shifts</p>
        </div>
      </div>

      {/* The Branches Grid */}
      <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-3xl p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-[#2C1B10] font-heading">Configured Bakery Branches</h2>
            <p className="text-xs text-[#8C7361]">Live production hubs and retail outlets loaded from Neon PostgreSQL</p>
          </div>
          <Link
            href="/branches"
            className="text-xs font-bold text-[#E87A18] hover:text-[#D96B10] flex items-center gap-1"
          >
            Manage Branches <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Central Hubs Cards */}
          {hubBranches.map((hub) => (
            <div key={hub.id} className="rounded-2xl border-2 border-teal-500 bg-teal-50/40 p-4 relative">
              <span className="absolute top-3 right-3 text-[10px] font-black uppercase px-2 py-0.5 rounded bg-teal-800 text-white">
                Central Hub
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center mb-3">
                <Building2 className="w-4 h-4" />
              </div>
              <p className="font-extrabold text-[#2C1B10] text-sm">{hub.name}</p>
              <p className="text-[11px] font-bold text-[#8C7361] mt-0.5">Code: {hub.code}</p>
              <p className="text-xs text-[#8C7361] mt-2">{hub.address || 'Central production facility & flour warehouse'}</p>
            </div>
          ))}

          {/* Spokes Cards */}
          {spokeBranches.map((spoke) => (
            <div key={spoke.id} className="rounded-2xl border border-[#EDE4D5] bg-[#FAF7EE]/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-[#E87A18] flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-[#4A2E1B] bg-[#F4ECE1] px-1.5 py-0.5 rounded border border-[#EDE4D5]">
                  Spoke
                </span>
              </div>
              <p className="font-extrabold text-[#2C1B10] text-sm">{spoke.name}</p>
              <p className="text-[11px] font-bold text-[#8C7361] mt-0.5">Code: {spoke.code}</p>
              <p className="text-xs text-[#8C7361] mt-2">{spoke.address || 'Retail counter & local stock receiving'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Operational Plugins Section */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-black text-[#2C1B10] font-heading">Operational Plug-in Modules</h2>
          <p className="text-xs text-[#8C7361]">
            Ready to be activated and migrated step-by-step on top of this foundation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Baking & Supply Plug-in */}
          <div className="bg-[#FFFDF8] border-2 border-[#EDE4D5] rounded-3xl p-6 shadow-2xs hover:border-[#E87A18]/60 transition-colors">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-[#4A2E1B] text-xs font-bold border border-[#EDE4D5]">
                <Wheat className="w-3.5 h-3.5 text-[#E87A18]" />
                BAKING &amp; SUPPLY PLUGIN
              </div>
              <span className="text-xs font-bold text-[#8C7361]">Production &amp; Logistics</span>
            </div>

            <h3 className="text-xl font-black text-[#2C1B10] mt-4 font-heading">
              Baking Engine, Yield Physics &amp; Crate Transfers
            </h3>
            <p className="text-xs text-[#8C7361] mt-1 leading-relaxed">
              Handles raw material warehouse intake, oven batches, recipe yield formulas, and driver bread dispatch to spokes.
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-[#2C1B10] bg-[#FAF7EE] p-3 rounded-xl border border-[#EDE4D5]">
                <Wheat className="w-4 h-4 text-[#E87A18] mt-0.5 shrink-0" />
                <div>
                  <span className="font-extrabold">Raw Material Warehouse:</span> Flour bags, yeast, salt, oil intake &amp; deduction.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-[#2C1B10] bg-[#FAF7EE] p-3 rounded-xl border border-[#EDE4D5]">
                <Flame className="w-4 h-4 text-[#E87A18] mt-0.5 shrink-0" />
                <div>
                  <span className="font-extrabold">Baking Physics Engine:</span> 100kg flour &rarr; standard 1,362 loaf yield formula.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-[#2C1B10] bg-[#FAF7EE] p-3 rounded-xl border border-[#EDE4D5]">
                <Truck className="w-4 h-4 text-[#E87A18] mt-0.5 shrink-0" />
                <div>
                  <span className="font-extrabold">40-Loaf Crate Transfers:</span> Manifest creation, driver dispatch, and spoke receiving handshake.
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#EDE4D5] flex items-center justify-between">
              <div className="text-[11px] text-[#8C7361] font-mono">
                Modules: stock, production, transfers
              </div>
              <Link
                href="/production"
                className="text-xs font-bold text-[#E87A18] hover:text-[#D96B10] flex items-center gap-1"
              >
                View Screen Specs <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Sales & Retail POS Plug-in */}
          <div className="bg-[#FFFDF8] border-2 border-[#EDE4D5] rounded-3xl p-6 shadow-2xs hover:border-[#E87A18]/60 transition-colors">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-900 text-xs font-bold border border-teal-200">
                <Receipt className="w-3.5 h-3.5 text-teal-700" />
                SALES &amp; POS PLUGIN
              </div>
              <span className="text-xs font-bold text-[#8C7361]">Retail POS &amp; Cash Flow</span>
            </div>

            <h3 className="text-xl font-black text-[#2C1B10] mt-4 font-heading">
              Counter POS, Multi-Tender &amp; Daily Closeout
            </h3>
            <p className="text-xs text-[#8C7361] mt-1 leading-relaxed">
              Handles front counter touchscreen, 58mm thermal receipts, cafe credit sales, and evening cash reconciliation.
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-[#2C1B10] bg-[#FAF7EE] p-3 rounded-xl border border-[#EDE4D5]">
                <Receipt className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                <div>
                  <span className="font-extrabold">Touchscreen POS:</span> Fast-tap bread tiles, quantity selector, customer selection.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-[#2C1B10] bg-[#FAF7EE] p-3 rounded-xl border border-[#EDE4D5]">
                <Wallet className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                <div>
                  <span className="font-extrabold">Multi-Tender Payments:</span> Cash, CBE Birr, Telebirr, Mobile Banking, and Credit.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-[#2C1B10] bg-[#FAF7EE] p-3 rounded-xl border border-[#EDE4D5]">
                <CheckCircle2 className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                <div>
                  <span className="font-extrabold">Evening Closeout Math:</span> Counted cash vs system calculated cash &amp; leftover count.
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#EDE4D5] flex items-center justify-between">
              <div className="text-[11px] text-[#8C7361] font-mono">
                Modules: products, pos, daily-tracking
              </div>
              <Link
                href="/pos"
                className="text-xs font-bold text-[#E87A18] hover:text-[#D96B10] flex items-center gap-1"
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
