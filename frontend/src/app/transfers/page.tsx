'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  Truck,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
  X,
  Loader2,
  RefreshCw,
  Building2,
  UserCheck,
  FileText,
  BadgeAlert,
  ChevronRight,
} from 'lucide-react';

interface TransferManifest {
  id: string;
  manifestNumber: string;
  sourceBranchId: string;
  destinationBranchId: string;
  productId: string;
  dispatchedLoaves: number;
  crateCount: number;
  driverId: string;
  status: 'PENDING_DISPATCH' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED';
  dispatchedAt: string | null;
  driverSignedAt: string | null;
  receivedLoaves: number | null;
  crushedLoaves: number | null;
  driverBilledCost: number | string | null;
  receivedAt: string | null;
  supervisorCodeVerified: boolean;
  notes: string | null;
  createdAt: string;
  sourceBranch: { id: string; name: string; code: string };
  destinationBranch: { id: string; name: string; code: string };
  product: { id: string; name: string; sku: string; sellingPrice?: number | string };
  driver: { id: string; fullName: string; phone: string };
  receivedByUser?: { id: string; fullName: string; role: string } | null;
}

interface TransferMetrics {
  totalTransfers: number;
  pendingCount: number;
  inTransitCount: number;
  receivedCount: number;
  totalDispatchedLoaves: number;
  totalCratesMoved: number;
  totalReceivedLoaves: number;
  totalCrushedLoaves: number;
  totalDriverBilledCost: number;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  isHub: boolean;
}

interface Driver {
  id: string;
  fullName: string;
  phone: string;
  branch?: { id: string; name: string; code: string };
}

