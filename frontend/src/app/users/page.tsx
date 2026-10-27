'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { UserPlus, RefreshCw, KeyRound } from 'lucide-react';

interface StaffUser {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  branchId: string | null;
  branch?: { id: string; name: string; code: string; isHub: boolean } | null;
  shift: string;
  salary: number;
  isActive: boolean;
}

export default function UsersPage() {
  const { branches, company, user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isOwnerOrAdmin = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'BRANCH_MANAGER';

  // Form State for creating a user
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    role: 'CASHIER',
    branchId: '',
    shift: 'DAY',
    salary: '',
    password: '',
  });

  const fetchUsers = async () => {
    setLoading(true);
    const res = await apiRequest<{ users: StaffUser[] }>('/users');
    if (res.data?.users) {
      setUsers(res.data.users);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.password || formData.password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const payload = {
      ...formData,
      salary: formData.salary ? Number(formData.salary) : null,
    };

    const res = await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.data) {
      setShowAddModal(false);
      setFormData({
        fullName: '',
        phone: '',
        role: 'CASHIER',
        branchId: '',
        shift: 'DAY',
        salary: '',
        password: '',
      });
      await fetchUsers();
    } else {
      setError(res.error || 'Failed to create staff member');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPasswordModal) return;
    setError(null);

    if (!newPassword || newPassword.trim().length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    const res = await apiRequest(`/users/${showPasswordModal.id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword: newPassword.trim() }),
    });

    if (res.data) {
      setShowPasswordModal(null);
      setNewPassword('');
      await fetchUsers();
    } else {
      setError(res.error || 'Failed to update employee password');
    }
  };

  const currencySymbol = company?.currency || 'ETB';

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Staff Roster</h1>
          <p className="text-xs text-slate-500 mt-1">
            Bakery personnel, assigned branches, shift schedules &amp; credentials
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
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
              <UserPlus className="w-4 h-4" />
              Add Staff Member
            </button>
          )}
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Staff Name &amp; Phone</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Assigned Branch</th>
                <th className="py-3 px-4">Shift</th>
                <th className="py-3 px-4">Salary ({currencySymbol})</th>
                {isOwnerOrAdmin && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div>{u.fullName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{u.phone}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    {u.branch ? (
                      <span className="font-semibold text-slate-800">
                        {u.branch.name} ({u.branch.code})
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Global (HQ)</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    {u.shift ? (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.shift === 'NIGHT' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {u.shift}
                      </span>
                    ) : (
                      <span className="text-slate-400">&mdash;</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-semibold text-slate-700">
                    {u.salary ? `${currencySymbol} ${Number(u.salary).toLocaleString()}` : '&mdash;'}
                  </td>

                  {isOwnerOrAdmin && (
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setShowPasswordModal(u)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors"
                      >
                        Reset Password
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <h2 className="text-lg font-black text-slate-900">Add Staff Member</h2>
            <p className="text-xs text-slate-500 mt-0.5">Register staff with branch assignment and login password</p>

            {error && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Almaz Bekele"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number (Login)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0911223344"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="CASHIER">Cashier (Front POS)</option>
                    <option value="BRANCH_MANAGER">Branch Manager</option>
                    <option value="BAKER">Baker (Production)</option>
                    <option value="PRODUCTION_SUPERVISOR">Production Supervisor</option>
                    <option value="STOREKEEPER">Storekeeper (Warehouse)</option>
                    <option value="DRIVER">Driver (Logistics)</option>
                    <option value="ADMIN">System Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Branch</label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="">-- Unassigned (HQ / Floating) --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shift</label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="DAY">Day Shift (06:00 - 18:00)</option>
                    <option value="NIGHT">Night Shift (18:00 - 06:00)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Monthly Salary ({currencySymbol})</label>
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Login Password (min 6 chars)</label>
                <input
                  type="password"
                  required
                  placeholder="Set initial password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
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
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  Save Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <h2 className="text-lg font-black text-slate-900">Reset Password</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set new password for <span className="font-bold text-slate-800">{showPasswordModal.fullName}</span>
            </p>

            {error && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Password (min 6 chars)</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(null)}
                  className="px-3 py-2 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
