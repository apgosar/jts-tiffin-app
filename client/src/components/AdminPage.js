import React, { useState, useEffect, useCallback, useRef } from 'react';
import JtsLogo from './JtsLogo';
import { getAdminOrders, updateAdminMenu, getKitchenSummary, updateAdminDeliveryBatch } from '../services/api';
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
    rotiPrice: '8', riceHalfPrice: '15', riceFullPrice: '30',
    sabjiHalfPrice: '25', sabjiFullPrice: '50',
    dalHalfPrice: '25', dalFullPrice: '50',
    farsanPrice: '0', farsanAvailable: 'No',
    sweetPrice: '0', sweetAvailable: 'No',
    namkeenAvailable: 'No', saladAvailable: 'No',
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

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const updateLunchDescriptions = (meta) => {
    const addons = [];
    if (meta.saladAvailable === 'Yes') addons.push('Salad');
    if (meta.sweetAvailable === 'Yes') addons.push('Sweet');
    if (meta.namkeenAvailable === 'Yes') addons.push('Namkeen');
    if (meta.farsanAvailable === 'Yes') addons.push('Farsan');
    const suffix = addons.length > 0 ? ', ' + addons.join(' / ') : '';

    setItems(prevItems => prevItems.map(item => {
      if (item.category !== 'Lunch') return item;
      
      let base = '';
      if (item.name === 'Mini Lunch') base = '3 Roti, 1/2 Sabji, 1/2 Dal, 1/2 Rice';
      else if (item.name === 'Brunch') base = '6 Roti, Sabji, 1/2 Dal, 1/2 Rice';
      else if (item.name === 'Full Lunch') base = '6 Roti, Sabji, Dal, Rice';
      else if (item.name === 'Family Meal') base = '9 Roti, 1.5 Sabji, 1.5 Dal, 1.5 Rice';
      else return item;
      
      return { ...item, description: base + suffix };
    }));
  };

  const updateMeta = (field, value) => {
    setMetadata(prev => {
      const next = { ...prev, [field]: value };
      if (['farsanAvailable', 'sweetAvailable', 'namkeenAvailable', 'saladAvailable'].includes(field)) {
        updateLunchDescriptions(next);
      }
      return next;
    });
  };

  const loadPresets = () => {
    const addons = [];
    if (metadata.saladAvailable === 'Yes') addons.push('Salad');
    if (metadata.sweetAvailable === 'Yes') addons.push('Sweet');
    if (metadata.namkeenAvailable === 'Yes') addons.push('Namkeen');
    if (metadata.farsanAvailable === 'Yes') addons.push('Farsan');
    const suffix = addons.length > 0 ? ', ' + addons.join(' / ') : '';

    setItems([
      { name: 'Mini Lunch',  description: `3 Roti, 1/2 Sabji, 1/2 Dal, 1/2 Rice${suffix}`, price: 140, available: true, category: 'Lunch' },
      { name: 'Brunch',      description: `6 Roti, Sabji, 1/2 Dal, 1/2 Rice${suffix}`, price: 180, available: true, category: 'Lunch' },
      { name: 'Full Lunch',  description: `6 Roti, Sabji, Dal, Rice${suffix}`, price: 220, available: true, category: 'Lunch' },
      { name: 'Family Meal', description: `9 Roti, 1.5 Sabji, 1.5 Dal, 1.5 Rice${suffix}`, price: 320, available: true, category: 'Lunch' },
      { name: 'Choviar Special', description: 'Ragdo, 4 Kelawada, Dal Khichdi', price: 160, available: true, category: 'Choviar' },
    ]);
  };

  const addLunchItem = () => {
    setItems(prev => [...prev, { name: '', description: '', price: 0, available: true, category: 'Lunch' }]);
  };

  const addChoviarItem = () => {
    setItems(prev => [...prev, { name: '', description: '', price: 0, available: true, category: 'Choviar', qty: '' }]);
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
      // Notify parent so currentMenu stays in sync — prevents qty/fields resetting on tab switch
      if (onMenuSaved) onMenuSaved(items, metadata);
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
        
        {/* Roti */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Roti Price</label>
          <input type="number" value={metadata.rotiPrice || ''} onChange={e => updateMeta('rotiPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
        </div>

        {/* Rice */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Rice Name</label>
          <input type="text" value={metadata.rice || ''} onChange={e => updateMeta('rice', e.target.value)} placeholder="e.g. Jeera Rice" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Half Price</label>
              <input type="number" value={metadata.riceHalfPrice || ''} onChange={e => updateMeta('riceHalfPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Full Price</label>
              <input type="number" value={metadata.riceFullPrice || ''} onChange={e => updateMeta('riceFullPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Sabji */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Sabji Name</label>
          <input type="text" value={metadata.sabji || ''} onChange={e => updateMeta('sabji', e.target.value)} placeholder="e.g. Bhindi" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Half Price</label>
              <input type="number" value={metadata.sabjiHalfPrice || ''} onChange={e => updateMeta('sabjiHalfPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Full Price</label>
              <input type="number" value={metadata.sabjiFullPrice || ''} onChange={e => updateMeta('sabjiFullPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Dal */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Dal Name</label>
          <input type="text" value={metadata.dal || ''} onChange={e => updateMeta('dal', e.target.value)} placeholder="e.g. Gujarati Dal" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Half Price</label>
              <input type="number" value={metadata.dalHalfPrice || ''} onChange={e => updateMeta('dalHalfPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Full Price</label>
              <input type="number" value={metadata.dalFullPrice || ''} onChange={e => updateMeta('dalFullPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            </div>
          </div>
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

        {/* Testing Mode */}
        <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
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

      {/* Choviar Details Section */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-sm font-bold text-gray-800">Choviar Details</h3>
          <button onClick={addChoviarItem} className="text-xs font-bold text-white bg-jts-red hover:bg-jts-crimson px-2 py-1 rounded-lg shadow-sm transition">+ Add Item</button>
        </div>
        
        {items.filter(i => i.category === 'Choviar').length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_60px_80px_40px_30px] gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide px-1">
              <span>Item Name</span>
              <span className="text-center">Qty/Order</span>
              <span>Price (₹)</span>
              <span>Avail</span>
              <span></span>
            </div>
            {items.map((item, idx) => {
              if (item.category !== 'Choviar') return null;
              return (
                <div key={idx} className="grid grid-cols-[1fr_60px_80px_40px_30px] gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
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
                  <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 font-bold flex items-center justify-center">✕</button>
                </div>
              );
            })}
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
        const lunchOrders = orders.filter(o => o.items.some(i => i.category !== 'Choviar'));
        const choviarOrders = orders.filter(o => o.items.every(i => i.category === 'Choviar'));
        
        const sortByRoute = (a, b) => {
          const rA = parseInt(assignments[a.orderId]?.routeOrder, 10) || 9999;
          const rB = parseInt(assignments[b.orderId]?.routeOrder, 10) || 9999;
          if (rA !== rB) return rA - rB;
          // At equal sequence, show outside orders first
          const aOut = a.zone === 'outside' ? 0 : 1;
          const bOut = b.zone === 'outside' ? 0 : 1;
          return aOut - bOut;
        };

        // Sort each group: outside orders first (among those with no seq), then by routeOrder
        const sortGroupWithOutsideFirst = (list) => {
          const assigned = list.filter(o => assignments[o.orderId]?.routeOrder && assignments[o.orderId]?.routeOrder !== 9999);
          const unassigned = list.filter(o => !assignments[o.orderId]?.routeOrder || assignments[o.orderId]?.routeOrder === 9999);
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
                            type="number"
                            min="1"
                            value={assignments[order.orderId]?.routeOrder || ''}
                            onChange={e => handleUpdateAssignment(order.orderId, 'routeOrder', e.target.value)}
                            className="w-12 px-1 py-1 text-center border border-gray-300 focus:outline-none focus:border-jts-red font-semibold text-sm rounded-none"
                          />
                        </td>
                        <td className="border-r border-gray-300 px-2 py-1 align-middle cursor-pointer" onClick={() => setModalOrder(order)}>
                          <div className="font-bold text-gray-900 flex items-center gap-1.5">
                            {order.name}
                            {order.zone === 'outside' && <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-bold uppercase tracking-widest border border-amber-200">Out</span>}
                          </div>
                          <div className="text-xs text-gray-500">{order.phone}</div>
                        </td>
                        <td className="border-r border-gray-300 px-2 py-1 text-center align-middle font-bold text-gray-800">
                          {order.grandTotal}
                        </td>
                        <td className="border-r border-gray-300 px-2 py-1 align-middle text-xs text-gray-700 leading-snug break-words">
                          {order.address}
                        </td>
                        <td className="px-1 py-1 text-center align-middle">
                          <div className="flex flex-col gap-1 pl-1">
                            {['Dabbawala', 'Sagar', 'Dalpat'].map(driver => (
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
function KitchenTab({ password }) {
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
    const lines = [`🍱 Kitchen Order Summary – ${convertDate(kitchenDate)}`, ''];
    lines.push(`Total Roti: ${summary.grandTotals?.Roti || 0}`);
    lines.push(`Total Sabji: ${summary.grandTotals?.Sabji || 0}`);
    lines.push(`Total Dal: ${summary.grandTotals?.Dal || 0}`);
    lines.push(`Total Rice: ${summary.grandTotals?.Rice || 0}`);
    lines.push(`Total Sweet: ${summary.grandTotals?.Sweet || 0}`);
    lines.push(`Total Farsan: ${summary.grandTotals?.Farsan || 0}`);
    lines.push('');
    lines.push(`Total Tiffins: ${summary.orderCount}`);
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
            onChange={e => setKitchenDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition"
          />
        </div>
        <button
          onClick={() => fetchSummary(kitchenDate)}
          disabled={loading}
          className={`w-full py-3 rounded-xl font-bold text-sm text-white transition print-hide
            ${loading ? 'bg-red-300 cursor-not-allowed' : 'bg-jts-red hover:bg-jts-crimson'}`}
        >
          {loading ? 'Loading…' : '🔄 Refresh Kitchen Summary'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 print-hide">{error}</div>}

      {summary && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-sm">
                🍱 {convertDate(kitchenDate)}
              </h3>
              <button
                onClick={() => window.print()}
                className="print-hide bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition"
              >
                🖨️ Print
              </button>
            </div>

            {summary.orderCount === 0 && (!summary.choviarOrderCount) ? (
              <p className="text-sm text-gray-400 text-center py-4">No orders for this date</p>
            ) : (
              <div className="flex flex-col gap-10">
                {/* LUNCH SECTION */}
                {summary.orderCount > 0 && (
                  <div>
                    <h3 className="text-lg font-black text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">🍽️ LUNCH ({summary.orderCount})</h3>
                {/* Grand Totals Grid */}
                <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">🔢 Grand Totals (Bulk Quantities)</h4>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: 'Roti', val: summary.grandTotals?.Roti },
                    { label: 'Sabji', val: summary.grandTotals?.Sabji },
                    { label: 'Dal', val: summary.grandTotals?.Dal },
                    { label: 'Rice', val: summary.grandTotals?.Rice },
                    { label: 'Sweet', val: summary.grandTotals?.Sweet },
                    { label: 'Farsan', val: summary.grandTotals?.Farsan },
                  ].filter(stat => (stat.label !== 'Sweet' && stat.label !== 'Farsan') || stat.val > 0).map(stat => (
                    <div key={stat.label} className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-2xl font-black text-jts-red mt-1">{stat.val || 0}</p>
                    </div>
                  ))}
                </div>

                {/* Packet Summary */}
                {summary.packetSummary && (
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-4">📦 Packet Breakdown</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Dal/Rice/Sabji Table */}
                      <div>
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

                      {/* Roti Table */}
                      <div>
                        <table className="w-full text-center text-sm border-collapse border border-gray-200 bg-white max-w-[250px]">
                          <thead>
                            <tr className="bg-gray-100 text-gray-700">
                              <th className="border border-gray-200 p-2">Roti</th>
                              <th className="border border-gray-200 p-2">Pkt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(summary.packetSummary.Roti || {})
                              .sort((a, b) => Number(a[0]) - Number(b[0]))
                              .map(([rotiCount, pktCount], i) => (
                                <tr key={rotiCount} className={i % 2 === 1 ? "bg-red-50/50" : ""}>
                                  <td className="border border-gray-200 p-2 text-gray-800">{rotiCount}</td>
                                  <td className="border border-gray-200 p-2 font-bold">{pktCount}</td>
                                </tr>
                              ))
                            }
                            {Object.keys(summary.packetSummary.Roti || {}).length === 0 && (
                              <tr>
                                <td colSpan={2} className="border border-gray-200 p-4 text-gray-400 italic">No rotis</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Orders Table */}
                {summary.kitchenOrders && summary.kitchenOrders.length > 0 && (
                  <div className="w-full">
                    <table className="w-full text-left text-xs leading-tight">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-[9px] uppercase tracking-tighter">
                          <th className="py-1.5 px-1 rounded-l-lg font-bold">Seq</th>
                          <th className="py-1.5 px-1 font-bold">Driver</th>
                          <th className="py-1.5 px-1 font-bold">Name</th>
                          <th className="py-1.5 px-1 font-bold">Locality</th>
                          <th className="py-1.5 px-1 text-center font-bold">Roti</th>
                          <th className="py-1.5 px-1 text-center font-bold">Sabji</th>
                          <th className="py-1.5 px-1 text-center font-bold">Dal</th>
                          <th className="py-1.5 px-1 text-center font-bold">Rice</th>
                          {summary.grandTotals?.Sweet > 0 && <th className="py-1.5 px-1 text-center font-bold">Sweet</th>}
                          {summary.grandTotals?.Farsan > 0 && <th className="py-1.5 px-1 rounded-r-lg text-center font-bold">Farsan</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.kitchenOrders.map((order, i) => (
                          <tr key={order.orderId || i} className={`hover:bg-gray-50 transition ${order.zone === 'outside' ? 'bg-orange-50/50' : ''}`}>
                            <td className="py-2 px-1 font-bold text-gray-800">#{order.routeOrder === 9999 ? '-' : order.routeOrder}</td>
                            <td className="py-2 px-1 text-gray-600 font-medium truncate max-w-[60px]">{order.deliveryPerson}</td>
                            <td className="py-2 px-1 text-gray-800 font-bold whitespace-normal min-w-[100px] leading-snug">
                              {order.name}
                              {order.zone === 'outside' && <span className="ml-1 inline-block px-1 py-0.5 bg-orange-200 text-orange-900 text-[9px] font-black rounded">O</span>}
                            </td>
                            <td className="py-2 px-1 text-gray-600 text-[10px] whitespace-normal min-w-[80px] leading-snug">{order.locality || '-'}</td>
                            <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.Roti || '-'}</td>
                            <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.Sabji || '-'}</td>
                            <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.Dal || '-'}</td>
                            <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.Rice || '-'}</td>
                            {summary.grandTotals?.Sweet > 0 && <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.Sweet || '-'}</td>}
                            {summary.grandTotals?.Farsan > 0 && <td className="py-2 px-1 text-center text-gray-800 font-bold">{order.Farsan || '-'}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                  </div>
                )}

                {/* CHOVIAR SECTION */}
                {summary.choviarOrderCount > 0 && (
                  <div>
                    <h3 className="text-lg font-black text-jts-red border-b-2 border-jts-red/20 pb-2 mb-4">🌙 CHOVIAR ({summary.choviarOrderCount})</h3>
                    
                    {/* Choviar Grand Totals Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      {Object.entries(summary.choviarGrandTotals || {}).map(([itemName, count]) => (
                        <div key={itemName} className="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
                          <p className="text-xs font-bold text-gray-600 uppercase tracking-tight truncate px-1">{itemName}</p>
                          <p className="text-2xl font-black text-jts-red mt-1">{count}</p>
                        </div>
                      ))}
                    </div>

                    {/* Choviar Orders Table */}
                    {summary.choviarKitchenOrders && summary.choviarKitchenOrders.length > 0 && (
                      <div className="w-full">
                        <table className="w-full text-left text-xs leading-tight">
                          <thead>
                            <tr className="bg-orange-50/50 text-gray-600 text-[9px] uppercase tracking-tighter">
                              <th className="py-1.5 px-1 rounded-l-lg font-bold">Seq</th>
                              <th className="py-1.5 px-1 font-bold">Driver</th>
                              <th className="py-1.5 px-1 font-bold">Name</th>
                              <th className="py-1.5 px-1 font-bold">Locality</th>
                              {Object.keys(summary.choviarGrandTotals || {}).map(item => (
                                <th key={item} className="py-1.5 px-1 text-center font-bold">{item}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {summary.choviarKitchenOrders.map((order, i) => (
                              <tr key={order.orderId || i} className={`hover:bg-gray-50 transition ${order.zone === 'outside' ? 'bg-orange-50/50' : ''}`}>
                                <td className="py-2 px-1 font-bold text-gray-800">#{order.routeOrder === 9999 ? '-' : order.routeOrder}</td>
                                <td className="py-2 px-1 text-gray-600 font-medium truncate max-w-[60px]">{order.deliveryPerson}</td>
                                <td className="py-2 px-1 text-gray-800 font-bold whitespace-normal min-w-[100px] leading-snug">
                                  {order.name}
                                  {order.zone === 'outside' && <span className="ml-1 inline-block px-1 py-0.5 bg-orange-200 text-orange-900 text-[9px] font-black rounded">O</span>}
                                </td>
                                <td className="py-2 px-1 text-gray-600 text-[10px] whitespace-normal min-w-[80px] leading-snug">{order.locality || '-'}</td>
                                {Object.keys(summary.choviarGrandTotals || {}).map(item => (
                                  <td key={item} className="py-2 px-1 text-center text-gray-800 font-bold">{order[item] || '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
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

  useEffect(() => {
    fetchBilling();
  }, [monthPickerValue]);

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
        if (order.paymentReceived) continue;
        
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
        
        groups[phone].totalPending += order.grandTotal;
        groups[phone].unpaidOrders.push(order);
      }
      
      const customerList = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(customerList);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch billing data.');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Month</label>
        <input 
          type="month" 
          value={monthPickerValue}
          onChange={(e) => setMonthPickerValue(e.target.value)}
          className="w-full sm:w-auto px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition"
        />
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
                      </div>
                      <span className="font-bold text-gray-900 shrink-0 mt-0.5">₹{order.grandTotal.toLocaleString('en-IN')}</span>
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
              <div className="flex justify-between items-center bg-red-50 rounded-xl p-3 border border-red-100">
                <span className="font-bold text-red-800 text-sm">Total Pending</span>
                <span className="font-black text-jts-red text-xl">₹{selectedCustomer.totalPending.toLocaleString('en-IN')}/-</span>
              </div>

              <div className="space-y-3">
                {selectedCustomer.unpaidOrders.map((order, idx) => (
                  <div key={order.orderId || idx} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex justify-between items-start mb-2 border-b border-gray-200 pb-2">
                      <span className="font-bold text-gray-800">{order.date}</span>
                      <span className="font-bold text-jts-red">₹{order.grandTotal.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{order.itemsSummary}</p>
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
          <TabBtn active={activeTab === 'billing'} onClick={() => setActiveTab('billing')}>💰 Billing</TabBtn>
        </div>
      </div>

      {/* Tab content */}
      <main className="max-w-2xl mx-auto px-4 py-3">
        {activeTab === 'menu'    && <MenuTab    password={adminPassword} currentMenu={currentMenu} currentMetadata={currentMetadata} onMenuSaved={(savedItems, savedMeta) => { setCurrentMenu(savedItems); setCurrentMetadata(savedMeta); }} />}
        {activeTab === 'orders'  && <OrdersTab  password={adminPassword} />}
        {activeTab === 'kitchen' && <KitchenTab password={adminPassword} />}
        {activeTab === 'billing' && <BillingTab password={adminPassword} />}
        {activeTab === 'manage' && (
          <ManageUsersView adminPassword={adminPassword} />
        )}
      </main>
    </div>
  );
}
