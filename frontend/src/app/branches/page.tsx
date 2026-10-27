'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, Branch } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { Building2, Store, Plus, MapPin, Users, Check, RefreshCw } from 'lucide-react';

export default function BranchesPage() {
  const { activeBranch, switchBranch, refreshBranches, user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: '', code: '', address: '', isHub: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await apiRequest<{ branch: Branch }>('/branches', {
      method: 'POST',
      body: JSON.stringify(newBranch),
    });

    if (res.data?.branch) {
      setShowAddModal(false);
      setNewBranch({ name: '', code: '', address: '', isHub: false });
      await fetchBranches();
      await refreshBranches();
    } else {
      setError(res.error || 'Failed to create branch');
    }
    setSubmitting(false);
  };

  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Branches &amp; Outlets ({branches.length})
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Production facilities and retail distribution spokes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchBranches}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>

          {isOwnerOrAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Branch
            </button>
          )}
        </div>
      </div>

      {/* Branches List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {branches.map((b) => {
          const isActive = activeBranch?.id === b.id;
          return (
            <div
              key={b.id}
              className={`bg-white rounded-2xl border p-5 transition-all shadow-sm relative flex flex-col justify-between ${
                isActive ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        b.isHub ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {b.isHub ? <Building2 className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{b.name}</h3>
                      <span className="font-mono text-xs font-semibold text-slate-500">Code: {b.code}</span>
                    </div>
                  </div>

                  {b.isHub ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-teal-100 text-teal-800 border border-teal-200">
                      Central Hub
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                      Spoke
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{b.address || 'Address not registered'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{b._count?.users ?? 0} Staff Members Assigned</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                {isActive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
                    <Check className="w-3.5 h-3.5" /> Active Branch
                  </span>
                ) : (
                  <button
                    onClick={() => switchBranch(b.id)}
                    className="text-xs font-bold text-slate-700 hover:text-amber-700 hover:bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
                  >
                    Switch Context
                  </button>
                )}

                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  Operational
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Branch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h2 className="text-lg font-black text-slate-900">Add New Branch</h2>
            <p className="text-xs text-slate-500 mt-0.5">Register an additional spoke or production facility</p>

            {error && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateBranch} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gerji Spoke"
                  value={newBranch.name}
                  onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch Code (3-4 Chars)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GRJ"
                  value={newBranch.code}
                  onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Physical Address / Landmark</label>
                <input
                  type="text"
                  placeholder="e.g. Gerji Mebrat Hail, Addis Ababa"
                  value={newBranch.address}
                  onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isHubCheckbox"
                  checked={newBranch.isHub}
                  onChange={(e) => setNewBranch({ ...newBranch, isHub: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                />
                <label htmlFor="isHubCheckbox" className="font-semibold text-slate-700 cursor-pointer">
                  Designate as Central Production Hub
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
