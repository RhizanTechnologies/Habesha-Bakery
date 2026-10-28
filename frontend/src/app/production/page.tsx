'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  Flame,
  Wheat,
  Scale,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  PlusCircle,
  X,
  Loader2,
  CalendarDays,
  Clock,
  ShieldAlert,
  Info,
} from 'lucide-react';

interface BatchItem {
  id: string;
  batchNumber: string;
  flourSacksUsed: number | string;
  flourWeightKg: number | string;
  expectedLoaves: number;
  actualLoavesBaked: number;
  damagedLoaves: number;
  yieldEfficiency: number | string;
  isFlagged: boolean;
  flagReason: string | null;
  status: string;
  shift: string;
  createdAt: string;
  baker?: {
    id: string;
    fullName: string;
    role: string;
  };
  product?: {
    name: string;
    sku: string;
  };
}

interface ProductionMetrics {
  totalBatches: number;
  totalSacksUsed: number;
  totalLoavesBaked: number;
  totalExpectedLoaves: number;
  totalDamaged: number;
  flaggedCount: number;
  averageEfficiency: number;
}

export default function ProductionPage() {
  const { user, activeBranch } = useAuth();

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [metrics, setMetrics] = useState<ProductionMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'FLAGGED'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [flourSacksInput, setFlourSacksInput] = useState('4');
  const [actualBakedInput, setActualBakedInput] = useState('5448');
  const [damagedInput, setDamagedInput] = useState('0');
  const [shiftInput, setShiftInput] = useState<'DAY' | 'NIGHT'>('DAY');
  const [flagReasonInput, setFlagReasonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Live Yield Physics calculations for the form
  const LOAVES_PER_SACK = 1362;
  const numSacks = parseFloat(flourSacksInput) || 0;
  const numBaked = parseInt(actualBakedInput, 10) || 0;
  const expectedCalculated = Math.round(numSacks * LOAVES_PER_SACK);
  const efficiencyCalculated =
    expectedCalculated > 0 ? Number(((numBaked / expectedCalculated) * 100).toFixed(2)) : 0;
  const isCalculatedUnderYield = expectedCalculated > 0 && efficiencyCalculated < 90.0;

  const fetchProductionData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [batchesRes, metricsRes] = await Promise.all([
        apiRequest<{ batches: BatchItem[] }>('/production/batches'),
        apiRequest<ProductionMetrics>('/production/metrics'),
      ]);

      if (batchesRes.data?.batches) {
        setBatches(batchesRes.data.batches);
      } else if (batchesRes.error) {
        setError(batchesRes.error);
      }

      if (metricsRes.data) {
        setMetrics(metricsRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load production data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductionData();
  }, [activeBranch]);

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (numSacks <= 0 || numBaked <= 0) {
      setFormError('Flour sacks used and actual loaves baked must be positive numbers.');
      return;
    }

    if (isCalculatedUnderYield && !flagReasonInput.trim()) {
      setFormError('Yield is below 90% threshold. A supervisor explanation reason is required.');
      return;
    }

    setIsSubmitting(true);
    const res = await apiRequest('/production/batches', {
      method: 'POST',
      body: JSON.stringify({
        flourSacksUsed: numSacks,
        actualLoavesBaked: numBaked,
        damagedLoaves: parseInt(damagedInput, 10) || 0,
        shift: shiftInput,
        flagReason: flagReasonInput.trim() || undefined,
      }),
    });
    setIsSubmitting(false);

    if (res.data) {
      setIsModalOpen(false);
      setFlagReasonInput('');
      fetchProductionData();
    } else {
      setFormError(res.error || 'Failed to record batch.');
    }
  };

  const displayedBatches = batches.filter((b) => (filter === 'FLAGGED' ? b.isFlagged : true));

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EDE4D5]/60">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E87A18]/10 text-[#E87A18] text-xs font-bold mb-1.5 border border-[#E87A18]/20">
            <Flame className="w-3.5 h-3.5" />
            Kitchen &bull; 1,362 Yield Physics Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading">
            Baking Batches &amp; Yield Variance Control
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] font-medium mt-0.5">
            Dough mixing, oven batches, and automated yield tracking (standard 1,362 loaves per 50kg flour sack).
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            setFormError(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 bg-[#E87A18] hover:bg-[#D96B10] active:scale-[0.99] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4 text-white" />
          <span>Record Baking Batch</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Loaves Baked */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Total Loaves Baked
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#E87A18] flex items-center justify-center font-bold">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading mt-2 font-mono">
            {metrics?.totalLoavesBaked.toLocaleString() || '0'} <span className="text-sm font-semibold text-[#8C7361]">Loaves</span>
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
            Expected: {metrics?.totalExpectedLoaves.toLocaleString() || '0'} loaves
          </p>
        </div>

        {/* Flour Sacks Processed */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Flour Sacks Used
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#E87A18] flex items-center justify-center font-bold">
              <Wheat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading mt-2 font-mono">
            {metrics?.totalSacksUsed || 0} <span className="text-sm font-semibold text-[#8C7361]">Sacks</span>
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
            Mass: {((metrics?.totalSacksUsed || 0) * 50).toLocaleString()} kg flour
          </p>
        </div>

        {/* Average Yield Efficiency */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Yield Efficiency %
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-heading mt-2 font-mono ${(metrics?.averageEfficiency || 100) >= 90 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {metrics?.averageEfficiency || 100}%
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
            Physics benchmark: 1,362 loaves / sack
          </p>
        </div>

        {/* Flagged Under-Yield Batches */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Under-Yield Flags (&lt;90%)
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${(metrics?.flaggedCount || 0) > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-heading mt-2 font-mono ${(metrics?.flaggedCount || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {metrics?.flaggedCount || 0} <span className="text-sm font-semibold text-[#8C7361]">Batches</span>
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
            {(metrics?.flaggedCount || 0) > 0 ? 'Requires supervisor investigation' : 'No yield anomalies detected'}
          </p>
        </div>
      </div>

      {/* ── Baking Batches Table ── */}
      <div className="border border-[#EDE4D5] bg-white rounded-3xl shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-[#EDE4D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF7EE]/30">
          <div>
            <h3 className="text-base font-extrabold text-[#2C1B10]">Baking Batch Logs &amp; Yield Audit</h3>
            <p className="text-xs text-[#8C7361]">Complete shift logbook verifying loaves produced per sack of flour</p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white p-1 rounded-2xl border border-[#EDE4D5]">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${filter === 'ALL' ? 'bg-[#E87A18] text-white shadow-xs' : 'text-[#8C7361] hover:text-[#2C1B10]'}`}
            >
              All Batches ({batches.length})
            </button>
            <button
              onClick={() => setFilter('FLAGGED')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${filter === 'FLAGGED' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:text-rose-900'}`}
            >
              <AlertTriangle className="w-3 h-3" />
              Under-Yield Only ({batches.filter((b) => b.isFlagged).length})
            </button>
          </div>
        </div>

        {/* Mobile Batch Cards (< md) */}
        <div className="md:hidden p-3.5 space-y-3">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-[#8C7361]">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#E87A18] mb-2" />
              Loading baking logs...
            </div>
          ) : displayedBatches.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8C7361]">
              No baking batches recorded for this filter.
            </div>
          ) : (
            displayedBatches.map((batch) => {
              const eff = Number(batch.yieldEfficiency);
              return (
                <div
                  key={batch.id}
                  className={`p-3.5 sm:p-4 rounded-2xl bg-[#FFFDF8] border shadow-xs space-y-3 overflow-hidden ${
                    batch.isFlagged ? 'border-rose-300 bg-rose-50/20' : 'border-[#EDE4D5]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-extrabold text-sm text-[#2C1B10] truncate">{batch.batchNumber}</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FAF7EE] text-[#4A2E1B] border border-[#EDE4D5]">
                          {batch.shift}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8C7361] mt-0.5 truncate">
                        {new Date(batch.createdAt).toLocaleString()} &bull; {batch.baker?.fullName || 'Master Baker'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          eff >= 90
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {eff >= 90 ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertTriangle className="w-3 h-3 text-rose-600" />}
                        {eff}% Yield
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-[#EDE4D5]/60">
                    <div className="p-2 bg-[#FAF7EE]/60 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider block">Flour Used</span>
                      <span className="font-mono font-bold text-xs text-[#4A2E1B]">{batch.flourSacksUsed} sacks</span>
                      <span className="text-[10px] text-[#8C7361] block font-mono">({batch.flourWeightKg}kg)</span>
                    </div>
                    <div className="p-2 bg-[#FAF7EE]/60 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider block">Expected</span>
                      <span className="font-mono font-bold text-xs text-[#8C7361]">{batch.expectedLoaves.toLocaleString()}</span>
                      <span className="text-[10px] text-[#8C7361] block">loaves</span>
                    </div>
                    <div className="p-2 bg-[#FAF7EE]/60 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider block">Actual Baked</span>
                      <span className="font-mono font-extrabold text-xs text-[#2C1B10]">{batch.actualLoavesBaked.toLocaleString()}</span>
                      {batch.damagedLoaves > 0 && (
                        <span className="text-[10px] text-rose-700 font-semibold block">-{batch.damagedLoaves} dmg</span>
                      )}
                    </div>
                  </div>

                  {batch.isFlagged && batch.flagReason && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span className="italic">{batch.flagReason}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7EE] text-[#8C7361] font-bold uppercase tracking-wider text-[11px] border-b border-[#EDE4D5]">
              <tr>
                <th className="py-3.5 px-4">Batch Number</th>
                <th className="py-3.5 px-4">Shift &amp; Baker</th>
                <th className="py-3.5 px-4 text-right">Flour Used</th>
                <th className="py-3.5 px-4 text-right">Expected Loaves</th>
                <th className="py-3.5 px-4 text-right">Actual Baked</th>
                <th className="py-3.5 px-4 text-right">Yield Efficiency</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE4D5]/60 text-[#2C1B10]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#8C7361]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#E87A18] mb-2" />
                    Loading baking logs...
                  </td>
                </tr>
              ) : displayedBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#8C7361]">
                    No baking batches recorded for this filter.
                  </td>
                </tr>
              ) : (
                displayedBatches.map((batch) => {
                  const eff = Number(batch.yieldEfficiency);
                  return (
                    <tr key={batch.id} className="hover:bg-[#FAF7EE]/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-extrabold text-sm text-[#2C1B10]">
                        {batch.batchNumber}
                        <div className="text-[11px] font-normal text-[#8C7361]">
                          {new Date(batch.createdAt).toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#2C1B10]">{batch.baker?.fullName || 'Master Baker'}</div>
                        <span className="inline-block mt-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FAF7EE] text-[#4A2E1B] border border-[#EDE4D5]">
                          {batch.shift} SHIFT
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-[#4A2E1B]">
                        {batch.flourSacksUsed} <span className="text-xs text-[#8C7361]">sacks</span>
                        <div className="text-[11px] text-[#8C7361]">({batch.flourWeightKg} kg)</div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-[#8C7361]">
                        {batch.expectedLoaves.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-sm text-[#2C1B10]">
                        {batch.actualLoavesBaked.toLocaleString()}
                        {batch.damagedLoaves > 0 && (
                          <div className="text-[11px] text-rose-700 font-semibold">
                            -{batch.damagedLoaves} damaged
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-sm">
                        <span className={eff >= 90 ? 'text-emerald-700' : 'text-rose-700'}>
                          {batch.yieldEfficiency}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {batch.isFlagged ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Under-Yield Alert
                            </span>
                            {batch.flagReason && (
                              <span className="text-[10px] text-rose-700 italic mt-0.5 max-w-[180px] truncate" title={batch.flagReason}>
                                {batch.flagReason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Optimal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Record New Baking Batch ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-[#EDE4D5] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE4D5]">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-[#E87A18]" />
                <h3 className="text-base font-extrabold text-[#2C1B10]">Log Baking Batch &amp; Yield</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8C7361] hover:text-[#4A2E1B] p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8C7361] font-medium leading-relaxed">
              Log flour sacks used and finished loaf yield. System automatically checks compliance with the 1,362 loaves/sack physical standard.
            </p>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleBatchSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider mb-1">
                    Flour Sacks Used (50kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={flourSacksInput}
                    onChange={(e) => setFlourSacksInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#EDE4D5] rounded-xl text-sm font-bold text-[#2C1B10] font-mono focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                    required
                  />
                  <p className="text-[11px] text-[#8C7361] mt-0.5 font-mono">
                    = {(numSacks * 50).toLocaleString()} kg flour
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider mb-1">
                    Shift
                  </label>
                  <select
                    value={shiftInput}
                    onChange={(e) => setShiftInput(e.target.value as 'DAY' | 'NIGHT')}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                  >
                    <option value="DAY">Day Shift (Morning)</option>
                    <option value="NIGHT">Night Shift (Overnight)</option>
                  </select>
                </div>
              </div>

              {/* Live Yield Physics Engine Gauge */}
              <div className="p-4 bg-[#FAF7EE] border border-[#EDE4D5] rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="text-[#4A2E1B]">Expected Yield Standard:</span>
                  <span className="font-mono text-[#E87A18] text-sm">
                    {expectedCalculated.toLocaleString()} loaves (1,362/sack)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-extrabold pt-1 border-t border-[#EDE4D5]/80">
                  <span className="text-[#4A2E1B]">Calculated Efficiency:</span>
                  <span className={`font-mono text-sm ${efficiencyCalculated >= 90 ? 'text-emerald-700' : 'text-rose-700 font-black'}`}>
                    {efficiencyCalculated}%
                  </span>
                </div>

                {isCalculatedUnderYield && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-semibold flex items-start gap-1.5 mt-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>
                      Yield is under 90% ({efficiencyCalculated}%). This batch will be flagged with a red alert for supervisor audit.
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider mb-1">
                    Actual Finished Loaves
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={actualBakedInput}
                    onChange={(e) => setActualBakedInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#EDE4D5] rounded-xl text-sm font-bold text-[#2C1B10] font-mono focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider mb-1">
                    Damaged / Burnt Loaves
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={damagedInput}
                    onChange={(e) => setDamagedInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#EDE4D5] rounded-xl text-sm font-bold text-[#2C1B10] font-mono focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                  />
                </div>
              </div>

              {isCalculatedUnderYield && (
                <div>
                  <label className="block text-[11px] font-black text-rose-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    Reason for Under-Yield (Mandatory)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Oven thermostat failure / dough spillage during proofing"
                    value={flagReasonInput}
                    onChange={(e) => setFlagReasonInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-rose-50/50 border border-rose-300 rounded-xl text-xs font-bold text-rose-950 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-[#EDE4D5]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#EDE4D5] bg-white text-[#4A2E1B] font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[#E87A18] hover:bg-[#D96B10] text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording Batch...</span>
                    </>
                  ) : (
                    'Save Batch & Verify Physics'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
