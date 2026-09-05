import React, { useState, useEffect, useCallback } from 'react';
import JtsLogo from './JtsLogo';
import { getAdminOrders, updateAdminMenu, getKitchenSummary, updateAdminDeliveryBatch, createAdminOrder, lookupCustomer } from '../services/api';
import { toBlob } from 'html-to-image';

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, authError }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setLocalError(''); }}
              placeholder="Admin password"
              className="w-full px-4 py-3 pr-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                // Eye-off icon
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                // Eye icon
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
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
      className={`whitespace-nowrap px-4 py-2.5 text-xs font-bold transition rounded-lg
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
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{order.createdAtStr || `${order.date} ${order.time}`}</span>
            {order.isRecurring && (
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-semibold">🔄 Recurring</span>
            )}
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
              {order.instructions && (
                <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                  <p className="text-xs font-bold text-yellow-800 uppercase tracking-wide mb-0.5">Special Instructions</p>
                  <p className="text-sm text-yellow-900">{order.instructions}</p>
                </div>
              )}
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
                    <span className="text-amber-700">{order.zone === 'borivali' ? 'Delivery Fee' : 'Outside Borivali surcharge'}</span>
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

// ─── Admin New Order Modal (Post-Cutoff / Manual Entry) ───────────────────────
function AdminNewOrderModal({ password, currentMetadata, currentMenu, onClose, onOrderCreated }) {
  const getTodayDate = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  };

  const [date, setDate] = useState(getTodayDate());
  const [phone, setPhone] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupStatus, setLookupStatus] = useState(null);
  const [form, setForm] = useState({
    name: '',
    wingFlat: '',
    building: '',
    street: '',
    landmark: '',
    locality: '',
    pincode: '',
    instructions: ''
  });
  const [zone, setZone] = useState(null);
  const [deliveryPerson, setDeliveryPerson] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // Meal selections
  const [selectedLunch, setSelectedLunch] = useState('Full Lunch');
  const [lunchQty, setLunchQty] = useState(1);
  const [hasChoviar, setHasChoviar] = useState(false);
  const [choviarQty, setChoviarQty] = useState(1);
  const [extraBreadQty, setExtraBreadQty] = useState(0);

  // Custom Items
  const [customItems, setCustomItems] = useState([]);
  const [selectedCustomItem, setSelectedCustomItem] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const breadType = currentMetadata?.breadType || 'Roti';

  const checkPincode = (pin) => {
    if (/^\d{6}$/.test(pin)) {
      fetch(`/api/check-pincode?pincode=${pin}`)
        .then(r => r.json())
        .then(d => setZone(d.zone || null))
        .catch(() => setZone(null));
    } else {
      setZone(null);
    }
  };

  const handlePhoneChange = async (val) => {
    setPhone(val);
    if (/^[6-9]\d{9}$/.test(val)) {
      setLookupLoading(true);
      try {
        const res = await lookupCustomer(val);
        const profiles = res.data?.profiles || [];
        if (profiles.length > 0) {
          const p = profiles[0];
          setForm({
            name: p.name || '',
            wingFlat: p.wingFlat || '',
            building: p.building || '',
            street: p.street || '',
            landmark: p.landmark || '',
            locality: p.locality || '',
            pincode: p.pincode || '',
            instructions: p.instructions || ''
          });
          setLookupStatus({ found: true, name: p.name });
          if (p.pincode) checkPincode(p.pincode);
        } else {
          setLookupStatus({ found: false });
        }
      } catch (err) {
        setLookupStatus({ found: false });
      } finally {
        setLookupLoading(false);
      }
    } else {
      setLookupStatus(null);
    }
  };

  const getItemPrice = (name) => {
    const item = (currentMenu || []).find(m => m.name === name);
    if (item && Number(item.price)) return Number(item.price);
    if (name === 'Mini Lunch') return 140;
    if (name === 'Brunch') return 180;
    if (name === 'Full Lunch') return 220;
    if (name === 'Family Meal') return 320;
    if (name === 'Choviar Special' || name === 'Choviar' || name === 'Full Choviar') return 160;
    if (name === `Extra ${breadType}` || name === 'Extra Roti' || name === 'Roti') {
      return parseFloat(currentMetadata?.rotiPrice) || 8;
    }
    return 0;
  };

  const buildItemsList = () => {
    const items = [];
    if (selectedLunch && selectedLunch !== 'None' && lunchQty > 0) {
      items.push({ name: selectedLunch, quantity: lunchQty, price: getItemPrice(selectedLunch) });
    }
    if (hasChoviar && choviarQty > 0) {
      items.push({ name: 'Choviar', quantity: choviarQty, price: getItemPrice('Choviar') });
    }
    if (extraBreadQty > 0) {
      items.push({ name: `Extra ${breadType}`, quantity: extraBreadQty, price: getItemPrice(`Extra ${breadType}`) });
    }
    customItems.forEach(ci => {
      items.push({ name: ci.name, quantity: ci.quantity, price: ci.price });
    });
    return items;
  };

  const handleAddCustomItem = () => {
    if (!selectedCustomItem) return;
    const price = getItemPrice(selectedCustomItem);
    const existingIndex = customItems.findIndex(ci => ci.name === selectedCustomItem);
    if (existingIndex >= 0) {
      const updated = [...customItems];
      updated[existingIndex].quantity += customItemQty;
      setCustomItems(updated);
    } else {
      setCustomItems([...customItems, { name: selectedCustomItem, quantity: customItemQty, price }]);
    }
    setSelectedCustomItem('');
    setCustomItemQty(1);
  };

  const handleRemoveCustomItem = (idx) => {
    setCustomItems(customItems.filter((_, i) => i !== idx));
  };

  const itemsList = buildItemsList();
  const subtotal = itemsList.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const tiffinsCount = itemsList.filter(i => i.name.includes('Lunch') || i.name.includes('Meal') || i.name.includes('Brunch') || i.name.includes('Choviar')).reduce((s, i) => s + i.quantity, 0);

  let surcharge = 0;
  if (zone === 'outside') {
    surcharge = 40 * Math.max(1, tiffinsCount);
  } else if (zone === 'borivali') {
    if (tiffinsCount === 0 && subtotal > 0 && subtotal < 250) {
      surcharge = 30;
    }
  }
  const grandTotal = Math.round((subtotal + surcharge) / 5) * 5;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Please enter customer name.');
    if (!phone.trim() || phone.length !== 10) return setError('Please enter a valid 10-digit mobile number.');
    if (!form.pincode.trim() || form.pincode.length !== 6) return setError('Please enter a valid 6-digit pincode.');
    if (itemsList.length === 0) return setError('Please select at least one meal or item.');

    setError('');
    setSubmitting(true);

    const [y, mo, dd] = date.split('-');
    const formattedDate = `${dd}/${mo}/${y}`;

    try {
      const payload = {
        date: formattedDate,
        customer: {
          name: form.name.trim(),
          phone: phone.trim(),
          wingFlat: form.wingFlat.trim(),
          building: form.building.trim(),
          street: form.street.trim(),
          landmark: form.landmark.trim(),
          locality: form.locality.trim(),
          pincode: form.pincode.trim(),
          instructions: form.instructions.trim()
        },
        items: itemsList.map(i => ({ name: i.name, quantity: i.quantity })),
        deliveryPerson,
        paymentMethod
      };

      await createAdminOrder(payload, password);
      onOrderCreated(date);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  const lunchOptions = ['None', 'Mini Lunch', 'Brunch', 'Full Lunch', 'Family Meal'];
  const availableCustomMenuItems = (currentMenu || []).filter(m => 
    !lunchOptions.includes(m.name) && m.name !== 'Choviar' && m.name !== 'Choviar Special' && m.name !== `Extra ${breadType}`
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-gray-800">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>➕ Place Order</span>
                <span className="text-[10px] bg-red-100 text-jts-red px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Post-Cutoff Admin</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Order confirmed with kitchen after packing</p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition">✕</button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Section 1: Date & Phone Lookup */}
          <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Delivery Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-jts-red focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">
                  Customer Phone {lookupLoading && <span className="text-jts-red font-normal lowercase">(searching...)</span>}
                </label>
                <input
                  type="tel"
                  maxLength="10"
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-bold tracking-wider focus:ring-2 focus:ring-jts-red focus:outline-none"
                  required
                />
              </div>
            </div>

            {lookupStatus?.found && (
              <div className="text-[11px] bg-green-50 border border-green-200 text-green-700 px-2.5 py-1 rounded-lg font-medium flex items-center justify-between">
                <span>✅ Profile found: <strong>{lookupStatus.name}</strong> (auto-filled)</span>
              </div>
            )}
            {lookupStatus && !lookupStatus.found && phone.length === 10 && (
              <div className="text-[11px] bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-lg font-medium">
                ℹ️ New customer (details will be saved)
              </div>
            )}
          </div>

          {/* Section 2: Address Details */}
          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Customer Name</label>
              <input
                type="text"
                placeholder="Full Name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-jts-red focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Flat / Wing"
                value={form.wingFlat}
                onChange={e => setForm({ ...form, wingFlat: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-jts-red focus:outline-none"
              />
              <input
                type="text"
                placeholder="Building / Society"
                value={form.building}
                onChange={e => setForm({ ...form, building: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-jts-red focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Street / Road"
                value={form.street}
                onChange={e => setForm({ ...form, street: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-jts-red focus:outline-none"
              />
              <input
                type="text"
                placeholder="Landmark (opt)"
                value={form.landmark}
                onChange={e => setForm({ ...form, landmark: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-jts-red focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Locality (e.g. Borivali W)"
                value={form.locality}
                onChange={e => setForm({ ...form, locality: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-jts-red focus:outline-none"
              />
              <div>
                <input
                  type="text"
                  maxLength="6"
                  placeholder="Pincode (6-digit)"
                  value={form.pincode}
                  onChange={e => {
                    setForm({ ...form, pincode: e.target.value });
                    checkPincode(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold tracking-wider focus:ring-2 focus:ring-jts-red focus:outline-none"
                  required
                />
                {zone && (
                  <span className={`text-[10px] font-bold block mt-0.5 ${zone === 'outside' ? 'text-amber-600' : 'text-green-600'}`}>
                    {zone === 'outside' ? '🚚 Outside Borivali (+₹40/tiffin)' : '📍 Borivali Zone'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Meal Selection */}
          <div className="bg-red-50/40 p-3.5 rounded-xl border border-red-100 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Lunch Plan</p>
              <span className="text-[10px] bg-red-100 text-jts-red px-2 py-0.5 rounded font-bold">Bread: {breadType}</span>
            </div>

            {/* Lunch selection pills */}
            <div className="grid grid-cols-3 gap-1.5">
              {lunchOptions.map(opt => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setSelectedLunch(opt)}
                  className={`py-1.5 px-2 text-xs rounded-lg font-bold border transition ${
                    selectedLunch === opt ? 'bg-jts-red text-white border-jts-red shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            {selectedLunch !== 'None' && (
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-gray-600 font-medium">{selectedLunch} Quantity:</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setLunchQty(Math.max(1, lunchQty - 1))} className="w-6 h-6 rounded border bg-white text-gray-600 font-bold hover:bg-gray-100">-</button>
                  <span className="w-5 text-center font-bold text-gray-800">{lunchQty}</span>
                  <button type="button" onClick={() => setLunchQty(lunchQty + 1)} className="w-6 h-6 rounded border border-jts-red bg-white text-jts-red font-bold hover:bg-red-50">+</button>
                  <span className="text-gray-500 font-bold ml-1">₹{getItemPrice(selectedLunch) * lunchQty}</span>
                </div>
              </div>
            )}

            {/* Choviar & Extra Bread */}
            <div className="border-t border-red-100 pt-2.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700">
                  <input type="checkbox" checked={hasChoviar} onChange={e => setHasChoviar(e.target.checked)} className="w-4 h-4 text-jts-red rounded border-gray-300" />
                  <span>Choviar Meal (₹{getItemPrice('Choviar')})</span>
                </label>
                {hasChoviar && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setChoviarQty(Math.max(1, choviarQty - 1))} className="w-6 h-6 rounded border bg-white font-bold">-</button>
                    <span className="w-5 text-center font-bold">{choviarQty}</span>
                    <button type="button" onClick={() => setChoviarQty(choviarQty + 1)} className="w-6 h-6 rounded border border-jts-red bg-white text-jts-red font-bold">+</button>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-700">Extra {breadType} (₹{getItemPrice(`Extra ${breadType}`)}/pc)</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setExtraBreadQty(Math.max(0, extraBreadQty - 1))} className="w-6 h-6 rounded border bg-white font-bold">-</button>
                  <span className="w-5 text-center font-bold">{extraBreadQty}</span>
                  <button type="button" onClick={() => setExtraBreadQty(Math.min(50, extraBreadQty + 1))} className="w-6 h-6 rounded border border-jts-red bg-white text-jts-red font-bold">+</button>
                </div>
              </div>
            </div>

            {/* Additional Custom Menu Items */}
            {availableCustomMenuItems.length > 0 && (
              <div className="border-t border-red-100 pt-2 space-y-1.5">
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Add Custom Item (Extra Sabji/Farsan/Sweet)</p>
                <div className="flex gap-2">
                  <select
                    value={selectedCustomItem}
                    onChange={e => setSelectedCustomItem(e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-jts-red"
                  >
                    <option value="">Select menu item...</option>
                    {availableCustomMenuItems.map(m => (
                      <option key={m.name} value={m.name}>{m.name} (₹{m.price})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={customItemQty}
                    onChange={e => setCustomItemQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-12 text-xs text-center border border-gray-200 rounded-lg px-1 py-1.5 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomItem}
                    disabled={!selectedCustomItem}
                    className="px-2.5 py-1.5 bg-gray-800 hover:bg-black text-white text-xs font-bold rounded-lg disabled:opacity-40 transition"
                  >
                    + Add
                  </button>
                </div>

                {customItems.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {customItems.map((ci, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-white px-2.5 py-1 rounded border border-gray-200">
                        <span>{ci.name} × {ci.quantity}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">₹{ci.price * ci.quantity}</span>
                          <button type="button" onClick={() => handleRemoveCustomItem(idx)} className="text-red-500 font-bold hover:text-red-700">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Delivery Boy & Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Delivery Person</label>
              <select
                value={deliveryPerson}
                onChange={e => setDeliveryPerson(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-jts-red focus:outline-none"
              >
                <option value="">Unassigned</option>
                <option value="Dinesh">Dinesh</option>
                <option value="Ramesh">Ramesh</option>
                <option value="Harish">Harish</option>
                <option value="Haresh">Haresh</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-jts-red focus:outline-none"
              >
                <option value="Cash">Cash on Delivery</option>
                <option value="Online">Online / UPI</option>
              </select>
            </div>
          </div>

          {/* Section 5: Pricing Summary */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal ({itemsList.length} items)</span>
              <span>₹{subtotal}</span>
            </div>
            {surcharge > 0 && (
              <div className="flex justify-between text-amber-700 font-medium">
                <span>Delivery Charge</span>
                <span>+₹{surcharge}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-gray-900 border-t border-gray-200 pt-1 mt-1">
              <span>Grand Total</span>
              <span className="text-jts-red">₹{grandTotal}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || itemsList.length === 0}
              className="flex-1 py-2.5 px-4 bg-jts-red hover:bg-jts-crimson text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {submitting ? 'Placing Order...' : `Confirm & Place Order (₹${grandTotal})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab 1: Tomorrow's Menu ────────────────────────────────────────────────────
const TIFFIN_DEFAULTS = [
  { name: 'Mini Lunch',   description: '3 Roti, 1/2 Sabji, 1/2 Dal, 1/2 Rice, Salad / Sweet / Namkeen / Farsan', price: 140, available: true, category: 'Lunch' },
  { name: 'Brunch',       description: '6 Roti, Sabji, 1/2 Dal, 1/2 Rice, Salad / Sweet / Namkeen / Farsan', price: 180, available: true, category: 'Lunch' },
  { name: 'Full Lunch',   description: '6 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 220, available: true, category: 'Lunch' },
  { name: 'Family Meal',  description: '9 Roti, 1.5 Sabji, 1.5 Dal, 1.5 Rice, Salad / Sweet / Namkeen / Farsan', price: 320, available: true, category: 'Lunch' },
  { name: 'Choviar Special', description: 'Ragdo, 4 Kelawada, Dal Khichdi', price: 160, available: true, category: 'Choviar', qty: 4 },
];

function MenuTab({ password, currentMenu, currentMetadata, onMenuSaved }) {
  const [items, setItems]       = useState(currentMenu.length > 0 ? currentMenu : TIFFIN_DEFAULTS);
  const [metadata, setMetadata] = useState({
    sabji: '', sweet: '', dal: '', farsan: '', rice: '',
    breadType: 'Roti',
    rotiPrice: '8', riceHalfPrice: '15', riceFullPrice: '30',
    sabjiHalfPrice: '25', sabjiFullPrice: '50',
    dalHalfPrice: '25', dalFullPrice: '50',
    farsanPrice: '0', farsanAvailable: 'No',
    sweetPrice: '0', sweetAvailable: 'No',
    ...currentMetadata
  });
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');

  useEffect(() => {
    if (currentMenu.length > 0) {
      setItems(currentMenu);
    } else {
      setItems([
        { name: 'Mini Lunch',  description: '3 Roti, 1/2 Sabji, 1/2 Dal, 1/2 Rice, Salad / Sweet / Namkeen / Farsan', price: 140, available: true, category: 'Lunch' },
        { name: 'Brunch',      description: '6 Roti, Sabji, 1/2 Dal, 1/2 Rice, Salad / Sweet / Namkeen / Farsan', price: 180, available: true, category: 'Lunch' },
        { name: 'Full Lunch',  description: '6 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 220, available: true, category: 'Lunch' },
        { name: 'Family Meal', description: '9 Roti, 1.5 Sabji, 1.5 Dal, 1.5 Rice, Salad / Sweet / Namkeen / Farsan', price: 320, available: true, category: 'Lunch' },
        { name: 'Choviar Special', description: 'Ragdo, 4 Kelawada, Dal Khichdi', price: 160, available: true, category: 'Choviar', qty: 4 },
      ]);
    }
    if (currentMetadata && Object.keys(currentMetadata).length > 0) {
      setMetadata(prev => ({ ...prev, ...currentMetadata }));
    }
  }, [currentMenu, currentMetadata]);

  const getDynamicMealConfig = (meta) => {
    const addons = [];
    if (meta.saladAvailable === 'Yes') addons.push('Salad');
    if (meta.sweetAvailable === 'Yes') addons.push('Sweet');
    if (meta.namkeenAvailable === 'Yes') addons.push('Namkeen');
    if (meta.farsanAvailable === 'Yes') addons.push('Farsan');
    const suffix = addons.length > 0 ? ', ' + addons.join(' / ') : '';
    const bread = meta.breadType || 'Roti';
    
    const defaultMatrix = {
      "Mini Lunch": { Roti: 3, Paratha: 3, Puri: 3, Sabji: 0.5, Dal: 0.5, Rice: 0.5, Sweet: 1, Farsan: 1 },
      "Brunch": { Roti: 6, Paratha: 4, Puri: 6, Sabji: 1, Dal: 0.5, Rice: 0.5, Sweet: 1, Farsan: 1 },
      "Full Lunch": { Roti: 6, Paratha: 4, Puri: 6, Sabji: 1, Dal: 1, Rice: 1, Sweet: 1, Farsan: 1 },
      "Family Meal": { Roti: 9, Paratha: 6, Puri: 9, Sabji: 1.5, Dal: 1.5, Rice: 1.5, Sweet: 2, Farsan: 2 }
    };
    
    const defaultBasePrices = {
      "Mini Lunch": 140,
      "Brunch": 180,
      "Full Lunch": 220,
      "Family Meal": 320
    };

    const fmt = (val) => val === 0.5 ? "1/2" : val;

    return { suffix, bread, defaultMatrix, defaultBasePrices, fmt };
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const newItems = prev.map((item, i) => i === idx ? { ...item, [field]: value } : item);
      
      // If basePrice is changed, recalculate total price
      if (field === 'basePrice' && newItems[idx].category === 'Lunch') {
         const meta = metadata;
         const { defaultMatrix } = getDynamicMealConfig(meta);
         const m = meta.tiffinMatrix?.[newItems[idx].name] || defaultMatrix[newItems[idx].name];
         let newPrice = parseFloat(value) || 0;
         if (m) {
           if (meta.sweetAvailable === 'Yes' && parseFloat(meta.sweetPrice) > 0) newPrice += parseFloat(meta.sweetPrice) * (m.Sweet || 1);
           if (meta.farsanAvailable === 'Yes' && parseFloat(meta.farsanPrice) > 0) newPrice += parseFloat(meta.farsanPrice) * (m.Farsan || 1);
           if (parseFloat(meta.sabjiPrice) > 0) newPrice += parseFloat(meta.sabjiPrice) * (m.Sabji || 1);
         }
         newItems[idx].price = newPrice;
      }
      return newItems;
    });
  };

  const updateLunchDescriptions = (meta) => {
    const { suffix, bread, defaultMatrix, defaultBasePrices, fmt } = getDynamicMealConfig(meta);

    setItems(prevItems => prevItems.map(item => {
      if (item.category !== 'Lunch') return item;
      
      const m = meta.tiffinMatrix?.[item.name] || defaultMatrix[item.name];
      if (!m) return item;

      const baseDesc = `${m[bread]} ${bread}, ${fmt(m.Sabji)} Sabji, ${fmt(m.Dal)} Dal, ${fmt(m.Rice)} Rice`;
      
      let basePrice = item.basePrice ?? defaultBasePrices[item.name];
      if (basePrice === undefined) {
         // fallback if it's a custom lunch item
         basePrice = item.price || 0;
      }
      
      let newPrice = basePrice;
      if (meta.sweetAvailable === 'Yes' && parseFloat(meta.sweetPrice) > 0) {
        newPrice += parseFloat(meta.sweetPrice) * (m.Sweet || 1);
      }
      if (meta.farsanAvailable === 'Yes' && parseFloat(meta.farsanPrice) > 0) {
        newPrice += parseFloat(meta.farsanPrice) * (m.Farsan || 1);
      }
      if (parseFloat(meta.sabjiPrice) > 0) {
        newPrice += parseFloat(meta.sabjiPrice) * (m.Sabji || 1);
      }
      
      return { ...item, basePrice, description: baseDesc + suffix, price: newPrice };
    }));
  };

  const updateMeta = (field, value) => {
    setMetadata(prev => {
      const next = { ...prev, [field]: value };
      if (['farsanAvailable', 'sweetAvailable', 'namkeenAvailable', 'saladAvailable', 'breadType', 'farsanPrice', 'sweetPrice', 'sabjiPrice'].includes(field)) {
        updateLunchDescriptions(next);
      }
      return next;
    });
  };

  const loadPresets = () => {
    const { suffix, bread, defaultMatrix, defaultBasePrices, fmt } = getDynamicMealConfig(metadata);

    const getPrice = (name) => {
      const m = metadata.tiffinMatrix?.[name] || defaultMatrix[name];
      let newPrice = defaultBasePrices[name];
      if (metadata.sweetAvailable === 'Yes' && parseFloat(metadata.sweetPrice) > 0) newPrice += parseFloat(metadata.sweetPrice) * (m.Sweet || 1);
      if (metadata.farsanAvailable === 'Yes' && parseFloat(metadata.farsanPrice) > 0) newPrice += parseFloat(metadata.farsanPrice) * (m.Farsan || 1);
      if (parseFloat(metadata.sabjiPrice) > 0) newPrice += parseFloat(metadata.sabjiPrice) * (m.Sabji || 1);
      return newPrice;
    };

    const getDesc = (name) => {
      const m = metadata.tiffinMatrix?.[name] || defaultMatrix[name];
      return `${m[bread]} ${bread}, ${fmt(m.Sabji)} Sabji, ${fmt(m.Dal)} Dal, ${fmt(m.Rice)} Rice${suffix}`;
    };

    setItems([
      { name: 'Mini Lunch',  description: getDesc('Mini Lunch'), basePrice: defaultBasePrices['Mini Lunch'], price: getPrice('Mini Lunch'), available: true, category: 'Lunch' },
      { name: 'Brunch',      description: getDesc('Brunch'), basePrice: defaultBasePrices['Brunch'], price: getPrice('Brunch'), available: true, category: 'Lunch' },
      { name: 'Full Lunch',  description: getDesc('Full Lunch'), basePrice: defaultBasePrices['Full Lunch'], price: getPrice('Full Lunch'), available: true, category: 'Lunch' },
      { name: 'Family Meal', description: getDesc('Family Meal'), basePrice: defaultBasePrices['Family Meal'], price: getPrice('Family Meal'), available: true, category: 'Lunch' },
      { name: 'Choviar Special', description: 'Ragdo, 4 Kelawada, Dal Khichdi', price: 160, available: true, category: 'Choviar' },
    ]);
  };

  const addLunchItem = () => {
    setItems(prev => [...prev, { name: '', description: '', basePrice: 0, price: 0, available: true, category: 'Lunch' }]);
  };

  const addChoviarItem = () => {
    setItems(prev => [...prev, { name: '', description: '', price: 0, available: true, category: 'Choviar', qty: '' }]);
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const moveChoviarItem = (idx, direction) => {
    setItems(prev => {
      const choviarIndices = prev.map((item, i) => item.category === 'Choviar' ? i : -1).filter(i => i !== -1);
      const choviarPos = choviarIndices.indexOf(idx);
      const targetPos = choviarPos + direction;
      if (targetPos < 0 || targetPos >= choviarIndices.length) return prev;
      const targetIdx = choviarIndices[targetPos];
      const newItems = [...prev];
      const temp = newItems[idx];
      newItems[idx] = newItems[targetIdx];
      newItems[targetIdx] = temp;
      return newItems;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      await updateAdminMenu({ items, metadata }, password);
      setMsg('✅ Menu saved successfully! Customers will see the updated menu immediately.');
      // Notify parent so currentMenu stays in sync — prevents qty/fields resetting on tab switch
      if (onMenuSaved) onMenuSaved(items, metadata);
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Failed to save menu.'));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const handleMakeLive = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = `${String(tomorrow.getDate()).padStart(2, '0')}/${String(tomorrow.getMonth() + 1).padStart(2, '0')}/${tomorrow.getFullYear()}`;
    
    const newMeta = { ...metadata, liveMenuDate: dateStr };
    setMetadata(newMeta);
    
    setSaving(true);
    setMsg('');
    try {
      await updateAdminMenu({ items, metadata: newMeta }, password);
      setMsg(`✅ Menu is now LIVE for ${dateStr}!`);
      if (onMenuSaved) onMenuSaved(items, newMeta);
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Failed to make menu live.'));
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
        <div className="flex gap-2">
          <button onClick={loadPresets} className="bg-jts-navy text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-900 shadow-sm transition">
            Load Presets
          </button>
          <button onClick={addLunchItem} className="bg-jts-red text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-jts-crimson shadow-sm transition">
            + Add Lunch Item
          </button>
        </div>
      </div>

      {/* Metadata Section */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-4">
        <h3 className="text-sm font-bold text-gray-800 border-b pb-2">Custom Order & Lunch Details</h3>
        
        {/* Bread Type */}
        <div className="mb-2 border-b border-gray-100 pb-4">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-2">Bread of the Day</label>
          <div className="flex gap-4">
            {['Roti', 'Paratha', 'Puri'].map(bType => (
              <label key={bType} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-700">
                <input
                  type="radio"
                  name="breadType"
                  value={bType}
                  checked={(metadata.breadType || 'Roti') === bType}
                  onChange={e => updateMeta('breadType', e.target.value)}
                  className="w-4 h-4 text-jts-red focus:ring-jts-red"
                />
                {bType}
              </label>
            ))}
          </div>
        </div>



        {/* Rice */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Rice Name</label>
          <input type="text" value={metadata.rice || ''} onChange={e => updateMeta('rice', e.target.value)} placeholder="e.g. Jeera Rice" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
        </div>

        {/* Sabji */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Sabji</label>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
            <input type="text" value={metadata.sabji || ''} onChange={e => updateMeta('sabji', e.target.value)} placeholder="Name (e.g. Bhindi)" className="flex-1 min-w-[120px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            <input type="number" value={metadata.sabjiPrice || ''} onChange={e => updateMeta('sabjiPrice', e.target.value)} placeholder="Premium ₹" className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
        </div>

        {/* Dal */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Dal Name</label>
          <input type="text" value={metadata.dal || ''} onChange={e => updateMeta('dal', e.target.value)} placeholder="e.g. Gujarati Dal" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
        </div>

        {/* Farsan */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Farsan</label>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
            <input type="text" value={metadata.farsan || ''} onChange={e => updateMeta('farsan', e.target.value)} placeholder="e.g. Dhokla" className="flex-1 min-w-[120px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            <input type="number" value={metadata.farsanPrice || ''} onChange={e => updateMeta('farsanPrice', e.target.value)} placeholder="₹" className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            <label className="flex items-center gap-1 cursor-pointer text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1.5 rounded-lg border border-gray-200 whitespace-nowrap">
              <input type="checkbox" checked={metadata.farsanAvailable === 'Yes'} onChange={e => updateMeta('farsanAvailable', e.target.checked ? 'Yes' : 'No')} className="w-4 h-4 text-jts-red" />
              On
            </label>
          </div>
        </div>

        {/* Sweet */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Sweet</label>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
            <input type="text" value={metadata.sweet || ''} onChange={e => updateMeta('sweet', e.target.value)} placeholder="e.g. Aamras" className="flex-1 min-w-[120px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            <input type="number" value={metadata.sweetPrice || ''} onChange={e => updateMeta('sweetPrice', e.target.value)} placeholder="₹" className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            <label className="flex items-center gap-1 cursor-pointer text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1.5 rounded-lg border border-gray-200 whitespace-nowrap">
              <input type="checkbox" checked={metadata.sweetAvailable === 'Yes'} onChange={e => updateMeta('sweetAvailable', e.target.checked ? 'Yes' : 'No')} className="w-4 h-4 text-jts-red" />
              On
            </label>
          </div>
        </div>

        {/* Closed Status */}
        <div className="col-span-1 sm:col-span-2 pt-2 border-t border-gray-100 mt-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl flex-1 justify-center transition hover:bg-red-100">
            <input type="checkbox" checked={metadata.lunchClosed === 'Yes'} onChange={e => updateMeta('lunchClosed', e.target.checked ? 'Yes' : 'No')} className="w-4 h-4 text-red-600" />
            Close Lunch Tomorrow
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl flex-1 justify-center transition hover:bg-red-100">
            <input type="checkbox" checked={metadata.choviarClosed === 'Yes'} onChange={e => updateMeta('choviarClosed', e.target.checked ? 'Yes' : 'No')} className="w-4 h-4 text-red-600" />
            Close Choviar Tomorrow
          </label>
        </div>

        {/* Namkeen and Salad Checkboxes */}
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-700">
            <input type="checkbox" checked={metadata.namkeenAvailable === 'Yes'} onChange={e => updateMeta('namkeenAvailable', e.target.checked ? 'Yes' : 'No')} className="w-4 h-4 text-jts-red rounded" />
            Namkeen Included
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-700">
            <input type="checkbox" checked={metadata.saladAvailable === 'Yes'} onChange={e => updateMeta('saladAvailable', e.target.checked ? 'Yes' : 'No')} className="w-4 h-4 text-jts-red rounded" />
            Salad Included
          </label>
        </div>
      </div>

      {/* Choviar Details Section */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-sm font-bold text-gray-800">Choviar Details</h3>
          <button onClick={addChoviarItem} className="text-xs font-bold text-white bg-jts-red hover:bg-jts-crimson px-2 py-1 rounded-lg shadow-sm transition">+ Add Item</button>
        </div>
        
        {items.filter(i => i.category === 'Choviar').length > 0 ? (
          <div className="overflow-x-auto">
            <div className="flex flex-col gap-2 min-w-[400px] pb-1">
              <div className="grid grid-cols-[1fr_60px_80px_40px_64px] gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide px-1">
                <span>Item Name</span>
                <span className="text-center">Qty/Order</span>
                <span>Price (₹)</span>
                <span>Avail</span>
                <span className="text-right">Action</span>
              </div>
              {items.map((item, idx) => {
                if (item.category !== 'Choviar') return null;
                const choviarIndices = items.map((it, i) => it.category === 'Choviar' ? i : -1).filter(i => i !== -1);
                const isFirst = choviarIndices[0] === idx;
                const isLast = choviarIndices[choviarIndices.length - 1] === idx;
                return (
                  <div key={idx} className="grid grid-cols-[1fr_60px_80px_40px_64px] gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <input type="text" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-jts-red bg-white" placeholder="Name" />
                    <input
                      type="number"
                      min="1"
                      value={item.qty || ''}
                      onChange={e => updateItem(idx, 'qty', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full text-sm text-center border border-gray-200 rounded-md px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-jts-red bg-white"
                      placeholder="—"
                    />
                    <input type="number" value={item.price} onChange={e => updateItem(idx, 'price', e.target.value)} className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-jts-red bg-white" placeholder="₹" />
                    <input type="checkbox" checked={item.available} onChange={e => updateItem(idx, 'available', e.target.checked)} className="w-4 h-4 text-jts-red mx-auto" />
                    <div className="flex items-center gap-1 justify-end">
                      <button 
                        type="button" 
                        onClick={() => moveChoviarItem(idx, -1)} 
                        disabled={isFirst}
                        className="text-gray-500 hover:text-gray-800 disabled:opacity-20 p-0.5 text-xs font-bold transition"
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button 
                        type="button" 
                        onClick={() => moveChoviarItem(idx, 1)} 
                        disabled={isLast}
                        className="text-gray-500 hover:text-gray-800 disabled:opacity-20 p-0.5 text-xs font-bold transition"
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button 
                        type="button" 
                        onClick={() => removeItem(idx)} 
                        className="text-red-500 hover:text-red-700 font-bold p-0.5 text-xs ml-0.5 transition"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic text-center py-2">No Choviar items added.</p>
        )}
      </div>

      <h3 className="text-sm font-bold text-gray-800 mt-2 px-1">Lunch Menu Cards</h3>
      
      {items.map((item, idx) => {
        if (item.category !== 'Lunch') return null;
        return (
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
              <label className="text-xs font-medium text-gray-500">Base Price (₹)</label>
              <input
                type="number"
                min="0"
                value={item.basePrice ?? item.price}
                onChange={e => updateItem(idx, 'basePrice', parseFloat(e.target.value) || 0)}
                className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-jts-red transition"
              />
              {item.price !== (item.basePrice ?? item.price) && (
                <span className="text-base font-black text-jts-red ml-2">Total: ₹{item.price}</span>
              )}
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
        );
      })}

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg}
        </div>
      )}

      <button onClick={addLunchItem} className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition text-sm border border-gray-300 border-dashed mb-1">
        + Add Another Lunch Item
      </button>

      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3.5 rounded-xl font-bold text-white text-sm transition mb-4
          ${saving ? 'bg-red-300 cursor-not-allowed' : 'bg-jts-red hover:bg-jts-crimson shadow-md'}`}
      >
        {saving ? 'Saving…' : '💾 Save Menu (Hidden from Users)'}
      </button>

      <button
        onClick={handleMakeLive}
        disabled={saving}
        className={`w-full py-3.5 rounded-xl font-black text-white text-sm tracking-wide transition shadow-md
          ${saving ? 'bg-green-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
      >
        🚀 MAKE MENU LIVE FOR TOMORROW
      </button>
    </div>
  );
}

// ─── Tab 2: Orders ─────────────────────────────────────────────────────────────
function OrdersTab({ password, currentMetadata, currentMenu }) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const getDeliveryDate = () => {
    const d = new Date();
    if (d.getHours() >= 19) d.setDate(d.getDate() + 1);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  };
  const defaultDate = getDeliveryDate();

  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterDate, setFilterDate]   = useState(defaultDate);
  const [modalOrder, setModalOrder]   = useState(null);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [msg, setMsg] = useState('');

  const convertMonth = (m) => { if (!m) return undefined; const [y, mo] = m.split('-'); return `${mo}/${y}`; };
  const convertDate  = (d) => { if (!d) return undefined; const [y, mo, dd] = d.split('-'); return `${dd}/${mo}/${y}`; };

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (filterDate) params.date = convertDate(filterDate);
      else if (filterMonth) params.month = convertMonth(filterMonth);
      const res = await getAdminOrders(params, password);
      const dataOrders = res.data.orders || [];
      setOrders(dataOrders);
      const initial = {};
      dataOrders.forEach(o => {
        initial[o.orderId] = { deliveryPerson: o.deliveryPerson || '', routeOrder: (o.routeOrder && o.routeOrder !== 9999) ? o.routeOrder : '' };
      });
      setAssignments(initial);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch orders.');
    } finally {
      setLoading(false);
    }
  }, [password, filterMonth, filterDate]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleUpdateAssignment = (orderId, field, value) => {
    setAssignments(prev => ({ ...prev, [orderId]: { ...prev[orderId], [field]: value } }));
  };

  const handleSaveAssignments = async (orderList) => {
    setSavingAssignments(true); setMsg('');
    try {
      const updates = orderList.map(o => ({
        orderId: o.orderId,
        deliveryPerson: assignments[o.orderId]?.deliveryPerson || '',
        routeOrder: assignments[o.orderId]?.routeOrder || ''
      }));
      await updateAdminDeliveryBatch(updates, password);
      setMsg('✅ Delivery assignments saved!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('❌ Failed to save assignments.');
    } finally {
      setSavingAssignments(false);
    }
  };

  // Analytics
  const totalRevenue     = orders.reduce((s, o) => s + o.grandTotal, 0);
  const totalTiffins     = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);

  // Per-item breakdown
  const itemCounts = {};
  orders.forEach(o => o.items.forEach(i => {
    itemCounts[i.name] = (itemCounts[i.name] || 0) + i.quantity;
  }));

  // Top selling item
  let topSellingItem = { name: 'N/A', qty: 0 };
  Object.entries(itemCounts).forEach(([name, qty]) => {
    if (qty > topSellingItem.qty) {
      topSellingItem = { name, qty };
    }
  });

  return (
    <div className="flex flex-col gap-4">
      {modalOrder && <OrderModal order={modalOrder} onClose={() => setModalOrder(null)} />}

      {showNewOrderModal && (
        <AdminNewOrderModal
          password={password}
          currentMetadata={currentMetadata}
          currentMenu={currentMenu}
          onClose={() => setShowNewOrderModal(false)}
          onOrderCreated={(orderDate) => {
            setShowNewOrderModal(false);
            setMsg('✅ Order placed successfully!');
            setTimeout(() => setMsg(''), 4000);
            if (orderDate) {
              setFilterDate(orderDate);
              setFilterMonth('');
            } else {
              fetchOrders();
            }
          }}
        />
      )}

      {/* Action Button: Post-Cutoff Order Placement */}
      <div className="print-hide">
        <button
          type="button"
          onClick={() => setShowNewOrderModal(true)}
          className="w-full py-3 px-4 bg-jts-red hover:bg-jts-crimson text-white rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition active:scale-98"
        >
          <span>➕ Place Order (Post-Cutoff)</span>
        </button>
      </div>

      {/* Dashboard Insights */}
      <div className="bg-gradient-to-br from-jts-navy to-gray-900 rounded-2xl p-4 text-white shadow-lg print-hide">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Dashboard Insights</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-300 font-medium">Revenue (Filtered)</p>
            <p className="text-2xl font-black text-jts-gold mt-0.5">₹{totalRevenue.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-300 font-medium">Top Selling Item</p>
            <p className="text-lg font-black text-white mt-0.5 leading-tight">{topSellingItem.name}</p>
            <p className="text-xs text-jts-red font-bold mt-0.5">{topSellingItem.qty} sold</p>
          </div>
        </div>
      </div>

      {/* Basic Stats */}
      <div className="grid grid-cols-2 gap-3 print-hide">
        <StatCard label="Total Orders" value={orders.length} />
        <StatCard label="Total Tiffins" value={totalTiffins} color="text-jts-red" />
      </div>

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
          <label className="text-xs font-medium text-gray-600 block mb-1">Delivery Date</label>
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

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg}
        </div>
      )}

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

      {!loading && orders.length > 0 && (() => {
        const activeOrdersList = orders.filter(o => o.status !== 'CANCELLED');
        const lunchOrders = activeOrdersList.filter(o => o.items.some(i => i.category !== 'Choviar'));
        const choviarOrders = activeOrdersList.filter(o => o.items.every(i => i.category === 'Choviar'));
        
        const sortByRoute = (a, b) => {
          const rA = parseInt(a.routeOrder, 10) || 9999;
          const rB = parseInt(b.routeOrder, 10) || 9999;
          if (rA !== rB) return rA - rB;
          // At equal sequence, show outside orders first
          const aOut = a.zone === 'outside' ? 0 : 1;
          const bOut = b.zone === 'outside' ? 0 : 1;
          return aOut - bOut;
        };

        // Sort each group: outside orders first (among those with no seq), then by routeOrder
        const sortGroupWithOutsideFirst = (list) => {
          const assigned = list.filter(o => o.routeOrder && o.routeOrder !== 9999);
          const unassigned = list.filter(o => !o.routeOrder || o.routeOrder === 9999);
          const outsideUnassigned = unassigned.filter(o => o.zone === 'outside');
          const borivaliUnassigned = unassigned.filter(o => o.zone !== 'outside');
          return [...assigned.sort(sortByRoute), ...outsideUnassigned, ...borivaliUnassigned];
        };

        const sortedLunch = sortGroupWithOutsideFirst(lunchOrders);
        const sortedChoviar = sortGroupWithOutsideFirst(choviarOrders);

        const renderGroup = (title, groupOrders) => {
          if (groupOrders.length === 0) return null;
          return (
            <div className="flex flex-col gap-3 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800 text-lg uppercase tracking-wide">{title} ({groupOrders.length})</h3>
                <button
                  onClick={() => handleSaveAssignments(groupOrders)}
                  disabled={savingAssignments}
                  className={`px-4 py-1.5 text-white text-sm font-bold rounded-lg transition ${savingAssignments ? 'bg-red-300 cursor-not-allowed' : 'bg-jts-red hover:bg-jts-crimson shadow-sm'}`}
                >
                  {savingAssignments ? 'Saving...' : '💾 Save Assignments'}
                </button>
              </div>
              <div className="overflow-x-auto bg-white rounded-xl border border-gray-300 shadow-sm">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-gray-100 border-b border-gray-300 text-gray-800 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="border-r border-gray-300 px-2 py-2 text-center w-16">Seq</th>
                      <th className="border-r border-gray-300 px-3 py-2">Name</th>
                      <th className="border-r border-gray-300 px-2 py-2 text-center w-16">Amt</th>
                      <th className="border-r border-gray-300 px-3 py-2">Address</th>
                      <th className="px-2 py-2 text-center w-28">Driver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupOrders.map(order => (
                      <tr key={order.orderId} className="border-b border-gray-300 hover:bg-gray-50 transition">
                        <td className="border-r border-gray-300 px-1 py-1 text-center align-middle">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={assignments[order.orderId]?.routeOrder || ''}
                            onChange={e => handleUpdateAssignment(order.orderId, 'routeOrder', e.target.value.replace(/\D/g, ''))}
                            className="w-12 px-1 py-1 text-center border border-gray-300 focus:outline-none focus:border-jts-red font-semibold text-sm rounded-none"
                          />
                        </td>
                        <td className="border-r border-gray-300 px-2 py-1 align-middle cursor-pointer" onClick={() => setModalOrder(order)}>
                          <div className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                            {order.name}
                            {order.zone === 'outside' && <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-bold uppercase tracking-widest border border-amber-200">Out</span>}
                            {order.isRecurring && <span className="text-[9px] bg-purple-100 text-purple-800 px-1 py-0.5 rounded font-bold uppercase border border-purple-200">R</span>}
                          </div>
                          <div className="text-xs text-gray-500">{order.phone}</div>
                        </td>
                        <td className="border-r border-gray-300 px-2 py-1 text-center align-middle font-bold text-gray-800">
                          {order.grandTotal}
                        </td>
                        <td className="border-r border-gray-300 px-2 py-1 align-middle text-xs text-gray-700 leading-snug break-words">
                          {order.address}
                          {order.instructions && (
                            <div className="mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-block">
                              📝 {order.instructions}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1 text-center align-middle">
                          <div className="flex flex-col gap-1 pl-1">
                            {['Dabbawala', 'Sagar'].map(driver => (
                              <label key={driver} className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`driver-${order.orderId}`}
                                  value={driver}
                                  checked={assignments[order.orderId]?.deliveryPerson === driver}
                                  onChange={() => handleUpdateAssignment(order.orderId, 'deliveryPerson', driver)}
                                  className="text-jts-red focus:ring-jts-red w-3 h-3"
                                />
                                <span className="text-[10px] font-medium text-gray-700 leading-none">{driver}</span>
                              </label>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        };

        return (
          <div className="flex flex-col gap-4">
            {renderGroup('Lunch Orders', sortedLunch)}
            {renderGroup('Choviar Orders', sortedChoviar)}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Tab 3: Send to Kitchen ────────────────────────────────────────────────────
function KitchenTab({ password, currentMetadata, currentMenu }) {
  const getDeliveryDate = () => {
    const d = new Date();
    if (d.getHours() >= 19) d.setDate(d.getDate() + 1);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  };
  const defaultDate = getDeliveryDate();

  const [kitchenDate, setKitchenDate] = useState(defaultDate);
  const [summary, setSummary]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [copied, setCopied]           = useState(false);
  const [printMode, setPrintMode]     = useState(null); // 'lunch' | 'choviar' | null

  useEffect(() => {
    if (!printMode) return;
    const handleAfterPrint = () => {
      setPrintMode(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);

    const timer = setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode(null), 500);
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printMode]);

  const convertDate = (d) => {
    if (!d) return '';
    const [y, mo, dd] = d.split('-');
    return `${dd}/${mo}/${y}`;
  };

  const fetchSummary = async (dateStr) => {
    setLoading(true); setError(''); setSummary(null);
    try {
      const res = await getKitchenSummary(convertDate(dateStr), password);
      setSummary(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch kitchen summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (kitchenDate && password) {
      fetchSummary(kitchenDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitchenDate, password]);

  const buildKitchenText = () => {
    if (!summary) return '';
    const bread = summary.breadType || summary.metadata?.breadType || currentMetadata?.breadType || 'Roti';
    const total = summary.grandTotals?.[bread] ??
      Object.entries(summary.packetSummary?.Bread || {}).reduce((sum, [size, count]) => sum + (Number(size) * Number(count)), 0);

    const lines = [`🍱 Kitchen Order Summary – ${convertDate(kitchenDate)}`, ''];
    lines.push(`Total ${bread}: ${total || 0}`);
    lines.push(`Total Sabji: ${summary.grandTotals?.Sabji || 0}`);
    lines.push(`Total Dal: ${summary.grandTotals?.Dal || 0}`);
    lines.push(`Total Rice: ${summary.grandTotals?.Rice || 0}`);
    lines.push(`Total Sweet: ${summary.grandTotals?.Sweet || 0}`);
    lines.push(`Total Farsan: ${summary.grandTotals?.Farsan || 0}`);
    lines.push('');
    lines.push(`Total Lunch Tiffins: ${summary.orderCount || 0}`);

    if (summary.choviarGrandTotals && Object.keys(summary.choviarGrandTotals).length > 0) {
      lines.push('');
      lines.push(`🌙 Choviar Order Summary`);
      for (const [item, qty] of Object.entries(summary.choviarGrandTotals)) {
        if (qty > 0) lines.push(`Total ${item}: ${qty}`);
      }
      lines.push('');
      lines.push(`Total Choviar Orders: ${summary.choviarOrderCount || 0}`);
    }

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

  const breadType = summary?.breadType || summary?.metadata?.breadType || currentMetadata?.breadType || 'Roti';
  const breadGrandTotal = summary?.grandTotals?.[breadType] ??
    Object.entries(summary?.packetSummary?.Bread || {}).reduce((sum, [size, count]) => sum + (Number(size) * Number(count)), 0);

  const isChoviarCombo = (name) => {
    const n = (name || '').trim().toLowerCase();
    return n === 'full choviar' || n === 'choviar' || n === 'choviar special' || n === 'family choviar';
  };

  const choviarQtyItemName = summary?.choviarQtyItemName || 
    (currentMenu || []).find(m => m.category === 'Choviar' && !isChoviarCombo(m.name) && m.qty && Number(m.qty) > 0)?.name?.trim() ||
    (currentMenu || []).find(m => m.category === 'Choviar' && m.qty && Number(m.qty) > 0)?.name?.trim();

  const choviarQtyGrandTotal = choviarQtyItemName && (
    summary?.choviarGrandTotals?.[choviarQtyItemName] ??
    Object.entries(summary?.choviarPacketSummary || {}).reduce((sum, [size, count]) => sum + (Number(size) * Number(count)), 0)
  );

  const choviarItemNames = Object.keys(summary?.choviarGrandTotals || {}).sort((a, b) => {
    if (a === choviarQtyItemName) return -1;
    if (b === choviarQtyItemName) return 1;
    return 0;
  });

  const sortedChoviarOrders = [...(summary?.choviarKitchenOrders || [])].sort((a, b) => {
    if ((a.serialNumber || 0) !== (b.serialNumber || 0)) {
      return (a.serialNumber || 0) - (b.serialNumber || 0);
    }
    if (choviarQtyItemName) {
      return (a[choviarQtyItemName] || 0) - (b[choviarQtyItemName] || 0);
    }
    return 0;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-3 print:hidden">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Delivery Date</label>
          <input
            type="date"
            value={kitchenDate}
            onChange={e => setKitchenDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition"
          />
        </div>
        <button
          onClick={() => fetchSummary(kitchenDate)}
          disabled={loading}
          className={`w-full py-3 rounded-xl font-bold text-sm text-white transition
            ${loading ? 'bg-red-300 cursor-not-allowed' : 'bg-jts-red hover:bg-jts-crimson'}`}
        >
          {loading ? 'Loading…' : '🔄 Refresh Kitchen Summary'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 print:hidden">{error}</div>}

      {summary && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-sm">
                🍱 {convertDate(kitchenDate)} {printMode === 'lunch' ? '— Lunch' : printMode === 'choviar' ? '— Choviar' : ''}
              </h3>
              <div className="flex items-center gap-2 print:hidden">
                {summary.orderCount > 0 && (
                  <button
                    onClick={() => setPrintMode('lunch')}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition"
                  >
                    🖨️ Print Lunch
                  </button>
                )}
                {summary.choviarOrderCount > 0 && (
                  <button
                    onClick={() => setPrintMode('choviar')}
                    className="bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition"
                  >
                    🖨️ Print Choviar
                  </button>
                )}
              </div>
            </div>

            {summary.orderCount === 0 && (!summary.choviarOrderCount) ? (
              <p className="text-sm text-gray-400 text-center py-4">No orders for this date</p>
            ) : (
              <div className="flex flex-col gap-10">
                {/* LUNCH SECTION */}
                {summary.orderCount > 0 && (
                  <div className={printMode === 'choviar' ? 'print:hidden' : ''}>
                    <div className="flex items-center justify-between border-b-2 border-gray-200 pb-2 mb-4">
                      <h3 className="text-lg font-black text-gray-800">🍽️ LUNCH ({summary.orderCount})</h3>
                      <button
                        onClick={() => setPrintMode('lunch')}
                        className="print:hidden bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition"
                      >
                        🖨️ Print Lunch
                      </button>
                    </div>
                {/* Grand Totals Grid */}
                <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3 print:hidden">🔢 Grand Totals (Bulk Quantities)</h4>
                <div className="grid grid-cols-3 gap-3 mb-6 print:hidden">
                  {[
                    { label: 'Tiffins', val: summary.grandTotals?.Tiffins },
                    { label: 'Roti', val: summary.grandTotals?.Roti },
                    { label: 'Paratha', val: summary.grandTotals?.Paratha },
                    { label: 'Puri', val: summary.grandTotals?.Puri },
                    { label: 'Sabji', val: summary.grandTotals?.Sabji },
                    { label: 'Dal', val: summary.grandTotals?.Dal },
                    { label: 'Rice', val: summary.grandTotals?.Rice },
                    { label: 'Namkeen', val: summary.grandTotals?.Namkeen },
                    { label: 'Salad', val: summary.grandTotals?.Salad },
                    { label: 'Sweet', val: summary.grandTotals?.Sweet },
                    { label: 'Farsan', val: summary.grandTotals?.Farsan },
                  ].filter(stat => stat.val > 0).map(stat => (
                    <div key={stat.label} className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-2xl font-black text-jts-red mt-1">{stat.val || 0}</p>
                    </div>
                  ))}
                </div>

                {/* Packet Summary */}
                {summary.packetSummary && (
                  <div className="mb-6 print:hidden">
                    <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-4">📦 Packet Breakdown</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Dal/Rice/Sabji Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-center text-sm border-collapse border border-gray-200 bg-white">
                          <thead>
                            <tr className="bg-gray-100 text-gray-700">
                              <th className="border border-gray-200 p-2"></th>
                              <th className="border border-gray-200 p-2">Dal</th>
                              <th className="border border-gray-200 p-2">Rice</th>
                              <th className="border border-gray-200 p-2">Sabji</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-gray-200 font-bold bg-gray-50 p-2 text-left">Half</td>
                              <td className="border border-gray-200 p-2">{summary.packetSummary.Dal?.Half || 0}</td>
                              <td className="border border-gray-200 p-2">{summary.packetSummary.Rice?.Half || 0}</td>
                              <td className="border border-gray-200 p-2">{summary.packetSummary.Sabji?.Half || 0}</td>
                            </tr>
                            <tr>
                              <td className="border border-gray-200 font-bold bg-gray-50 p-2 text-left">Full</td>
                              <td className="border border-gray-200 p-2">{summary.packetSummary.Dal?.Full || 0}</td>
                              <td className="border border-gray-200 p-2">{summary.packetSummary.Rice?.Full || 0}</td>
                              <td className="border border-gray-200 p-2">{summary.packetSummary.Sabji?.Full || 0}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Bread Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-center text-sm border-collapse border border-gray-200 bg-white max-w-[250px]">
                          <thead>
                            <tr className="bg-gray-100 text-gray-700">
                              <th className="border border-gray-200 p-2">Pkt Size</th>
                              <th className="border border-gray-200 p-2">Total Pkts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(summary.packetSummary.Bread || {})
                              .sort((a, b) => Number(a[0]) - Number(b[0]))
                              .map(([breadCount, pktCount], i) => (
                                <tr key={breadCount} className={i % 2 === 1 ? "bg-red-50/50" : ""}>
                                  <td className="border border-gray-200 p-2 text-gray-800">{breadCount} pc pkt</td>
                                  <td className="border border-gray-200 p-2 font-bold">{pktCount}</td>
                                </tr>
                              ))
                            }
                            {Object.keys(summary.packetSummary.Bread || {}).length === 0 && (
                              <tr>
                                <td colSpan={2} className="border border-gray-200 p-4 text-gray-400 italic">No breads</td>
                              </tr>
                            )}
                            <tr className="bg-gray-50 border-t-2 border-gray-300">
                              <td className="border border-gray-200 p-2 text-gray-800 text-left font-bold">Grand Total ({breadType})</td>
                              <td className="border border-gray-200 p-2 font-bold text-jts-red">{breadGrandTotal}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Orders Table */}
                {summary.kitchenOrders && summary.kitchenOrders.length > 0 && (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-xs leading-tight">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-[9px] uppercase tracking-tighter">
                          <th className="py-1.5 px-1 rounded-l-lg font-bold">SR NO</th>
                          <th className="py-1.5 px-1 font-bold">Name</th>
                          <th className="py-1.5 px-1 font-bold">Locality</th>
                          {summary.grandTotals?.Tiffins > 0 && <th className="py-1.5 px-1 text-center font-bold">Tiffins</th>}
                          <th className="py-1.5 px-1 text-center font-bold">{breadType}</th>
                          <th className="py-1.5 px-1 text-center font-bold">Sabji</th>
                          <th className="py-1.5 px-1 text-center font-bold">Dal</th>
                          <th className="py-1.5 px-1 text-center font-bold">Rice</th>
                          {summary.grandTotals?.Namkeen > 0 && <th className="py-1.5 px-1 text-center font-bold">Namkeen</th>}
                          {summary.grandTotals?.Salad > 0 && <th className="py-1.5 px-1 text-center font-bold">Salad</th>}
                          {summary.grandTotals?.Sweet > 0 && <th className="py-1.5 px-1 text-center font-bold">Sweet</th>}
                          {summary.grandTotals?.Farsan > 0 && <th className="py-1.5 px-1 rounded-r-lg text-center font-bold">Farsan</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.kitchenOrders.map((order, i) => (
                          <tr key={order.orderId || i} className={`hover:bg-gray-50 transition ${order.zone === 'outside' ? 'bg-orange-50/50' : ''}`}>
                            <td className="py-2 px-1 font-bold text-gray-800">#{order.serialNumber || '-'}</td>
                            <td className="py-2 px-1 text-gray-800 font-bold whitespace-normal min-w-[100px] leading-snug">
                              {order.name}
                            </td>
                            <td className="py-2 px-1 text-gray-600 text-[10px] whitespace-normal min-w-[80px] leading-snug">{order.locality || '-'}</td>
                            {summary.grandTotals?.Tiffins > 0 && <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.Tiffins || '-'}</td>}
                            <td className="py-2 px-1 text-center text-gray-800 font-bold">{order[breadType] || order.Bread || order.RotiStr || order.Roti || order.Paratha || order.Puri || '-'}</td>
                            <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.SabjiStr || order.Sabji || '-'}</td>
                            <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.DalStr || order.Dal || '-'}</td>
                            <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.RiceStr || order.Rice || '-'}</td>
                            {summary.grandTotals?.Namkeen > 0 && <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.Namkeen || '-'}</td>}
                            {summary.grandTotals?.Salad > 0 && <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.Salad || '-'}</td>}
                            {summary.grandTotals?.Sweet > 0 && <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.Sweet || '-'}</td>}
                            {summary.grandTotals?.Farsan > 0 && <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.Farsan || '-'}</td>}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-300 text-gray-900">
                          <td colSpan={3} className="py-2 px-1 text-left font-black uppercase text-[10px]">
                            TOTAL ({summary.orderCount})
                          </td>
                          {summary.grandTotals?.Tiffins > 0 && (
                            <td className="py-2 px-1 text-center font-black">{summary.grandTotals.Tiffins}</td>
                          )}
                          <td className="py-2 px-1 text-center font-black text-jts-red">{breadGrandTotal}</td>
                          <td className="py-2 px-1 text-center font-black">{summary.grandTotals?.Sabji ?? 0}</td>
                          <td className="py-2 px-1 text-center font-black">{summary.grandTotals?.Dal ?? 0}</td>
                          <td className="py-2 px-1 text-center font-black">{summary.grandTotals?.Rice ?? 0}</td>
                          {summary.grandTotals?.Namkeen > 0 && (
                            <td className="py-2 px-1 text-center font-black">{summary.grandTotals.Namkeen}</td>
                          )}
                          {summary.grandTotals?.Salad > 0 && (
                            <td className="py-2 px-1 text-center font-black">{summary.grandTotals.Salad}</td>
                          )}
                          {summary.grandTotals?.Sweet > 0 && (
                            <td className="py-2 px-1 text-center font-black">{summary.grandTotals.Sweet}</td>
                          )}
                          {summary.grandTotals?.Farsan > 0 && (
                            <td className="py-2 px-1 text-center font-black">{summary.grandTotals.Farsan}</td>
                          )}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                  </div>
                )}

                {/* CHOVIAR SECTION */}
                {summary.choviarOrderCount > 0 && (
                  <div className={printMode === 'lunch' ? 'print:hidden' : ''}>
                    <div className="flex items-center justify-between border-b-2 border-jts-red/20 pb-2 mb-4">
                      <h3 className="text-lg font-black text-jts-red">🌙 CHOVIAR ({summary.choviarOrderCount})</h3>
                      <button
                        onClick={() => setPrintMode('choviar')}
                        className="print:hidden bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition"
                      >
                        🖨️ Print Choviar
                      </button>
                    </div>
                    
                    {/* Choviar Grand Totals Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 print:hidden">
                      {choviarItemNames.map(itemName => (
                        <div key={itemName} className="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
                          <p className="text-xs font-bold text-gray-600 uppercase tracking-tight truncate px-1">{itemName}</p>
                          <p className="text-2xl font-black text-jts-red mt-1">{summary.choviarGrandTotals?.[itemName] || 0}</p>
                        </div>
                      ))}
                    </div>

                    {/* Choviar Packet Breakdown */}
                    {choviarQtyItemName && summary.choviarPacketSummary && (
                      <div className="mb-6 print:hidden">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-4">📦 {choviarQtyItemName} Packet Breakdown</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-center text-sm border-collapse border border-gray-200 bg-white max-w-[250px]">
                            <thead>
                              <tr className="bg-orange-100/60 text-gray-700">
                                <th className="border border-gray-200 p-2">Pkt Size</th>
                                <th className="border border-gray-200 p-2">Total Pkts</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(summary.choviarPacketSummary || {})
                                .sort((a, b) => Number(a[0]) - Number(b[0]))
                                .map(([pcCount, pktCount], i) => (
                                  <tr key={pcCount} className={i % 2 === 1 ? "bg-orange-50/50" : ""}>
                                    <td className="border border-gray-200 p-2 text-gray-800">{pcCount} pc pkt</td>
                                    <td className="border border-gray-200 p-2 font-bold">{pktCount}</td>
                                  </tr>
                                ))
                              }
                              {Object.keys(summary.choviarPacketSummary || {}).length === 0 && (
                                <tr>
                                  <td colSpan={2} className="border border-gray-200 p-4 text-gray-400 italic">No {choviarQtyItemName} packets</td>
                                </tr>
                              )}
                              <tr className="bg-orange-50/60 border-t-2 border-orange-200">
                                <td className="border border-gray-200 p-2 text-gray-800 text-left font-bold">Grand Total ({choviarQtyItemName})</td>
                                <td className="border border-gray-200 p-2 font-bold text-jts-red">{choviarQtyGrandTotal || 0}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Choviar Orders Table */}
                    {sortedChoviarOrders.length > 0 && (
                      <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-xs leading-tight">
                          <thead>
                            <tr className="bg-orange-50/50 text-gray-600 text-[9px] uppercase tracking-tighter">
                              <th className="py-1.5 px-1 rounded-l-lg font-bold">SR NO</th>
                              <th className="py-1.5 px-1 font-bold">Name</th>
                              <th className="py-1.5 px-1 font-bold">Locality</th>
                              {choviarItemNames.map(item => (
                                <th key={item} className="py-1.5 px-1 text-center font-bold">{item}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {sortedChoviarOrders.map((order, i) => (
                              <tr key={order.orderId || i} className={`hover:bg-gray-50 transition ${order.zone === 'outside' ? 'bg-orange-50/50' : ''}`}>
                                <td className="py-2 px-1 font-bold text-gray-800">#{order.serialNumber || '-'}</td>
                                <td className="py-2 px-1 text-gray-800 font-bold whitespace-normal min-w-[100px] leading-snug">
                                  {order.name}
                                </td>
                                <td className="py-2 px-1 text-gray-600 text-[10px] whitespace-normal min-w-[80px] leading-snug">{order.locality || '-'}</td>
                                {choviarItemNames.map(item => (
                                  <td key={item} className="py-2 px-1 text-center text-gray-800 font-bold">{order[item] || '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-orange-100/70 font-bold border-t-2 border-orange-300 text-gray-900">
                              <td colSpan={3} className="py-2 px-1 text-left font-black uppercase text-[10px]">
                                TOTAL ({summary.choviarOrderCount})
                              </td>
                              {choviarItemNames.map(item => (
                                <td key={item} className="py-2 px-1 text-center font-black text-jts-red">
                                  {summary.choviarGrandTotals?.[item] || 0}
                                </td>
                              ))}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {summary.orderCount > 0 && (
            <button
              onClick={handleCopy}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition print:hidden
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
// ─── Manage Users View ────────────────────────────────────────────────────────
function ManageUsersView({ adminPassword }) {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchOrders = async (e) => {
    e.preventDefault();
    if (phone.length !== 10) return setError('Please enter a 10-digit mobile number');
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/manage?phone=${encodeURIComponent(phone)}`, {
        headers: { 'x-admin-password': adminPassword }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(data.orders || []);
      if (data.orders?.length === 0) setError('No upcoming orders found for this number.');
    } catch (err) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order for the customer?')) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/manage/${encodeURIComponent(orderId)}?phone=${encodeURIComponent(phone)}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(orders.filter(o => o.id !== orderId));
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Manage User Orders</h2>
        <form onSubmit={searchOrders} className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit Mobile Number"
            maxLength="10"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-jts-red focus:outline-none"
          />
          <button type="submit" disabled={loading} className="px-6 py-2 bg-jts-navy text-white font-bold rounded-xl hover:bg-opacity-90">
            {loading ? '...' : 'Search'}
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2 font-medium">{error}</p>}
      </div>

      <div className="space-y-3">
        {orders.map(order => (
          <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-gray-800 text-sm mb-1">{order.date}</p>
              <p className="text-xs text-gray-500 font-medium">Order: #{order.id}</p>
              <p className="text-xs text-gray-600 mt-1">{order.itemsSummary}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <p className="font-extrabold text-jts-red">₹{order.grandTotal}</p>
              <button
                onClick={() => handleCancel(order.id)}
                disabled={loading}
                className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100"
              >
                Cancel Order
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────
function BillingTab({ password }) {
  const [monthPickerValue, setMonthPickerValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Hidden references for the shareable bill
  const [shareData, setShareData] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  const [refreshKey, setRefreshKey] = useState(0);
  const [recordAmount, setRecordAmount] = useState('');
  const [recordMethod, setRecordMethod] = useState('Gpay');
  const [recordDate, setRecordDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [isRecording, setIsRecording] = useState(false);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const totalToPay = Number(recordAmount);
    if (isNaN(totalToPay) || totalToPay <= 0) return alert('Enter a valid amount');
    
    setIsRecording(true);
    try {
      let remaining = totalToPay;
      const updates = [];
      const [year, month, day] = recordDate.split('-');
      const formattedDate = `${day}/${month}/${year}`;
      
      const ordersToPay = [...selectedCustomer.unpaidOrders].filter(o => o.outstanding > 0);
      
      for (const order of ordersToPay) {
        if (remaining <= 0) break;
        const applyAmt = Math.min(order.outstanding, remaining);
        remaining -= applyAmt;
        const newPaid = order.paid + applyAmt;
        
        updates.push({
          orderId: order.orderId || order.id,
          paymentReceived: true,
          paymentMethod: recordMethod,
          amountReceived: newPaid,
          paymentDate: formattedDate
        });
      }
      
      if (remaining > 0) {
        if (updates.length > 0) {
           updates[updates.length - 1].amountReceived += remaining;
        } else if (selectedCustomer.unpaidOrders.length > 0) {
           const lastOrder = selectedCustomer.unpaidOrders[selectedCustomer.unpaidOrders.length - 1];
           updates.push({
             orderId: lastOrder.orderId || lastOrder.id,
             paymentReceived: true,
             paymentMethod: recordMethod,
             amountReceived: lastOrder.paid + remaining,
             paymentDate: formattedDate
           });
        }
      }
      
      const res = await fetch('/api/admin/orders/payment/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ updates })
      });
      if (!res.ok) throw new Error('Failed to record payment');
      
      alert('Payment recorded successfully!');
      setRecordAmount('');
      setSelectedCustomer(null);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      alert(err.message || 'Error recording payment');
    } finally {
      setIsRecording(false);
    }
  };

  useEffect(() => {
    const fetchBilling = async () => {
      setLoading(true);
      setError('');
      try {
        const [year, month] = monthPickerValue.split('-');
        const apiMonth = `${month}/${year}`;
        const res = await getAdminOrders({ month: apiMonth }, password);
        
        const orders = res.data.orders || [];
        
        // Aggregate unpaid orders
        const groups = {};
        
        for (const order of orders) {
          if (order.status === 'CANCELLED') continue;
          
          let outstanding = order.grandTotal || 0;
          let paid = 0;

          if (order.paymentReceived) {
            if (order.amountReceived !== undefined && order.amountReceived !== '') {
              const amount = Number(order.amountReceived);
              if (!isNaN(amount)) {
                paid = amount;
                outstanding = outstanding - paid;
              } else {
                outstanding = 0; // Fully paid
              }
            } else {
              outstanding = 0; // Fully paid
            }
          }

          if (outstanding === 0) continue;
          
          const phone = order.phone || 'Unknown';
          if (!groups[phone]) {
            groups[phone] = {
              name: order.name || 'Unknown',
              phone: phone,
              address: order.address || '',
              totalPending: 0,
              unpaidOrders: []
            };
          }
          
          order.outstanding = outstanding;
          order.paid = paid;

          groups[phone].totalPending += outstanding;
          groups[phone].unpaidOrders.push(order);
        }
        const customerList = Object.values(groups).map(cust => {
          cust.unpaidOrders.sort((a, b) => {
            const [d1, m1, y1] = a.date.split('/');
            const [d2, m2, y2] = b.date.split('/');
            return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
          });
          return cust;
        }).filter(cust => cust.totalPending !== 0).sort((a, b) => a.name.localeCompare(b.name));
        setCustomers(customerList);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch billing data.');
      } finally {
        setLoading(false);
      }
    };

    fetchBilling();
  }, [monthPickerValue, password, refreshKey]);

  const handleShare = async (customer) => {
    setShareData(customer);
    // Wait for state to update and component to render
    setTimeout(async () => {
      const nodes = document.querySelectorAll('.bill-capture-node');
      if (nodes.length > 0) {
        try {
          const files = [];
          for (let i = 0; i < nodes.length; i++) {
            const blob = await toBlob(nodes[i], { backgroundColor: '#ffffff', pixelRatio: 2 });
            if (!blob) throw new Error('Failed to create image blob');
            files.push(new File([blob], `Bill_${customer.name}_${monthPickerValue}_Part${i+1}.png`, { type: 'image/png' }));
          }
          
          if (navigator.share && navigator.canShare && navigator.canShare({ files })) {
            await navigator.share({
              files,
              title: `Tiffin Bill - ${customer.name}`,
              text: `Here is your tiffin bill for ${monthPickerValue}. Total pending: ₹${customer.totalPending}/-`,
            });
          } else {
            // Fallback for browsers that don't support file sharing (e.g. desktop)
            files.forEach(f => {
              const url = URL.createObjectURL(f);
              const a = document.createElement('a');
              a.href = url;
              a.download = f.name;
              a.click();
              URL.revokeObjectURL(url);
            });
            alert('Your device does not support direct image sharing. The bill has been downloaded instead.');
          }
        } catch (err) {
          console.error('Error sharing bill:', err);
          alert('Failed to generate or share the bill image.');
        }
      }
      setShareData(null);
    }, 100);
  };

  return (
    <div className="space-y-4">
      {/* Month Filter */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Month</label>
          <input 
            type="month" 
            value={monthPickerValue}
            onChange={(e) => setMonthPickerValue(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition"
          />
        </div>
        <button onClick={() => window.print()} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition text-sm flex items-center gap-2">
          🖨️ Print Report
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 text-center print:hidden">
        <p className="text-sm text-gray-500 font-medium mb-1">Total Outstanding ({monthPickerValue})</p>
        <p className="text-3xl font-black text-jts-red">₹{customers.reduce((sum, c) => sum + c.totalPending, 0).toLocaleString('en-IN')}/-</p>
      </div>

      {loading ? (
        <div className="text-center text-sm text-gray-500 py-6 animate-pulse">Loading billing data...</div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>
      ) : customers.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-6">No pending payments for this month! 🎉</div>
      ) : (
        <div className="space-y-3">
          {customers.map((cust) => (
            <div 
              key={cust.phone} 
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:shadow-md transition"
              onClick={() => setSelectedCustomer(cust)}
            >
              <div>
                <p className="font-bold text-gray-900 text-lg">{cust.name}</p>
                <p className="text-sm text-gray-500">{cust.phone}</p>
                <p className="text-sm font-semibold text-jts-red mt-1">Pending: ₹{cust.totalPending.toLocaleString('en-IN')}/- ({cust.unpaidOrders.length} orders)</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleShare(cust); }}
                className="self-start sm:self-auto bg-green-100 hover:bg-green-200 text-green-800 font-semibold py-2 px-4 rounded-xl text-sm flex items-center gap-2 transition"
              >
                <span>📤 Share Bill</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden Bill Template for capturing */}
      {shareData && (
        <div className="absolute top-[-9999px] left-[-9999px]">
          {Array.from({ length: Math.ceil(shareData.unpaidOrders.length / 12) }).map((_, i) => {
            const pageOrders = shareData.unpaidOrders.slice(i * 12, (i + 1) * 12);
            const isLastPage = i === Math.ceil(shareData.unpaidOrders.length / 12) - 1;
            const totalPages = Math.ceil(shareData.unpaidOrders.length / 12);
            
            return (
              <div key={i} className="bill-capture-node bg-white p-6 w-[450px] border border-gray-100 mb-10">
                <div className="text-center border-b border-gray-200 pb-4 mb-4">
                  <h2 className="text-2xl font-black text-gray-900 uppercase" style={{ fontFamily: "'Oswald', sans-serif" }}>Jain Tiffin Service</h2>
                  <p className="text-sm text-gray-500 mt-1">Monthly Bill - {monthPickerValue} {totalPages > 1 ? `(Part ${i+1}/${totalPages})` : ''}</p>
                </div>
                
                {i === 0 && (
                  <div className="mb-4">
                    <p className="font-bold text-gray-900">{shareData.name}</p>
                    <p className="text-sm text-gray-600">{shareData.phone}</p>
                    <p className="text-sm text-gray-600 mt-1">{shareData.address}</p>
                  </div>
                )}

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-xs font-semibold text-gray-400 uppercase border-b border-gray-100 pb-1">
                    <span>Date & Items</span>
                    <span>Amount</span>
                  </div>
                  {pageOrders.map((order, idx) => (
                    <div key={order.orderId || idx} className="flex justify-between text-sm py-2 border-b border-gray-50 items-start gap-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{order.date}</span>
                        <span className="text-xs text-gray-500 mt-0.5">{order.itemsSummary}</span>
                        {order.paid > 0 && order.outstanding > 0 && <span className="text-[10px] text-orange-600 font-bold mt-0.5">Partial: ₹{order.paid} paid</span>}
                        {order.paid > 0 && order.outstanding < 0 && <span className="text-[10px] text-green-600 font-bold mt-0.5">Excess: ₹{order.paid} paid</span>}
                      </div>
                      <span className="font-bold text-gray-900 shrink-0 mt-0.5">₹{order.outstanding.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>

                {isLastPage && (
                  <div className="flex justify-between items-center bg-gray-50 rounded-xl p-3 border border-gray-100 mt-6">
                    <span className="font-bold text-gray-700 uppercase text-xs">Total Pending</span>
                    <span className="font-black text-jts-red text-xl">₹{shareData.totalPending.toLocaleString('en-IN')}/-</span>
                  </div>
                )}
                
                <div className="text-center mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-400 font-medium">Thank you for ordering with us!</p>
                  <p className="text-[10px] text-gray-400 mt-1">Gpay / PayTM: 87790 84488 (Keyur Shah)</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{selectedCustomer.name}</h3>
                <p className="text-xs text-gray-500">Bill Details for {monthPickerValue}</p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-500">✕</button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4">
              
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <h4 className="font-bold text-blue-900 mb-3 text-sm">Record Payment</h4>
                <form onSubmit={handleRecordPayment} className="space-y-3">
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="Amount" 
                      value={recordAmount}
                      onChange={e => setRecordAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                      required
                    />
                    <select 
                      value={recordMethod} 
                      onChange={e => setRecordMethod(e.target.value)}
                      className="px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm bg-white"
                    >
                      <option value="Gpay">Gpay</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="date" 
                      value={recordDate}
                      onChange={e => setRecordDate(e.target.value)}
                      className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                      required
                    />
                    <button 
                      type="submit" 
                      disabled={isRecording}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm disabled:opacity-50 shrink-0"
                    >
                      {isRecording ? '...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="flex justify-between items-center bg-red-50 rounded-xl p-3 border border-red-100">
                <span className="font-bold text-red-800 text-sm">Total Pending</span>
                <span className="font-black text-jts-red text-xl">₹{selectedCustomer.totalPending.toLocaleString('en-IN')}/-</span>
              </div>

              <div className="space-y-3">
                {selectedCustomer.unpaidOrders.filter(o => o.outstanding !== 0).map((order, idx) => (
                  <div key={order.orderId || idx} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex justify-between items-start mb-2 border-b border-gray-200 pb-2">
                      <span className="font-bold text-gray-800">{order.date}</span>
                      <span className="font-bold text-jts-red">₹{order.outstanding.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{order.itemsSummary}</p>
                    {order.paid > 0 && order.outstanding > 0 && <p className="text-xs text-orange-600 font-bold mt-1 pt-1 border-t border-gray-100 border-dashed">Partial Payment: ₹{order.paid} received</p>}
                    {order.paid > 0 && order.outstanding < 0 && <p className="text-xs text-green-600 font-bold mt-1 pt-1 border-t border-gray-100 border-dashed">Excess Payment: ₹{order.paid} received</p>}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 shrink-0">
              <button 
                onClick={() => { setSelectedCustomer(null); handleShare(selectedCustomer); }}
                className="w-full py-3 bg-green-100 hover:bg-green-200 text-green-800 font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                📤 Share Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 5: Settings ───────────────────────────────────────────────────────────
function SettingsTab({ password, currentMetadata, onMetadataSaved }) {
  const [metadata, setMetadata] = useState({
    lunchCutoff: '05:00',
    choviarCutoff: '11:00',
    betaTesting: 'No',
    namkeenAvailable: 'No',
    saladAvailable: 'No',
    tiffinMatrix: {
      "Mini Lunch": { Roti: 3, Paratha: 3, Puri: 3, Namkeen: 1, Salad: 1, Farsan: 1, Sweet: 1, Sabji: 0.5, Dal: 0.5, Rice: 0.5 },
      "Brunch": { Roti: 6, Paratha: 4, Puri: 6, Namkeen: 1, Salad: 1, Farsan: 1, Sweet: 1, Sabji: 1, Dal: 0.5, Rice: 0.5 },
      "Full Lunch": { Roti: 6, Paratha: 4, Puri: 6, Namkeen: 1, Salad: 1, Farsan: 1, Sweet: 1, Sabji: 1, Dal: 1, Rice: 1 },
      "Family Meal": { Roti: 9, Paratha: 6, Puri: 9, Namkeen: 2, Salad: 2, Farsan: 2, Sweet: 2, Sabji: 1.5, Dal: 1.5, Rice: 1.5 }
    },
    ...currentMetadata
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (currentMetadata && Object.keys(currentMetadata).length > 0) {
      setMetadata(prev => ({ ...prev, ...currentMetadata }));
    }
  }, [currentMetadata]);

  const updateMeta = (field, value) => setMetadata(prev => ({ ...prev, [field]: value }));
  const updateMatrix = (tiffin, field, value) => {
    setMetadata(prev => ({
      ...prev,
      tiffinMatrix: {
        ...prev.tiffinMatrix,
        [tiffin]: { ...prev.tiffinMatrix[tiffin], [field]: parseFloat(value) || 0 }
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      // Just update metadata. We need to preserve currentMenu.
      const menuRes = await fetch('/api/menu');
      const menuData = await menuRes.json();
      const currentItems = menuData.menu || [];
      await updateAdminMenu({ items: currentItems, metadata }, password);
      setMsg('✅ Settings saved successfully!');
      if (onMetadataSaved) onMetadataSaved(metadata);
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Failed to save settings.'));
      setTimeout(() => setMsg(''), 4000);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Cutoff Times */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-4">
        <h3 className="text-sm font-bold text-gray-800 border-b pb-2">Cutoff Times (24hr format)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Lunch Cutoff Time</label>
            <div className="flex gap-2">
              <input type="time" value={metadata.lunchCutoff || '05:00'} onChange={e => updateMeta('lunchCutoff', e.target.value)} className="w-1/2 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
              <select value={metadata.lunchCutoffDay || 'Same Day'} onChange={e => updateMeta('lunchCutoffDay', e.target.value)} className="w-1/2 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none">
                <option value="Same Day">Same Day</option>
                <option value="Previous Day">Previous Day</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Choviar Cutoff Time</label>
            <div className="flex gap-2">
              <input type="time" value={metadata.choviarCutoff || '11:00'} onChange={e => updateMeta('choviarCutoff', e.target.value)} className="w-1/2 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
              <select value={metadata.choviarCutoffDay || 'Same Day'} onChange={e => updateMeta('choviarCutoffDay', e.target.value)} className="w-1/2 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none">
                <option value="Same Day">Same Day</option>
                <option value="Previous Day">Previous Day</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Settings */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-4">
        <h3 className="text-sm font-bold text-gray-800 border-b pb-2">Pricing Settings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Roti Price</label>
            <input type="number" value={metadata.rotiPrice || ''} onChange={e => updateMeta('rotiPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Sabji (Half)</label>
            <input type="number" value={metadata.sabjiHalfPrice || ''} onChange={e => updateMeta('sabjiHalfPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Sabji (Full)</label>
            <input type="number" value={metadata.sabjiFullPrice || ''} onChange={e => updateMeta('sabjiFullPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Dal (Half)</label>
            <input type="number" value={metadata.dalHalfPrice || ''} onChange={e => updateMeta('dalHalfPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Dal (Full)</label>
            <input type="number" value={metadata.dalFullPrice || ''} onChange={e => updateMeta('dalFullPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Rice (Half)</label>
            <input type="number" value={metadata.riceHalfPrice || ''} onChange={e => updateMeta('riceHalfPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Rice (Full)</label>
            <input type="number" value={metadata.riceFullPrice || ''} onChange={e => updateMeta('riceFullPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
        </div>
        
        {/* Testing Mode */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-blue-900">Beta Testing Mode</p>
            <p className="text-[10px] font-medium text-blue-700">Disables all timing restrictions for ordering</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div className={`w-12 h-6 rounded-full flex items-center transition-colors ${metadata.betaTesting === 'Yes' ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${metadata.betaTesting === 'Yes' ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            <input type="checkbox" className="hidden" checked={metadata.betaTesting === 'Yes'} onChange={e => updateMeta('betaTesting', e.target.checked ? 'Yes' : 'No')} />
          </label>
        </div>
      </div>

      {/* Tiffin Matrix */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-4">
        <h3 className="text-sm font-bold text-gray-800 border-b pb-2">Tiffin Quantities Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-[10px] sm:text-xs min-w-[500px]">
            <thead>
              <tr className="bg-gray-100 text-gray-500 uppercase tracking-wide">
                <th className="p-2 text-left">Tiffin</th>
                <th className="p-2">Roti</th>
                <th className="p-2">Paratha</th>
                <th className="p-2">Puri</th>
                <th className="p-2">Namkeen</th>
                <th className="p-2">Salad</th>
                <th className="p-2">Farsan</th>
                <th className="p-2">Sweet</th>
                <th className="p-2">Sabji</th>
                <th className="p-2">Dal</th>
                <th className="p-2">Rice</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(metadata.tiffinMatrix || {}).map(tiffin => (
                <tr key={tiffin} className="border-t border-gray-100">
                  <td className="p-2 text-left font-bold text-gray-700">{tiffin}</td>
                  {['Roti', 'Paratha', 'Puri', 'Namkeen', 'Salad', 'Farsan', 'Sweet', 'Sabji', 'Dal', 'Rice'].map(field => (
                    <td key={field} className="p-1">
                      <input type="number" min="0" step="0.5" value={metadata.tiffinMatrix[tiffin][field] || 0} onChange={e => updateMatrix(tiffin, field, e.target.value)} className="w-full min-w-[50px] text-center border border-gray-200 rounded px-1 py-1 focus:ring-1 focus:ring-jts-red" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button */}
      {msg && <div className={`p-3 rounded-lg text-sm font-bold shadow-sm ${msg.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
      <button onClick={handleSave} disabled={saving} className={`w-full py-3.5 rounded-xl font-black text-white text-sm tracking-wide transition shadow-sm ${saving ? 'bg-red-300 cursor-not-allowed' : 'bg-jts-red hover:bg-jts-crimson'}`}>
        {saving ? 'SAVING...' : '💾 SAVE SETTINGS'}
      </button>
    </div>
  );
}

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
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto hide-scrollbar">
          <TabBtn active={activeTab === 'menu'}    onClick={() => setActiveTab('menu')}>🍽️ Tomorrow's Menu</TabBtn>
          <TabBtn active={activeTab === 'orders'}  onClick={() => setActiveTab('orders')}>📋 Orders</TabBtn>
          <TabBtn active={activeTab === 'kitchen'} onClick={() => setActiveTab('kitchen')}>👨‍🍳 Kitchen</TabBtn>
          <TabBtn active={activeTab === 'billing'} onClick={() => setActiveTab('billing')}>💰 Billing</TabBtn>
          <TabBtn active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>⚙️ Settings</TabBtn>
        </div>
      </div>

      {/* Tab content */}
      <main className="max-w-2xl mx-auto px-4 py-3">
        {activeTab === 'menu'    && <MenuTab    password={adminPassword} currentMenu={currentMenu} currentMetadata={currentMetadata} onMenuSaved={(savedItems, savedMeta) => { setCurrentMenu(savedItems); setCurrentMetadata(savedMeta); }} />}
        {activeTab === 'orders'  && <OrdersTab  password={adminPassword} currentMetadata={currentMetadata} currentMenu={currentMenu} />}
        {activeTab === 'kitchen' && <KitchenTab password={adminPassword} currentMetadata={currentMetadata} currentMenu={currentMenu} />}
        {activeTab === 'billing' && <BillingTab password={adminPassword} />}
        {activeTab === 'settings' && <SettingsTab password={adminPassword} currentMetadata={currentMetadata} onMetadataSaved={(savedMeta) => setCurrentMetadata(savedMeta)} />}
        {activeTab === 'manage' && (
          <ManageUsersView adminPassword={adminPassword} />
        )}
      </main>
    </div>
  );
}
