import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart, getOrderingState } from '../App';
import { lookupCustomer, placeOrder } from '../services/api';

// ─── Small helpers ────────────────────────────────────────────────────────────
function Field({ label, id, required, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function TextInput({ id, value, onChange, placeholder, type = 'text', maxLength, inputMode, autoComplete }) {
  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      autoComplete={autoComplete}
      className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400
        focus:outline-none focus:ring-2 focus:ring-jts-red focus:border-transparent transition"
    />
  );
}

// ─── Zone Badge ───────────────────────────────────────────────────────────────
function ZoneBadge({ zone, cartSubtotal }) {
  if (!zone) return null;
  if (zone === 'borivali') {
    const fee = cartSubtotal < 250 ? 30 : 0;
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
        <span className="text-green-600 text-base">✅</span>
        <div>
          <p className="text-xs font-bold text-green-800">Delivery in Borivali</p>
          {fee > 0 ? (
            <p className="text-[11px] text-green-600">₹30 delivery charge (orders &lt; ₹250)</p>
          ) : (
            <p className="text-[11px] text-green-600">Free delivery</p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
      <span className="text-amber-600 text-base">⚠️</span>
      <div>
        <p className="text-xs font-bold text-amber-800">Outside Borivali</p>
        <p className="text-[11px] text-amber-700">₹40 extra per tiffin will be added</p>
      </div>
    </div>
  );
}

// ─── Order Row ────────────────────────────────────────────────────────────────
function OrderRow({ item, onIncrement, onDecrement }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800">{item.name}</p>
        <p className="text-xs text-gray-500">₹{item.price}/- each</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onDecrement}
          className="w-8 h-8 rounded-full bg-red-100 text-jts-red hover:bg-red-200 flex items-center justify-center text-lg font-bold transition-colors"
        >−</button>
        <span className="w-5 text-center font-bold text-jts-red">{item.quantity}</span>
        <button
          type="button"
          onClick={onIncrement}
          className="w-8 h-8 rounded-full bg-jts-red text-white hover:bg-jts-crimson flex items-center justify-center text-lg font-bold transition-colors"
        >+</button>
        <span className="font-semibold text-gray-700 min-w-[60px] text-right">
          ₹{(item.price * item.quantity).toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  );
}

// ─── INITIAL FORM STATE ───────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '', wingFlat: '', building: '', street: '', landmark: '', locality: '', pincode: '',
};

// ─── CheckoutPage ─────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, cartSubtotal, updateQuantity, clearCart, setLastOrder, metadata } = useCart();

  // Phone lookup
  const [phone, setPhone]                     = useState('');
  const [lookupState, setLookupState]         = useState('idle'); // idle | loading | done
  const [savedProfiles, setSavedProfiles]     = useState([]);  // [{ name, address, pincode }]
  const [selectedProfile, setSelectedProfile] = useState(null); // index or -1 (new)

  // Form
  const [form, setForm]     = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  // Pincode / zone
  const [zone, setZone]     = useState(null); // null | 'borivali' | 'outside'

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jts_customer_profile');
      if (saved) {
        const profile = JSON.parse(saved);
        setPhone(profile.phone || '');
        setForm({
          name:     profile.name || '',
          wingFlat: profile.wingFlat || '',
          building: profile.building || '',
          street:   profile.street || '',
          landmark: profile.landmark || '',
          locality: profile.locality || '',
          pincode:  profile.pincode || '',
        });
        if (profile.pincode) computeZone(profile.pincode);
      }
    } catch (err) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Submission
  const [submitting, setSubmitting]   = useState(false);
  const [serverError, setServerError] = useState('');

  // ── Ordering cutoffs ─────────────────────────────────────────────────────────
  const { status } = getOrderingState(metadata?.betaTesting);
  const hasLunch = cartItems.some(item => item.category === 'Lunch' || !item.category);
  const isCheckoutBlocked = status === 'CLOSED' || (status === 'LUNCH_CLOSED' && hasLunch);
  
  // ── Derived zone / surcharge ─────────────────────────────────────────────────
  const lunchItems = cartItems.filter(i => i.category === 'Lunch' || !i.category);
  const choviarItems = cartItems.filter(i => i.category === 'Choviar');

  const lunchSubtotal = lunchItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const choviarSubtotal = choviarItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const lunchQty = lunchItems.reduce((s, i) => s + i.quantity, 0);
  const choviarQty = choviarItems.reduce((s, i) => s + i.quantity, 0);

  let lunchSurcharge = 0;
  let choviarSurcharge = 0;
  let lunchOutsideTiffins = 0;
  let choviarOutsideTiffins = 0;

  if (zone === 'outside') {
    lunchOutsideTiffins = lunchItems.filter(i => i.name.includes('Lunch') || i.name.includes('Meal') || i.name.includes('Brunch')).reduce((s, i) => s + i.quantity, 0);
    if (lunchOutsideTiffins === 0 && lunchItems.length > 0) lunchOutsideTiffins = 1;
    
    choviarOutsideTiffins = choviarItems.filter(i => i.name.includes('Choviar') || i.name.includes('Meal')).reduce((s, i) => s + i.quantity, 0);
    if (choviarOutsideTiffins === 0 && choviarItems.length > 0) choviarOutsideTiffins = 1;

    lunchSurcharge = lunchItems.length > 0 ? 40 * lunchOutsideTiffins : 0;
    choviarSurcharge = choviarItems.length > 0 ? 40 * choviarOutsideTiffins : 0;
  } else if (zone === 'borivali') {
    if (lunchItems.length > 0 && lunchSubtotal < 250) lunchSurcharge = 30;
    if (choviarItems.length > 0 && choviarSubtotal < 250) choviarSurcharge = 30;
  }

  const surchargeTotal = lunchSurcharge + choviarSurcharge;
  const exactTotal = cartSubtotal + surchargeTotal;
  const grandTotal = Math.round(exactTotal / 5) * 5;
  const roundOffAmount = grandTotal - exactTotal;

  // ── Redirect if cart empty ───────────────────────────────────────────────────
  if (cartItems.length === 0 && !submitting) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4 pb-20">
        <div className="w-32 h-32 bg-white rounded-full shadow-sm flex items-center justify-center animate-bounce">
          <p className="text-6xl">🛒</p>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-gray-800 mb-2">Your Tiffin is Empty</h2>
          <p className="text-gray-500 font-medium">Looks like you haven't added anything to your cart yet.</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-8 py-3.5 bg-jts-red text-white font-bold rounded-full shadow-lg shadow-red-200 hover:bg-jts-crimson active:scale-95 transition-all w-full max-w-xs"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  // ── Phone change + lookup ────────────────────────────────────────────────────
  const handlePhoneChange = async (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(val);
    if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));

    if (/^[6-9]\d{9}$/.test(val)) {
      setLookupState('loading');
      try {
        const res     = await lookupCustomer(val);
        const profiles = res.data.profiles || [];
        setSavedProfiles(profiles);
        if (profiles.length > 0) {
          setSelectedProfile(0);
          applyProfile(profiles[0]);
        } else {
          setSelectedProfile(-1);
          setForm(EMPTY_FORM);
          setZone(null);
        }
      } catch {
        setSavedProfiles([]);
        setSelectedProfile(-1);
        setForm(EMPTY_FORM);
        setZone(null);
      } finally {
        setLookupState('done');
      }
    } else {
      setLookupState('idle');
      setSavedProfiles([]);
      setSelectedProfile(null);
      setForm(EMPTY_FORM);
      setZone(null);
    }
  };

  const applyProfile = (profile) => {
    if (!profile) return;
    setForm(prev => ({
      ...prev,
      name:     profile.name || '',
      wingFlat: profile.wingFlat || '',
      building: profile.building || '',
      street:   profile.street || '',
      landmark: profile.landmark || '',
      locality: profile.locality || '',
      pincode:  profile.pincode || '',
    }));
    computeZone(profile.pincode || '');
  };

  const computeZone = (pincode) => {
    // Zone is determined server-side; we just show a badge if pincode is 6 digits.
    // We optimistically show nothing until submission if we don't know the pincodes.
    // The server will tell us the zone and surcharge.
    // For real-time UX, we expose a /api/check-pincode endpoint in server.js.
    if (/^\d{6}$/.test(pincode)) {
      fetch(`/api/check-pincode?pincode=${pincode}`)
        .then(r => r.json())
        .then(data => setZone(data.zone || null))
        .catch(() => setZone(null));
    } else {
      setZone(null);
    }
  };

  const handleFormChange = (field) => (e) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    if (field === 'pincode') computeZone(val);
  };

  const selectProfile = (idx) => {
    setSelectedProfile(idx);
    if (idx >= 0) {
      applyProfile(savedProfiles[idx]);
    } else {
      setForm(EMPTY_FORM);
      setZone(null);
    }
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone.trim()))
      e.phone = 'Enter a valid 10-digit mobile number (starting 6–9)';
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.wingFlat.trim()) e.wingFlat = 'Wing / Flat No is required';
    if (!form.building.trim()) e.building = 'Building name is required';
    if (!form.street.trim()) e.street = 'Street name is required';
    if (!form.locality.trim()) e.locality = 'Locality is required';
    if (!form.pincode.trim()) {
      e.pincode = 'PINCODE is required';
    } else if (!/^\d{6}$/.test(form.pincode.trim())) {
      e.pincode = 'Enter a valid 6-digit PINCODE';
    }
    return e;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isCheckoutBlocked) return;
    
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstKey = Object.keys(validationErrors)[0];
      document.getElementById(firstKey)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSubmitting(true);
    setServerError('');

    try {
      const formattedAddress =
        `${form.wingFlat.trim()}, ${form.building.trim()}, ${form.street.trim()}` +
        `${form.landmark ? ', ' + form.landmark.trim() : ''}, ` +
        `${form.locality.trim()} – ${form.pincode.trim()}`;

      const res = await placeOrder({
        customer: {
          name:    form.name.trim(),
          phone:   phone.trim(),
          wingFlat: form.wingFlat.trim(),
          building: form.building.trim(),
          street:   form.street.trim(),
          landmark: form.landmark.trim(),
          locality: form.locality.trim(),
          pincode:  form.pincode.trim(),
          address:  formattedAddress,
        },
        items: cartItems.map(({ name, price, quantity }) => ({ name, price, quantity })),
        subtotal: cartSubtotal,
      });

      setLastOrder({
        orderId:        res.data.orderId,
        items:          cartItems,
        subtotal:       cartSubtotal,
        surchargeTotal: res.data.surchargeTotal,
        grandTotal:     res.data.grandTotal,
        zone:           res.data.zone,
        customer:       { ...form, phone },
      });
      
      try {
        localStorage.setItem('jts_customer_profile', JSON.stringify({
          phone: phone,
          ...form
        }));
      } catch (err) {}

      clearCart();
      navigate('/confirmation');
    } catch (err) {
      console.error(err);
      setServerError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-2xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-600 text-xl"
            aria-label="Back to menu"
          >
            ←
          </button>
          <h1 className="font-bold text-gray-900 text-base">Checkout</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 py-4 flex flex-col gap-5">

        {/* ── Order Summary ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <span>🧾</span> Your Order
            </h2>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs font-semibold text-jts-red hover:text-jts-crimson transition"
            >
              + Add More
            </button>
          </div>

          {/* Lunch Order Section */}
          {lunchItems.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-gray-800 text-sm mb-2 border-b border-gray-100 pb-1">Lunch Order</h3>
              <div className="flex flex-col">
                {lunchItems.map(item => (
                  <OrderRow
                    key={item.name}
                    item={item}
                    onIncrement={() => updateQuantity(item.name, 1)}
                    onDecrement={() => updateQuantity(item.name, -1)}
                  />
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Subtotal ({lunchQty} item{lunchQty !== 1 ? 's' : ''})</span>
                  <span className="font-semibold">₹{lunchSubtotal.toLocaleString('en-IN')}</span>
                </div>
                {lunchSurcharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">
                      {zone === 'borivali' ? 'Delivery Charge (Orders < ₹250)' : `Outside Borivali surcharge (₹40 × ${lunchOutsideTiffins})`}
                    </span>
                    <span className="font-semibold text-amber-700">+₹{lunchSurcharge}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Choviar Order Section */}
          {choviarItems.length > 0 && (
            <div className="mb-2">
              <h3 className="font-bold text-gray-800 text-sm mb-2 border-b border-gray-100 pb-1">Choviar Order</h3>
              <div className="flex flex-col">
                {choviarItems.map(item => (
                  <OrderRow
                    key={item.name}
                    item={item}
                    onIncrement={() => updateQuantity(item.name, 1)}
                    onDecrement={() => updateQuantity(item.name, -1)}
                  />
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Subtotal ({choviarQty} item{choviarQty !== 1 ? 's' : ''})</span>
                  <span className="font-semibold">₹{choviarSubtotal.toLocaleString('en-IN')}</span>
                </div>
                {choviarSurcharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">
                      {zone === 'borivali' ? 'Delivery Charge (Orders < ₹250)' : `Outside Borivali surcharge (₹40 × ${choviarOutsideTiffins})`}
                    </span>
                    <span className="font-semibold text-amber-700">+₹{choviarSurcharge}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Grand Total */}
          <div className="mt-1 pt-1 space-y-1.5">
            {roundOffAmount !== 0 && (
              <div className="flex justify-between text-sm text-gray-700">
                <span>Round Off</span>
                <span className="font-semibold">{roundOffAmount > 0 ? '+' : ''}₹{roundOffAmount}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200 mt-2">
              <span className="text-gray-800">Grand Total</span>
              <span className="text-jts-red text-xl">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </section>

        {isCheckoutBlocked ? (
          <div className="bg-red-50 border-2 border-jts-red rounded-2xl shadow-sm p-6 text-center">
            <p className="text-3xl mb-2">⏰</p>
            <h2 className="text-lg font-bold text-jts-red mb-1">Order Cutoff Passed</h2>
            <p className="text-sm text-gray-700 font-medium">
              {status === 'CLOSED' 
                ? "We are now closed for today's orders. We will be back post 7 PM."
                : "Lunch orders are only accepted till 5 AM. Please remove lunch items from your cart to proceed with Choviar orders."}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-4" noValidate>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <span>👤</span> Your Details
            </h2>

          {/* STEP 1: Mobile */}
          <Field label="Mobile Number" id="phone" required error={errors.phone}>
            <TextInput
              id="phone"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="10-digit mobile number"
              type="tel"
              inputMode="tel"
              maxLength={10}
              autoComplete="tel"
            />
          </Field>

          {lookupState === 'loading' && (
            <p className="text-sm text-gray-500 font-medium px-1 flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-jts-red border-t-transparent rounded-full animate-spin" />
              Looking up your details…
            </p>
          )}

          {/* STEP 2: Saved addresses picker */}
          {lookupState === 'done' && savedProfiles.length > 0 && (
            <div className="flex flex-col gap-2">
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

          {/* STEP 3: Name + Address form (shown when profile -1 or no profiles) */}
          {lookupState === 'done' && (selectedProfile === -1 || savedProfiles.length === 0) && (
            <>
              <Field label="Full Name" id="name" required error={errors.name}>
                <TextInput
                  id="name"
                  value={form.name}
                  onChange={handleFormChange('name')}
                  placeholder="e.g. Raj Mehta"
                  autoComplete="name"
                />
              </Field>

              <div className="border-t border-gray-100 pt-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span>📍</span> Delivery Address
                </h3>
                <div className="flex flex-col gap-3">
                  <Field label="Wing / Flat No" id="wingFlat" required error={errors.wingFlat}>
                    <TextInput id="wingFlat" value={form.wingFlat} onChange={handleFormChange('wingFlat')} placeholder="e.g. B-204" />
                  </Field>
                  <Field label="Building Name" id="building" required error={errors.building}>
                    <TextInput id="building" value={form.building} onChange={handleFormChange('building')} placeholder="e.g. Shanti Apartments" />
                  </Field>
                  <Field label="Street Name" id="street" required error={errors.street}>
                    <TextInput id="street" value={form.street} onChange={handleFormChange('street')} placeholder="e.g. S.V. Road" />
                  </Field>
                  <Field label="Landmark (optional)" id="landmark" error={errors.landmark}>
                    <TextInput id="landmark" value={form.landmark} onChange={handleFormChange('landmark')} placeholder="e.g. Near State Bank ATM" />
                  </Field>
                  <Field label="Locality" id="locality" required error={errors.locality}>
                    <TextInput id="locality" value={form.locality} onChange={handleFormChange('locality')} placeholder="e.g. Borivali West" />
                  </Field>
                  <Field label="PINCODE" id="pincode" required error={errors.pincode}>
                    <TextInput
                      id="pincode"
                      value={form.pincode}
                      onChange={handleFormChange('pincode')}
                      placeholder="6-digit PINCODE"
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </Field>

                  {/* Zone Badge */}
                  {form.pincode.length === 6 && zone && <ZoneBadge zone={zone} cartSubtotal={cartSubtotal} />}
                </div>
              </div>
            </>
          )}

          {/* Show zone badge for selected profile */}
          {lookupState === 'done' && selectedProfile >= 0 && zone && (
            <ZoneBadge zone={zone} cartSubtotal={cartSubtotal} />
          )}

          {/* Server error */}
          {serverError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          {/* Submit */}
          {lookupState !== 'idle' && (
            <button
              type="submit"
              disabled={submitting || lookupState === 'loading'}
              className={`w-full py-4 rounded-2xl font-bold text-white text-base transition
                ${submitting || lookupState === 'loading'
                  ? 'bg-red-300 cursor-not-allowed'
                  : 'bg-jts-red hover:bg-jts-crimson active:bg-red-900 shadow-md'}`}
            >
              {submitting ? 'Placing Order…' : '🛍️ Place Order'}
            </button>
          )}
        </form>
        )}
      </main>
    </div>
  );
}
