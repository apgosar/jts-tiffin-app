import React, { useState, useEffect, useCallback } from 'react';
import JtsLogo from './JtsLogo';
import { getAdminOrders, updateAdminMenu, getKitchenSummary, updateAdminDeliveryBatch } from '../services/api';

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
  { name: 'Family Meal',  description: '9 Roti, 1.5 Sabji, 1.5 Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 320, available: true, category: 'Lunch' },
  { name: 'Choviar Special', description: 'Ragdo, 4 Kelawada, Dal Khichdi', price: 160, available: true, category: 'Choviar' },
];

function MenuTab({ password, currentMenu, currentMetadata }) {
  const [items, setItems]       = useState(currentMenu.length > 0 ? currentMenu : TIFFIN_DEFAULTS);
  const [metadata, setMetadata] = useState({
    sabji: '', sweet: '', dal: '', farsan: '',
    rotiPrice: '8', ricePrice: '30',
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
        { name: 'Mini Lunch',  description: '3 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 140, available: true, category: 'Lunch' },
        { name: 'Brunch',      description: '6 Roti, Sabji, 1/2 Dal, 1/2 Rice, Salad / Sweet / Namkeen / Farsan', price: 180, available: true, category: 'Lunch' },
        { name: 'Full Lunch',  description: '6 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 220, available: true, category: 'Lunch' },
        { name: 'Family Meal', description: '9 Roti, 1.5 Sabji, 1.5 Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 320, available: true, category: 'Lunch' },
        { name: 'Choviar Special', description: 'Ragdo, 4 Kelawada, Dal Khichdi', price: 160, available: true, category: 'Choviar' },
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
      if (item.name === 'Mini Lunch') base = '3 Roti, Sabji, Dal, Rice';
      else if (item.name === 'Brunch') base = '6 Roti, Sabji, 1/2 Dal, 1/2 Rice';
      else if (item.name === 'Full Lunch') base = '6 Roti, Sabji, Dal, Rice';
      else if (item.name === 'Family Meal') base = '9 Roti, 1.5 Sabji, 1.5 Dal, Rice';
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
      { name: 'Mini Lunch',  description: `3 Roti, Sabji, Dal, Rice${suffix}`, price: 140, available: true, category: 'Lunch' },
      { name: 'Brunch',      description: `6 Roti, Sabji, 1/2 Dal, 1/2 Rice${suffix}`, price: 180, available: true, category: 'Lunch' },
      { name: 'Full Lunch',  description: `6 Roti, Sabji, Dal, Rice${suffix}`, price: 220, available: true, category: 'Lunch' },
      { name: 'Family Meal', description: `9 Roti, 1.5 Sabji, 1.5 Dal, Rice${suffix}`, price: 320, available: true, category: 'Lunch' },
      { name: 'Choviar Special', description: 'Ragdo, 4 Kelawada, Dal Khichdi', price: 160, available: true, category: 'Choviar' },
    ]);
  };

  const addLunchItem = () => {
    setItems(prev => [...prev, { name: '', description: '', price: 0, available: true, category: 'Lunch' }]);
  };

  const addChoviarItem = () => {
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
        
        {/* Roti & Rice */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Roti Price</label>
            <input type="number" value={metadata.rotiPrice || ''} onChange={e => updateMeta('rotiPrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Rice Price (Standard)</label>
            <input type="number" value={metadata.ricePrice || ''} onChange={e => updateMeta('ricePrice', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
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
          <div className="flex gap-2 items-center">
            <input type="text" value={metadata.farsan || ''} onChange={e => updateMeta('farsan', e.target.value)} placeholder="e.g. Dhokla" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            <input type="number" value={metadata.farsanPrice || ''} onChange={e => updateMeta('farsanPrice', e.target.value)} placeholder="₹" className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            <label className="flex items-center gap-1 cursor-pointer text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1.5 rounded-lg border border-gray-200">
              <input type="checkbox" checked={metadata.farsanAvailable === 'Yes'} onChange={e => updateMeta('farsanAvailable', e.target.checked ? 'Yes' : 'No')} className="w-4 h-4 text-jts-red" />
              On
            </label>
          </div>
        </div>

        {/* Sweet */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Sweet</label>
          <div className="flex gap-2 items-center">
            <input type="text" value={metadata.sweet || ''} onChange={e => updateMeta('sweet', e.target.value)} placeholder="e.g. Aamras" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            <input type="number" value={metadata.sweetPrice || ''} onChange={e => updateMeta('sweetPrice', e.target.value)} placeholder="₹" className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none" />
            <label className="flex items-center gap-1 cursor-pointer text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1.5 rounded-lg border border-gray-200">
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
            <div className="grid grid-cols-[1fr_80px_40px_30px] gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide px-1">
              <span>Item Name</span>
              <span>Price (₹)</span>
              <span>Avail</span>
              <span></span>
            </div>
            {items.map((item, idx) => {
              if (item.category !== 'Choviar') return null;
              return (
                <div key={idx} className="grid grid-cols-[1fr_80px_40px_30px] gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <input type="text" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-jts-red bg-white" placeholder="Name" />
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

  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [filterMonth, setFilterMonth] = useState(defaultMonth);
  const [filterDate, setFilterDate]   = useState('');
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
        initial[o.orderId] = { deliveryPerson: o.deliveryPerson || '', routeOrder: o.routeOrder || '' };
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
          return rA - rB;
        };

        const sortedLunch = [...lunchOrders].sort(sortByRoute);
        const sortedChoviar = [...choviarOrders].sort(sortByRoute);

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
              <div className="flex flex-col gap-2">
                {groupOrders.map(order => (
                  <div key={order.orderId} className="bg-white rounded-xl border border-gray-100 p-3 hover:border-red-200 hover:shadow-sm transition">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Order Info */}
                      <div className="flex-1 cursor-pointer" onClick={() => setModalOrder(order)}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-jts-red text-xs tracking-widest">{order.orderId}</span>
                          {order.zone === 'outside' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Outside</span>}
                          <span className="text-xs text-gray-400">{order.date}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{order.name}</p>
                        <p className="text-xs text-gray-500">{order.phone} • {order.address}</p>
                        <div className="flex justify-between items-center mt-1.5">
                          <span className="text-xs text-gray-500 font-medium">{order.items.map(i => `${i.name}×${i.quantity}`).join(', ')}</span>
                          <span className="text-sm font-bold text-gray-700 ml-2">₹{order.grandTotal.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      
                      {/* Delivery Controls */}
                      <div className="w-full md:w-auto bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 flex flex-col gap-2.5 min-w-[200px]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Driver</span>
                          <div className="flex flex-col gap-1">
                            {['Dabbawala', 'Sagar', 'Dalpat'].map(driver => (
                              <label key={driver} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`driver-${order.orderId}`}
                                  value={driver}
                                  checked={assignments[order.orderId]?.deliveryPerson === driver}
                                  onChange={() => handleUpdateAssignment(order.orderId, 'deliveryPerson', driver)}
                                  className="text-jts-red focus:ring-jts-red w-3.5 h-3.5"
                                />
                                <span className="text-xs font-medium text-gray-700">{driver}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Route #</span>
                          <input
                            type="number"
                            min="1"
                            placeholder="Seq"
                            value={assignments[order.orderId]?.routeOrder || ''}
                            onChange={e => handleUpdateAssignment(order.orderId, 'routeOrder', e.target.value)}
                            className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-jts-red font-semibold text-center"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
  // Default to today's date instead of tomorrow
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const todayLocal = new Date(today.getTime() - (offset * 60 * 1000));
  const defaultDate = todayLocal.toISOString().split('T')[0];

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
          className={`w-full py-3 rounded-xl font-bold text-sm text-white transition
            ${loading ? 'bg-red-300 cursor-not-allowed' : 'bg-jts-red hover:bg-jts-crimson'}`}
        >
          {loading ? 'Loading…' : '🔄 Refresh Kitchen Summary'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

      {summary && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="font-bold text-gray-800 text-sm mb-4">
              🍱 {convertDate(kitchenDate)} – {summary.orderCount} order{summary.orderCount !== 1 ? 's' : ''}
            </h3>

            {summary.orderCount === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No orders for this date</p>
            ) : (
              <>
                {/* Grand Totals Grid */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: 'Roti', val: summary.grandTotals?.Roti },
                    { label: 'Sabji', val: summary.grandTotals?.Sabji },
                    { label: 'Dal', val: summary.grandTotals?.Dal },
                    { label: 'Rice', val: summary.grandTotals?.Rice },
                    { label: 'Sweet', val: summary.grandTotals?.Sweet },
                    { label: 'Farsan', val: summary.grandTotals?.Farsan },
                  ].map(stat => (
                    <div key={stat.label} className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-2xl font-black text-jts-red mt-1">{stat.val || 0}</p>
                    </div>
                  ))}
                </div>

                {/* Orders Table */}
                {summary.kitchenOrders && summary.kitchenOrders.length > 0 && (
                  <div className="overflow-x-auto -mx-4 px-4">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                          <th className="py-2 px-3 rounded-l-lg font-bold">Seq No</th>
                          <th className="py-2 px-3 font-bold">Driver</th>
                          <th className="py-2 px-3 font-bold">Name</th>
                          <th className="py-2 px-3 text-center font-bold">Roti</th>
                          <th className="py-2 px-3 text-center font-bold">Sabji</th>
                          <th className="py-2 px-3 text-center font-bold">Dal</th>
                          <th className="py-2 px-3 text-center font-bold">Rice</th>
                          <th className="py-2 px-3 text-center font-bold">Sweet</th>
                          <th className="py-2 px-3 rounded-r-lg text-center font-bold">Farsan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.kitchenOrders.map((order, i) => (
                          <tr key={order.orderId || i} className="hover:bg-gray-50 transition">
                            <td className="py-3 px-3 font-bold text-gray-800">#{order.routeOrder === 9999 ? '-' : order.routeOrder}</td>
                            <td className="py-3 px-3 text-gray-600 font-medium">{order.deliveryPerson}</td>
                            <td className="py-3 px-3 text-gray-800 font-semibold">{order.name}</td>
                            <td className="py-3 px-3 text-center text-gray-700 font-bold">{order.Roti || '-'}</td>
                            <td className="py-3 px-3 text-center text-gray-700 font-bold">{order.Sabji || '-'}</td>
                            <td className="py-3 px-3 text-center text-gray-700 font-bold">{order.Dal || '-'}</td>
                            <td className="py-3 px-3 text-center text-gray-700 font-bold">{order.Rice || '-'}</td>
                            <td className="py-3 px-3 text-center text-gray-700 font-bold">{order.Sweet || '-'}</td>
                            <td className="py-3 px-3 text-center text-gray-700 font-bold">{order.Farsan || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
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
