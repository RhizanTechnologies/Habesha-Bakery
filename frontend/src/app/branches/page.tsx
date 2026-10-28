'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, Branch } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  Building2,
  Store,
  Plus,
  MapPin,
  Users,
  Check,
  CheckCircle2,
  RefreshCw,
  Search,
  Edit2,
  Trash2,
  LayoutGrid,
  List,
  AlertCircle,
  X,
} from 'lucide-react';

export default function BranchesPage() {
  const { activeBranch, switchBranch, refreshBranches, user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'HUBS' | 'SPOKES'>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);

  // Form State
  const [formData, setFormData] = useState({ name: '', code: '', address: '', isHub: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const fetchBranches = async () => {
    setLoading(true);
    const res = await apiRequest<{ branches: Branch[] }>('/branches');
    if (res.data?.branches) {
      setBranches(res.data.branches);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Create Branch
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await apiRequest<{ branch: Branch }>('/branches', {
      method: 'POST',
      body: JSON.stringify(formData),
    });

    if (res.data?.branch) {
      setShowAddModal(false);
      setFormData({ name: '', code: '', address: '', isHub: false });
      showNotification(`Branch '${res.data.branch.name}' created successfully.`);
      await fetchBranches();
      await refreshBranches();
    } else {
      setError(res.error || 'Failed to create branch');
    }
    setSubmitting(false);
  };

  // Edit Branch
  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    setSubmitting(true);
    setError(null);

    const res = await apiRequest<{ branch: Branch }>(`/branches/${editingBranch.id}`, {
      method: 'PATCH',
      body: JSON.stringify(formData),
    });

    if (res.data?.branch) {
      setEditingBranch(null);
      showNotification(`Branch '${res.data.branch.name}' updated successfully.`);
      await fetchBranches();
      await refreshBranches();
    } else {
      setError(res.error || 'Failed to update branch');
    }
    setSubmitting(false);
  };

  // Deactivate Branch
  const handleDeleteBranch = async () => {
    if (!branchToDelete) return;
    setSubmitting(true);
    setError(null);

    const res = await apiRequest(`/branches/${branchToDelete.id}`, {
      method: 'DELETE',
    });

    if (!res.error) {
      showNotification(`Branch '${branchToDelete.name}' has been deactivated.`);
      setBranchToDelete(null);
      await fetchBranches();
      await refreshBranches();
    } else {
      setError(res.error || 'Failed to deactivate branch');
    }
    setSubmitting(false);
  };

  const openEditModal = (b: Branch) => {
    setEditingBranch(b);
    setFormData({
      name: b.name,
      code: b.code,
      address: b.address || '',
      isHub: b.isHub,
    });
    setError(null);
  };

  // Filtered branches
  const filteredBranches = branches.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.address && b.address.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterType === 'HUBS') return b.isHub;
    if (filterType === 'SPOKES') return !b.isHub;
    return true;
  });

  const hubCount = branches.filter((b) => b.isHub).length;
  const spokeCount = branches.filter((b) => !b.isHub).length;
  const totalStaffAssigned = branches.reduce((acc, b) => acc + (b._count?.users || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2C1B10] text-[#FFFDF8] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-[#EDE4D5] animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-[#E87A18]" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#2C1B10] tracking-tight">
            Branches &amp; Outlets
          </h1>
          <p className="text-xs text-[#8C7361] mt-0.5">
            Manage central baking hubs and retail spoke points across Habesha Bakery
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchBranches}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-[#EDE4D5] text-[#2C1B10] hover:bg-[#FAF7EE] text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {isOwnerOrAdmin && (
            <button
              onClick={() => {
                setFormData({ name: '', code: '', address: '', isHub: false });
                setError(null);
                setShowAddModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#E87A18] hover:bg-[#D96B10] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Branch</span>
            </button>
          )}
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#FFFDF8] rounded-2xl p-4 border border-[#EDE4D5] shadow-2xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C7361]">Total Outlets</p>
          <p className="text-xl sm:text-2xl font-black text-[#2C1B10] mt-1">{branches.length}</p>
          <p className="text-[11px] text-[#8C7361] mt-0.5">Active enterprise locations</p>
        </div>

        <div className="bg-[#FFFDF8] rounded-2xl p-4 border border-teal-200 bg-teal-50/20 shadow-2xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-teal-800">Central Hubs</p>
          <p className="text-xl sm:text-2xl font-black text-teal-900 mt-1">{hubCount}</p>
          <p className="text-[11px] text-teal-700 mt-0.5">Production &amp; Warehouses</p>
        </div>

        <div className="bg-[#FFFDF8] rounded-2xl p-4 border border-amber-200 bg-amber-50/20 shadow-2xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Retail Spokes</p>
          <p className="text-xl sm:text-2xl font-black text-amber-900 mt-1">{spokeCount}</p>
          <p className="text-[11px] text-amber-700 mt-0.5">Direct sales counters</p>
        </div>

        <div className="bg-[#FFFDF8] rounded-2xl p-4 border border-[#EDE4D5] shadow-2xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C7361]">Staff Assigned</p>
          <p className="text-xl sm:text-2xl font-black text-[#2C1B10] mt-1">{totalStaffAssigned}</p>
          <p className="text-[11px] text-[#8C7361] mt-0.5">Active employees on roster</p>
        </div>
      </div>

      {/* Search, Filter Tabs & View Toggle */}
      <div className="bg-[#FFFDF8] rounded-2xl border border-[#EDE4D5] p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8C7361] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search branches by name, code, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#FAF7EE] p-1 rounded-xl self-start sm:self-auto border border-[#EDE4D5]">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              filterType === 'ALL' ? 'bg-[#4A2E1B] text-white shadow-2xs' : 'text-[#8C7361] hover:text-[#2C1B10]'
            }`}
          >
            All ({branches.length})
          </button>
          <button
            onClick={() => setFilterType('HUBS')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              filterType === 'HUBS' ? 'bg-[#4A2E1B] text-white shadow-2xs' : 'text-[#8C7361] hover:text-[#2C1B10]'
            }`}
          >
            Hubs ({hubCount})
          </button>
          <button
            onClick={() => setFilterType('SPOKES')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              filterType === 'SPOKES' ? 'bg-[#4A2E1B] text-white shadow-2xs' : 'text-[#8C7361] hover:text-[#2C1B10]'
            }`}
          >
            Spokes ({spokeCount})
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="hidden md:flex items-center gap-1 border-l border-[#EDE4D5] pl-3">
          <button
            onClick={() => setViewMode('GRID')}
            className={`p-1.5 rounded-lg ${
              viewMode === 'GRID' ? 'bg-[#EDE4D5] text-[#2C1B10]' : 'text-[#8C7361] hover:text-[#2C1B10]'
            }`}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('TABLE')}
            className={`p-1.5 rounded-lg ${
              viewMode === 'TABLE' ? 'bg-[#EDE4D5] text-[#2C1B10]' : 'text-[#8C7361] hover:text-[#2C1B10]'
            }`}
            title="Table View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content: Grid or Table View */}
      {filteredBranches.length === 0 ? (
        <div className="bg-[#FFFDF8] rounded-2xl border border-[#EDE4D5] p-8 text-center">
          <Building2 className="w-10 h-10 text-[#8C7361]/30 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#2C1B10]">No branches found</h3>
          <p className="text-xs text-[#8C7361] mt-1">Try adjusting your search or filter criteria.</p>
        </div>
      ) : viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((b) => {
            const isActiveContext = activeBranch?.id === b.id;
            return (
              <div
                key={b.id}
                className={`bg-[#FFFDF8] rounded-2xl border p-5 transition-all shadow-2xs flex flex-col justify-between ${
                  isActiveContext
                    ? 'border-[#E87A18] ring-2 ring-[#E87A18]/20'
                    : 'border-[#EDE4D5] hover:border-[#8C7361]/40'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                          b.isHub ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-[#E87A18]'
                        }`}
                      >
                        {b.isHub ? <Building2 className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-[#2C1B10] text-sm sm:text-base truncate">{b.name}</h3>
                        <span className="font-mono text-xs font-bold text-[#8C7361]">Code: {b.code}</span>
                      </div>
                    </div>

                    {b.isHub ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-teal-100 text-teal-800 border border-teal-200 shrink-0">
                        Central Hub
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#F4ECE1] text-[#4A2E1B] border border-[#EDE4D5] shrink-0">
                        Spoke
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-[#8C7361]">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#8C7361]/70 shrink-0" />
                      <span className="truncate">{b.address || 'Address not registered'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-[#8C7361]/70 shrink-0" />
                      <span>{b._count?.users ?? 0} Staff Members Assigned</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-[#EDE4D5] flex items-center justify-between gap-2">
                  {/* Context Switch */}
                  {isActiveContext ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                      <Check className="w-3.5 h-3.5" /> Active Context
                    </span>
                  ) : (
                    <button
                      onClick={() => switchBranch(b.id)}
                      className="text-xs font-bold text-[#2C1B10] hover:text-[#E87A18] hover:bg-[#FAF7EE] px-2.5 py-1 rounded-lg border border-[#EDE4D5] transition-colors"
                    >
                      Switch Context
                    </button>
                  )}

                  {/* Actions for Owner/Admin */}
                  {isOwnerOrAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(b)}
                        className="p-1.5 rounded-lg text-[#8C7361] hover:text-[#2C1B10] hover:bg-[#FAF7EE] transition-colors"
                        title="Edit Branch"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {user?.role === 'OWNER' && (
                        <button
                          onClick={() => setBranchToDelete(b)}
                          className="p-1.5 rounded-lg text-[#8C7361] hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Deactivate Branch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-[#FFFDF8] rounded-2xl border border-[#EDE4D5] overflow-hidden shadow-2xs">
          {/* Mobile Branch Cards (< md) */}
          <div className="md:hidden p-3.5 space-y-3">
            {filteredBranches.map((b) => {
              const isActiveContext = activeBranch?.id === b.id;
              return (
                <div key={b.id} className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#EDE4D5] shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#FAF7EE] border border-[#EDE4D5] flex items-center justify-center shrink-0">
                        {b.isHub ? <Building2 className="w-5 h-5 text-teal-700" /> : <Store className="w-5 h-5 text-[#E87A18]" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[#2C1B10]">{b.name}</span>
                          {isActiveContext && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-teal-100 text-teal-800 rounded">ACTIVE</span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-[#8C7361]">{b.code}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {b.isHub ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          Hub
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F4ECE1] text-[#4A2E1B] border border-[#EDE4D5]">
                          Spoke
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#EDE4D5]/60">
                    <div className="p-2 bg-[#FAF7EE]/40 rounded-xl">
                      <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider block">Address</span>
                      <span className="font-medium text-xs text-[#2C1B10] block truncate">{b.address || '—'}</span>
                    </div>

                    <div className="p-2 bg-[#FAF7EE]/40 rounded-xl">
                      <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider block">Assigned Staff</span>
                      <span className="font-bold text-xs text-[#2C1B10] block">{b._count?.users ?? 0} Personnel</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#EDE4D5]/60">
                    {!isActiveContext ? (
                      <button
                        onClick={() => switchBranch(b.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#E87A18] text-white font-bold text-xs hover:bg-[#D96B10] transition-colors"
                      >
                        Select Branch
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-teal-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Current Context
                      </span>
                    )}

                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => openEditModal(b)}
                        className="p-1.5 rounded-xl border border-[#EDE4D5] text-[#8C7361] hover:text-[#2C1B10] hover:bg-[#FAF7EE] text-xs font-bold flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7EE] border-b border-[#EDE4D5] text-[#8C7361] uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Branch Details</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Assigned Staff</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE4D5]/70">
                {filteredBranches.map((b) => {
                  const isActiveContext = activeBranch?.id === b.id;
                  return (
                    <tr key={b.id} className="hover:bg-[#FAF7EE]/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#2C1B10] flex items-center gap-2">
                          {b.isHub ? (
                            <Building2 className="w-4 h-4 text-teal-700" />
                          ) : (
                            <Store className="w-4 h-4 text-[#E87A18]" />
                          )}
                          <span>{b.name}</span>
                          {isActiveContext && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-teal-100 text-teal-800 rounded">
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-[#2C1B10]">{b.code}</td>
                      <td className="px-4 py-3.5">
                        {b.isHub ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            Central Hub
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F4ECE1] text-[#4A2E1B] border border-[#EDE4D5]">
                            Retail Spoke
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[#8C7361] max-w-[200px] truncate">
                        {b.address || '—'}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-[#2C1B10]">
                        {b._count?.users ?? 0} staff
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isActiveContext && (
                            <button
                              onClick={() => switchBranch(b.id)}
                              className="text-[11px] font-bold text-[#E87A18] hover:underline px-2 py-1"
                            >
                              Select
                            </button>
                          )}
                          {isOwnerOrAdmin && (
                            <button
                              onClick={() => openEditModal(b)}
                              className="p-1 rounded text-[#8C7361] hover:text-[#2C1B10] hover:bg-[#FAF7EE]"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Branch Modal */}
      {(showAddModal || editingBranch) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#FFFDF8] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-[#EDE4D5]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-[#2C1B10]">
                  {editingBranch ? 'Edit Branch' : 'Add New Branch'}
                </h2>
                <p className="text-xs text-[#8C7361] mt-0.5">
                  {editingBranch ? `Update settings for ${editingBranch.name}` : 'Register a new hub or retail location'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingBranch(null);
                }}
                className="p-1 rounded-lg text-[#8C7361] hover:text-[#2C1B10]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={editingBranch ? handleUpdateBranch : handleCreateBranch}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-bold text-[#2C1B10] mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gerji Spoke"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-medium bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-[#2C1B10] mb-1">Branch Code (3-4 Chars)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GRJ"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-mono font-bold bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-[#2C1B10] mb-1">Physical Address / Landmark</label>
                <input
                  type="text"
                  placeholder="e.g. Gerji Mebrat Hail, Addis Ababa"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-medium bg-white"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="isHubCheckbox"
                  checked={formData.isHub}
                  onChange={(e) => setFormData({ ...formData, isHub: e.target.checked })}
                  className="w-4 h-4 text-[#E87A18] rounded focus:ring-[#E87A18]"
                />
                <label htmlFor="isHubCheckbox" className="font-bold text-[#2C1B10] cursor-pointer">
                  Designate as Central Production Hub
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#EDE4D5]">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingBranch(null);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-[#EDE4D5] font-bold text-[#8C7361] hover:bg-[#FAF7EE]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#E87A18] hover:bg-[#D96B10] text-white font-bold disabled:opacity-50 shadow-sm"
                >
                  {submitting ? 'Saving...' : editingBranch ? 'Save Changes' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Deactivate Confirmation Modal */}
      {branchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#FFFDF8] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#EDE4D5]">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-black text-[#2C1B10]">Deactivate Branch?</h2>
            <p className="text-xs text-[#8C7361] mt-1 leading-relaxed">
              Are you sure you want to deactivate <span className="font-bold text-[#2C1B10]">{branchToDelete.name}</span>?
              Staff assigned to this branch will no longer be able to log in until reassigned.
            </p>

            {error && (
              <div className="mt-2 text-xs font-bold text-red-600">{error}</div>
            )}

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setBranchToDelete(null)}
                className="px-3 py-1.5 rounded-xl border border-[#EDE4D5] text-xs font-bold text-[#8C7361] hover:bg-[#FAF7EE]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBranch}
                disabled={submitting}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Deactivating...' : 'Confirm Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
