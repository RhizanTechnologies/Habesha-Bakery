'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  ShoppingBag,
  Plus,
  Search,
  LayoutGrid,
  List,
  Edit2,
  Check,
  AlertCircle,
  X,
  Package,
  Layers,
  TrendingUp,
  Tag,
  Coins,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';

interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  _count?: { products: number };
}

interface Product {
  id: string;
  categoryId: string;
  category?: ProductCategory;
  name: string;
  sku: string;
  sellingPrice: number;
  costPrice?: number | null;
  unit: string;
  isActive: boolean;
  availableStock: number;
}

export default function ProductsPage() {
  const { user, activeBranch } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & View
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK'>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    categoryId: '',
    sellingPrice: '',
    costPrice: '',
    unit: 'PIECE',
    initialStock: '20',
  });

  const [categoryFormData, setCategoryFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canManageProducts = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER';

  const fetchData = async () => {
    setLoading(true);
    const branchParam = activeBranch?.id ? `?branchId=${activeBranch.id}` : '';
    const [prodRes, catRes] = await Promise.all([
      apiRequest<Product[]>(`/products${branchParam}`),
      apiRequest<ProductCategory[]>('/products/categories'),
    ]);

    if (prodRes.data) {
      setProducts(prodRes.data);
    }
    if (catRes.data) {
      setCategories(catRes.data);
      if (!formData.categoryId && catRes.data.length > 0) {
        setFormData((prev) => ({ ...prev, categoryId: catRes.data![0].id }));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeBranch?.id]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      sku: formData.sku.trim().toUpperCase(),
      categoryId: formData.categoryId,
      sellingPrice: parseFloat(formData.sellingPrice),
      costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
      unit: formData.unit.toUpperCase(),
      initialStock: parseInt(formData.initialStock, 10) || 0,
      isActive: true,
    };

    const res = await apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccessMessage('Product added to catalog successfully!');
      setShowAddModal(false);
      setFormData({
        name: '',
        sku: '',
        categoryId: categories[0]?.id || '',
        sellingPrice: '',
        costPrice: '',
        unit: 'PIECE',
        initialStock: '20',
      });
      fetchData();
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setError(null);
    setSubmitting(true);

    const res = await apiRequest(`/products/${editingProduct.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editingProduct.name,
        sellingPrice: editingProduct.sellingPrice,
        costPrice: editingProduct.costPrice,
        isActive: editingProduct.isActive,
      }),
    });

    setSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccessMessage('Product updated successfully!');
      setEditingProduct(null);
      fetchData();
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await apiRequest('/products/categories', {
      method: 'POST',
      body: JSON.stringify(categoryFormData),
    });

    setSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else {
      setShowCategoryModal(false);
      setCategoryFormData({ name: '', description: '' });
      fetchData();
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;

    const matchesStock =
      stockFilter === 'ALL' ||
      (stockFilter === 'IN_STOCK' && p.availableStock > 0) ||
      (stockFilter === 'LOW_STOCK' && p.availableStock <= 15);

    return matchesSearch && matchesCategory && matchesStock;
  });

  // KPI Computations
  const totalItems = products.length;
  const inStockItems = products.filter((p) => p.availableStock > 0).length;
  const avgPrice = totalItems > 0 ? products.reduce((acc, p) => acc + p.sellingPrice, 0) / totalItems : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 transform skew-x-12 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/30 backdrop-blur-sm border border-amber-400/30 text-amber-100 text-xs font-semibold mb-3">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Bread & Pastry Catalog</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Product Catalog & Shelf Pricing
            </h1>
            <p className="text-amber-100/80 text-sm mt-1 max-w-xl">
              Manage retail bread items, loaf sizes, unit pricing, and real-time shelf stock for{' '}
              <span className="font-semibold text-white">{activeBranch?.name || 'All Branches'}</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-amber-800/60 hover:bg-amber-800 border border-amber-500/30 text-amber-100 transition shadow-sm"
              title="Refresh Catalog"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {canManageProducts && (
              <>
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-amber-800/60 hover:bg-amber-800 border border-amber-500/30 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Layers className="w-4 h-4" />
                  <span>+ Category</span>
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-white text-amber-900 hover:bg-amber-50 text-xs font-bold transition flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                >
                  <Plus className="w-4 h-4 text-amber-700" />
                  <span>New Product</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Catalog Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-amber-500/30">
          <div className="bg-amber-900/30 backdrop-blur-sm rounded-2xl p-3.5 border border-amber-500/20">
            <div className="text-amber-200/70 text-xs font-semibold flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Total Items
            </div>
            <div className="text-xl sm:text-2xl font-black mt-1 text-white">{totalItems}</div>
          </div>
          <div className="bg-amber-900/30 backdrop-blur-sm rounded-2xl p-3.5 border border-amber-500/20">
            <div className="text-amber-200/70 text-xs font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" /> In Shelf Stock
            </div>
            <div className="text-xl sm:text-2xl font-black mt-1 text-emerald-300">{inStockItems}</div>
          </div>
          <div className="bg-amber-900/30 backdrop-blur-sm rounded-2xl p-3.5 border border-amber-500/20">
            <div className="text-amber-200/70 text-xs font-semibold flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" /> Avg Price
            </div>
            <div className="text-xl sm:text-2xl font-black mt-1 text-white">{avgPrice.toFixed(2)} ETB</div>
          </div>
          <div className="bg-amber-900/30 backdrop-blur-sm rounded-2xl p-3.5 border border-amber-500/20">
            <div className="text-amber-200/70 text-xs font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Categories
            </div>
            <div className="text-xl sm:text-2xl font-black mt-1 text-white">{categories.length}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Category Pills & View Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            <option value="ALL">All Stock Levels</option>
            <option value="IN_STOCK">In Stock (&gt; 0)</option>
            <option value="LOW_STOCK">Low Shelf Stock (&le; 15)</option>
          </select>

          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'GRID' ? 'bg-white shadow-sm text-amber-900' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'TABLE' ? 'bg-white shadow-sm text-amber-900' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Products Display */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-2/3" />
              <div className="h-6 bg-slate-100 rounded w-1/3" />
              <div className="h-10 bg-slate-50 rounded" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700 mb-4">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No products match your search</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting the filter criteria or add a new bread item.</p>
          {canManageProducts && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 transition shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )}
        </div>
      ) : viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((p) => {
            const isLowStock = p.availableStock <= 15;
            const isOutOfStock = p.availableStock === 0;

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-amber-300 shadow-sm hover:shadow-md transition flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-600 font-mono">
                      {p.sku}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                        isOutOfStock
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : isLowStock
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                      {p.availableStock} {p.unit.toLowerCase()}s
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-amber-800 transition">
                    {p.name}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-400" />
                    <span>{p.category?.name || 'Fresh Bread'}</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Retail Price</div>
                    <div className="text-lg font-black text-amber-900">{p.sellingPrice.toFixed(2)} ETB</div>
                  </div>

                  {canManageProducts && (
                    <button
                      onClick={() => setEditingProduct(p)}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-600 hover:text-amber-800 transition"
                      title="Edit Price & Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Selling Price</th>
                  {canManageProducts && <th className="py-3.5 px-4">Cost Price</th>}
                  <th className="py-3.5 px-4">Shelf Stock ({activeBranch?.code || 'Local'})</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/40 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{p.name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{p.sku}</td>
                    <td className="py-3.5 px-4 text-slate-600">{p.category?.name || 'Fresh Bread'}</td>
                    <td className="py-3.5 px-4 font-bold text-amber-900">{p.sellingPrice.toFixed(2)} ETB</td>
                    {canManageProducts && (
                      <td className="py-3.5 px-4 text-slate-500">
                        {p.costPrice ? `${p.costPrice.toFixed(2)} ETB` : '—'}
                      </td>
                    )}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          p.availableStock === 0
                            ? 'bg-red-100 text-red-700'
                            : p.availableStock <= 15
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {p.availableStock} {p.unit.toLowerCase()}s
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {canManageProducts && (
                        <button
                          onClick={() => setEditingProduct(p)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 font-bold text-xs transition inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add New Product */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <ShoppingBag className="w-5 h-5" />
                <span>Add Product to Catalog</span>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1 text-slate-600">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard 50g Loaf, French Baguette"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">SKU Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BREAD-50G"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-mono text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-600">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Selling Price (ETB)</label>
                  <input
                    type="number"
                    step="0.25"
                    required
                    placeholder="15.00"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-600">Cost Price (ETB - Optional)</label>
                  <input
                    type="number"
                    step="0.25"
                    placeholder="9.50"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Unit Type</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm bg-white"
                  >
                    <option value="PIECE">PIECE</option>
                    <option value="PACK">PACK</option>
                    <option value="KG">KG</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-slate-600">Initial Shelf Stock</label>
                  <input
                    type="number"
                    value={formData.initialStock}
                    onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold transition flex items-center gap-1.5 shadow-md"
                >
                  {submitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Product Price & Details */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <Edit2 className="w-4 h-4" />
                <span>Edit Product Details</span>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1 text-slate-600">Product Name</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Selling Price (ETB)</label>
                  <input
                    type="number"
                    step="0.25"
                    required
                    value={editingProduct.sellingPrice}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, sellingPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-600">Cost Price (ETB)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={editingProduct.costPrice || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        costPrice: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <label className="text-slate-600">Product Status</label>
                <button
                  type="button"
                  onClick={() => setEditingProduct({ ...editingProduct, isActive: !editingProduct.isActive })}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                    editingProduct.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {editingProduct.isActive ? 'Active in POS' : 'Disabled'}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold transition flex items-center gap-1.5 shadow-md"
                >
                  {submitting ? 'Saving...' : 'Update Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Category */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <Layers className="w-4 h-4" />
                <span>New Category</span>
              </div>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1 text-slate-600">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pastries, Specialty Breads"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-600">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Brief note about this category"
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold transition shadow-md"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
