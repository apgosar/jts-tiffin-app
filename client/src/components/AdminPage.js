import React, { useState, useEffect, useCallback } from 'react';
import JtsLogo from './JtsLogo';
import { getAdminOrders, updateAdminMenu, getKitchenSummary } from '../services/api';

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, authError }) {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const displayError = localError || authError || '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) { setLocalError('Please enter the admin password.'); return; }
    setLocalError('');
    onLogin(password.trim());
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="text-center mb-6">
          <JtsLogo className="w-16 h-16 mx-auto mb-3" />
          <h1 className="font-bold text-gray-900 text-lg" style={{ fontFamily: "'Oswald', sans-serif" }}>
            Admin Panel
          </h1>
          <p className="text-gray-500 text-sm mt-1">Enter the admin password to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setLocalError(''); }}
            placeholder="Admin password"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition"
          />
          {displayError && <p className="text-xs text-red-600 -mt-2">{displayError}</p>}
          <button type="submit" className="w-full py-3 bg-jts-red hover:bg-jts-crimson text-white font-bold rounded-xl transition">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-xs font-bold transition rounded-lg
        ${active ? 'bg-jts-red text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {children}
    </button>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-gray-800' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────
function OrderModal({ order, onClose }) {
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-gray-500">Order ID</p>
              <p className="font-black text-jts-red text-lg tracking-widest">{order.orderId}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-500">✕</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`text-xs px-2 py-1 rounded-full font-semibold
              ${order.zone === 'outside' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
              {order.zone === 'outside' ? '🚚 Outside Borivali' : '📍 Borivali'}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{order.date} {order.time}</span>
          </div>
          <div className="space-y-3">
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Customer</h3>
              <p className="text-sm font-semibold text-gray-800">{order.name}</p>
              <p className="text-sm text-gray-600">{order.phone}</p>
            </section>
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Delivery Address</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{order.address}</p>
            </section>
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</h3>
              <div className="space-y-1.5">
                {order.items.map((item, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-sm flex justify-between gap-3">
                    <span className="text-gray-700">{item.name} <span className="text-gray-400">×{item.quantity}</span></span>
                    <span className="font-semibold">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                {order.surchargeTotal > 0 && (
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm flex justify-between gap-3">
                    <span className="text-amber-700">Outside Borivali surcharge</span>
                    <span className="font-semibold text-amber-700">₹{order.surchargeTotal}</span>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="text-jts-red">₹{order.grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: Tomorrow's Menu ────────────────────────────────────────────────────
const TIFFIN_DEFAULTS = [
  { name: 'Mini Lunch',   description: '3 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 140, available: true, category: 'Lunch' },
  { name: 'Brunch',       description: '6 Roti, Sabji, 1/2 Dal, 1/2 Rice, Salad / Sweet / Namkeen / Farsan', price: 180, available: true, category: 'Lunch' },
  { name: 'Full Lunch',   description: '6 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 220, available: true, category: 'Lunch' },
  { name: 'Family Meal',  description: '9 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 320, available: true, category: 'Lunch' },
  { name: 'Choviar Special', description: 'Ragdo, 4 Kelawada, Dal Khichdi', price: 160, available: true, category: 'Choviar' },
];

function MenuTab({ password, currentMenu, currentMetadata }) {
  const [items, setItems]       = useState(currentMenu.length > 0 ? currentMenu : TIFFIN_DEFAULTS);
  const [metadata, setMetadata] = useState(currentMetadata || { sabji: '', sweet: '', dal: '', farsan: '' });
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');

  useEffect(() => {
    if (currentMenu.length > 0) setItems(currentMenu);
    if (currentMetadata && Object.keys(currentMetadata).length > 0) setMetadata(currentMetadata);
  }, [currentMenu, currentMetadata]);

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const updateMeta = (field, value) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  };

  const addItem = () => {
    setItems(prev => [...prev, { name: '', description: '', price: 0, available: true, category: 'Choviar' }]);
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      await updateAdminMenu({ items, metadata }, password);
      setMsg('✅ Menu saved successfully! Customers will see the updated menu immediately.');
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Failed to save menu.'));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowLabel = tomorrow.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-jts-gold/20 border border-jts-gold rounded-xl px-4 py-2.5 text-sm text-jts-navy font-semibold text-center flex justify-between items-center">
        <span>📅 Setting menu for: <span className="font-bold">{tomorrowLabel}</span></span>
        <button onClick={addItem} className="bg-jts-red text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-jts-crimson shadow-sm transition">
          + Add Item
        </button>
      </div>

      {/* Metadata Section */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-3 border-b pb-2">Daily Lunch Details</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Sabji</label>
            <input type="text" value={metadata.sabji || ''} onChange={e => updateMeta('sabji', e.target.value)} placeholder="e.g. Bhindi" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Sweet</label>
            <input type="text" value={metadata.sweet || ''} onChange={e => updateMeta('sweet', e.target.value)} placeholder="e.g. Aamras" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Dal</label>
            <input type="text" value={metadata.dal || ''} onChange={e => updateMeta('dal', e.target.value)} placeholder="e.g. Gujarati Dal" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Farsan / Namkeen</label>
            <input type="text" value={metadata.farsan || ''} onChange={e => updateMeta('farsan', e.target.value)} placeholder="e.g. Dhokla" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
        </div>
      </div>

      {items.map((item, idx) => (
        <div key={idx} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-3 relative shadow-sm">
          <button onClick={() => removeItem(idx)} className="absolute -top-2 -right-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold transition">✕</button>
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <input 
              type="text" 
              value={item.name} 
              onChange={e => updateItem(idx, 'name', e.target.value)}
              placeholder="Item Name"
              className="font-bold text-sm uppercase tracking-wide border-b-2 border-jts-red focus:outline-none focus:border-jts-crimson bg-transparent w-40"
              style={{ fontFamily: "'Oswald', sans-serif" }}
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-medium text-gray-600">Available</span>
              <div
                onClick={() => updateItem(idx, 'available', !item.available)}
                className={`w-10 h-6 rounded-full flex items-center transition-colors ${item.available ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${item.available ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </label>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
            <textarea
              value={item.description}
              onChange={e => updateItem(idx, 'description', e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-jts-red resize-none transition"
            />
          </div>

          {/* Price & Category */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Price (₹)</label>
              <input
                type="number"
                min="0"
                value={item.price}
                onChange={e => updateItem(idx, 'price', parseFloat(e.target.value) || 0)}
                className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-jts-red transition"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs font-medium text-gray-500">Category</label>
              <select
                value={item.category || 'Lunch'}
                onChange={e => updateItem(idx, 'category', e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-jts-red transition bg-white"
              >
                <option value="Lunch">Lunch</option>
                <option value="Choviar">Choviar</option>
              </select>
            </div>
          </div>
        </div>
      ))}

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3.5 rounded-xl font-bold text-white text-sm transition
          ${saving ? 'bg-red-300 cursor-not-allowed' : 'bg-jts-red hover:bg-jts-crimson shadow-md'}`}
      >
        {saving ? 'Saving…' : '💾 Save Menu'}
      </button>
    </div>
  );
}

// ─── Tab 2: Orders ─────────────────────────────────────────────────────────────
function OrdersTab({ password }) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [filterMonth, setFilterMonth] = useState(defaultMonth);
  const [filterDate, setFilterDate]   = useState('');
  const [modalOrder, setModalOrder]   = useState(null);

  const convertMonth = (m) => { if (!m) return undefined; const [y, mo] = m.split('-'); return `${mo}/${y}`; };
  const convertDate  = (d) => { if (!d) return undefined; const [y, mo, dd] = d.split('-'); return `${dd}/${mo}/${y}`; };

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (filterDate) params.date = convertDate(filterDate);
      else if (filterMonth) params.month = convertMonth(filterMonth);
      const res = await getAdminOrders(params, password);
      setOrders(res.data.orders || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch orders.');
    } finally {
      setLoading(false);
    }
  }, [password, filterMonth, filterDate]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Analytics
  const totalRevenue     = orders.reduce((s, o) => s + o.grandTotal, 0);
  const totalTiffins     = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);
  const outsideCount     = orders.filter(o => o.zone === 'outside').length;

  // Per-item breakdown
  const itemCounts = {};
  orders.forEach(o => o.items.forEach(i => {
    itemCounts[i.name] = (itemCounts[i.name] || 0) + i.quantity;
  }));

  return (
    <div className="flex flex-col gap-4">
      {modalOrder && <OrderModal order={modalOrder} onClose={() => setModalOrder(null)} />}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Orders" value={orders.length} />
        <StatCard label="Total Tiffins" value={totalTiffins} color="text-jts-red" />
        <StatCard label="Revenue" value={`₹${(totalRevenue/1000).toFixed(1)}k`} color="text-jts-red" sub={`₹${totalRevenue.toLocaleString('en-IN')}`} />
      </div>

      {/* Item breakdown */}
      {Object.keys(itemCounts).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tiffin Breakdown</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(itemCounts).map(([name, qty]) => (
              <div key={name} className="flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-1">
                <span className="text-xs font-semibold text-gray-700">{name}</span>
                <span className="text-xs font-black text-jts-red">×{qty}</span>
              </div>
            ))}
            {outsideCount > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-3 py-1">
                <span className="text-xs font-semibold text-amber-700">🚚 Outside Borivali</span>
                <span className="text-xs font-black text-amber-700">{outsideCount} orders</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-600 block mb-1">Filter by Month</label>
          <input
            type="month" value={filterMonth}
            onChange={e => { setFilterMonth(e.target.value); setFilterDate(''); }}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-600 block mb-1">Filter by Date</label>
          <input
            type="date" value={filterDate}
            onChange={e => { setFilterDate(e.target.value); setFilterMonth(''); }}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={fetchOrders}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => { setFilterDate(''); setFilterMonth(defaultMonth); }}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

      {/* Orders list */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-red-200 border-t-jts-red rounded-full animate-spin" />
        </div>
      )}

      {!loading && orders.length === 0 && !error && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="font-medium">No orders found</p>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="flex flex-col gap-2">
          {orders.map(order => (
            <div
              key={order.orderId}
              onClick={() => setModalOrder(order)}
              className="bg-white rounded-xl border border-gray-100 p-3 cursor-pointer hover:border-red-200 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-jts-red text-xs tracking-widest">{order.orderId}</span>
                <div className="flex items-center gap-1.5">
                  {order.zone === 'outside' && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Outside</span>
                  )}
                  <span className="text-xs text-gray-400">{order.date}</span>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{order.name}</p>
              <p className="text-xs text-gray-500">{order.phone}</p>
              <div className="flex justify-between items-center mt-1.5">
                <span className="text-xs text-gray-400">
                  {order.items.map(i => `${i.name}×${i.quantity}`).join(', ')}
                </span>
                <span className="text-sm font-bold text-gray-700">₹{order.grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Send to Kitchen ────────────────────────────────────────────────────
function KitchenTab({ password }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [, month, day] = tomorrow.toISOString().slice(0, 10).split('-');
  const defaultDate = `${tomorrow.getFullYear()}-${month}-${day}`;

  const [kitchenDate, setKitchenDate] = useState(defaultDate);
  const [summary, setSummary]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [copied, setCopied]           = useState(false);

  const convertDate = (d) => {
    if (!d) return '';
    const [y, mo, dd] = d.split('-');
    return `${dd}/${mo}/${y}`;
  };

  const fetchSummary = async () => {
    setLoading(true); setError(''); setSummary(null);
    try {
      const res = await getKitchenSummary(convertDate(kitchenDate), password);
      setSummary(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch kitchen summary.');
    } finally {
      setLoading(false);
    }
  };

  const buildKitchenText = () => {
    if (!summary) return '';
    const lines = [`🍱 Kitchen Order Summary – ${convertDate(kitchenDate)}`, ''];
    summary.items.forEach(row => {
      lines.push(`${row.name}: ${row.totalQty} tiffins`);
      if (row.borivaliQty > 0 && row.outsideQty > 0) {
        lines.push(`  (Borivali: ${row.borivaliQty}, Outside: ${row.outsideQty})`);
      }
    });
    lines.push('');
    lines.push(`Total Tiffins: ${summary.grandTotal}`);
    return lines.join('\n');
  };

  const handleCopy = () => {
    const text = buildKitchenText();
    navigator.clipboard.writeText(text).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2500); },
      () => {
        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Delivery Date</label>
          <input
            type="date"
            value={kitchenDate}
            onChange={e => { setKitchenDate(e.target.value); setSummary(null); }}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition"
          />
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className={`w-full py-3 rounded-xl font-bold text-sm text-white transition
            ${loading ? 'bg-red-300 cursor-not-allowed' : 'bg-jts-red hover:bg-jts-crimson'}`}
        >
          {loading ? 'Loading…' : '📊 Get Kitchen Summary'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

      {summary && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 text-sm">
                🍱 {convertDate(kitchenDate)} – {summary.orderCount} order{summary.orderCount !== 1 ? 's' : ''}
              </h3>
            </div>

            {summary.items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No orders for this date</p>
            ) : (
              <div className="flex flex-col divide-y divide-gray-100">
                {summary.items.map(row => (
                  <div key={row.name} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{row.name}</p>
                      {row.borivaliQty > 0 && row.outsideQty > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Borivali: {row.borivaliQty} &nbsp;|&nbsp; Outside: {row.outsideQty}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-black text-jts-red">{row.totalQty}</p>
                      <p className="text-[10px] text-gray-400">tiffins</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {summary.items.length > 0 && (
              <div className="border-t border-gray-100 pt-3 flex justify-between items-center font-bold">
                <span className="text-gray-700">Grand Total</span>
                <span className="text-2xl text-jts-red">{summary.grandTotal} tiffins</span>
              </div>
            )}
          </div>

          {summary.items.length > 0 && (
            <button
              onClick={handleCopy}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition
                ${copied
                  ? 'bg-green-500 text-white'
                  : 'bg-jts-navy hover:bg-blue-900 text-white'}`}
            >
              {copied ? '✅ Copied to Clipboard!' : '📋 Copy / Send to Kitchen (WhatsApp)'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── AdminPage ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [adminPassword, setAdminPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError]         = useState('');
  const [activeTab, setActiveTab]         = useState('menu'); // menu | orders | kitchen
  const [currentMenu, setCurrentMenu]     = useState([]);
  const [currentMetadata, setCurrentMetadata] = useState({});

  const handleLogin = async (pass) => {
    setAuthError('');
    try {
      await getAdminOrders({}, pass);
      setAdminPassword(pass);
      setAuthenticated(true);
      // Also fetch current menu
      try {
        const menuRes = await fetch('/api/menu');
        const menuData = await menuRes.json();
        setCurrentMenu(menuData.menu || []);
        setCurrentMetadata(menuData.metadata || {});
      } catch { /* ignore */ }
    } catch (err) {
      if (err.response?.status === 401) {
        setAuthError('Incorrect password. Please try again.');
      } else {
        setAuthError(err.response?.data?.error || 'Unable to sign in right now.');
      }
    }
  };

  if (!authenticated) {
    return <LoginScreen onLogin={handleLogin} authError={authError} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <JtsLogo className="w-9 h-9 flex-shrink-0" />
          <div className="flex-1">
            <h1 className="font-bold text-gray-900 text-sm leading-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>
              Admin Panel
            </h1>
            <p className="text-xs text-gray-500">Jain Tiffin Service</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-2">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <TabBtn active={activeTab === 'menu'}    onClick={() => setActiveTab('menu')}>🍽️ Tomorrow's Menu</TabBtn>
          <TabBtn active={activeTab === 'orders'}  onClick={() => setActiveTab('orders')}>📋 Orders</TabBtn>
          <TabBtn active={activeTab === 'kitchen'} onClick={() => setActiveTab('kitchen')}>👨‍🍳 Kitchen</TabBtn>
        </div>
      </div>

      {/* Tab content */}
      <main className="max-w-2xl mx-auto px-4 py-3">
        {activeTab === 'menu'    && <MenuTab    password={adminPassword} currentMenu={currentMenu} currentMetadata={currentMetadata} />}
        {activeTab === 'orders'  && <OrdersTab  password={adminPassword} />}
        {activeTab === 'kitchen' && <KitchenTab password={adminPassword} />}
      </main>
    </div>
  );
}
