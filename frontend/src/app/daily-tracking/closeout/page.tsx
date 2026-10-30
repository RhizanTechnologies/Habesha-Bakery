'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiRequest } from '../../../lib/api';
import {
  CircleDollarSign,
  Banknote,
  Smartphone,
  Building,
  Check,
  AlertTriangle,
  AlertCircle,
  Save,
  RotateCcw,
  Calendar,
  History,
  TrendingDown,
  TrendingUp,
  FileText,
  UserCheck,
  Lock,
  Unlock,
  Coins,
} from 'lucide-react';

interface SummaryData {
  branch: { id: string; name: string; code: string };
  businessDate: string;
  totalOrders: number;
  totalCashSales: number;
  totalTelebirrSales: number;
  totalCbeSales: number;
  totalDigitalSales: number;
  totalCreditSales: number;
  totalGrossSales: number;
  closeout: {
    id: string;
    startingFloat: number;
    totalCashSales: number;
    totalDigitalSales: number;
    totalExpenses: number;
    expectedCash: number;
    actualCountedCash: number;
    variance: number;
    notes?: string | null;
    submittedByUser: { fullName: string; phone: string };
    updatedAt: string;
  } | null;
}

interface CloseoutRecord {
  id: string;
  businessDate: string;
  startingFloat: number;
  totalCashSales: number;
  totalDigitalSales: number;
  totalExpenses: number;
  expectedCash: number;
  actualCountedCash: number;
  variance: number;
  notes?: string | null;
  submittedByUser: { fullName: string; phone: string };
  branch: { name: string; code: string };
  updatedAt: string;
}

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CloseoutPage() {
  const { user, activeBranch } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [history, setHistory] = useState<CloseoutRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Reconciliation Form
  const [startingFloat, setStartingFloat] = useState<string>('500');
  const [actualCountedCash, setActualCountedCash] = useState<string>('');
  const [totalExpenses, setTotalExpenses] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchSummary = async (date: string) => {
    setLoading(true);
    const branchParam = activeBranch?.id ? `&branchId=${activeBranch.id}` : '';
    const [sumRes, histRes] = await Promise.all([
      apiRequest<SummaryData>(`/daily-tracking/summary?businessDate=${date}${branchParam}`),
      apiRequest<CloseoutRecord[]>(`/daily-tracking/history?${branchParam ? branchParam.slice(1) : ''}`),
    ]);

    if (sumRes.data) {
      setSummary(sumRes.data);
      if (sumRes.data.closeout) {
        setStartingFloat(sumRes.data.closeout.startingFloat.toString());
        setActualCountedCash(sumRes.data.closeout.actualCountedCash.toString());
        setTotalExpenses(sumRes.data.closeout.totalExpenses.toString());
        setNotes(sumRes.data.closeout.notes || '');
      } else {
        setActualCountedCash('');
        setTotalExpenses('0');
        setNotes('');
      }
    }

    if (histRes.data) {
      setHistory(histRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchSummary(selectedDate);
  }, [selectedDate, activeBranch?.id]);

  // Reconciliation Arithmetic:
  // expectedCash = startingFloat + totalCashSales - totalExpenses
  // variance = actualCountedCash - expectedCash
  const floatNum = parseFloat(startingFloat) || 0;
  const expensesNum = parseFloat(totalExpenses) || 0;
  const countedNum = parseFloat(actualCountedCash) || 0;
  const cashSales = summary ? summary.totalCashSales : 0;
  const expectedCash = floatNum + cashSales - expensesNum;
  const variance = countedNum - expectedCash;
  const hasEnteredCash = actualCountedCash.trim() !== '';

  const handleSubmitCloseout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEnteredCash) return;
    setError(null);
    setSubmitting(true);

    const payload = {
      branchId: activeBranch?.id,
      businessDate: selectedDate,
      startingFloat: floatNum,
      actualCountedCash: countedNum,
      totalExpenses: expensesNum,
      notes: notes.trim() || undefined,
    };

    const res = await apiRequest('/daily-tracking/closeout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccessMessage('Daily cash reconciliation submitted successfully!');
      fetchSummary(selectedDate);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Alert Banners */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/30 backdrop-blur-sm border border-amber-400/30 text-amber-100 text-xs font-semibold mb-3">
              <CircleDollarSign className="w-3.5 h-3.5" />
              <span>Evening Cash Reconciliation &bull; Zero-Lockout Continuous Flow</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Daily Drawer Closeout & Cash Tracking
            </h1>
            <p className="text-amber-100/80 text-sm mt-1 max-w-xl">
              Track physical cash counts against continuous POS sales for{' '}
              <span className="font-semibold text-white">{activeBranch?.name || 'All Branches'}</span>. Terminals stay
              open with zero locking.
            </p>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-amber-900/40 backdrop-blur-sm p-2 rounded-2xl border border-amber-400/30 text-xs">
            <Calendar className="w-4 h-4 text-amber-200 ml-2" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none px-2 py-1"
            />
            <button
              onClick={() => setSelectedDate(getTodayDateString())}
              className="px-2.5 py-1 rounded-xl bg-amber-500/30 hover:bg-amber-500/50 text-white font-bold text-[11px] transition"
            >
              Today
            </button>
          </div>
        </div>

        {/* Real-time Sales Aggregates */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-amber-500/30">
          <div className="bg-amber-900/30 backdrop-blur-sm rounded-2xl p-3.5 border border-amber-500/20">
            <div className="text-amber-200/70 text-xs font-semibold flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5" /> Cash Sales
            </div>
            <div className="text-xl sm:text-2xl font-black mt-1 text-emerald-300">
              {summary ? summary.totalCashSales.toFixed(2) : '0.00'} ETB
            </div>
            <div className="text-[10px] text-amber-200/50 mt-0.5">Physical drawer intake</div>
          </div>

          <div className="bg-amber-900/30 backdrop-blur-sm rounded-2xl p-3.5 border border-amber-500/20">
            <div className="text-amber-200/70 text-xs font-semibold flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> Digital Sales
            </div>
            <div className="text-xl sm:text-2xl font-black mt-1 text-cyan-200">
              {summary ? summary.totalDigitalSales.toFixed(2) : '0.00'} ETB
            </div>
            <div className="text-[10px] text-amber-200/50 mt-0.5">Telebirr &amp; CBE</div>
          </div>

          <div className="bg-amber-900/30 backdrop-blur-sm rounded-2xl p-3.5 border border-amber-500/20">
            <div className="text-amber-200/70 text-xs font-semibold flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" /> Total Gross Sales
            </div>
            <div className="text-xl sm:text-2xl font-black mt-1 text-white">
              {summary ? summary.totalGrossSales.toFixed(2) : '0.00'} ETB
            </div>
            <div className="text-[10px] text-amber-200/50 mt-0.5">
              {summary ? summary.totalOrders : 0} orders recorded
            </div>
          </div>

          <div className="bg-amber-900/30 backdrop-blur-sm rounded-2xl p-3.5 border border-amber-500/20">
            <div className="text-amber-200/70 text-xs font-semibold flex items-center gap-1.5">
              <Unlock className="w-3.5 h-3.5 text-amber-300" /> Continuous Status
            </div>
            <div className="text-lg font-black mt-1 text-amber-100 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Unlocked &bull; Open</span>
            </div>
            <div className="text-[10px] text-amber-200/50 mt-0.5">No session lockouts</div>
          </div>
        </div>
      </div>

      {/* Main Reconciliation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Reconciliation Calculator Form (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-700" />
              <h2 className="text-base font-bold text-slate-900">Cash Drawer Counting Form</h2>
            </div>
            {summary?.closeout && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Closeout Submitted
              </span>
            )}
          </div>

          <form onSubmit={handleSubmitCloseout} className="space-y-4 text-xs font-semibold text-slate-700">
            {/* Input Row 1: Starting Float & Expenses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-slate-600">Starting Float (Morning Change)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ETB</span>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={startingFloat}
                    onChange={(e) => setStartingFloat(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Cash in drawer at start of shift</p>
              </div>

              <div>
                <label className="block mb-1 text-slate-600">Total Drawer Expenses (Cash Out)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ETB</span>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={totalExpenses}
                    onChange={(e) => setTotalExpenses(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Petty cash paid out for supplies/repairs</p>
              </div>
            </div>

            {/* Input Row 2: Physical Cash Counted */}
            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60 space-y-2">
              <label className="block text-amber-900 font-bold text-sm">
                Physical Cash Counted in Drawer (Evening Total)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-700 font-bold">ETB</span>
                <input
                  type="number"
                  step="0.5"
                  required
                  placeholder="Enter physical cash bills & coins counted"
                  value={actualCountedCash}
                  onChange={(e) => setActualCountedCash(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-amber-300 bg-white font-black text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
              <p className="text-[11px] text-amber-800">
                Count all bank notes and coins currently sitting in the physical drawer.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block mb-1 text-slate-600">Closeout Notes &amp; Variance Explanations</label>
              <textarea
                rows={2}
                placeholder="Explain any discrepancy, tips, petty cash receipts, or shift handoff notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-xs font-normal"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !hasEnteredCash}
              className={`w-full py-3.5 rounded-2xl font-black text-sm transition flex items-center justify-center gap-2 shadow-md active:scale-95 ${
                submitting || !hasEnteredCash
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-amber-800 hover:bg-amber-900 text-white shadow-amber-800/30'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Saving Closeout...' : 'Save & Submit Evening Closeout'}</span>
            </button>
          </form>
        </div>

        {/* RIGHT: Live Variance & Formulas Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Variance Dynamic Card */}
          <div
            className={`rounded-3xl p-6 border shadow-sm transition space-y-4 ${
              !hasEnteredCash
                ? 'bg-slate-50 border-slate-200 text-slate-600'
                : variance === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : variance < 0
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">Drawer Status</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                  !hasEnteredCash
                    ? 'bg-slate-200 text-slate-700'
                    : variance === 0
                    ? 'bg-emerald-200 text-emerald-900'
                    : variance < 0
                    ? 'bg-red-200 text-red-900'
                    : 'bg-amber-200 text-amber-900'
                }`}
              >
                {!hasEnteredCash ? (
                  'Awaiting Count'
                ) : variance === 0 ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-800" /> Perfectly Balanced
                  </>
                ) : variance < 0 ? (
                  <>
                    <TrendingDown className="w-3.5 h-3.5 text-red-700" /> Cash Shortage
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-3.5 h-3.5 text-amber-700" /> Cash Overage
                  </>
                )}
              </span>
            </div>

            {/* Formula Breakdown */}
            <div className="space-y-2 pt-2 border-t border-slate-200/60 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Starting Float:</span>
                <span className="font-mono font-bold">+{floatNum.toFixed(2)} ETB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Cash Sales:</span>
                <span className="font-mono font-bold text-emerald-700">+{cashSales.toFixed(2)} ETB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Expenses Paid:</span>
                <span className="font-mono font-bold text-red-600">-{expensesNum.toFixed(2)} ETB</span>
              </div>

              <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-slate-800">
                <span>Expected Cash:</span>
                <span className="font-mono">{expectedCash.toFixed(2)} ETB</span>
              </div>

              <div className="flex justify-between font-bold text-slate-800">
                <span>Actual Counted Cash:</span>
                <span className="font-mono">
                  {hasEnteredCash ? `${countedNum.toFixed(2)} ETB` : '—'}
                </span>
              </div>
            </div>

            {/* Big Variance Display */}
            <div className="pt-3 border-t border-slate-200/60 flex items-baseline justify-between">
              <div>
                <span className="text-[11px] uppercase font-bold text-slate-500">Discrepancy (Variance)</span>
                <div
                  className={`text-2xl font-black ${
                    !hasEnteredCash
                      ? 'text-slate-400'
                      : variance === 0
                      ? 'text-emerald-700'
                      : variance < 0
                      ? 'text-red-600'
                      : 'text-amber-600'
                  }`}
                >
                  {hasEnteredCash ? `${variance > 0 ? '+' : ''}${variance.toFixed(2)} ETB` : '0.00 ETB'}
                </div>
              </div>

              {hasEnteredCash && variance !== 0 && (
                <div className="text-[11px] font-bold text-slate-500 text-right max-w-[140px]">
                  {variance < 0 ? 'Cashier is short by' : 'Cashier has excess of'}{' '}
                  <span className="font-black text-slate-900">{Math.abs(variance).toFixed(2)} ETB</span>
                </div>
              )}
            </div>
          </div>

          {/* Continuous Date Rule Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Unlock className="w-4 h-4 text-emerald-600" />
              <span>Continuous Date Policy</span>
            </div>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Submitting closeouts records daily financial snapshots for auditing. In accordance with continuous date
              operations, POS transactions are never blocked and terminal state remains continuously active.
            </p>
          </div>
        </div>
      </div>

      {/* Historical Closeouts Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-700" />
            <h2 className="text-base font-bold text-slate-900">Branch Closeout Audit Trail</h2>
          </div>
          <span className="text-xs text-slate-400 font-semibold">{history.length} records logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Business Date</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Submitted By</th>
                <th className="py-3 px-4">Cash Sales</th>
                <th className="py-3 px-4">Expected Cash</th>
                <th className="py-3 px-4">Actual Counted</th>
                <th className="py-3 px-4">Variance</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No historical closeout records found.
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record.id} className="hover:bg-amber-50/30 transition">
                    <td className="py-3 px-4 font-bold font-mono text-slate-900">{record.businessDate}</td>
                    <td className="py-3 px-4 font-semibold">{record.branch.name}</td>
                    <td className="py-3 px-4 text-slate-600">{record.submittedByUser.fullName}</td>
                    <td className="py-3 px-4 font-bold text-emerald-800">{record.totalCashSales.toFixed(2)}</td>
                    <td className="py-3 px-4 font-mono">{record.expectedCash.toFixed(2)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {record.actualCountedCash.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          record.variance === 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : record.variance < 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {record.variance === 0 ? (
                          'Balanced'
                        ) : (
                          `${record.variance > 0 ? '+' : ''}${record.variance.toFixed(2)} ETB`
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{record.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
