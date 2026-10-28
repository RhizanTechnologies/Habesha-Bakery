'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  Wheat,
  Scale,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Clock,
  Building2,
  X,
  Loader2,
  CalendarDays,
  FileText,
} from 'lucide-react';

interface StockItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  packageWeightKg: number | null;
  minStockThreshold: number;
  costPerUnit: number | null;
  currentQuantity: number;
  isLowStock: boolean;
  updatedAt: string;
}

interface DisbursementItem {
  id: string;
  quantity: number;
  unit: string;
  rawMaterial?: {
    id: string;
    name: string;
    unit: string;
  };
}

interface DisbursementRecord {
  id: string;
  department: string;
  notes: string | null;
  createdAt: string;
  fromBranch: {
    id: string;
    name: string;
    code: string;
  };
  disbursedByUser: {
    id: string;
    fullName: string;
    role: string;
  };
  items: DisbursementItem[];
}

export default function StockPage() {
  const { user, activeBranch } = useAuth();

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [disbursements, setDisbursements] = useState<DisbursementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);

  // Form states for Disbursement
  const [disburseItems, setDisburseItems] = useState<{ rawMaterialId: string; quantity: string }[]>([
    { rawMaterialId: '', quantity: '1' },
  ]);
  const [disburseDept, setDisburseDept] = useState('KITCHEN');
  const [disburseNotes, setDisburseNotes] = useState('');
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [disburseError, setDisburseError] = useState<string | null>(null);

  // Form states for Ingestion (Receive delivery)
  const [ingestMaterialId, setIngestMaterialId] = useState('');
  const [ingestQuantity, setIngestQuantity] = useState('');
  const [ingestNotes, setIngestNotes] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const fetchStockData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [stockRes, disburseRes] = await Promise.all([
        apiRequest<{ stocks: StockItem[]; branch: any }>('/inventory/stock'),
        apiRequest<{ disbursements: DisbursementRecord[] }>('/inventory/disbursements'),
      ]);

      if (stockRes.data?.stocks) {
        setStocks(stockRes.data.stocks);
      } else if (stockRes.error) {
        setError(stockRes.error);
      }

      if (disburseRes.data?.disbursements) {
        setDisbursements(disburseRes.data.disbursements);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, [activeBranch]);

  // Derived metrics
  const flourMaterial = stocks.find((s) => s.sku.includes('FLOUR') || s.unit === 'BAG');
  const flourSacks = flourMaterial ? flourMaterial.currentQuantity : 0;
  const flourWeightKg = flourMaterial
    ? flourSacks * (flourMaterial.packageWeightKg || 50)
    : 0;

  const lowStockCount = stocks.filter((s) => s.isLowStock).length;

  // Handlers
  const handleAddDisburseRow = () => {
    setDisburseItems((prev) => [...prev, { rawMaterialId: '', quantity: '1' }]);
  };

  const handleRemoveDisburseRow = (index: number) => {
    setDisburseItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDisburseItemChange = (index: number, field: 'rawMaterialId' | 'quantity', val: string) => {
    setDisburseItems((prev) => {
      const next = [...prev];
      next[index][field] = val;
      return next;
    });
  };

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisburseError(null);

    // Validate
    const payloadItems = disburseItems
      .filter((i) => i.rawMaterialId && Number(i.quantity) > 0)
      .map((i) => ({
        rawMaterialId: i.rawMaterialId,
        quantity: Number(i.quantity),
      }));

    if (payloadItems.length === 0) {
      setDisburseError('Please select at least one material with a positive quantity.');
      return;
    }

    setIsDisbursing(true);
    const res = await apiRequest('/inventory/disburse', {
      method: 'POST',
      body: JSON.stringify({
        department: disburseDept,
        notes: disburseNotes.trim() || undefined,
        items: payloadItems,
      }),
    });
    setIsDisbursing(false);

    if (res.data) {
      setIsDisburseModalOpen(false);
      setDisburseItems([{ rawMaterialId: '', quantity: '1' }]);
      setDisburseNotes('');
      fetchStockData();
    } else {
      setDisburseError(res.error || 'Failed to complete disbursement.');
    }
  };

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngestError(null);

    const qty = Number(ingestQuantity);
    if (!ingestMaterialId || isNaN(qty) || qty <= 0) {
      setIngestError('Please select a material and enter a positive delivery quantity.');
      return;
    }

    setIsIngesting(true);
    const res = await apiRequest('/inventory/ingest', {
      method: 'POST',
      body: JSON.stringify({
        rawMaterialId: ingestMaterialId,
        quantity: qty,
        notes: ingestNotes.trim() || undefined,
      }),
    });
    setIsIngesting(false);

    if (res.data) {
      setIsIngestModalOpen(false);
      setIngestQuantity('');
      setIngestNotes('');
      fetchStockData();
    } else {
      setIngestError(res.error || 'Failed to record supplier intake.');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EDE4D5]/60">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E87A18]/10 text-[#E87A18] text-xs font-bold mb-1.5 border border-[#E87A18]/20">
            <Wheat className="w-3.5 h-3.5" />
            Central Hub Warehouse &bull; Developer 1
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading">
            Raw Material Inventory &amp; Scale Disbursements
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] font-medium mt-0.5">
            Storekeeper weigh-outs, 50kg flour sacks, and ingredient tracking to the kitchen.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setIngestError(null);
              setIsIngestModalOpen(true);
            }}
            className="px-4 py-2.5 bg-white hover:bg-[#FAF7EE] border border-[#EDE4D5] text-[#4A2E1B] font-bold rounded-xl text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#E87A18]" />
            <span>Receive Delivery</span>
          </button>

          <button
            onClick={() => {
              setDisburseError(null);
              setIsDisburseModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#E87A18] hover:bg-[#D96B10] active:scale-[0.99] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Scale className="w-4 h-4 text-white" />
            <span>Weigh Out to Kitchen</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Flour Sacks in Stock */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Flour Sacks In Warehouse
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#E87A18] flex items-center justify-center font-bold">
              <Wheat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading mt-2 font-mono">
            {flourSacks} <span className="text-sm font-semibold text-[#8C7361]">Sacks</span>
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
            Equivalent to {flourWeightKg.toLocaleString()} kg flour mass
          </p>
        </div>

        {/* Low Stock Alerts */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Reorder Warning
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${lowStockCount > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-heading mt-2 font-mono ${lowStockCount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {lowStockCount} {lowStockCount === 1 ? 'Material' : 'Materials'}
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
            {lowStockCount > 0 ? 'Below minimum reorder threshold' : 'All warehouse stock healthy'}
          </p>
        </div>

        {/* Scale Disbursements Today */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Kitchen Scale Disbursements
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading mt-2 font-mono">
            {disbursements.length} <span className="text-sm font-semibold text-[#8C7361]">Disbursements</span>
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
            Materials scaled out to bakers
          </p>
        </div>

        {/* Active Facility Context */}
        <div className="border border-[#EDE4D5] bg-white rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">
              Warehouse Facility
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#2C1B10] tracking-tight font-heading mt-2 truncate">
            {activeBranch?.name || 'Central Hub'}
          </div>
          <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
            {activeBranch?.isHub ? 'Hub Production & Warehouse' : 'Branch Storage'}
          </p>
        </div>
      </div>

      {/* ── Warehouse Materials Stock Balance Table ── */}
      <div className="border border-[#EDE4D5] bg-white rounded-3xl shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-[#EDE4D5] flex items-center justify-between bg-[#FAF7EE]/30">
          <div>
            <h3 className="text-base font-extrabold text-[#2C1B10]">Raw Materials Inventory Roster</h3>
            <p className="text-xs text-[#8C7361]">Live storekeeper balances with minimum threshold indicators</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#E87A18]/10 text-[#E87A18] border border-[#E87A18]/20">
            {stocks.length} Tracked Ingredients
          </span>
        </div>

        {/* Mobile Inventory Cards (< md) */}
        <div className="md:hidden p-3.5 space-y-3">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-[#8C7361]">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#E87A18] mb-2" />
              Loading warehouse stock...
            </div>
          ) : stocks.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8C7361]">
              No raw materials registered in warehouse.
            </div>
          ) : (
            stocks.map((item) => (
              <div key={item.id} className="p-3.5 sm:p-4 rounded-2xl bg-[#FFFDF8] border border-[#EDE4D5] shadow-xs space-y-3 overflow-hidden">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#FAF7EE] border border-[#EDE4D5] flex items-center justify-center text-[#E87A18] shrink-0">
                      <Wheat className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[#2C1B10] truncate">{item.name}</h4>
                      <p className="font-mono text-[11px] text-[#8C7361] truncate">{item.sku}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                      item.isLowStock
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {item.isLowStock ? (
                      <>
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        Low Stock
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Healthy
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#EDE4D5]/60">
                  <div className="p-2.5 bg-[#FAF7EE]/60 rounded-xl">
                    <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider block">Warehouse Balance</span>
                    <span className="font-mono font-extrabold text-sm text-[#2C1B10]">
                      {item.currentQuantity} <span className="text-xs text-[#8C7361] font-semibold">{item.unit}</span>
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#FAF7EE]/60 rounded-xl">
                    <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider block">Min Threshold</span>
                    <span className="font-mono font-bold text-sm text-[#8C7361]">
                      {item.minStockThreshold} {item.unit}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-[#8C7361] font-medium flex items-center justify-between">
                  <span>Packaging Unit:</span>
                  <span className="font-semibold text-[#4A2E1B]">{item.packageWeightKg ? `${item.packageWeightKg} kg / ${item.unit}` : item.unit}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7EE] text-[#8C7361] font-bold uppercase tracking-wider text-[11px] border-b border-[#EDE4D5]">
              <tr>
                <th className="py-3.5 px-4">Material Name</th>
                <th className="py-3.5 px-4">SKU Code</th>
                <th className="py-3.5 px-4">Packaging / Unit</th>
                <th className="py-3.5 px-4 text-right">Warehouse Balance</th>
                <th className="py-3.5 px-4 text-right">Min Threshold</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE4D5]/60 text-[#2C1B10]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#8C7361]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#E87A18] mb-2" />
                    Loading warehouse stock...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#8C7361]">
                    No raw materials registered in warehouse.
                  </td>
                </tr>
              ) : (
                stocks.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF7EE]/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-sm">
                      <div className="flex items-center gap-2">
                        <Wheat className="w-4 h-4 text-[#8C7361]" />
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#8C7361]">{item.sku}</td>
                    <td className="py-3.5 px-4 font-semibold text-[#4A2E1B]">
                      {item.packageWeightKg ? `${item.packageWeightKg} kg / ${item.unit}` : item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-sm">
                      {item.currentQuantity} <span className="text-xs text-[#8C7361] font-semibold">{item.unit}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#8C7361]">
                      {item.minStockThreshold} {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          item.isLowStock
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {item.isLowStock ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Low Stock
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Healthy
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent Scale Disbursements Log ── */}
      <div className="border border-[#EDE4D5] bg-white rounded-3xl shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-[#EDE4D5] flex items-center justify-between bg-[#FAF7EE]/30">
          <div>
            <h3 className="text-base font-extrabold text-[#2C1B10]">Recent Scale Weigh-Out Manifests</h3>
            <p className="text-xs text-[#8C7361]">Materials weighed out by storekeeper to the bakery kitchen</p>
          </div>
          <span className="text-xs font-bold text-[#8C7361]">Audit Verified</span>
        </div>

        <div className="divide-y divide-[#EDE4D5]/60">
          {disbursements.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8C7361]">
              No scale disbursements recorded yet today.
            </div>
          ) : (
            disbursements.map((d) => (
              <div key={d.id} className="p-4 hover:bg-[#FAF7EE]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[#2C1B10]">Issued to: {d.department}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF7EE] text-[#4A2E1B] border border-[#EDE4D5]">
                      {d.fromBranch?.code || 'BOLE-HUB'}
                    </span>
                  </div>
                  <p className="text-[#8C7361] mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(d.createdAt).toLocaleString()} &bull; Disbursed by: {d.disbursedByUser?.fullName} ({d.disbursedByUser?.role})
                  </p>
                  {d.notes && <p className="text-[#8C7361] italic mt-0.5 text-[11px]">Note: &ldquo;{d.notes}&rdquo;</p>}
                </div>

                <div className="flex flex-wrap gap-1.5 self-start sm:self-auto">
                  {d.items.map((item) => (
                    <span
                      key={item.id}
                      className="px-2.5 py-1 rounded-xl bg-[#FAF7EE] border border-[#EDE4D5] text-[#2C1B10] font-bold text-[11px]"
                    >
                      {item.rawMaterial?.name || 'Material'}: <span className="text-[#E87A18] font-mono">{item.quantity} {item.unit}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Modal: Scale Disbursement to Kitchen ── */}
      {isDisburseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-[#EDE4D5] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE4D5]">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#E87A18]" />
                <h3 className="text-base font-extrabold text-[#2C1B10]">Weigh Out Materials to Kitchen</h3>
              </div>
              <button
                onClick={() => setIsDisburseModalOpen(false)}
                className="text-[#8C7361] hover:text-[#4A2E1B] p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8C7361] font-medium leading-relaxed">
              Storekeeper weighs out raw materials (flour sacks, yeast, sugar, salt) on scale and issues them to the baking kitchen.
            </p>

            {disburseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                {disburseError}
              </div>
            )}

            <form onSubmit={handleDisburseSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider mb-1">
                  Destination Department
                </label>
                <input
                  type="text"
                  value={disburseDept}
                  onChange={(e) => setDisburseDept(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                  required
                />
              </div>

              {/* Items to weigh out */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider">
                  Materials To Disburse
                </label>

                {disburseItems.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={row.rawMaterialId}
                      onChange={(e) => handleDisburseItemChange(idx, 'rawMaterialId', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                      required
                    >
                      <option value="">-- Select Material --</option>
                      {stocks.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Available: {s.currentQuantity} {s.unit})
                        </option>
                      ))}
                    </select>

                    <div className="w-24">
                      <input
                        type="number"
                        step="any"
                        min="0.1"
                        placeholder="Qty"
                        value={row.quantity}
                        onChange={(e) => handleDisburseItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] font-mono focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                        required
                      />
                    </div>

                    {disburseItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDisburseRow(idx)}
                        className="text-rose-600 hover:text-rose-800 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddDisburseRow}
                  className="text-xs font-bold text-[#E87A18] hover:text-[#D96B10] flex items-center gap-1 mt-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Add Another Material
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider mb-1">
                  Disbursement Notes / Shift Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard morning baguette & 50g loaf bake"
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#EDE4D5]">
                <button
                  type="button"
                  onClick={() => setIsDisburseModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#EDE4D5] bg-white text-[#4A2E1B] font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDisbursing}
                  className="flex-1 py-2.5 bg-[#E87A18] hover:bg-[#D96B10] text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isDisbursing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    'Confirm Weigh-Out & Issue'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Receive Supplier Delivery (Ingest) ── */}
      {isIngestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] rounded-3xl p-6 w-full max-w-md shadow-2xl border border-[#EDE4D5] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE4D5]">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#E87A18]" />
                <h3 className="text-base font-extrabold text-[#2C1B10]">Receive Supplier Delivery</h3>
              </div>
              <button
                onClick={() => setIsIngestModalOpen(false)}
                className="text-[#8C7361] hover:text-[#4A2E1B] p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8C7361] font-medium leading-relaxed">
              Record incoming shipments of flour sacks, yeast, and ingredients into Central Hub warehouse stock.
            </p>

            {ingestError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                {ingestError}
              </div>
            )}

            <form onSubmit={handleIngestSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider mb-1">
                  Raw Material Item
                </label>
                <select
                  value={ingestMaterialId}
                  onChange={(e) => setIngestMaterialId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                  required
                >
                  <option value="">-- Select Material --</option>
                  {stocks.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider mb-1">
                  Received Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  placeholder="e.g. 50"
                  value={ingestQuantity}
                  onChange={(e) => setIngestQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] font-mono focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-[#8C7361] uppercase tracking-wider mb-1">
                  Delivery / Supplier Invoice Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kaliti Flour Mill Invoice #9821"
                  value={ingestNotes}
                  onChange={(e) => setIngestNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#EDE4D5]">
                <button
                  type="button"
                  onClick={() => setIsIngestModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#EDE4D5] bg-white text-[#4A2E1B] font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isIngesting}
                  className="flex-1 py-2.5 bg-[#E87A18] hover:bg-[#D96B10] text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isIngesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Add to Warehouse'
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
