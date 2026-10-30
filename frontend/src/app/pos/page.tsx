'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  Receipt,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Search,
  Check,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  Printer,
  History,
  RotateCcw,
  Sparkles,
  UserCheck,
  Calendar,
  Layers,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  availableStock: number;
  unit: string;
  isActive: boolean;
  categoryId: string;
  category?: { id: string; name: string };
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

interface SaleReceipt {
  id: string;
  receiptNumber: string;
  totalAmount: number;
  paymentMethod: string;
  customerName?: string | null;
  customerPhone?: string | null;
  createdAt: string;
  businessDate: string;
  branch: { name: string; code: string; address?: string };
  cashier: { fullName: string; phone?: string };
  items: Array<{
    id: string;
    product: { name: string; sku: string; unit: string };
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

export default function PosPage() {
  const { user, activeBranch } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TELEBIRR' | 'CBE' | 'MOBILE_BANKING' | 'CREDIT'>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Modals & History
  const [submitting, setSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<SaleReceipt | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [todaySummary, setTodaySummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch product catalog for active branch
  const fetchProducts = async () => {
    setLoading(true);
    const branchParam = activeBranch?.id ? `?branchId=${activeBranch.id}` : '';
    const res = await apiRequest<Product[]>(`/products${branchParam}`);
    if (res.data) {
      setProducts(res.data.filter((p) => p.isActive));
    }
    setLoading(false);
  };

  const fetchTodayOrders = async () => {
    const branchParam = activeBranch?.id ? `?branchId=${activeBranch.id}` : '';
    const res = await apiRequest<any>(`/pos/orders/today${branchParam}`);
    if (res.data) {
      setTodaySales(res.data.orders || []);
      setTodaySummary(res.data.summary || null);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchTodayOrders();
  }, [activeBranch?.id]);

  // Unique categories from products
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p.category) map.set(p.category.id, p.category.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  // Cart operations
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: product.sellingPrice }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCashTendered('');
    setCustomerName('');
    setCustomerPhone('');
  };

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const tenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedNum - cartSubtotal);

  // Quick tender buttons
  const setExactCash = () => setCashTendered(cartSubtotal.toString());
  const addCashAmount = (amount: number) => setCashTendered(amount.toString());

  // Handle Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setError(null);
    setSubmitting(true);

    const payload = {
      branchId: activeBranch?.id,
      paymentMethod,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      items: cart.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    };

    const res = await apiRequest<SaleReceipt>('/pos/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setLastReceipt(res.data);
      clearCart();
      fetchProducts(); // Refresh shelf stock
      fetchTodayOrders();
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto pb-10 space-y-4">
      {/* Top POS Status Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 leading-tight">Counter Touchscreen POS</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {activeBranch?.code || 'ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Branch: <span className="font-semibold text-slate-800">{activeBranch?.name || 'Local Store'}</span> &bull; Cashier:{' '}
              <span className="font-semibold text-slate-800">{user?.fullName || 'Cashier'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {todaySummary && (
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Shift Sales:</span>{' '}
                <span className="font-black text-slate-800">{todaySummary.totalOrders} tickets</span>
              </div>
              <div className="w-px h-4 bg-slate-200" />
              <div>
                <span className="text-slate-400 font-medium">Gross:</span>{' '}
                <span className="font-black text-amber-900">{todaySummary.totalGross.toFixed(2)} ETB</span>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              fetchTodayOrders();
              setShowHistoryModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Shift Orders</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Catalog / Right Ticket */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Product Catalog Touch Tiles (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Search & Category Pills */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search bread by name or tap items below..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === 'ALL'
                    ? 'bg-amber-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Products ({products.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedCategory === c.id
                      ? 'bg-amber-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Tiles Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200 h-28 animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 text-xs">
              No products found in this category.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((p) => {
                const inCart = cart.find((i) => i.product.id === p.id);
                const isOutOfStock = p.availableStock <= 0;

                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`bg-white rounded-2xl p-4 border text-left transition flex flex-col justify-between relative group active:scale-95 shadow-sm hover:shadow-md h-32 ${
                      inCart
                        ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20'
                        : 'border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-600 text-white text-[11px] font-black flex items-center justify-center shadow-md animate-scale-up">
                        {inCart.quantity}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-mono">
                        <span>{p.sku}</span>
                        <span
                          className={`font-semibold ${
                            isOutOfStock ? 'text-red-500' : p.availableStock <= 15 ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                        >
                          {p.availableStock} in shelf
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm mt-1 leading-snug line-clamp-2">
                        {p.name}
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400">{p.unit}</span>
                      <span className="text-base font-black text-amber-900">{p.sellingPrice.toFixed(2)} ETB</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Live Cashier Ticket & Payment Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-5 flex flex-col justify-between space-y-4">
            {/* Ticket Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-amber-700" />
                <span className="font-bold text-slate-900 text-sm">Active Order Ticket</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  {cartItemCount} items
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[11px] font-bold text-red-600 hover:text-red-700 transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Ticket Items List */}
            <div className="min-h-[160px] max-h-[260px] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
              {cart.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                  <ShoppingCart className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
                  <span>Cart is empty</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">Tap products on the left to add items</span>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-xs truncate">{item.product.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.quantity} &times; {item.unitPrice.toFixed(2)} ETB
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-black text-xs text-slate-900">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right min-w-[60px]">
                      <div className="font-black text-xs text-slate-900">
                        {(item.quantity * item.unitPrice).toFixed(2)}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-[10px] text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Display */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase font-bold text-slate-500">Order Total</span>
                <span className="text-2xl font-black text-amber-950">{cartSubtotal.toFixed(2)} ETB</span>
              </div>
            </div>

            {/* Multi-Tender Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 px-2.5 rounded-xl border flex flex-col items-center gap-1 transition ${
                    paymentMethod === 'CASH'
                      ? 'bg-amber-800 text-white border-amber-800 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('TELEBIRR')}
                  className={`py-2 px-2.5 rounded-xl border flex flex-col items-center gap-1 transition ${
                    paymentMethod === 'TELEBIRR'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Telebirr</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CBE')}
                  className={`py-2 px-2.5 rounded-xl border flex flex-col items-center gap-1 transition ${
                    paymentMethod === 'CBE'
                      ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  <span>CBE Bank</span>
                </button>
              </div>
            </div>

            {/* Cash Tender Calculation (When Cash selected) */}
            {paymentMethod === 'CASH' && (
              <div className="bg-amber-50/60 rounded-2xl p-3.5 border border-amber-200/70 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-amber-900">Cash Received (ETB)</label>
                  <button
                    type="button"
                    onClick={setExactCash}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline"
                  >
                    Exact Amount
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1"
                    placeholder="Enter cash given by customer"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-amber-300 bg-white font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <div className="flex items-center gap-1">
                    {[100, 200, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => addCashAmount(amt)}
                        className="px-2 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] transition"
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {tenderedNum >= cartSubtotal && cartSubtotal > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-amber-200 font-bold">
                    <span className="text-amber-800">Change Due:</span>
                    <span className="text-sm font-black text-emerald-700">{changeDue.toFixed(2)} ETB</span>
                  </div>
                )}
              </div>
            )}

            {/* Customer Details (Optional) */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                placeholder="Customer Name (Optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <input
                type="text"
                placeholder="Phone (Optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-mono"
              />
            </div>

            {/* Complete Sale Button */}
            <button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={handleCheckout}
              className={`w-full py-3.5 rounded-2xl font-black text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-lg active:scale-95 ${
                cart.length === 0 || submitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
              }`}
            >
              {submitting ? (
                <span>Processing Sale...</span>
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  <span>COMPLETE SALE &bull; {cartSubtotal.toFixed(2)} ETB</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Printable Thermal Receipt */}
      {lastReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Sale Completed
              </span>
              <button
                onClick={() => setLastReceipt(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thermal Receipt Paper Layout */}
            <div id="thermal-receipt" className="bg-slate-50 rounded-2xl p-4 border border-slate-200 font-mono text-xs space-y-3 text-slate-800">
              <div className="text-center space-y-0.5">
                <h2 className="font-black text-sm tracking-tight uppercase">HABESHA BAKERY</h2>
                <div className="text-[11px] text-slate-500">{lastReceipt.branch.name}</div>
                <div className="text-[10px] text-slate-400">{lastReceipt.branch.address || 'Addis Ababa, Ethiopia'}</div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-1.5 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>RECEIPT:</span>
                  <span className="font-bold">{lastReceipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span>{new Date(lastReceipt.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>CASHIER:</span>
                  <span>{lastReceipt.cashier.fullName}</span>
                </div>
                {lastReceipt.customerName && (
                  <div className="flex justify-between">
                    <span>CUSTOMER:</span>
                    <span>{lastReceipt.customerName}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-1 text-[11px]">
                {lastReceipt.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span className="truncate max-w-[170px]">
                      {item.quantity}x {item.product.name}
                    </span>
                    <span className="font-bold">{item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Total & Payment Method */}
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                <div className="flex justify-between text-sm font-black">
                  <span>TOTAL ETB:</span>
                  <span>{lastReceipt.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>PAYMENT METHOD:</span>
                  <span className="font-bold uppercase text-slate-700">{lastReceipt.paymentMethod}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-200">
                Thank you for choosing Habesha Bakery!
              </div>
            </div>

            {/* Receipt Modal Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-xs text-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setLastReceipt(null)}
                className="flex-1 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 font-bold text-xs text-white transition shadow-sm"
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Today Shift Orders History */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <History className="w-5 h-5 text-amber-700" />
                <span>Today Shift Orders Feed</span>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {todaySummary && (
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="text-slate-400 text-[10px] font-bold">TOTAL ORDERS</div>
                  <div className="font-black text-slate-900 text-sm mt-0.5">{todaySummary.totalOrders}</div>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                  <div className="text-emerald-700 text-[10px] font-bold">CASH SALES</div>
                  <div className="font-black text-emerald-900 text-sm mt-0.5">
                    {todaySummary.totalCash.toFixed(2)}
                  </div>
                </div>
                <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                  <div className="text-blue-700 text-[10px] font-bold">TELEBIRR</div>
                  <div className="font-black text-blue-900 text-sm mt-0.5">
                    {todaySummary.totalTelebirr.toFixed(2)}
                  </div>
                </div>
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                  <div className="text-amber-800 text-[10px] font-bold">GROSS ETB</div>
                  <div className="font-black text-amber-950 text-sm mt-0.5">
                    {todaySummary.totalGross.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
              {todaySales.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No orders recorded today yet.</div>
              ) : (
                todaySales.map((sale) => (
                  <div key={sale.id} className="p-3.5 hover:bg-slate-50/80 transition flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold text-slate-900">{sale.receiptNumber}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(sale.createdAt).toLocaleTimeString()} &bull; Cashier: {sale.cashier.fullName}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {sale.paymentMethod}
                      </span>
                      <span className="font-black text-slate-900 text-sm">
                        {sale.totalAmount.toFixed(2)} ETB
                      </span>
                      <button
                        onClick={() => {
                          setLastReceipt(sale);
                          setShowHistoryModal(false);
                        }}
                        className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold text-[10px] hover:bg-amber-100 transition"
                      >
                        Receipt
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
