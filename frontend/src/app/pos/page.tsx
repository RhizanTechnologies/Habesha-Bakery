'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  ShoppingCart,
  Plus,
  Minus,
  Search,
  Check,
  AlertCircle,
  X,
  Banknote,
  Smartphone,
  Building,
  History,
  RotateCcw,
  Sparkles,
  Store,
  Layers,
  ArrowRight,
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

interface SaleRecord {
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

  // Modals & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [saleSuccessMsg, setSaleSuccessMsg] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [todaySales, setTodaySales] = useState<SaleRecord[]>([]);
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

  // Handle Checkout (Direct counter checkout, NO receipt printing)
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

    const res = await apiRequest<SaleRecord>('/pos/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const saleAmt = res.data.totalAmount;
      const changeText = paymentMethod === 'CASH' && tenderedNum > saleAmt
        ? ` • Change: ${(tenderedNum - saleAmt).toFixed(2)} ETB`
        : '';

      setSaleSuccessMsg(`✓ Order completed: ${saleAmt.toFixed(2)} ETB (${paymentMethod})${changeText}`);
      clearCart();
      fetchProducts();
      fetchTodayOrders();
      setTimeout(() => setSaleSuccessMsg(null), 5000);
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
      {/* ── Top POS Status Bar ── */}
      <div className="bg-[#FFFDF8] rounded-3xl p-4 border border-[#EDE4D5] shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#4A2E1B] text-white flex items-center justify-center shadow-xs">
            <Store className="w-5 h-5 text-[#E87A18]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-[#2C1B10] leading-tight font-heading">
                Counter Touchscreen POS
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#F4ECE1] text-[#4A2E1B] border border-[#EDE4D5]">
                {activeBranch?.code || 'ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-[#8C7361] mt-0.5">
              Branch: <span className="font-bold text-[#2C1B10]">{activeBranch?.name || 'Local Store'}</span> &bull; Cashier:{' '}
              <span className="font-bold text-[#2C1B10]">{user?.fullName || 'Cashier'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {todaySummary && (
            <div className="hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-[#FAF7EE] border border-[#EDE4D5] text-xs">
              <div>
                <span className="text-[#8C7361] font-medium">Shift Sales:</span>{' '}
                <span className="font-extrabold text-[#2C1B10]">{todaySummary.totalOrders} tickets</span>
              </div>
              <div className="w-px h-4 bg-[#EDE4D5]" />
              <div>
                <span className="text-[#8C7361] font-medium">Gross:</span>{' '}
                <span className="font-black text-[#E87A18] font-mono">{todaySummary.totalGross.toFixed(2)} ETB</span>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              fetchTodayOrders();
              setShowHistoryModal(true);
            }}
            className="px-3.5 py-2 rounded-2xl bg-[#FAF7EE] hover:bg-[#F4ECE1] text-[#4A2E1B] text-xs font-bold transition flex items-center gap-1.5 border border-[#EDE4D5]"
          >
            <History className="w-4 h-4 text-[#8C7361]" />
            <span>Shift Orders</span>
          </button>
        </div>
      </div>

      {/* ── Main Grid: Left Catalog / Right Ticket ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Product Catalog Touch Tiles (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Search & Category Pills */}
          <div className="bg-[#FFFDF8] rounded-3xl p-3.5 border border-[#EDE4D5] shadow-2xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C7361]" />
              <input
                type="text"
                placeholder="Search bread by name or tap items below..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2 text-xs rounded-2xl border border-[#EDE4D5] bg-[#FAF7EE]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E87A18] text-[#2C1B10]"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#4A2E1B] text-white shadow-2xs'
                    : 'bg-[#FAF7EE] text-[#8C7361] hover:bg-[#F4ECE1] border border-[#EDE4D5]'
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
                      ? 'bg-[#4A2E1B] text-white shadow-2xs'
                      : 'bg-[#FAF7EE] text-[#8C7361] hover:bg-[#F4ECE1] border border-[#EDE4D5]'
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
                <div key={i} className="bg-[#FFFDF8] rounded-3xl p-4 border border-[#EDE4D5] h-28 animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-[#FFFDF8] rounded-3xl p-8 text-center border border-[#EDE4D5] text-[#8C7361] text-xs">
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
                    className={`bg-[#FFFDF8] rounded-3xl p-4 border text-left transition flex flex-col justify-between relative group active:scale-95 shadow-2xs hover:shadow-md h-32 ${
                      inCart
                        ? 'border-[#E87A18] ring-2 ring-[#E87A18]/20 bg-[#FAF7EE]/60'
                        : 'border-[#EDE4D5] hover:border-[#E87A18]'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#E87A18] text-white text-[11px] font-black flex items-center justify-center shadow-md">
                        {inCart.quantity}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between gap-1 text-[10px] text-[#8C7361] font-mono">
                        <span>{p.sku}</span>
                        <span
                          className={`font-semibold ${
                            isOutOfStock ? 'text-red-600' : p.availableStock <= 15 ? 'text-[#E87A18]' : 'text-emerald-700'
                          }`}
                        >
                          {p.availableStock} in shelf
                        </span>
                      </div>
                      <div className="font-extrabold text-[#2C1B10] text-sm mt-1 leading-snug line-clamp-2 font-heading">
                        {p.name}
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between pt-2 border-t border-[#EDE4D5]">
                      <span className="text-[10px] uppercase font-bold text-[#8C7361]">{p.unit}</span>
                      <span className="text-base font-black text-[#4A2E1B] font-mono">{p.sellingPrice.toFixed(2)} ETB</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Live Cashier Ticket & Payment Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#FFFDF8] rounded-3xl border border-[#EDE4D5] shadow-sm p-5 flex flex-col justify-between space-y-4">
            {/* Ticket Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE4D5]">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#E87A18]" />
                <span className="font-extrabold text-[#2C1B10] text-sm font-heading">Active Order Ticket</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#F4ECE1] text-[#4A2E1B] border border-[#EDE4D5]">
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

            {/* Instant Sale Completion Banner (Fast counter feedback, NO receipt popup) */}
            {saleSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-2xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saleSuccessMsg}</span>
                </div>
                <button onClick={() => setSaleSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Ticket Items List */}
            <div className="min-h-[160px] max-h-[260px] overflow-y-auto space-y-2 pr-1 divide-y divide-[#EDE4D5] custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center text-[#8C7361] text-xs">
                  <ShoppingCart className="w-8 h-8 text-[#EDE4D5] mb-2 stroke-[1.5]" />
                  <span className="font-bold text-[#2C1B10]">Cart is empty</span>
                  <span className="text-[11px] text-[#8C7361] mt-0.5">Tap bread items on the left to add</span>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-[#2C1B10] text-xs truncate">{item.product.name}</div>
                      <div className="text-[10px] text-[#8C7361] font-mono">
                        {item.quantity} &times; {item.unitPrice.toFixed(2)} ETB
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-6 h-6 rounded-lg bg-[#FAF7EE] hover:bg-[#F4ECE1] text-[#4A2E1B] font-bold flex items-center justify-center transition border border-[#EDE4D5]"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-black text-xs text-[#2C1B10] font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-6 h-6 rounded-lg bg-[#FAF7EE] hover:bg-[#F4ECE1] text-[#4A2E1B] font-bold flex items-center justify-center transition border border-[#EDE4D5]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right min-w-[65px]">
                      <div className="font-black text-xs text-[#2C1B10] font-mono">
                        {(item.quantity * item.unitPrice).toFixed(2)} ETB
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-[10px] text-red-500 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Display */}
            <div className="bg-[#FAF7EE] rounded-2xl p-4 border border-[#EDE4D5] space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase font-extrabold text-[#8C7361] tracking-wider">Order Total</span>
                <span className="text-2xl font-black text-[#4A2E1B] font-mono">{cartSubtotal.toFixed(2)} ETB</span>
              </div>
            </div>

            {/* Multi-Tender Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold text-[#8C7361] uppercase tracking-wider block">
                Payment Tender
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 px-2.5 rounded-2xl border flex flex-col items-center gap-1 transition ${
                    paymentMethod === 'CASH'
                      ? 'bg-[#4A2E1B] text-white border-[#4A2E1B] shadow-2xs'
                      : 'bg-[#FAF7EE] text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#F4ECE1]'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('TELEBIRR')}
                  className={`py-2 px-2.5 rounded-2xl border flex flex-col items-center gap-1 transition ${
                    paymentMethod === 'TELEBIRR'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-[#FAF7EE] text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#F4ECE1]'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Telebirr</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CBE')}
                  className={`py-2 px-2.5 rounded-2xl border flex flex-col items-center gap-1 transition ${
                    paymentMethod === 'CBE'
                      ? 'bg-purple-700 text-white border-purple-700 shadow-2xs'
                      : 'bg-[#FAF7EE] text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#F4ECE1]'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  <span>CBE Bank</span>
                </button>
              </div>
            </div>

            {/* Cash Tender Calculation (When Cash selected) */}
            {paymentMethod === 'CASH' && (
              <div className="bg-[#FAF7EE] rounded-2xl p-3.5 border border-[#EDE4D5] space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-[#2C1B10]">Cash Received (ETB)</label>
                  <button
                    type="button"
                    onClick={setExactCash}
                    className="text-[10px] font-bold text-[#E87A18] hover:text-[#D96B10] underline"
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
                    className="flex-1 px-3.5 py-2 rounded-xl border border-[#EDE4D5] bg-white font-bold text-sm text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#E87A18] font-mono"
                  />
                  <div className="flex items-center gap-1">
                    {[100, 200, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => addCashAmount(amt)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#F4ECE1] hover:bg-[#EDE4D5] text-[#4A2E1B] font-bold text-[10px] transition border border-[#EDE4D5]"
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {tenderedNum >= cartSubtotal && cartSubtotal > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-[#EDE4D5] font-bold">
                    <span className="text-[#8C7361]">Change Due:</span>
                    <span className="text-sm font-black text-emerald-700 font-mono">{changeDue.toFixed(2)} ETB</span>
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
                className="px-3 py-1.5 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE]/40 text-xs focus:outline-none focus:ring-2 focus:ring-[#E87A18] text-[#2C1B10]"
              />
              <input
                type="text"
                placeholder="Phone (Optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE]/40 text-xs focus:outline-none focus:ring-2 focus:ring-[#E87A18] text-[#2C1B10] font-mono"
              />
            </div>

            {/* Complete Sale Button */}
            <button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={handleCheckout}
              className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-md active:scale-95 ${
                cart.length === 0 || submitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-[#4A2E1B] hover:bg-[#3A2314] text-white'
              }`}
            >
              {submitting ? (
                <span>Recording Sale...</span>
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[2.5] text-[#E87A18]" />
                  <span>COMPLETE SALE &bull; {cartSubtotal.toFixed(2)} ETB</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal: Today Shift Orders History (No receipt printing) ── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-[#2C1B10]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF8] rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-[#EDE4D5] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE4D5]">
              <div className="flex items-center gap-2 text-[#2C1B10] font-extrabold text-sm font-heading">
                <History className="w-5 h-5 text-[#E87A18]" />
                <span>Today Shift Orders Feed</span>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-[#8C7361] hover:text-[#2C1B10] p-1.5 rounded-xl hover:bg-[#FAF7EE]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {todaySummary && (
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-[#FAF7EE] p-2.5 rounded-2xl border border-[#EDE4D5]">
                  <div className="text-[#8C7361] text-[10px] font-bold">TOTAL ORDERS</div>
                  <div className="font-black text-[#2C1B10] text-sm mt-0.5">{todaySummary.totalOrders}</div>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-2xl border border-emerald-200">
                  <div className="text-emerald-800 text-[10px] font-bold">CASH SALES</div>
                  <div className="font-black text-emerald-900 text-sm mt-0.5 font-mono">
                    {todaySummary.totalCash.toFixed(2)}
                  </div>
                </div>
                <div className="bg-blue-50 p-2.5 rounded-2xl border border-blue-200">
                  <div className="text-blue-800 text-[10px] font-bold">TELEBIRR</div>
                  <div className="font-black text-blue-900 text-sm mt-0.5 font-mono">
                    {todaySummary.totalTelebirr.toFixed(2)}
                  </div>
                </div>
                <div className="bg-amber-50 p-2.5 rounded-2xl border border-amber-200">
                  <div className="text-[#E87A18] text-[10px] font-bold">GROSS ETB</div>
                  <div className="font-black text-[#4A2E1B] text-sm mt-0.5 font-mono">
                    {todaySummary.totalGross.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto divide-y divide-[#EDE4D5] border border-[#EDE4D5] rounded-2xl custom-scrollbar">
              {todaySales.length === 0 ? (
                <div className="p-8 text-center text-[#8C7361] text-xs">No orders recorded today yet.</div>
              ) : (
                todaySales.map((sale) => (
                  <div key={sale.id} className="p-3.5 hover:bg-[#FAF7EE] transition flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold text-[#2C1B10]">{sale.receiptNumber}</div>
                      <div className="text-[10px] text-[#8C7361] mt-0.5">
                        {new Date(sale.createdAt).toLocaleTimeString()} &bull; Cashier: {sale.cashier.fullName}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F4ECE1] text-[#4A2E1B] border border-[#EDE4D5]">
                        {sale.paymentMethod}
                      </span>
                      <span className="font-black text-[#2C1B10] text-sm font-mono">
                        {sale.totalAmount.toFixed(2)} ETB
                      </span>
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
