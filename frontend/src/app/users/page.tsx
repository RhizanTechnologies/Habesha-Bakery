'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth, Branch } from '../../context/AuthContext';
import { apiRequest, getFileUrl } from '../../lib/api';
import {
  Users,
  UserPlus,
  RefreshCw,
  Search,
  KeyRound,
  Edit2,
  Trash2,
  ShieldCheck,
  Check,
  Copy,
  AlertCircle,
  X,
  Phone,
  Building2,
  Sparkles,
  Eye,
  EyeOff,
  FileText,
  Upload,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';

interface StaffUser {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  branchId: string | null;
  branch?: { id: string; name: string; code: string; isHub: boolean } | null;
  shift: string | null;
  salary: number | string | null;
  avatarUrl?: string | null;
  filesUrl?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface RoleMetadata {
  role: string;
  label: string;
  category: string;
  description: string;
  badgeColor: string;
}

const SHIFT_OPTIONS = [
  { value: 'DAY', label: 'Day Shift' },
  { value: 'NIGHT', label: 'Night Shift' },
];

export default function UsersPage() {
  const { branches, user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RoleMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'ROLES'>('ROSTER');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<StaffUser | null>(null);

  // File Upload State
  const [docFile, setDocFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password Generator State
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    role: 'CASHIER',
    branchId: '',
    shift: 'DAY',
    salary: '',
    password: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isOwnerOrAdmin = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';
  const isManager = currentUser?.role === 'BRANCH_MANAGER';

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const fetchUsersAndRoles = async () => {
    setLoading(true);
    const [usersRes, rolesRes] = await Promise.all([
      apiRequest<{ users: StaffUser[] }>('/users?includeInactive=true'),
      apiRequest<{ roles: RoleMetadata[] }>('/users/roles'),
    ]);

    if (usersRes.data?.users) {
      setUsers(usersRes.data.users);
    }
    if (rolesRes.data?.roles) {
      setRoles(rolesRes.data.roles);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  // Quick Password Generator
  const generateStrongPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let pass = 'H';
    for (let i = 0; i < 9; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setFormData((prev) => ({ ...prev, password: pass }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Create Staff Member with PDF and Avatar
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const data = new FormData();
    data.append('fullName', formData.fullName.trim());
    data.append('phone', formData.phone.trim());
    data.append('role', formData.role);
    data.append('password', formData.password.trim());
    if (formData.branchId) data.append('branchId', formData.branchId);
    if (formData.shift) data.append('shift', formData.shift);
    if (formData.salary) data.append('salary', formData.salary);

    if (docFile) {
      data.append('file', docFile);
    }
    if (avatarFile) {
      data.append('avatar', avatarFile);
    }

    const res = await apiRequest<{ user: StaffUser }>('/users', {
      method: 'POST',
      body: data,
    });

    if (res.data?.user) {
      setShowAddModal(false);
      setDocFile(null);
      setAvatarFile(null);
      setFormData({
        fullName: '',
        phone: '',
        role: 'CASHIER',
        branchId: '',
        shift: 'DAY',
        salary: '',
        password: '',
      });
      showNotification(`Staff member '${res.data.user.fullName}' registered successfully.`);
      await fetchUsersAndRoles();
    } else {
      setError(res.error || 'Failed to create staff member');
    }
    setSubmitting(false);
  };

  // Update Staff Member
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    setError(null);

    const data = new FormData();
    data.append('fullName', formData.fullName.trim());
    data.append('phone', formData.phone.trim());
    data.append('role', formData.role);
    if (formData.branchId) data.append('branchId', formData.branchId);
    if (formData.shift) data.append('shift', formData.shift);
    if (formData.salary) data.append('salary', formData.salary);

    if (docFile) {
      data.append('file', docFile);
    }
    if (avatarFile) {
      data.append('avatar', avatarFile);
    }

    const res = await apiRequest<{ user: StaffUser }>(`/users/${editingUser.id}`, {
      method: 'PATCH',
      body: data,
    });

    if (res.data?.user) {
      setEditingUser(null);
      setDocFile(null);
      setAvatarFile(null);
      showNotification(`Staff member '${res.data.user.fullName}' updated.`);
      await fetchUsersAndRoles();
    } else {
      setError(res.error || 'Failed to update staff member');
    }
    setSubmitting(false);
  };

  // Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    setSubmitting(true);
    setError(null);

    const res = await apiRequest(`/users/${passwordModalUser.id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword }),
    });

    if (!res.error) {
      showNotification(`Password for ${passwordModalUser.fullName} has been updated.`);
      setPasswordModalUser(null);
      setNewPassword('');
    } else {
      setError(res.error || 'Failed to reset password');
    }
    setSubmitting(false);
  };

  // Toggle Active / Deactivate
  const handleToggleActive = async (targetUser: StaffUser) => {
    setSubmitting(true);
    setError(null);

    const res = await apiRequest(`/users/${targetUser.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !targetUser.isActive }),
    });

    if (!res.error) {
      showNotification(
        `Staff member '${targetUser.fullName}' ${!targetUser.isActive ? 'activated' : 'deactivated'}.`
      );
      await fetchUsersAndRoles();
    } else {
      setError(res.error || 'Operation failed');
    }
    setSubmitting(false);
  };

  const openEditModal = (u: StaffUser) => {
    setEditingUser(u);
    setDocFile(null);
    setAvatarFile(null);
    setFormData({
      fullName: u.fullName,
      phone: u.phone,
      role: u.role,
      branchId: u.branchId || '',
      shift: u.shift || 'DAY',
      salary: u.salary ? String(u.salary) : '',
      password: '',
    });
    setError(null);
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phone.includes(searchTerm);

    if (!matchesSearch) return false;
    if (selectedBranchFilter !== 'ALL' && u.branchId !== selectedBranchFilter) return false;
    if (selectedRoleFilter !== 'ALL' && u.role !== selectedRoleFilter) return false;
    return true;
  });

  const getRoleBadge = (roleName: string) => {
    const found = roles.find((r) => r.role === roleName);
    const badgeColor = found?.badgeColor || 'bg-slate-100 text-slate-800 border-slate-300';
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${badgeColor}`}>
        {found?.label || roleName.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2C1B10] text-[#FFFDF8] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-[#EDE4D5] animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-[#E87A18]" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#2C1B10] tracking-tight">
            Staff &amp; Role Settings
          </h1>
          <p className="text-xs text-[#8C7361] mt-0.5">
            Personnel onboarding, Kebele/ID documents (PDF), branch scoping, and role permissions
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchUsersAndRoles}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-[#EDE4D5] text-[#2C1B10] hover:bg-[#FAF7EE] text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {(isOwnerOrAdmin || isManager) && (
            <button
              onClick={() => {
                setFormData({
                  fullName: '',
                  phone: '',
                  role: 'CASHIER',
                  branchId: isManager ? (currentUser?.branchId || '') : '',
                  shift: 'DAY',
                  salary: '',
                  password: '',
                });
                setDocFile(null);
                setAvatarFile(null);
                setError(null);
                setShowAddModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#E87A18] hover:bg-[#D96B10] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register Personnel</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EDE4D5] pb-2">
        <button
          onClick={() => setActiveTab('ROSTER')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ROSTER'
              ? 'bg-[#4A2E1B] text-white shadow-sm'
              : 'text-[#8C7361] hover:text-[#2C1B10] hover:bg-[#FAF7EE]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Directory ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ROLES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ROLES'
              ? 'bg-[#4A2E1B] text-white shadow-sm'
              : 'text-[#8C7361] hover:text-[#2C1B10] hover:bg-[#FAF7EE]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Role Permissions ({roles.length})</span>
        </button>
      </div>

      {/* TAB 1: STAFF ROSTER */}
      {activeTab === 'ROSTER' && (
        <div className="space-y-4">
          {/* Search & Filters Bar */}
          <div className="bg-[#FFFDF8] rounded-2xl border border-[#EDE4D5] p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#8C7361] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff by full name or phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-medium"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="text-xs font-bold text-[#2C1B10] bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
              >
                <option value="ALL">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>

              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="text-xs font-bold text-[#2C1B10] bg-[#FAF7EE]/60 border border-[#EDE4D5] rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
              >
                <option value="ALL">All Roles</option>
                {roles.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff Table / List */}
          {filteredUsers.length === 0 ? (
            <div className="bg-[#FFFDF8] rounded-2xl border border-[#EDE4D5] p-8 text-center">
              <Users className="w-10 h-10 text-[#8C7361]/40 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-[#2C1B10]">No staff members found</h3>
              <p className="text-xs text-[#8C7361] mt-1">Try clearing your search query or filters.</p>
            </div>
          ) : (
            <div className="bg-[#FFFDF8] rounded-2xl border border-[#EDE4D5] overflow-hidden shadow-2xs">
              {/* Mobile Staff Cards (< md) */}
              <div className="md:hidden p-3 space-y-3">
                {filteredUsers.map((u) => {
                  const avatarSrc = getFileUrl(u.avatarUrl);
                  const docSrc = getFileUrl(u.filesUrl);

                  return (
                    <div key={u.id} className="p-3.5 sm:p-4 rounded-2xl bg-[#FFFDF8] border border-[#EDE4D5] shadow-xs space-y-3 overflow-hidden">
                      {/* Header: Avatar, Name, Joined, and Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={u.fullName}
                              className="w-10 h-10 rounded-full object-cover border border-[#EDE4D5] shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#4A2E1B] to-[#E87A18] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                              {u.fullName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-extrabold text-sm text-[#2C1B10] truncate">{u.fullName}</p>
                            <span className="text-[10px] text-[#8C7361] block truncate">
                              Joined {new Date(u.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {u.isActive ? (
                            <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Role & Branch tags */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#EDE4D5]/60">
                        <div>{getRoleBadge(u.role)}</div>

                        <div className="flex items-center gap-1 text-[#2C1B10] font-semibold text-[11px] bg-[#FAF7EE] px-2 py-1 rounded-lg border border-[#EDE4D5]/80 max-w-full">
                          {u.branch ? (
                            <>
                              {u.branch.isHub ? (
                                <Building2 className="w-3 h-3 text-teal-700 shrink-0" />
                              ) : (
                                <Building2 className="w-3 h-3 text-[#E87A18] shrink-0" />
                              )}
                              <span className="truncate">{u.branch.name}</span>
                            </>
                          ) : (
                            <span className="text-[#8C7361] italic truncate">HQ / All Branches</span>
                          )}
                        </div>
                      </div>

                      {/* Details Grid: Phone & Salary */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#EDE4D5]/60">
                        <div className="p-2.5 bg-[#FAF7EE]/50 rounded-xl min-w-0">
                          <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider block">Phone (Login)</span>
                          <span className="font-mono font-bold text-xs text-[#2C1B10] flex items-center gap-1 mt-0.5 truncate">
                            <Phone className="w-3 h-3 text-[#8C7361] shrink-0" />
                            <span className="truncate">{u.phone}</span>
                          </span>
                        </div>

                        <div className="p-2.5 bg-[#FAF7EE]/50 rounded-xl min-w-0">
                          <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider block">Shift &amp; Salary</span>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap truncate">
                            {u.shift && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-[#F4ECE1] text-[#4A2E1B] uppercase shrink-0">
                                {u.shift}
                              </span>
                            )}
                            <span className="font-bold text-xs text-[#2C1B10] truncate">
                              {u.salary ? `${Number(u.salary).toLocaleString()} ETB` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ID Document (if available) */}
                      {docSrc && (
                        <div className="pt-1">
                          <a
                            href={docSrc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">View ID Document</span>
                            <ExternalLink className="w-3 h-3 text-blue-400 shrink-0" />
                          </a>
                        </div>
                      )}

                      {/* Bottom Actions Bar (Spans full width, comfortable touch targets) */}
                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-[#EDE4D5]/80">
                        <button
                          onClick={() => {
                            setPasswordModalUser(u);
                            setNewPassword('');
                            setError(null);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE]/70 text-[11px] font-bold text-[#4A2E1B] hover:bg-[#FAF7EE] active:scale-95 transition-all"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
                          <span className="truncate">Reset PIN</span>
                        </button>

                        <button
                          onClick={() => openEditModal(u)}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE]/70 text-[11px] font-bold text-[#2C1B10] hover:bg-[#FAF7EE] active:scale-95 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#8C7361] shrink-0" />
                          <span className="truncate">Edit</span>
                        </button>

                        {isOwnerOrAdmin && u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all active:scale-95 shrink-0 ${
                              u.isActive
                                ? 'border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100'
                                : 'border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100'
                            }`}
                            title={u.isActive ? 'Deactivate Staff' : 'Reactivate Staff'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Phone (Login)</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Assigned Branch</th>
                      <th className="px-4 py-3">ID Document</th>
                      <th className="px-4 py-3">Shift &amp; Salary</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDE4D5]/70">
                    {filteredUsers.map((u) => {
                      const avatarSrc = getFileUrl(u.avatarUrl);
                      const docSrc = getFileUrl(u.filesUrl);

                      return (
                        <tr key={u.id} className="hover:bg-[#FAF7EE]/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {avatarSrc ? (
                                <img
                                  src={avatarSrc}
                                  alt={u.fullName}
                                  className="w-8 h-8 rounded-full object-cover border border-[#EDE4D5] shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4A2E1B] to-[#E87A18] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                  {u.fullName.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-extrabold text-[#2C1B10] truncate">{u.fullName}</p>
                                <span className="text-[10px] text-[#8C7361]">
                                  Joined {new Date(u.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono font-bold text-[#2C1B10]">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-[#8C7361]" />
                              <span>{u.phone}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3">{getRoleBadge(u.role)}</td>

                          <td className="px-4 py-3">
                            {u.branch ? (
                              <div className="flex items-center gap-1.5 text-[#2C1B10] font-semibold">
                                {u.branch.isHub ? (
                                  <Building2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                ) : (
                                  <Building2 className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
                                )}
                                <span>{u.branch.name}</span>
                              </div>
                            ) : (
                              <span className="text-[#8C7361] italic">HQ / All Branches</span>
                            )}
                          </td>

                          {/* ID Document (PDF / Image) View */}
                          <td className="px-4 py-3">
                            {docSrc ? (
                              <a
                                href={docSrc}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>View Document</span>
                                <ExternalLink className="w-2.5 h-2.5 text-blue-400" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-[#8C7361] italic">No file attached</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              {u.shift && (
                                <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-[#F4ECE1] text-[#4A2E1B] uppercase">
                                  {u.shift} Shift
                                </span>
                              )}
                              <p className="font-bold text-[#2C1B10]">
                                {u.salary ? `${Number(u.salary).toLocaleString()} ETB` : '—'}
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            {u.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                Inactive
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Reset Password */}
                              <button
                                onClick={() => {
                                  setPasswordModalUser(u);
                                  setNewPassword('');
                                  setError(null);
                                }}
                                className="p-1.5 rounded-lg text-[#8C7361] hover:text-[#E87A18] hover:bg-[#FAF7EE] transition-colors"
                                title="Reset Password"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit User */}
                              <button
                                onClick={() => openEditModal(u)}
                                className="p-1.5 rounded-lg text-[#8C7361] hover:text-[#2C1B10] hover:bg-[#FAF7EE] transition-colors"
                                title="Edit Staff"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Active Status */}
                              {isOwnerOrAdmin && u.id !== currentUser?.id && (
                                <button
                                  onClick={() => handleToggleActive(u)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    u.isActive
                                      ? 'text-[#8C7361] hover:text-red-600 hover:bg-red-50'
                                      : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={u.isActive ? 'Deactivate' : 'Reactivate'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS MATRIX */}
      {activeTab === 'ROLES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roles.map((r) => {
            const userCount = users.filter((u) => u.role === r.role && u.isActive).length;
            return (
              <div
                key={r.role}
                className="bg-[#FFFDF8] rounded-2xl p-5 border border-[#EDE4D5] shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#8C7361]">
                      {r.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-[#FAF7EE] text-[#4A2E1B] border border-[#EDE4D5]">
                      {userCount} Staff
                    </span>
                  </div>

                  <h3 className="text-base font-black text-[#2C1B10] mt-2">{r.label}</h3>
                  <p className="text-xs text-[#8C7361] mt-1.5 leading-relaxed">{r.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#EDE4D5] flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${r.badgeColor}`}>
                    {r.role}
                  </span>
                  <span className="text-[11px] font-bold text-[#8C7361]">Scoped</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Staff Modal with Document PDF and Avatar */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#FFFDF8] rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-[#EDE4D5] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-[#2C1B10]">
                  {editingUser ? 'Edit Staff Member' : 'Register New Personnel'}
                </h2>
                <p className="text-xs text-[#8C7361] mt-0.5">
                  {editingUser ? `Updating credentials for ${editingUser.fullName}` : 'Onboard employee with role, branch assignment & identification file'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                  setDocFile(null);
                  setAvatarFile(null);
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
              onSubmit={editingUser ? handleUpdateUser : handleCreateUser}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-[#2C1B10] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Almaz Kebede"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-medium bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-[#2C1B10] mb-1">Phone Number (Login Username)</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0911223344"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-mono font-bold bg-white"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block font-bold text-[#2C1B10] mb-1">Assigned Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-bold bg-white"
                >
                  {roles.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.label} ({r.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch Assignment */}
              <div>
                <label className="block font-bold text-[#2C1B10] mb-1">Assigned Branch Outlet</label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-bold bg-white"
                >
                  <option value="">HQ / Unrestricted (Owner / Admin Only)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code}) {b.isHub ? '★ Hub' : 'Spoke'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Shift */}
                <div>
                  <label className="block font-bold text-[#2C1B10] mb-1">Work Shift</label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                    className="w-full px-3 py-2 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-bold bg-white"
                  >
                    {SHIFT_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Salary */}
                <div>
                  <label className="block font-bold text-[#2C1B10] mb-1">Monthly Salary (ETB)</label>
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full px-3 py-2 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-bold bg-white"
                  />
                </div>
              </div>

              {/* Identification Document Upload (PDF / Image) */}
              <div className="p-3.5 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE]/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-[#2C1B10] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-700" />
                    <span>Identification Document (PDF / Image)</span>
                  </label>
                  {editingUser?.filesUrl && (
                    <a
                      href={getFileUrl(editingUser.filesUrl) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:underline font-bold"
                    >
                      View Current Document
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-[#8C7361]">
                  Attach Kebele ID scan, passport, contract, or license (PDF or JPG/PNG/WebP, up to 15MB)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,image/jpeg,image/png,image/webp,image/jpg"
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    className="w-full text-xs border border-[#EDE4D5] bg-white rounded-xl p-1.5 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#4A2E1B] file:text-white hover:file:bg-[#E87A18] cursor-pointer"
                  />
                </div>
                {docFile && (
                  <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Selected: {docFile.name} ({(docFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Profile Avatar (Optional) */}
              <div className="p-3.5 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE]/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-[#2C1B10] flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-700" />
                    <span>Profile Photo <span className="font-normal text-[#8C7361]">(Optional)</span></span>
                  </label>
                  {editingUser?.avatarUrl && (
                    <a
                      href={getFileUrl(editingUser.avatarUrl) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-amber-700 hover:underline font-bold"
                    >
                      View Current Photo
                    </a>
                  )}
                </div>
                <input
                  type="file"
                  ref={avatarInputRef}
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  className="w-full text-xs border border-[#EDE4D5] bg-white rounded-xl p-1.5 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#4A2E1B] file:text-white hover:file:bg-[#E87A18] cursor-pointer"
                />
                {avatarFile && (
                  <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Selected: {avatarFile.name} ({(avatarFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Password field only when creating new user */}
              {!editingUser && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-[#2C1B10]">Initial Password</label>
                    <button
                      type="button"
                      onClick={generateStrongPassword}
                      className="text-[#E87A18] hover:underline font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Auto Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Min 6 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-mono font-bold bg-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#EDE4D5]">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingUser(null);
                    setDocFile(null);
                    setAvatarFile(null);
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
                  {submitting ? 'Saving...' : editingUser ? 'Save Changes' : 'Register Personnel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#FFFDF8] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#EDE4D5]">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-[#E87A18] flex items-center justify-center mb-3">
              <KeyRound className="w-5 h-5" />
            </div>

            <h2 className="text-base font-black text-[#2C1B10]">Reset Staff Password</h2>
            <p className="text-xs text-[#8C7361] mt-0.5">
              Set a new temporary password for <span className="font-bold text-[#2C1B10]">{passwordModalUser.fullName}</span> ({passwordModalUser.phone})
            </p>

            {error && (
              <div className="mt-3 p-2 rounded-lg bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="mt-4 space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-[#2C1B10]">New Password</label>
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    className="text-[#E87A18] hover:underline font-bold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Auto Generate
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    required
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-16 py-2 border border-[#EDE4D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-mono font-bold bg-white"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="p-1 text-[#8C7361] hover:text-[#2C1B10]"
                    >
                      {showPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {newPassword && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(newPassword)}
                        className="p-1 text-[#8C7361] hover:text-[#2C1B10]"
                        title="Copy password"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-3 py-1.5 rounded-xl border border-[#EDE4D5] font-bold text-[#8C7361] hover:bg-[#FAF7EE]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newPassword}
                  className="px-3.5 py-1.5 rounded-xl bg-[#E87A18] hover:bg-[#D96B10] text-white font-bold disabled:opacity-50 shadow-xs"
                >
                  {submitting ? 'Updating...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
