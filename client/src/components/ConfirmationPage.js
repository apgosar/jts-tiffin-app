import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../App';
import JtsLogo from './JtsLogo';

export default function ConfirmationPage() {
  const navigate = useNavigate();
  const { lastOrder, clearLastOrder } = useCart();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!lastOrder) {
    return (
      <div className="min-h-screen bg-jts-lcream flex flex-col items-center justify-center gap-4 px-4">
        <JtsLogo className="w-16 h-16" />
        <p className="text-gray-600 font-medium text-center">No order found. Start a new order!</p>
        <button
          onClick={() => { clearLastOrder(); navigate('/'); }}
          className="mt-2 px-6 py-3 bg-jts-red text-white font-semibold rounded-xl hover:bg-jts-crimson transition"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  const { orderId, items, subtotal, surchargeTotal, grandTotal, zone, customer, roundOffAmount, date } = lastOrder;

  const lunchItems = items.filter(i => i.category === 'Lunch' || !i.category);
  const choviarItems = items.filter(i => i.category === 'Choviar');

  const lunchSubtotal = lunchItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const choviarSubtotal = choviarItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

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

  return (
    <div className="min-h-screen bg-jts-cream flex flex-col">
      <main className="max-w-md mx-auto w-full px-4 py-8 flex flex-col gap-5">

        {/* Success banner */}
        <div className="bg-white rounded-3xl shadow-md border border-red-100 p-6 flex flex-col items-center text-center gap-3">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl">✅</div>
          <h1 className="font-extrabold text-gray-900 text-xl">Order Placed Successfully!</h1>
          <p className="text-gray-500 text-sm">
            Thank you, <span className="font-semibold text-gray-700">{customer.name}</span>!{' '}
            Your tiffin order has been received. 🛵
          </p>
          <div className="bg-jts-cream border border-red-200 rounded-xl px-5 py-3 w-full flex justify-between items-center text-left">
            <div>
              <p className="text-xs text-jts-red font-medium uppercase tracking-wide">Order ID</p>
              <p className="text-xl font-black text-jts-red tracking-widest">{orderId}</p>
            </div>
            {date && (
              <div className="text-right border-l border-red-200 pl-4">
                <p className="text-xs text-jts-red font-medium uppercase tracking-wide">Delivery Date</p>
                <p className="text-md font-bold text-gray-800">{date}</p>
              </div>
            )}
          </div>
          <p className="text-xs text-jts-navy font-medium">
            📞 For queries: Keyur Shah – 87790 84488
          </p>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-bold text-gray-800 mb-3">🧾 Order Summary</h2>
          <div className="flex flex-col text-sm">
            
            {/* Lunch Section */}
            {lunchItems.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold text-gray-800 mb-2 border-b border-gray-100 pb-1">Lunch Order</h3>
                <div className="flex flex-col gap-2">
                  {lunchItems.map((item) => (
                    <div key={item.name} className="flex justify-between">
                      <span className="text-gray-700">
                        {item.name} <span className="text-gray-400">×{item.quantity}</span>
                      </span>
                      <span className="font-semibold text-gray-800">
                        ₹{(item.price * item.quantity).toLocaleString('en-IN')}/-
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                  <div className="flex justify-between text-gray-700">
                    <span>Items Total</span>
                    <span className="font-semibold">₹{lunchSubtotal.toLocaleString('en-IN')}/-</span>
                  </div>
                  {lunchSurcharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-amber-700">
                        {zone === 'borivali' ? 'Delivery Charge (Orders < ₹250)' : `Outside Borivali surcharge (₹40 × ${lunchOutsideTiffins})`}
                      </span>
                      <span className="font-semibold text-amber-700">+₹{lunchSurcharge}/-</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-800 border-t border-gray-50 pt-1 mt-1 text-sm">
                    <span>Lunch Subtotal</span>
                    <span>₹{(lunchSubtotal + lunchSurcharge).toLocaleString('en-IN')}/-</span>
                  </div>
                </div>
              </div>
            )}

            {/* Choviar Section */}
            {choviarItems.length > 0 && (
              <div className="mb-2">
                <h3 className="font-bold text-gray-800 mb-2 border-b border-gray-100 pb-1">Choviar Order</h3>
                <div className="flex flex-col gap-2">
                  {choviarItems.map((item) => (
                    <div key={item.name} className="flex justify-between">
                      <span className="text-gray-700">
                        {item.name} <span className="text-gray-400">×{item.quantity}</span>
                      </span>
                      <span className="font-semibold text-gray-800">
                        ₹{(item.price * item.quantity).toLocaleString('en-IN')}/-
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                  <div className="flex justify-between text-gray-700">
                    <span>Items Total</span>
                    <span className="font-semibold">₹{choviarSubtotal.toLocaleString('en-IN')}/-</span>
                  </div>
                  {choviarSurcharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-amber-700">
                        {zone === 'borivali' ? 'Delivery Charge (Orders < ₹250)' : `Outside Borivali surcharge (₹40 × ${choviarOutsideTiffins})`}
                      </span>
                      <span className="font-semibold text-amber-700">+₹{choviarSurcharge}/-</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-800 border-t border-gray-50 pt-1 mt-1 text-sm">
                    <span>Choviar Subtotal</span>
                    <span>₹{(choviarSubtotal + choviarSurcharge).toLocaleString('en-IN')}/-</span>
                  </div>
                </div>
              </div>
            )}

            {/* Grand Total */}
            <div className="mt-1 pt-1 space-y-1.5">
              {(roundOffAmount || 0) !== 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Round Off</span>
                  <span className="font-semibold">{(roundOffAmount || 0) > 0 ? '+' : ''}₹{roundOffAmount || 0}/-</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between font-bold mt-1 text-base">
                <span>Total</span>
                <span className="text-jts-red">₹{grandTotal.toLocaleString('en-IN')}/-</span>
              </div>
            </div>

          </div>
        </div>

        {/* Zone note */}
        {zone === 'outside' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 font-medium text-center">
            🚚 Outside Borivali delivery – ₹40/tiffin surcharge included
          </div>
        )}

        {/* Delivery address */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-bold text-gray-800 mb-3">📍 Delivery Address</h2>
          <div className="text-sm text-gray-600 leading-relaxed">
            <p className="font-semibold text-gray-800">{customer.name}</p>
            <p>{customer.phone}</p>
            <p className="mt-1">
              {customer.wingFlat}, {customer.building}<br />
              {customer.street}{customer.landmark ? `, ${customer.landmark}` : ''}<br />
              {customer.locality} – {customer.pincode}
            </p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => { clearLastOrder(); navigate('/'); }}
          className="w-full py-4 bg-jts-red hover:bg-jts-crimson active:bg-red-900 text-white font-bold rounded-2xl text-base transition shadow-md"
        >
          🍱 Place Another Order
        </button>
      </main>
    </div>
  );
}
