'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Building2,
  Users,
  Store,
  TrendingUp,
  Package,
  Receipt,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';

function money(value: number | undefined | null) {
  return `${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;
}

interface UserSummary {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  branch?: { name: string } | null;
}

export default function DashboardPage() {
  const { user, activeBranch, branches } = useAuth();

  // Expand / Collapse breakdown for the two primary KPI cards
  const [showGainDetail, setShowGainDetail] = useState(false);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);

  // Daily totals
  const [yesterdayCash, setYesterdayCash] = useState(500);
  const [salesIncome, setSalesIncome] = useState(0);
  const [creditReceived] = useState(0);
  const [tomorrowCash] = useState(0);
  const [companyExpense, setCompanyExpense] = useState(0);
  const [supplierCost] = useState(0);
  const [payrollCost] = useState(0);
  const [ownerWithdrawals] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);

  // Staff summary
  const [staffList, setStaffList] = useState<UserSummary[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);

  // Fetch staff count and roster
  useEffect(() => {
    apiRequest<{ users: UserSummary[] }>('/users')
      .then((res) => {
        if (res.data?.users) {
          setStaffList(res.data.users);
        }
      })
      .finally(() => setIsLoadingStaff(false));
  }, []);

  // Fetch live daily sales summary for active branch
  useEffect(() => {
    const branchParam = activeBranch?.id ? `?branchId=${activeBranch.id}` : '';
    apiRequest<any>(`/daily-tracking/summary${branchParam}`)
      .then((res) => {
        if (res.data) {
          setSalesIncome(res.data.totalGrossSales || res.data.totalCashSales || 0);
          setTodayOrders(res.data.totalOrders || 0);
          if (res.data.closeout) {
            setYesterdayCash(Number(res.data.closeout.startingFloat) || 500);
            setCompanyExpense(Number(res.data.closeout.totalExpenses) || 0);
          }
        }
      })
      .catch(() => {});
  }, [activeBranch?.id]);

  // Today Gain formula: Yesterday + Sales + Credit Received - Tomorrow Leftover
  const todayGain = yesterdayCash + salesIncome + creditReceived - tomorrowCash;
  const todayExpense = companyExpense + supplierCost + payrollCost + ownerWithdrawals;
  const todayNet = todayGain - todayExpense;

  const hubBranches = branches.filter((b) => b.isHub);
  const spokeBranches = branches.filter((b) => !b.isHub);

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EDE4D5]/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading">
            Executive Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] font-medium mt-1 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-[#E87A18]" />
            {activeBranch
              ? `${activeBranch.name} • Operational Overview`
              : 'All Branches Performance Overview'}
          </p>
        </div>
        <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-2xl px-4 py-2 flex items-center space-x-3 shadow-2xs self-start sm:self-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-[#4A2E1B]">Live Session Active</span>
        </div>
      </div>

      {/* ── Quick Action Shortcuts ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/pos"
          className="p-3.5 rounded-2xl bg-white border border-[#EDE4D5] hover:border-[#E87A18] hover:shadow-md transition group flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#E87A18] flex items-center justify-center shrink-0 group-hover:scale-105 transition">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[#2C1B10] group-hover:text-[#E87A18] truncate">Counter POS</div>
            <div className="text-[10px] text-[#8C7361] font-medium truncate">Touchscreen Register</div>
          </div>
        </Link>
        <Link
          href="/daily-tracking/closeout"
          className="p-3.5 rounded-2xl bg-white border border-[#EDE4D5] hover:border-emerald-500 hover:shadow-md transition group flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[#2C1B10] group-hover:text-emerald-700 truncate">Daily Closeout</div>
            <div className="text-[10px] text-[#8C7361] font-medium truncate">Drawer Reconciliation</div>
          </div>
        </Link>
        <Link
          href="/products"
          className="p-3.5 rounded-2xl bg-white border border-[#EDE4D5] hover:border-blue-500 hover:shadow-md transition group flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[#2C1B10] group-hover:text-blue-700 truncate">Product Catalog</div>
            <div className="text-[10px] text-[#8C7361] font-medium truncate">Prices & Shelf Stock</div>
          </div>
        </Link>
        <Link
          href="/branches"
          className="p-3.5 rounded-2xl bg-white border border-[#EDE4D5] hover:border-teal-500 hover:shadow-md transition group flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[#2C1B10] group-hover:text-teal-700 truncate">Branch Network</div>
            <div className="text-[10px] text-[#8C7361] font-medium truncate">{branches.length} Outlets</div>
          </div>
        </Link>
      </div>

            {/* ── Primary Hero Cards: Today's Revenue (Gain) & Today's Expense (Costs) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* TODAY'S REVENUE (GAIN) */}
        <div>
          <div
            onClick={() => setShowGainDetail((prev) => !prev)}
            className="border border-emerald-200/80 bg-gradient-to-br from-emerald-500/10 via-emerald-50/50 to-white shadow-[0_8px_30px_rgba(16,185,129,0.06)] rounded-3xl p-6 cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
                  <ArrowUpRight className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase text-emerald-800 tracking-wider">
                    Today&apos;s Revenue (Gain)
                  </h3>
                  <p className="text-[11px] text-emerald-700/80 font-medium">
                    Calculated Daily Cash Inflow &amp; Sales
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Live Sales
                </span>
                <button
                  type="button"
                  className="text-emerald-800 hover:bg-emerald-100/50 p-1 rounded-xl transition-colors"
                >
                  {showGainDetail ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="mt-4 text-3xl sm:text-4xl font-extrabold text-emerald-950 tracking-tight font-heading font-mono">
              {money(todayGain)}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-emerald-100 text-xs">
              <span className="font-bold text-emerald-700">
                {showGainDetail ? 'Click to hide formula breakdown' : 'Click to view formula breakdown'}
              </span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                Active Outlet: {activeBranch?.name || 'All Branches'}
              </span>
            </div>
          </div>

          {/* GAIN DETAIL EXPANDABLE ACCORDION */}
          {showGainDetail && (
            <div className="mt-3 border border-emerald-200 bg-white shadow-lg rounded-3xl overflow-hidden animate-in fade-in duration-200">
              <div className="p-4 bg-emerald-50/70 border-b border-emerald-100">
                <h4 className="text-sm font-extrabold text-emerald-950">Revenue Formula Itemization</h4>
                <p className="text-xs text-emerald-800 mt-0.5">
                  [Yesterday Leftover] + [Sales Income] + [Credit Repaid] − [Tomorrow Leftover]
                </p>
              </div>
              <div className="p-4 bg-emerald-50/30 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 bg-white rounded-2xl border border-emerald-200 shadow-2xs flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-emerald-900 block">➕ Yesterday Leftover Cash</span>
                      <span className="text-[11px] text-[#8C7361]">Opening counter cash</span>
                    </div>
                    <span className="font-bold text-emerald-900 font-mono">{money(yesterdayCash)}</span>
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-emerald-200 shadow-2xs flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-emerald-900 block">➕ Income From Sales</span>
                      <span className="text-[11px] text-[#8C7361]">Daily counter receipts</span>
                    </div>
                    <span className="font-bold text-emerald-900 font-mono">{money(salesIncome)}</span>
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-emerald-200 shadow-2xs flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-emerald-900 block">➕ Credit Received From Loans</span>
                      <span className="text-[11px] text-[#8C7361]">Customer debt repayments</span>
                    </div>
                    <span className="font-bold text-emerald-900 font-mono">{money(creditReceived)}</span>
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-rose-200 shadow-2xs flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-rose-900 block">➖ Tomorrow Leftover Cash</span>
                      <span className="text-[11px] text-[#8C7361]">Retained counter float</span>
                    </div>
                    <span className="font-bold text-rose-900 font-mono">{money(tomorrowCash)}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-900 text-white rounded-2xl flex items-center justify-between font-extrabold text-sm shadow-sm">
                  <span className="uppercase tracking-wider text-xs">🟰 Total Daily Revenue:</span>
                  <span className="text-base sm:text-lg font-black text-emerald-300 font-mono">
                    {money(todayGain)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TODAY'S EXPENSE (COSTS) */}
        <div>
          <div
            onClick={() => setShowExpenseDetail((prev) => !prev)}
            className="border border-rose-200/80 bg-gradient-to-br from-rose-500/10 via-rose-50/50 to-white shadow-[0_8px_30px_rgba(244,63,94,0.06)] rounded-3xl p-6 cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
                  <ArrowDownRight className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase text-rose-800 tracking-wider">
                    Today&apos;s Expense (Costs)
                  </h3>
                  <p className="text-[11px] text-rose-700/80 font-medium">
                    Operating Costs, Purchases &amp; Deductions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                  Operating Costs
                </span>
                <button
                  type="button"
                  className="text-rose-800 hover:bg-rose-100/50 p-1 rounded-xl transition-colors"
                >
                  {showExpenseDetail ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="mt-4 text-3xl sm:text-4xl font-extrabold text-rose-950 tracking-tight font-heading font-mono">
              {money(todayExpense)}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-rose-100 text-xs">
              <span className="font-bold text-rose-700">
                {showExpenseDetail ? 'Click to hide cost itemization' : 'Click to view cost itemization'}
              </span>
              <span className="font-semibold text-rose-600">
                Authorized Cash Outflows
              </span>
            </div>
          </div>

          {/* EXPENSE DETAIL EXPANDABLE ACCORDION */}
          {showExpenseDetail && (
            <div className="mt-3 border border-rose-200 bg-white shadow-lg rounded-3xl overflow-hidden animate-in fade-in duration-200">
              <div className="p-4 bg-rose-50/70 border-b border-rose-100">
                <h4 className="text-sm font-bold text-rose-900">Operating Outflow Breakdown</h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-100">
                    <div className="text-rose-700 font-semibold mb-0.5">Company Petty</div>
                    <div className="font-extrabold text-rose-950 text-sm font-mono">{money(companyExpense)}</div>
                  </div>
                  <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-100">
                    <div className="text-purple-700 font-semibold mb-0.5">Owner Drawings</div>
                    <div className="font-extrabold text-purple-950 text-sm font-mono">{money(ownerWithdrawals)}</div>
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100">
                    <div className="text-amber-800 font-semibold mb-0.5">Supplier Material</div>
                    <div className="font-extrabold text-amber-950 text-sm font-mono">{money(supplierCost)}</div>
                  </div>
                  <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                    <div className="text-indigo-700 font-semibold mb-0.5">Payroll Paid</div>
                    <div className="font-extrabold text-indigo-950 text-sm font-mono">{money(payrollCost)}</div>
                  </div>
                </div>

                <div className="p-3.5 bg-[#4A2E1B] text-white rounded-2xl flex items-center justify-between font-extrabold text-sm shadow-sm">
                  <span className="uppercase tracking-wider text-xs">🟰 Total Operating Expenses:</span>
                  <span className="text-base sm:text-lg font-black text-rose-300 font-mono">
                    {money(todayExpense)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Secondary KPI Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Profit Today */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Net Profit Today
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-extrabold tracking-tight font-heading mt-2 font-mono ${todayNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {money(todayNet)}
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
            Revenue minus operating expenses
          </p>
        </div>

        {/* Active Branches */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Network Branches
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#2C1B10] tracking-tight font-heading mt-2">
            {branches.length} Outlets
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
            {hubBranches.length} Hub{hubBranches.length === 1 ? '' : 's'} + {spokeBranches.length} Spoke{spokeBranches.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Registered Staff */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Staff on Roster
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#2C1B10] tracking-tight font-heading mt-2">
            {isLoadingStaff ? '...' : `${staffList.length} Personnel`}
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
            Verified with Kebele ID &amp; Roles
          </p>
        </div>

        {/* Active Outlet Context */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Current Context
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#E87A18] flex items-center justify-center">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-[#2C1B10] tracking-tight font-heading mt-2 truncate">
            {activeBranch?.name || 'All Locations'}
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1 truncate">
            {activeBranch?.code ? `Code: ${activeBranch.code}` : 'Global Enterprise Scope'}
          </p>
        </div>
      </div>

      {/* ── Operational Management Overviews: Branch Directory & Staff Roster ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch Network List */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EDE4D5]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FAF7EE] border border-[#EDE4D5] flex items-center justify-center text-[#4A2E1B]">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#2C1B10]">Branch Network</h3>
                <p className="text-[11px] text-[#8C7361]">Central Hubs and Retail Spokes</p>
              </div>
            </div>
            <Link
              href="/branches"
              className="text-xs font-bold text-[#E87A18] hover:text-[#D96B10] flex items-center gap-1 hover:underline"
            >
              Manage Branches <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {branches.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7EE]/50 hover:bg-[#FAF7EE] border border-[#EDE4D5]/80 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#2C1B10] truncate">{b.name}</span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        b.isHub
                          ? 'bg-teal-50 text-teal-800 border-teal-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {b.isHub ? 'Hub Facility' : 'Retail Spoke'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8C7361] font-mono mt-0.5">Code: {b.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-semibold text-emerald-800">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff Directory Summary */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EDE4D5]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FAF7EE] border border-[#EDE4D5] flex items-center justify-center text-[#4A2E1B]">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#2C1B10]">Active Personnel</h3>
                <p className="text-[11px] text-[#8C7361]">Verified Team &amp; Role Assignments</p>
              </div>
            </div>
            <Link
              href="/users"
              className="text-xs font-bold text-[#E87A18] hover:text-[#D96B10] flex items-center gap-1 hover:underline"
            >
              Staff Directory <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {isLoadingStaff ? (
              <div className="p-8 text-center text-xs text-[#8C7361]">Loading team roster...</div>
            ) : staffList.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8C7361]">No personnel registered yet.</div>
            ) : (
              staffList.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7EE]/50 hover:bg-[#FAF7EE] border border-[#EDE4D5]/80 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#2C1B10] truncate">{s.fullName}</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#E87A18]/10 text-[#E87A18] border border-[#E87A18]/20">
                        {s.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8C7361] mt-0.5">
                      {s.branch?.name ? `Branch: ${s.branch.name}` : 'HQ / Global'} &bull; {s.phone}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Active
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
