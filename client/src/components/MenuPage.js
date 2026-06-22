import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart, getOrderingState } from '../App';
import { getMenu } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import JtsLogo from './JtsLogo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Quantity Stepper ─────────────────────────────────────────────────────────
// ─── Stepper Button Helper ──────────────────────────────────────────────────────
function QuantityStepper({ quantity, onIncrement, onDecrement, disabled = false }) {
  const [popping, setPopping] = useState(false);
  
  const handleInc = () => {
    setPopping(true);
    setTimeout(() => setPopping(false), 250);
    onIncrement();
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onDecrement}
        disabled={quantity === 0}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-xl font-bold transition-all
          ${quantity === 0
            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
            : 'bg-red-100 text-jts-red hover:bg-red-200 active:scale-90'}`}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className={`w-7 text-center font-bold text-base transition-colors
        ${quantity > 0 ? 'text-jts-red' : 'text-gray-400'}`}>
        {quantity}
      </span>
      <button
        onClick={handleInc}
        disabled={disabled}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-xl font-bold transition-all
          ${disabled
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-jts-red text-white hover:bg-jts-crimson shadow-sm'} 
          ${popping ? 'animate-button-pop' : ''}`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

// ─── Tiffin Card ──────────────────────────────────────────────────────────────
function TiffinCard({ item, cart, updateQuantity, animDelay }) {
  const unavailable = !item.available;
  
  const currentName = item.name;
  const currentPrice = item.price;
  
  const quantity = cart[currentName]?.quantity || 0;

  const handleInc = () => updateQuantity(currentName, 1, { ...item, name: currentName, price: currentPrice });
  const handleDec = () => updateQuantity(currentName, -1);

  return (
    <div
      className={`card-pop rounded-2xl overflow-hidden shadow-md border transition-all
        ${unavailable
          ? 'border-gray-200 opacity-70'
          : quantity > 0
            ? 'border-jts-red shadow-red-100'
            : 'border-gray-100 hover:border-red-200 hover:shadow-lg'}`}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      {/* Red header */}
      <div className="bg-jts-red px-4 py-3 flex items-center justify-between">
        <h3
          className="text-white font-bold text-lg tracking-wide uppercase"
          style={{ fontFamily: "'Oswald', Impact, sans-serif" }}
        >
          {item.name}
        </h3>
        {unavailable && (
          <span className="bg-gray-800 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">
            Unavailable
          </span>
        )}
        {!unavailable && quantity > 0 && (
          <span className="bg-white text-jts-red text-xs font-extrabold px-2 py-0.5 rounded-full">
            ×{quantity}
          </span>
        )}
      </div>

      {/* Body */}
      <div className={`px-4 pt-3 pb-4 flex flex-col gap-3 ${quantity > 0 ? 'bg-jts-cream' : 'bg-white'}`}>
        <p className="text-sm text-gray-600 leading-relaxed">
          {item.description}
        </p>

        <div className="border-t border-dotted border-gray-300 my-1" />

        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-baseline gap-1 bg-jts-gold rounded-lg px-3 py-1">
              <span className="text-jts-navy font-extrabold text-base">
                ₹{currentPrice}/-
              </span>
              <span className="text-jts-navy text-xs font-semibold opacity-80">per tiffin</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
              ₹40 extra per tiffin for delivery outside Borivali
            </p>
          </div>
          
          <div className="flex-shrink-0">
            {unavailable ? (
              <span className="text-xs text-gray-400 font-medium">Not available</span>
            ) : (
              <QuantityStepper quantity={quantity} onIncrement={handleInc} onDecrement={handleDec} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stepper Item for Custom / Individual Orders ──────────────────────────────
function StepperItem({ title, name, price, subtitle, cart, updateQuantity, category = 'Lunch' }) {
  const quantity = cart[name]?.quantity || 0;
  const handleInc = () => updateQuantity(name, 1, { name, price: Number(price), available: true, category });
  const handleDec = () => updateQuantity(name, -1);
  
  if (!Number(price)) return null;

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="font-bold text-gray-800 text-sm">{title}</p>
        <p className="text-xs text-gray-500">₹{price}/- {subtitle && <span className="italic">({subtitle})</span>}</p>
      </div>
      <QuantityStepper quantity={quantity} onIncrement={handleInc} onDecrement={handleDec} />
    </div>
  );
}

// ─── Custom Order Stepper Items ───────────────────────────────────────────────
const VariantItem = ({ title, subtitle, namePrefix, halfPrice, fullPrice, cart, updateQuantity }) => {
  const [variant, setVariant] = useState('Full'); // 'Half' or 'Full'
  
  const currentName = `${namePrefix} (${variant}) - ${subtitle}`;
  const currentPrice = variant === 'Half' ? halfPrice : fullPrice;
  const quantity = cart[currentName]?.quantity || 0;
  
  const handleInc = () => updateQuantity(currentName, 1, { name: currentName, price: Number(currentPrice), available: true });
  const handleDec = () => updateQuantity(currentName, -1);
  
  if (!Number(halfPrice) && !Number(fullPrice)) return null;

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-800 text-sm">{title} <span className="italic font-normal text-xs text-gray-500">({subtitle})</span></p>
        </div>
        <QuantityStepper quantity={quantity} onIncrement={handleInc} onDecrement={handleDec} />
      </div>
      <div className="flex gap-4 mt-2">
         <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
           <input type="radio" name={`${title}-variant`} checked={variant==='Half'} onChange={() => setVariant('Half')} className="text-jts-red focus:ring-jts-red" />
           Half (₹{halfPrice})
         </label>
         <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
           <input type="radio" name={`${title}-variant`} checked={variant==='Full'} onChange={() => setVariant('Full')} className="text-jts-red focus:ring-jts-red" />
           Full (₹{fullPrice})
         </label>
      </div>
    </div>
  );
};

const RotiItem = ({ metadata, cart, updateQuantity }) => {
  const name = 'Roti';
  const price = Number(metadata?.rotiPrice) || 8;
  const quantity = cart[name]?.quantity || 0;
  
  const handleSetQuantity = (val) => {
    const diff = val - quantity;
    if (diff !== 0) {
      updateQuantity(name, diff, { name, price, available: true });
    }
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="font-bold text-gray-800 text-sm">Roti</p>
        <p className="text-xs text-gray-500">₹{price}/- per piece</p>
      </div>
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          min="0"
          value={quantity || ''}
          onChange={(e) => handleSetQuantity(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-16 text-center text-sm font-bold border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-jts-red focus:outline-none"
          placeholder="0"
        />
        <span className="text-xs font-bold text-gray-500">pcs</span>
      </div>
    </div>
  );
};

// ─── Custom Order Section ───────────────────────────────────────────────────────────
function CustomOrderSection({ cart, updateQuantity, metadata }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-1">
      <div className="px-4 py-1 flex flex-col">
        <RotiItem metadata={metadata} cart={cart} updateQuantity={updateQuantity} />
        
        {metadata?.sabji && (
          <VariantItem 
            title="Sabji" 
            subtitle={metadata.sabji} 
            namePrefix="Sabji" 
            halfPrice={metadata.sabjiHalfPrice} 
            fullPrice={metadata.sabjiFullPrice} 
            cart={cart}
            updateQuantity={updateQuantity}
          />
        )}
        
        {metadata?.dal && (
          <VariantItem 
            title="Dal" 
            subtitle={metadata.dal} 
            namePrefix="Dal" 
            halfPrice={metadata.dalHalfPrice} 
            fullPrice={metadata.dalFullPrice} 
            cart={cart}
            updateQuantity={updateQuantity}
          />
        )}
        
        <StepperItem title="Rice" name="Rice" price={metadata?.ricePrice} cart={cart} updateQuantity={updateQuantity} />
        
        {metadata?.farsanAvailable === 'Yes' && metadata?.farsan && (
          <StepperItem title="Farsan" subtitle={metadata.farsan} name={`Farsan - ${metadata.farsan}`} price={metadata.farsanPrice} cart={cart} updateQuantity={updateQuantity} />
        )}
        
        {metadata?.sweetAvailable === 'Yes' && metadata?.sweet && (
          <StepperItem title="Sweet" subtitle={metadata.sweet} name={`Sweet - ${metadata.sweet}`} price={metadata.sweetPrice} cart={cart} updateQuantity={updateQuantity} />
        )}
      </div>
    </div>
  );
}

// ─── Floating Cart Bar ────────────────────────────────────────────────────────
function CartBar({ cartCount, cartSubtotal, onViewOrder }) {
  const [bouncing, setBouncing] = useState(false);

  useEffect(() => {
    if (cartCount > 0) {
      setBouncing(true);
      const timer = setTimeout(() => setBouncing(false), 250);
      return () => clearTimeout(timer);
    }
  }, [cartCount]);

  if (cartCount === 0) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-jts-cream via-jts-cream/95 to-transparent">
      <div className="max-w-md mx-auto">
        <button
          onClick={onViewOrder}
          className="w-full flex items-center justify-between bg-jts-red hover:bg-jts-crimson active:bg-red-900 text-white rounded-2xl px-5 py-4 shadow-lg transition-colors"
        >
          <span className={`bg-red-700 rounded-lg px-2.5 py-1 text-sm font-bold ${bouncing ? 'animate-button-pop' : ''}`}>
            {cartCount} {cartCount === 1 ? 'item' : 'items'}
          </span>
          <span className="font-bold text-base">View Order</span>
          <span className="font-bold text-base">₹{cartSubtotal.toLocaleString('en-IN')}</span>
        </button>
      </div>
    </div>
  );
}

// ─── MenuPage ─────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const navigate = useNavigate();
  const { cart, updateQuantity, menu, setMenu, metadata, setMetadata, cartCount, cartSubtotal } = useCart();

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  
  // Use ordering state helper
  const { status, targetDateLabel } = getOrderingState(metadata?.betaTesting);

  useEffect(() => {
    let cancelled = false;
    getMenu()
      .then(res => {
        if (cancelled) return;
        setMenu(res.data.menu || []);
        setMetadata(res.data.metadata || {});
      })
      .catch(err => {
        if (cancelled) return;
        console.error(err);
        setError('Failed to load the menu. Please refresh and try again.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [setMenu]);

  const lunchMenu = menu.filter(m => m.category === 'Lunch' || !m.category).map(m => {
    if (status === 'LUNCH_CLOSED') return { ...m, available: false };
    return m;
  });
  const choviarMenu = menu.filter(m => m.category === 'Choviar');

  return (
    <div className="min-h-screen bg-jts-lcream" style={{ paddingBottom: cartCount > 0 ? '96px' : '24px' }}>
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <JtsLogo className="w-12 h-12 flex-shrink-0" />
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <div className="flex items-baseline gap-0.5 leading-none">
              <span className="text-jts-red font-bold text-2xl" style={{ fontFamily: "'Oswald', Impact, sans-serif" }}>J</span>
              <span className="text-gray-900 font-bold text-lg" style={{ fontFamily: "'Oswald', Impact, sans-serif" }}>AIN TIFFIN</span>
            </div>
            <div className="text-gray-800 font-semibold text-sm tracking-widest" style={{ fontFamily: "'Oswald', Impact, sans-serif" }}>
              SERVICE
            </div>
            <div className="text-xs text-jts-navy font-semibold tracking-wide">BY KEYUR SHAH</div>
          </div>
          <button 
            onClick={() => navigate('/my-orders')}
            className="flex flex-col items-center justify-center p-2 text-jts-navy hover:bg-gray-100 rounded-xl transition-colors"
          >
            <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center mb-0.5">
              <span className="text-lg">👤</span>
            </div>
            <span className="text-[10px] font-bold tracking-wider">LOGIN</span>
          </button>
        </div>
      </header>

      {/* ── Navy tagline banner ── */}
      <div className="bg-jts-navy">
        <p className="max-w-md mx-auto text-center text-white text-xs font-semibold py-2 px-4 tracking-wide uppercase">
          We make sure you eat healthy and stay healthy
        </p>
      </div>

      {/* ── Ordering-for banner ── */}
      <div className="bg-jts-gold">
        <div className="max-w-md mx-auto text-center py-2 px-4 flex flex-col items-center">
          <span className="text-jts-navy text-xs font-bold uppercase tracking-wide">
            🗓️ Ordering for: {targetDateLabel}
          </span>
          <span className="text-jts-navy/80 text-[10px] font-semibold tracking-wide mt-0.5">
            Lunch orders till 5am | Choviar till 11am
          </span>
        </div>
      </div>

      {/* ── Recurring Orders Banner ── */}
      <div className="bg-jts-navy px-4 py-3 cursor-pointer hover:bg-opacity-90 transition-colors" onClick={() => navigate('/recurring')}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-jts-gold rounded-full flex items-center justify-center text-xl shadow-inner">
              📅
            </div>
            <div>
              <p className="text-white font-bold text-sm tracking-wide">SUBSCRIBE & SAVE TIME</p>
              <p className="text-gray-300 text-[11px] mt-0.5">Place recurring orders for multiple days</p>
            </div>
          </div>
          <div className="text-jts-gold font-bold text-lg">›</div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-md mx-auto px-4 py-5">
        {status === 'CLOSED' && (
          <div className="bg-white border-2 border-jts-red rounded-xl p-6 shadow-md text-center my-10">
            <p className="text-4xl mb-3">👨‍🍳</p>
            <h2 className="text-xl font-bold text-jts-red mb-2" style={{ fontFamily: "'Oswald', Impact, sans-serif" }}>We are cooking tomorrow's menu!</h2>
            <p className="text-gray-600 text-sm font-medium">Orders will be live again post 7 PM.</p>
          </div>
        )}

        {status !== 'CLOSED' && loading && <LoadingSpinner message="Loading today's menu…" />}

        {status !== 'CLOSED' && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-jts-red">
            {error}
          </div>
        )}

        {status !== 'CLOSED' && !loading && !error && menu.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-5xl mb-3">🍱</p>
            <p className="font-semibold text-lg text-gray-700">Menu not set yet</p>
            <p className="text-sm mt-1">Tomorrow's menu hasn't been configured. Check back soon!</p>
          </div>
        )}

        {status !== 'CLOSED' && !loading && !error && menu.length > 0 && (
          <div className="flex flex-col gap-6">
            
            {/* ── Lunch Section ── */}
            {lunchMenu.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-gray-800 uppercase" style={{ fontFamily: "'Oswald', Impact, sans-serif" }}>Lunch</h2>
                  <div className="flex-1 border-b-2 border-gray-300"></div>
                </div>
                
                {status === 'LUNCH_CLOSED' ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center justify-center opacity-70">
                    <span className="text-xl mb-1">🚫</span>
                    <p className="text-sm font-bold text-gray-600">Lunch: Unavailable</p>
                    <p className="text-xs text-gray-500 mt-0.5">Orders closed at 5 AM</p>
                  </div>
                ) : (
                  <>
                    {/* Metadata Banner */}
                    {metadata && (metadata.sabji || (metadata.sweetAvailable === 'Yes' && metadata.sweet) || metadata.dal || (metadata.farsanAvailable === 'Yes' && metadata.farsan)) && (
                      <div className="bg-white border-2 border-jts-gold rounded-xl p-3 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-jts-gold text-jts-navy text-[10px] font-bold px-2 py-1 rounded-bl-lg">TODAY'S SPECIAL</div>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-1">
                          {metadata.sabji && <div><span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide block">Sabji</span><span className="text-sm font-semibold text-gray-800">{metadata.sabji}</span></div>}
                          {metadata.sweetAvailable === 'Yes' && metadata.sweet && <div><span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide block">Sweet</span><span className="text-sm font-semibold text-gray-800">{metadata.sweet}</span></div>}
                          {metadata.dal && <div><span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide block">Dal</span><span className="text-sm font-semibold text-gray-800">{metadata.dal}</span></div>}
                          {metadata.farsanAvailable === 'Yes' && metadata.farsan && <div><span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide block">Farsan</span><span className="text-sm font-semibold text-gray-800">{metadata.farsan}</span></div>}
                        </div>
                      </div>
                    )}

                    {lunchMenu.map((item, idx) => (
                      <TiffinCard key={item.name} item={item} cart={cart} updateQuantity={updateQuantity} animDelay={idx * 70} />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── Custom Order Section ── */}
            {status !== 'LUNCH_CLOSED' && (
              <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-gray-800 uppercase" style={{ fontFamily: "'Oswald', Impact, sans-serif" }}>Custom Order</h2>
                  <div className="flex-1 border-b-2 border-gray-300"></div>
                </div>
                <CustomOrderSection cart={cart} updateQuantity={updateQuantity} metadata={metadata} />
              </div>
            )}

            {/* ── Choviar Section ── */}
            {choviarMenu.length > 0 && (
              <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-1">
                    <h2 className="text-2xl font-bold text-gray-800 uppercase" style={{ fontFamily: "'Oswald', Impact, sans-serif" }}>Choviar</h2>
                    <div className="flex-1 border-b-2 border-gray-300 mr-2"></div>
                  </div>
                  <button 
                    onClick={() => {
                      choviarMenu.forEach(item => updateQuantity(item.name, 1, item));
                    }} 
                    className="text-xs bg-jts-red text-white px-3 py-1.5 rounded-full shadow font-bold hover:bg-jts-crimson active:scale-95 transition-transform shrink-0"
                  >
                    + Full Choviar
                  </button>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-1 px-4 py-1 flex flex-col">
                  {choviarMenu.map((item, idx) => (
                    <StepperItem key={item.name} title={item.name} name={item.name} price={item.price} cart={cart} updateQuantity={updateQuantity} category="Choviar" />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Contact footer ── */}
        {status !== 'CLOSED' && !loading && !error && menu.length > 0 && (
          <div className="mt-8 bg-jts-navy rounded-2xl p-4 text-center">
            <p className="text-white font-bold text-base" style={{ fontFamily: "'Oswald', sans-serif" }}>Keyur Shah</p>
            <a href="tel:+918779084488" className="text-jts-gold font-semibold text-lg tracking-wide hover:underline">📞 87790 84488</a>
            <p className="text-white text-xs mt-2 opacity-75">Borivali delivery only</p>
            <p className="text-jts-gold text-xs mt-1 font-medium">₹40 extra per tiffin for delivery outside Borivali</p>
          </div>
        )}
      </main>

      {status !== 'CLOSED' && (
        <CartBar
          cartCount={cartCount}
          cartSubtotal={cartSubtotal}
          onViewOrder={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); navigate('/checkout'); }}
        />
      )}
    </div>
  );
}
