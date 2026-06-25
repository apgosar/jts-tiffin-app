import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, User, ShoppingBag, CheckCircle, X } from 'lucide-react';

export default function RecurringPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    wingFlat: '',
    building: '',
    street: '',
    landmark: '',
    locality: '',
    pincode: ''
  });

  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  const [excludedDates, setExcludedDates] = useState({});
  const [activeDateModal, setActiveDateModal] = useState(null);
  
  const [selectedItems, setSelectedItems] = useState({
    lunch: null,    // 'Full Lunch' | 'Family Meal' | null
    choviar: false  // true | false
  });

  // Derived state
  const [deliveryDates, setDeliveryDates] = useState([]);

  useEffect(() => {
    // Attempt to load customer from local storage
    try {
      const stored = window.localStorage.getItem('jts-tiffin:last-order');
      if (stored) {
        const p = JSON.parse(stored);
        setForm(f => ({ ...f, ...p }));
      }
    } catch {}
  }, []);

  const [lookupState, setLookupState] = useState('idle');
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);

  // Fetch address from existing database when phone number is 10 digits
  useEffect(() => {
    const fetchCustomer = async () => {
      if (form.phone.length === 10) {
        setLookupState('loading');
        try {
          const res = await fetch(`/api/customer/lookup?phone=${encodeURIComponent(form.phone)}`);
          const data = await res.json();
          if (res.ok && data.found && data.profiles && data.profiles.length > 0) {
            setSavedProfiles(data.profiles);
            setLookupState('done');
            selectProfile(data.profiles.length - 1, data.profiles);
          } else {
            setSavedProfiles([]);
            setLookupState('done');
            selectProfile(-1, []);
          }
        } catch (err) {
          console.error("Failed to lookup customer", err);
          setLookupState('done');
          setSavedProfiles([]);
          selectProfile(-1, []);
        }
      } else {
        setLookupState('idle');
        setSavedProfiles([]);
        setSelectedProfile(null);
      }
    };
    fetchCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.phone]);

  const selectProfile = (idx, profiles = savedProfiles) => {
    setSelectedProfile(idx);
    if (idx >= 0 && profiles[idx]) {
      const p = profiles[idx];
      setForm(f => ({
        ...f,
        name: p.name || '',
        wingFlat: p.wingFlat || '',
        building: p.building || '',
        street: p.street || '',
        landmark: p.landmark || '',
        locality: p.locality || '',
        pincode: p.pincode || ''
      }));
    } else {
      setForm(f => ({
        ...f,
        name: '', wingFlat: '', building: '', street: '', landmark: '', pincode: ''
      }));
    }
  };

  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      const dates = [];
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      let curr = new Date(start);
      while (curr <= end) {
        const dStr = `${String(curr.getDate()).padStart(2, '0')}/${String(curr.getMonth() + 1).padStart(2, '0')}/${curr.getFullYear()}`;
        const skipStatus = excludedDates[dStr] || 'None';
        if (skipStatus !== 'Both') {
          dates.push({
            dateStr: dStr,
            skipLunch: skipStatus === 'Lunch',
            skipChoviar: skipStatus === 'Choviar'
          });
        }
        curr.setDate(curr.getDate() + 1);
      }
      setDeliveryDates(dates);
    } else {
      setDeliveryDates([]);
    }
  }, [dateRange, excludedDates]);

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!form.name || !form.phone || !form.wingFlat || !form.building || !form.street || !form.locality || !form.pincode) {
        return setError('Please fill all required fields');
      }
      if (form.phone.length !== 10) return setError('Please enter a valid 10-digit mobile number');
      if (form.pincode.length !== 6) return setError('Please enter a valid 6-digit PINCODE');
    }
    if (step === 2) {
      if (!selectedItems.lunch && !selectedItems.choviar) {
        return setError('Please select at least one meal option');
      }
    }
    if (step === 3) {
      if (!dateRange.startDate || !dateRange.endDate) {
        return setError('Please select a start and end date');
      }
      const s = new Date(dateRange.startDate);
      const e = new Date(dateRange.endDate);
      if (e < s) return setError('End date must be after start date');
      if (deliveryDates.length === 0) return setError('No delivery dates selected. Adjust exclusions.');
      if (deliveryDates.length > 30) return setError('Maximum allowed duration is 30 days');
    }
    setStep(s => s + 1);
  };

  const handleFormChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
  };

  const handleModalSave = (dateStr, status) => {
    const newExclusions = { ...excludedDates };
    if (status === 'None') {
      delete newExclusions[dateStr];
    } else {
      newExclusions[dateStr] = status;
    }
    setExcludedDates(newExclusions);
    setActiveDateModal(null);
  };

  const submitOrder = async () => {
    setLoading(true);
    setError(null);

    const items = [];
    if (selectedItems.lunch === 'Full Lunch') {
      items.push({ name: 'Full Lunch', quantity: 1 });
    } else if (selectedItems.lunch === 'Family Meal') {
      items.push({ name: 'Family Meal', quantity: 1 });
    } else if (selectedItems.lunch === 'Mini Lunch') {
      items.push({ name: 'Mini Lunch', quantity: 1 });
    } else if (selectedItems.lunch === 'Brunch') {
      items.push({ name: 'Brunch', quantity: 1 });
    }
    
    if (selectedItems.choviar) {
      items.push({ name: 'Full Choviar', quantity: 1 });
    }

    try {
      const res = await fetch('/api/orders/recurring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer: {
            ...form,
            address: `${form.wingFlat}, ${form.building}, ${form.street}${form.landmark ? `, ${form.landmark}` : ''}, ${form.locality}`
          },
          items,
          deliveryDates
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);
      setStep(5); // Success step
    } catch (err) {
      setError(err.message || 'Failed to place recurring order');
    } finally {
      setLoading(false);
    }
  };

  // Helper to render calendar days
  const renderCalendar = () => {
    if (!dateRange.startDate || !dateRange.endDate) return null;
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    if (end < start) return null;

    const days = [];
    let curr = new Date(start);
    while (curr <= end) {
      const dStr = `${String(curr.getDate()).padStart(2, '0')}/${String(curr.getMonth() + 1).padStart(2, '0')}/${curr.getFullYear()}`;
      const skipStatus = excludedDates[dStr] || 'None';
      
      let bgClass = 'bg-green-50 border-green-200 text-green-700'; // None (Both included)
      let label = '';
      if (skipStatus === 'Both') {
        bgClass = 'bg-red-50 border-red-200 text-red-500 opacity-60 line-through';
        label = 'Skipped';
      } else if (skipStatus === 'Choviar') {
        bgClass = 'bg-blue-50 border-blue-200 text-blue-700';
        label = 'Lunch Only';
      } else if (skipStatus === 'Lunch') {
        bgClass = 'bg-purple-50 border-purple-200 text-purple-700';
        label = 'Choviar Only';
      }

      days.push(
        <button
          key={dStr}
          onClick={() => setActiveDateModal(dStr)}
          className={`p-1 rounded-lg border flex flex-col items-center justify-center transition-colors ${bgClass}`}
          style={{ minHeight: '80px' }}
        >
          <span className="text-xs font-bold">{curr.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
          <span className="text-xl font-bold">{curr.getDate()}</span>
          {label && <span className="text-[10px] uppercase font-black tracking-wider mt-1">{label}</span>}
        </button>
      );
      curr.setDate(curr.getDate() + 1);
    }

    return (
      <div className="mt-4">
        <p className="text-sm text-gray-500 mb-2">Tap a date to exclude/skip specific meals</p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {days}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => step > 1 && step < 5 ? setStep(step - 1) : navigate('/')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="font-bold text-lg text-jts-navy uppercase tracking-wide" style={{ fontFamily: "'Oswald', sans-serif" }}>
              Recurring Orders
            </h1>
            <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Subscribe & Save Time</span>
          </div>
          <div className="w-10"></div>
        </div>
        
        {/* Progress bar */}
        {step < 5 && (
          <div className="w-full bg-gray-100 h-1.5 flex">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`flex-1 h-full ${s <= step ? 'bg-jts-red' : 'bg-transparent'} ${s < step ? 'opacity-80' : ''}`} />
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-4">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)}><X size={16}/></button>
          </div>
        )}

        {/* STEP 1: Details */}
        {step === 1 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <User size={20} className="text-jts-red" />
              <h2 className="text-xl font-bold">Your Details</h2>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Mobile Number *</label>
                <input type="tel" value={form.phone} onChange={handleFormChange('phone')} placeholder="10-digit number" maxLength="10" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-jts-red focus:outline-none" />
              </div>

              {lookupState === 'loading' && (
                <p className="text-sm text-gray-500 font-medium px-1 flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-jts-red border-t-transparent rounded-full animate-spin" />
                  Looking up your details…
                </p>
              )}

              {lookupState === 'done' && savedProfiles.length > 0 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 mt-2">
                  <h3 className="text-sm font-semibold text-gray-700">Select delivery address:</h3>
                  {savedProfiles.map((profile, idx) => (
                    <label
                      key={idx}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition
                        ${selectedProfile === idx ? 'bg-red-50 border-jts-red' : 'bg-white border-gray-200 hover:border-red-200'}`}
                    >
                      <input
                        type="radio"
                        name="profileSelection"
                        checked={selectedProfile === idx}
                        onChange={() => selectProfile(idx)}
                        className="mt-0.5"
                      />
                      <div className="text-sm min-w-0">
                        <p className="font-semibold text-gray-800">{profile.name}</p>
                        <p className="text-gray-600 text-xs mt-0.5 break-words">
                          {profile.wingFlat}, {profile.building}, {profile.street}
                          {profile.landmark ? `, ${profile.landmark}` : ''},{' '}
                          {profile.locality} – {profile.pincode}
                        </p>
                      </div>
                    </label>
                  ))}
                  <label
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition
                      ${selectedProfile === -1 ? 'bg-red-50 border-jts-red' : 'bg-white border-gray-200 hover:border-red-200'}`}
                  >
                    <input
                      type="radio"
                      name="profileSelection"
                      checked={selectedProfile === -1}
                      onChange={() => selectProfile(-1)}
                    />
                    <span className="text-sm font-semibold text-gray-800">Enter a new address</span>
                  </label>
                </div>
              )}

              {lookupState === 'done' && (selectedProfile === -1 || savedProfiles.length === 0) && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Full Name *</label>
                    <input type="text" value={form.name} onChange={handleFormChange('name')} placeholder="Your name" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-jts-red focus:outline-none" />
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-sm font-bold text-gray-700 mb-2">Delivery Address</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Wing / Flat *</label>
                        <input type="text" value={form.wingFlat} onChange={handleFormChange('wingFlat')} placeholder="e.g. A-101" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-jts-red focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Building *</label>
                        <input type="text" value={form.building} onChange={handleFormChange('building')} placeholder="Name" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-jts-red focus:outline-none" />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Street / Area *</label>
                      <input type="text" value={form.street} onChange={handleFormChange('street')} placeholder="Street name" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-jts-red focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Landmark</label>
                        <input type="text" value={form.landmark} onChange={handleFormChange('landmark')} placeholder="Optional" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-jts-red focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Locality *</label>
                        <input type="text" value={form.locality} onChange={handleFormChange('locality')} placeholder="e.g. Borivali West" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-jts-red focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Pincode *</label>
                      <input type="text" value={form.pincode} onChange={handleFormChange('pincode')} placeholder="e.g. 400092" maxLength="6" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-jts-red focus:outline-none" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Dates */}
        {step === 3 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={20} className="text-jts-red" />
              <h2 className="text-xl font-bold">Select Dates</h2>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                  <input type="date" min={new Date().toISOString().split('T')[0]} value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                  <input type="date" min={dateRange.startDate || new Date().toISOString().split('T')[0]} value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>

              {renderCalendar()}

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-600">Total Active Days:</span>
                <span className="text-lg font-extrabold text-jts-red">{deliveryDates.length} days</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Meal Selection */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag size={20} className="text-jts-red" />
              <h2 className="text-xl font-bold">Meal Options</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">Select the standard meal you want delivered on all {deliveryDates.length} days.</p>
            
            <div className="space-y-4">
              {/* Lunch Options */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800">Lunch Options</h3>
                </div>
                <div className="p-2 space-y-2">
                  {[
                    { id: 'Mini Lunch', name: 'Mini Lunch', desc: '3 Roti, Sabji, Dal, Rice, Salad/Sweet/Farsan' },
                    { id: 'Brunch', name: 'Brunch', desc: '6 Roti, Sabji, 1/2 Dal, 1/2 Rice, Salad/Sweet/Farsan' },
                    { id: 'Full Lunch', name: 'Full Lunch', desc: '6 Roti, Sabji, Dal, Rice, Salad/Sweet/Farsan' },
                    { id: 'Family Meal', name: 'Family Meal', desc: '9 Roti, Sabji, Dal, Rice, Salad/Sweet/Farsan' }
                  ].map(opt => (
                    <div 
                      key={opt.id}
                      onClick={() => setSelectedItems({ ...selectedItems, lunch: selectedItems.lunch === opt.id ? null : opt.id })}
                      className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between
                        ${selectedItems.lunch === opt.id ? 'border-jts-red bg-red-50' : 'border-transparent hover:bg-gray-50'}`}
                    >
                      <div>
                        <p className={`font-bold ${selectedItems.lunch === opt.id ? 'text-jts-red' : 'text-gray-800'}`}>{opt.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                        ${selectedItems.lunch === opt.id ? 'border-jts-red bg-jts-red' : 'border-gray-300'}`}>
                        {selectedItems.lunch === opt.id && <CheckCircle size={14} className="text-white" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Choviar Options */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800">Choviar Option</h3>
                </div>
                <div className="p-2">
                  <div 
                    onClick={() => setSelectedItems({ ...selectedItems, choviar: !selectedItems.choviar })}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between
                      ${selectedItems.choviar ? 'border-jts-red bg-red-50' : 'border-transparent hover:bg-gray-50'}`}
                  >
                    <div>
                      <p className={`font-bold ${selectedItems.choviar ? 'text-jts-red' : 'text-gray-800'}`}>Full Choviar</p>
                      <p className="text-xs text-gray-500 mt-0.5">Standard Choviar tiffin</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                      ${selectedItems.choviar ? 'border-jts-red bg-jts-red' : 'border-gray-300'}`}>
                      {selectedItems.choviar && <CheckCircle size={14} className="text-white" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Summary */}
        {step === 4 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={20} className="text-jts-red" />
              <h2 className="text-xl font-bold">Review Order</h2>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Deliver To</p>
                <p className="font-bold text-gray-800">{form.name}</p>
                <p className="text-sm text-gray-600">{form.phone}</p>
                <p className="text-sm text-gray-600 mt-1">{form.wingFlat}, {form.building}, {form.locality}</p>
              </div>

              <div className="border-t border-dashed border-gray-200"></div>

              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Schedule</p>
                <p className="text-sm font-medium text-gray-800">
                  {new Date(dateRange.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} to {new Date(dateRange.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </p>
                <p className="text-sm font-bold text-jts-red mt-1">{deliveryDates.length} Active Days</p>
              </div>

              <div className="border-t border-dashed border-gray-200"></div>

              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Daily Items</p>
                <ul className="space-y-1">
                  {selectedItems.lunch && (
                    <li className="text-sm font-bold text-gray-800 flex justify-between">
                      <span>• {selectedItems.lunch}</span>
                      <span className="text-gray-500">{deliveryDates.filter(d => !d.skipLunch).length} days</span>
                    </li>
                  )}
                  {selectedItems.choviar && (
                    <li className="text-sm font-bold text-gray-800 flex justify-between">
                      <span>• Full Choviar</span>
                      <span className="text-gray-500">{deliveryDates.filter(d => !d.skipChoviar).length} days</span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="border-t border-gray-200 mt-4 pt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-sm text-blue-800 font-medium leading-relaxed">
                    <strong>Payment:</strong> You can pay the delivery executive daily. The final cost will be calculated daily based on the active menu.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Success */}
        {step === 5 && (
          <div className="animate-fade-in flex flex-col items-center justify-center py-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Subscription Active!</h2>
            <p className="text-gray-600 mb-8 max-w-xs mx-auto">
              Your recurring order has been successfully scheduled for {deliveryDates.length} days.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-[240px] mx-auto">
              <button
                onClick={() => navigate('/my-orders')}
                className="w-full py-3 bg-jts-red text-white font-bold rounded-full shadow-lg hover:bg-jts-crimson transition-all"
              >
                Manage my Subscription
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-full hover:bg-gray-200 transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      {step < 5 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-50">
          <div className="max-w-md mx-auto flex gap-3">
            {step === 4 ? (
              <button
                onClick={submitOrder}
                disabled={loading}
                className="flex-1 py-3.5 bg-jts-red text-white font-bold rounded-full shadow-lg shadow-red-200 hover:bg-jts-crimson active:scale-95 transition-all flex items-center justify-center"
              >
                {loading ? <span className="animate-pulse">Confirming...</span> : 'Confirm Subscription'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 py-3.5 bg-jts-red text-white font-bold rounded-full shadow-lg shadow-red-200 hover:bg-jts-crimson active:scale-95 transition-all"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL */}
      {activeDateModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 animate-fade-in" onClick={() => setActiveDateModal(null)}>
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md mx-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Edit Delivery</h3>
              <button onClick={() => setActiveDateModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-gray-600 font-medium mb-4">What do you want to deliver on <strong>{activeDateModal}</strong>?</p>

            <div className="space-y-3 mb-6">
              {!!selectedItems.lunch && !!selectedItems.choviar ? (
                <>
                  <label className="flex items-center p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="radio" name="modal_status" value="None" className="w-5 h-5 text-jts-red focus:ring-jts-red border-gray-300" defaultChecked={(excludedDates[activeDateModal] || 'None') === 'None'} />
                    <span className="ml-3 font-medium text-gray-800">Both (Lunch & Choviar)</span>
                  </label>
                  <label className="flex items-center p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="radio" name="modal_status" value="Choviar" className="w-5 h-5 text-jts-red focus:ring-jts-red border-gray-300" defaultChecked={(excludedDates[activeDateModal] || 'None') === 'Choviar'} />
                    <span className="ml-3 font-medium text-gray-800">Lunch Only</span>
                  </label>
                  <label className="flex items-center p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="radio" name="modal_status" value="Lunch" className="w-5 h-5 text-jts-red focus:ring-jts-red border-gray-300" defaultChecked={(excludedDates[activeDateModal] || 'None') === 'Lunch'} />
                    <span className="ml-3 font-medium text-gray-800">Choviar Only</span>
                  </label>
                </>
              ) : (
                <label className="flex items-center p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="radio" name="modal_status" value="None" className="w-5 h-5 text-jts-red focus:ring-jts-red border-gray-300" defaultChecked={(excludedDates[activeDateModal] || 'None') === 'None'} />
                  <span className="ml-3 font-medium text-gray-800">Include Meal</span>
                </label>
              )}
              <label className="flex items-center p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="radio" name="modal_status" value="Both" className="w-5 h-5 text-jts-red focus:ring-jts-red border-gray-300" defaultChecked={(excludedDates[activeDateModal] || 'None') === 'Both'} />
                <span className="ml-3 font-medium text-red-600">Skip Delivery</span>
              </label>
            </div>

            <button
              onClick={() => {
                const selectedOption = document.querySelector('input[name="modal_status"]:checked').value;
                handleModalSave(activeDateModal, selectedOption);
              }}
              className="w-full py-3.5 bg-jts-red text-white font-bold rounded-xl shadow-lg hover:bg-jts-crimson transition-colors"
            >
              Apply Selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
