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
    <div className="space-y-6">
      {/* ── Header Title & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#2C1B10]">Crate Logistics &amp; Transfers</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#E87A18]/10 text-[#E87A18] text-[11px] font-black uppercase tracking-wider">
              Developer 1
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-1 font-medium">
            40 loaves per crate packaging physics, driver departure sign-offs, and spoke arrival receiving with driver damage accountability.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={fetchTransfers}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-[#EDE4D5] bg-[#FFFDF8] hover:bg-[#FAF7EE] text-[#4A2E1B] transition-colors cursor-pointer"
            title="Refresh Transfers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#E87A18] hover:bg-[#D96B10] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Dispatch New Crates</span>
          </button>
        </div>
      </div>

      {/* ── Status Alerts ── */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── KPI Metric Cards ── */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="border border-[#EDE4D5] bg-[#FFFDF8] rounded-3xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#8C7361] mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider">In Transit</span>
              <Truck className="w-4 h-4 text-[#E87A18]" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#2C1B10]">{metrics.inTransitCount} Vans</div>
            <div className="text-[11px] text-[#8C7361] font-semibold mt-1">
              {metrics.pendingCount} pending departure
            </div>
          </div>

          <div className="border border-[#EDE4D5] bg-[#FFFDF8] rounded-3xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#8C7361] mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider">Crates Moved</span>
              <Package className="w-4 h-4 text-[#E87A18]" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#2C1B10]">{metrics.totalCratesMoved} Crates</div>
            <div className="text-[11px] text-[#8C7361] font-semibold mt-1">
              {metrics.totalDispatchedLoaves.toLocaleString()} Total Loaves
            </div>
          </div>

          <div className="border border-[#EDE4D5] bg-[#FFFDF8] rounded-3xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#8C7361] mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider">Delivered &amp; Stocked</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700">{metrics.receivedCount} Manifests</div>
            <div className="text-[11px] text-[#8C7361] font-semibold mt-1">
              +{metrics.totalReceivedLoaves.toLocaleString()} Added to Shelf Stock
            </div>
          </div>

          <div className="border border-[#EDE4D5] bg-[#FFFDF8] rounded-3xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#8C7361] mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider">Driver Penalty</span>
              <BadgeAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-700">ETB {metrics.totalDriverBilledCost.toFixed(2)}</div>
            <div className="text-[11px] text-rose-600 font-semibold mt-1">
              {metrics.totalCrushedLoaves} crushed loaves billed
            </div>
          </div>
        </div>
      )}

      {/* ── Main Manifest Card & Tabs ── */}
      <div className="border border-[#EDE4D5] bg-[#FFFDF8] rounded-3xl shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#EDE4D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF7EE]/50">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#4A2E1B]" />
            <h2 className="text-sm font-black text-[#2C1B10]">Inter-Branch Transfer Manifests</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EDE4D5] text-[#4A2E1B] font-bold">
              {filteredManifests.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['ALL', 'PENDING', 'IN_TRANSIT', 'RECEIVED'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#4A2E1B] text-white shadow-xs'
                    : 'bg-[#FFFDF8] text-[#8C7361] hover:text-[#4A2E1B] border border-[#EDE4D5]'
                }`}
              >
                {tab === 'ALL' && 'All'}
                {tab === 'PENDING' && 'Pending'}
                {tab === 'IN_TRANSIT' && 'In Transit'}
                {tab === 'RECEIVED' && 'Delivered'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#8C7361] flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#E87A18]" />
            <span className="text-xs font-bold">Loading transfer manifests...</span>
          </div>
        ) : filteredManifests.length === 0 ? (
          <div className="p-12 text-center text-[#8C7361]">
            <Truck className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#4A2E1B]" />
            <p className="text-xs font-bold text-[#4A2E1B]">No manifests found in this category.</p>
            <p className="text-[11px] text-[#8C7361] mt-0.5">Click &quot;Dispatch New Crates&quot; to send bread from Central Hub.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7EE] text-[#8C7361] uppercase font-black text-[10px] tracking-wider border-b border-[#EDE4D5]">
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
              <tbody className="divide-y divide-[#EDE4D5]/60 text-[#2C1B10] font-medium">
                {filteredManifests.map((manifest) => (
                  <tr key={manifest.id} className="hover:bg-[#FAF7EE]/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#2C1B10]">
                      {manifest.manifestNumber}
                      <div className="text-[10px] text-[#8C7361] font-normal">
                        {new Date(manifest.createdAt).toLocaleDateString()} &bull; {new Date(manifest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="text-[#E87A18]">{manifest.sourceBranch.name}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#8C7361] shrink-0" />
                        <span className="text-[#2C1B10]">{manifest.destinationBranch.name}</span>
                      </div>
                      <div className="text-[11px] text-[#8C7361] mt-0.5">
                        {manifest.product.name}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#2C1B10]">
                        {manifest.dispatchedLoaves.toLocaleString()} Loaves
                      </div>
                      <div className="text-[11px] text-[#E87A18] font-bold flex items-center gap-1 mt-0.5">
                        <Package className="w-3 h-3" />
                        {manifest.crateCount} Crates (40/crate)
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#2C1B10]">
                        {manifest.driver.fullName}
                      </div>
                      <div className="text-[11px] text-[#8C7361]">
                        {manifest.driver.phone}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {manifest.status === 'PENDING_DISPATCH' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Pending Dispatch
                        </span>
                      )}
                      {manifest.status === 'IN_TRANSIT' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200 animate-pulse">
                          <Truck className="w-3 h-3" />
                          In Transit
                        </span>
                      )}
                      {manifest.status === 'RECEIVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Stocked
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {manifest.status === 'RECEIVED' ? (
                        manifest.crushedLoaves && manifest.crushedLoaves > 0 ? (
                          <div>
                            <span className="text-rose-700 font-bold">
                              {manifest.crushedLoaves} Crushed
                            </span>
                            <div className="text-[10px] text-rose-600 font-semibold">
                              Billed ETB {Number(manifest.driverBilledCost).toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <span className="font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> 0 Damages
                          </span>
                        )
                      ) : (
                        <span className="text-[#8C7361]">&mdash;</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {manifest.status === 'PENDING_DISPATCH' && (
                        <button
                          onClick={() => handleDispatchHandshake(manifest.id)}
                          disabled={submitting}
                          className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-all shadow-xs flex items-center gap-1 ml-auto cursor-pointer"
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
                          className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition-all shadow-xs flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Spoke Arrival Handshake
                        </button>
                      )}

                      {manifest.status === 'RECEIVED' && (
                        <div className="text-right">
                          <span className="text-emerald-700 font-bold">+{manifest.receivedLoaves} Loaves Stocked</span>
                          {manifest.receivedByUser && (
                            <div className="text-[10px] text-[#8C7361]">
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

      {/* ── Modal 1: Create Transfer Manifest ── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF8] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#EDE4D5] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE4D5]">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#E87A18]" />
                <h3 className="text-base font-extrabold text-[#2C1B10]">Dispatch Crate Transfer</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-[#8C7361] hover:text-[#4A2E1B] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManifest} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#8C7361] mb-1">
                  Destination Retail Spoke Branch *
                </label>
                <select
                  value={destBranchId}
                  onChange={(e) => setDestBranchId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
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

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#8C7361] mb-1">
                  Dispatched Loaves (50g Bread) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={dispatchedLoaves}
                  onChange={(e) => setDispatchedLoaves(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] font-mono focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                  placeholder="e.g. 5448"
                />

                <div className="mt-2.5 p-3 rounded-2xl bg-[#FAF7EE] border border-[#EDE4D5] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#4A2E1B]">Physics Standard (40 loaves / crate):</span>
                    <div className="text-[#8C7361] mt-0.5">
                      {loavesNum.toLocaleString()} Loaves &divide; 40 = <strong className="text-[#2C1B10] font-black">{cratePreview} Crates</strong>
                    </div>
                  </div>
                  <Package className="w-7 h-7 text-[#E87A18] opacity-70" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#8C7361] mb-1">
                  Assigned Logistics Van Driver *
                </label>
                <select
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#8C7361] mb-1">
                  Departure Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-xs text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                  placeholder="e.g. Morning rush delivery via Van #2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EDE4D5]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2.5 border border-[#EDE4D5] bg-white text-[#4A2E1B] font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || loavesNum <= 0}
                  className="flex-1 py-2.5 bg-[#E87A18] hover:bg-[#D96B10] text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Pack {cratePreview} Crates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: Spoke Arrival Handshake (Receive & Damage Billing) ── */}
      {selectedManifestForReceive && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF8] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#EDE4D5] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE4D5]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-extrabold text-[#2C1B10]">Spoke Arrival Handshake</h3>
              </div>
              <button
                onClick={() => setSelectedManifestForReceive(null)}
                className="text-[#8C7361] hover:text-[#4A2E1B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 p-3.5 rounded-2xl bg-[#FAF7EE] border border-[#EDE4D5] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8C7361]">Manifest:</span>
                <span className="font-mono font-bold text-[#2C1B10]">{selectedManifestForReceive.manifestNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8C7361]">Destination:</span>
                <span className="font-bold text-[#2C1B10]">{selectedManifestForReceive.destinationBranch.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8C7361]">Total Dispatched:</span>
                <span className="font-bold text-[#2C1B10]">{selectedManifestForReceive.dispatchedLoaves} Loaves ({selectedManifestForReceive.crateCount} Crates)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8C7361]">Driver:</span>
                <span className="font-bold text-[#2C1B10]">{selectedManifestForReceive.driver.fullName}</span>
              </div>
            </div>

            <form onSubmit={handleReceiveHandshake} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#8C7361] mb-1">
                  Crushed / Damaged Loaves *
                </label>
                <input
                  type="number"
                  min="0"
                  max={selectedManifestForReceive.dispatchedLoaves}
                  step="1"
                  value={crushedLoaves}
                  onChange={(e) => setCrushedLoaves(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="0 if all arrived intact"
                />
              </div>

              {(() => {
                const crushedNum = Math.max(0, parseInt(crushedLoaves, 10) || 0);
                const intactNum = Math.max(0, selectedManifestForReceive.dispatchedLoaves - crushedNum);
                const unitPrice = Number(selectedManifestForReceive.product?.sellingPrice || 15.0);
                const driverDamagePenalty = crushedNum * unitPrice;

                return (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-2">
                    <div className="flex justify-between items-center text-emerald-950 font-bold">
                      <span>Loaves Adding to Shelf Stock:</span>
                      <span className="text-sm font-black text-emerald-700">+{intactNum} Loaves</span>
                    </div>

                    {crushedNum > 0 && (
                      <div className="pt-2 border-t border-emerald-200/80 text-rose-900 space-y-1">
                        <div className="flex justify-between items-center font-bold">
                          <span>Driver Penalty Applied:</span>
                          <span className="text-sm font-black text-rose-700">
                            ETB {driverDamagePenalty.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-rose-700">
                          {crushedNum} crushed loaves billed to driver {selectedManifestForReceive.driver.fullName}.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#8C7361] mb-1">
                  Supervisor Approval Code (6-Digit PIN)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-xs font-mono tracking-widest text-[#2C1B10] focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="123456 (For manager damage approval)"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#8C7361] mb-1">
                  Receiving Inspection Notes
                </label>
                <textarea
                  rows={2}
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-xs text-[#2C1B10] focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. Arrived on time, fresh temperature"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EDE4D5]">
                <button
                  type="button"
                  onClick={() => setSelectedManifestForReceive(null)}
                  className="flex-1 py-2.5 border border-[#EDE4D5] bg-white text-[#4A2E1B] font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Accept Delivery &amp; Add Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