export default function TransfersPage() {
  const { user } = useAuth();
  const [manifests, setManifests] = useState<TransferManifest[]>([]);
  const [metrics, setMetrics] = useState<TransferMetrics | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'IN_TRANSIT' | 'RECEIVED'>('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedManifestForReceive, setSelectedManifestForReceive] = useState<TransferManifest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form states for New Manifest
  const [destBranchId, setDestBranchId] = useState('');
  const [dispatchedLoaves, setDispatchedLoaves] = useState('5448');
  const [driverId, setDriverId] = useState('');
  const [notes, setNotes] = useState('');

  // Form states for Receive Handshake
  const [crushedLoaves, setCrushedLoaves] = useState('0');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');

  // Crate packaging formula preview: 40 loaves per crate
  const loavesNum = parseInt(dispatchedLoaves, 10) || 0;
  const cratePreview = Math.ceil(loavesNum / 40);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const [transfersRes, metricsRes, branchesRes, driversRes] = await Promise.all([
        apiRequest<{ manifests: TransferManifest[] }>('/transfers'),
        apiRequest<TransferMetrics>('/transfers/metrics'),
        apiRequest<{ branches: Branch[] }>('/branches'),
        apiRequest<{ drivers: Driver[] }>('/transfers/drivers'),
      ]);

      if (transfersRes.data?.manifests) {
        setManifests(transfersRes.data.manifests);
      }
      if (metricsRes.data) {
        setMetrics(metricsRes.data);
      }
      if (branchesRes.data?.branches) {
        setBranches(branchesRes.data.branches);
        const spokes = branchesRes.data.branches.filter((b) => !b.isHub);
        if (spokes.length > 0 && !destBranchId) {
          setDestBranchId(spokes[0].id);
        }
      }
      if (driversRes.data?.drivers) {
        setDrivers(driversRes.data.drivers);
        if (driversRes.data.drivers.length > 0 && !driverId) {
          setDriverId(driversRes.data.drivers[0].id);
        }
      }
    } catch (err: any) {
      console.error('Fetch transfers failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleCreateManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setSubmitting(true);

    try {
      const res = await apiRequest<{ message: string; manifest: TransferManifest }>('/transfers', {
        method: 'POST',
        body: JSON.stringify({
          destinationBranchId: destBranchId,
          dispatchedLoaves: loavesNum,
          driverId,
          notes,
        }),
      });

      if (res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(res.data?.message || 'Transfer manifest created successfully.');
        setIsCreateOpen(false);
        setNotes('');
        fetchTransfers();
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to dispatch manifest.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatchHandshake = async (manifestId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setSubmitting(true);

    try {
      const res = await apiRequest<{ message: string }>(`/transfers/${manifestId}/dispatch`, {
        method: 'POST',
      });
      if (res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(res.data?.message || 'Manifest dispatched successfully.');
        fetchTransfers();
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to complete dispatch handshake.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceiveHandshake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManifestForReceive) return;

    setActionError(null);
    setActionSuccess(null);
    setSubmitting(true);

    try {
      const res = await apiRequest<{ message: string }>(`/transfers/${selectedManifestForReceive.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          crushedLoaves: parseInt(crushedLoaves, 10) || 0,
          supervisorPin: supervisorPin.trim() || undefined,
          notes: receiveNotes,
        }),
      });

      if (res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(res.data?.message || 'Receiving handshake complete.');
        setSelectedManifestForReceive(null);
        setCrushedLoaves('0');
        setSupervisorPin('');
        setReceiveNotes('');
        fetchTransfers();
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to complete receiving handshake.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredManifests = manifests.filter((m) => {
    if (activeTab === 'PENDING') return m.status === 'PENDING_DISPATCH';
    if (activeTab === 'IN_TRANSIT') return m.status === 'IN_TRANSIT';
    if (activeTab === 'RECEIVED') return m.status === 'RECEIVED';
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-[#4A2E1B] rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-12">
          <Truck className="w-72 h-72" />
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-bold tracking-wide mb-3">
            <Layers className="w-3.5 h-3.5" />
            DEVELOPER 1 &bull; LOGISTICS &amp; CRATE ENGINE
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Hub-to-Spoke Crate Transfers
              </h1>
              <p className="text-amber-100/90 text-sm mt-1 max-w-2xl">
                Physics-based crate calculation (40 loaves/crate), driver sign-off handshake, and spoke arrival receiving with driver damage accountability.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchTransfers}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                <PlusCircle className="w-4 h-4" />
                Dispatch New Crates
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">In Transit</span>
              <Truck className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{metrics.inTransitCount} Vans</div>
            <div className="text-xs text-sky-700 font-semibold mt-1">
              {metrics.pendingCount} pending departure
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Crates Moved</span>
              <Package className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{metrics.totalCratesMoved} Crates</div>
            <div className="text-xs text-amber-700 font-semibold mt-1">
              {metrics.totalDispatchedLoaves.toLocaleString()} Total Loaves
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Delivered &amp; Stocked</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700">{metrics.receivedCount} Manifests</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">
              +{metrics.totalReceivedLoaves.toLocaleString()} Added to Shelf Stock
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Driver Accountability</span>
              <BadgeAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-700">ETB {metrics.totalDriverBilledCost.toFixed(2)}</div>
            <div className="text-xs text-rose-600 font-semibold mt-1">
              {metrics.totalCrushedLoaves} Crushed loaves billed
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {(['ALL', 'PENDING', 'IN_TRANSIT', 'RECEIVED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab
                ? 'bg-amber-800 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {tab === 'ALL' && 'All Transfers'}
            {tab === 'PENDING' && 'Pending Dispatch'}
            {tab === 'IN_TRANSIT' && 'In Transit (On Road)'}
            {tab === 'RECEIVED' && 'Delivered & Received'}
          </button>
        ))}
      </div>

      {/* Manifests Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-700" />
            <h2 className="text-sm font-bold text-slate-900">Inter-Branch Transfer Manifests</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {filteredManifests.length} total
            </span>
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Physics Standard: 40 loaves / crate &bull; Automatic +Shelf Stock on Spoke Arrival
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            <span className="text-sm font-semibold">Loading transfer manifests...</span>
          </div>
        ) : filteredManifests.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Truck className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-600" />
            <p className="text-sm font-bold text-slate-600">No transfer manifests found in this category.</p>
            <p className="text-xs text-slate-400 mt-1">Create a new crate transfer from the Central Hub to begin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF7EE] text-slate-700 text-xs uppercase font-black border-b border-slate-200/80 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Manifest #</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Loaves / Crates</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Damages</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredManifests.map((manifest) => (
                  <tr key={manifest.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-xs">
                      {manifest.manifestNumber}
                      <div className="text-[10px] text-slate-400 font-normal">
                        {new Date(manifest.createdAt).toLocaleDateString()} &bull; {new Date(manifest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <span className="text-amber-800">{manifest.sourceBranch.name}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-900">{manifest.destinationBranch.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-normal">
                        {manifest.product.name}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">
                        {manifest.dispatchedLoaves.toLocaleString()} Loaves
                      </div>
                      <div className="text-xs text-amber-800 font-bold flex items-center gap-1 mt-0.5">
                        <Package className="w-3.5 h-3.5" />
                        {manifest.crateCount} Crates (40/crate)
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-xs">
                        {manifest.driver.fullName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {manifest.driver.phone}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {manifest.status === 'PENDING_DISPATCH' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Pending Dispatch
                        </span>
                      )}
                      {manifest.status === 'IN_TRANSIT' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-900 border border-sky-200 animate-pulse">
                          <Truck className="w-3 h-3" />
                          In Transit (Van on Road)
                        </span>
                      )}
                      {manifest.status === 'RECEIVED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Received &amp; Stocked
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {manifest.status === 'RECEIVED' ? (
                        manifest.crushedLoaves && manifest.crushedLoaves > 0 ? (
                          <div className="text-xs">
                            <span className="text-rose-700 font-bold">
                              {manifest.crushedLoaves} Crushed
                            </span>
                            <div className="text-[10px] text-rose-600 font-semibold">
                              Billed ETB {Number(manifest.driverBilledCost).toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> 0 Damages
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">&mdash;</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {manifest.status === 'PENDING_DISPATCH' && (
                        <button
                          onClick={() => handleDispatchHandshake(manifest.id)}
                          disabled={submitting}
                          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1 ml-auto"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          Driver Sign &amp; Dispatch
                        </button>
                      )}

                      {manifest.status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => {
                            setSelectedManifestForReceive(manifest);
                            setCrushedLoaves('0');
                            setSupervisorPin('');
                          }}
                          disabled={submitting}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1 ml-auto"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Spoke Arrival Handshake
                        </button>
                      )}

                      {manifest.status === 'RECEIVED' && (
                        <div className="text-[11px] text-slate-500 text-right">
                          <span className="text-emerald-700 font-bold">+{manifest.receivedLoaves} Loaves Stocked</span>
                          {manifest.receivedByUser && (
                            <div className="text-[10px] text-slate-400">
                              by {manifest.receivedByUser.fullName}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Create Transfer Manifest */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-700" />
                <h3 className="text-lg font-black text-slate-900">Dispatch Inter-Branch Crate Transfer</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManifest} className="mt-4 space-y-4">
              {/* Destination Branch */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Destination Retail Spoke Branch *
                </label>
                <select
                  value={destBranchId}
                  onChange={(e) => setDestBranchId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {branches
                    .filter((b) => !b.isHub)
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                </select>
              </div>

              {/* Loaves Input & Crate Physics Calculator */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Dispatched Loaves (50g Bread) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={dispatchedLoaves}
                  onChange={(e) => setDispatchedLoaves(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="e.g. 5448"
                />

                {/* Physics Crate Calculation Preview */}
                <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-amber-950">Packaging Physics (40 loaves / crate):</span>
                    <div className="text-amber-800 mt-0.5">
                      {loavesNum.toLocaleString()} Loaves &divide; 40 = <strong className="text-amber-950 font-black">{cratePreview} Crates</strong>
                    </div>
                  </div>
                  <Package className="w-8 h-8 text-amber-600 opacity-60" />
                </div>
              </div>

              {/* Assigned Driver */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Assigned Logistics Van Driver *
                </label>
                <select
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Manifest Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Manifest Notes &amp; Vehicle Departure Instructions
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="e.g. Morning rush delivery via Van #2, fragile top crates"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || loavesNum <= 0}
                  className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-sm font-bold shadow-md transition-all flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Manifest &amp; Pack {cratePreview} Crates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Spoke Arrival Handshake (Receiving & Crushed Billing) */}
      {selectedManifestForReceive && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <h3 className="text-lg font-black text-slate-900">Spoke Arrival Handshake</h3>
              </div>
              <button
                onClick={() => setSelectedManifestForReceive(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Manifest:</span>
                <span className="font-mono font-bold text-slate-900">{selectedManifestForReceive.manifestNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Destination:</span>
                <span className="font-bold text-slate-900">{selectedManifestForReceive.destinationBranch.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Dispatched:</span>
                <span className="font-bold text-slate-900">{selectedManifestForReceive.dispatchedLoaves} Loaves ({selectedManifestForReceive.crateCount} Crates)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Driver:</span>
                <span className="font-bold text-slate-900">{selectedManifestForReceive.driver.fullName}</span>
              </div>
            </div>

            <form onSubmit={handleReceiveHandshake} className="mt-4 space-y-4">
              {/* Crushed Loaves Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Crushed / Damaged Loaves (Inspection) *
                </label>
                <input
                  type="number"
                  min="0"
                  max={selectedManifestForReceive.dispatchedLoaves}
                  step="1"
                  value={crushedLoaves}
                  onChange={(e) => setCrushedLoaves(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="0 if all arrived intact"
                />
              </div>

              {/* Dynamic Live Damage & Stock Credit Preview */}
              {(() => {
                const crushedNum = Math.max(0, parseInt(crushedLoaves, 10) || 0);
                const intactNum = Math.max(0, selectedManifestForReceive.dispatchedLoaves - crushedNum);
                const unitPrice = Number(selectedManifestForReceive.product?.sellingPrice || 15.0);
                const driverDamagePenalty = crushedNum * unitPrice;

                return (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-2">
                    <div className="flex justify-between items-center text-emerald-950 font-bold">
                      <span>Loaves Adding to Shelf Stock:</span>
                      <span className="text-base font-black text-emerald-700">+{intactNum} Loaves</span>
                    </div>

                    {crushedNum > 0 && (
                      <div className="pt-2 border-t border-emerald-200/80 text-rose-900 space-y-1">
                        <div className="flex justify-between items-center font-bold">
                          <span>Driver Damage Accountability:</span>
                          <span className="text-sm font-black text-rose-700">
                            ETB {driverDamagePenalty.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-rose-700">
                          {crushedNum} crushed loaves &times; ETB {unitPrice.toFixed(2)} billed directly to driver {selectedManifestForReceive.driver.fullName}.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Supervisor 6-Digit PIN (if damaged) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Supervisor Approval Code (6-Digit PIN)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm font-mono tracking-widest focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="123456 (Required if reporting damages)"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Managers verify and sign off on damaged crate write-offs and driver billing.
                </span>
              </div>

              {/* Receiving Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Receiving Inspection Notes
                </label>
                <textarea
                  rows={2}
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. Crushed top crates due to bumpy transit, remainder warm and shelf-ready"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedManifestForReceive(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold shadow-md transition-all flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Accept Delivery &amp; Add to Shelf Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
