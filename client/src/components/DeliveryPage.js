import React, { useState, useEffect, useRef } from 'react';

function SwipeButton({ isCompleted, onComplete }) {
  const [sliderPos, setSliderPos] = useState(4);
  const containerRef = useRef(null);

  const handleTouchMove = (e) => {
    if (isCompleted) return;
    const container = containerRef.current;
    if (!container) return;
    
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    let newPos = touch.clientX - rect.left - 24;
    
    const maxPos = rect.width - 52;
    if (newPos < 4) newPos = 4;
    if (newPos > maxPos) newPos = maxPos;
    
    setSliderPos(newPos);
  };

  const handleTouchEnd = () => {
    if (isCompleted) return;
    const container = containerRef.current;
    if (!container) return;
    
    const maxPos = container.getBoundingClientRect().width - 52;
    if (sliderPos > maxPos * 0.7) {
      setSliderPos(maxPos);
      onComplete();
    } else {
      setSliderPos(4);
    }
  };

  useEffect(() => {
    if (!isCompleted) setSliderPos(4);
  }, [isCompleted]);

  return (
    <div 
      ref={containerRef}
      className={`relative h-14 rounded-full overflow-hidden flex items-center transition-colors shadow-inner ${
        isCompleted ? 'bg-green-500' : 'bg-gray-200'
      }`}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`font-extrabold text-base ${isCompleted ? 'text-white' : 'text-gray-500'} ml-6`}>
          {isCompleted ? 'पेमेंट प्राप्त (Received)' : 'Swipe to Complete ➔'}
        </span>
      </div>
      
      <div 
        className={`absolute top-1 bottom-1 w-12 rounded-full shadow-md flex items-center justify-center transition-all ${isCompleted ? 'bg-white text-green-500' : 'bg-white text-gray-400 duration-150 ease-out'}`}
        style={{ left: isCompleted ? 'calc(100% - 52px)' : sliderPos + 'px' }}
      >
        <span className="text-xl font-bold">{isCompleted ? '✓' : '➔'}</span>
      </div>
    </div>
  );
}

function DeliveryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [savingOrderId, setSavingOrderId] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/delivery/orders');
      if (!res.ok) throw new Error('Failed to fetch delivery orders');
      const data = await res.json();
      setOrders(data.orders || []);
      
      // Group to find distinct riders
      const riders = [...new Set((data.orders || []).map(o => o.deliveryPerson))];
      if (riders.length > 0) {
        setActiveTab(riders[0]);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('ऑर्डर लोड करने में समस्या। (Error loading orders)');
      setLoading(false);
    }
  };

  const handlePaymentChange = async (rowIndex, orderId, paymentReceived, paymentMethod) => {
    setSavingOrderId(orderId);
    
    // Optimistic update
    setOrders(prev => prev.map(o => 
      o.rowIndex === rowIndex 
        ? { ...o, paymentReceived, paymentMethod }
        : o
    ));

    try {
      const res = await fetch('/api/delivery/orders/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex, paymentReceived, paymentMethod })
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch (err) {
      alert('सेव करने में त्रुटि (Error saving). कृपया पुनः प्रयास करें।');
      // Revert if error
      fetchOrders();
    } finally {
      setTimeout(() => {
        setSavingOrderId(null);
      }, 1000); // Keep 'Saving...' / 'Saved' visible briefly
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-xl font-bold text-jts-red animate-pulse">ऑर्डर लोड हो रहे हैं...</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-red-600 font-bold bg-white p-4 rounded-xl shadow">{error}</div>
    </div>
  );

  const riders = [...new Set(orders.map(o => o.deliveryPerson))];
  const activeOrders = orders.filter(o => o.deliveryPerson === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-jts-red text-white p-4 sticky top-0 z-10 shadow-md">
        <h1 className="text-2xl font-bold text-center" style={{ fontFamily: "'Oswald', sans-serif" }}>
          JTS Delivery Portal
        </h1>
        <p className="text-center text-red-200 text-xs mt-1 font-medium tracking-wide">
          Showing Orders for: Delivery Date ({new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })})
        </p>
      </header>

      {/* Rider Tabs */}
      {riders.length > 0 ? (
        <div className="flex overflow-x-auto bg-white shadow-sm hide-scrollbar sticky top-16 z-10">
          {riders.map(rider => (
            <button
              key={rider}
              onClick={() => setActiveTab(rider)}
              className={`flex-1 min-w-[120px] py-4 text-center font-bold text-lg border-b-4 transition-colors ${
                activeTab === rider 
                  ? 'border-jts-red text-jts-red bg-red-50' 
                  : 'border-transparent text-gray-500 hover:bg-gray-50'
              }`}
            >
              {rider}
            </button>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500 font-bold text-lg">
          आज के लिए कोई ऑर्डर असाइन नहीं किया गया है।
        </div>
      )}

      {/* Orders List */}
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {activeOrders.map((order, idx) => (
          <div 
            key={order.orderId} 
            className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all ${
              order.paymentReceived ? 'border-green-400 bg-green-50/30' : 'border-gray-200'
            }`}
          >
            {/* Header (Route Order & Status) */}
            <div className={`px-4 py-2 flex justify-between items-center ${order.paymentReceived ? 'bg-green-100' : 'bg-gray-100'}`}>
              <span className="font-extrabold text-gray-800 text-lg">
                # {order.routeOrder}
              </span>
              <span className="text-sm font-bold">
                {savingOrderId === order.orderId ? (
                  <span className="text-blue-600 animate-pulse">Saving...</span>
                ) : order.paymentReceived ? (
                  <span className="text-green-700 flex items-center gap-1">✅ Saved</span>
                ) : (
                  <span className="text-gray-500">Pending</span>
                )}
              </span>
            </div>

            <div className="p-4 space-y-3">
              {/* Hindi Details */}
              <div>
                <p className="text-sm text-gray-500 font-bold">नाम</p>
                <div className="flex justify-between items-start gap-2">
                  <p className="text-xl font-bold text-gray-900">{order.name}</p>
                  {order.phone && (
                    <a 
                      href={`tel:${order.phone}`}
                      className="bg-jts-red text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-sm active:scale-95 transition-transform"
                    >
                      📞 कॉल करें (Call)
                    </a>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 font-bold">पता</p>
                <p className="text-lg font-medium text-gray-800 leading-tight">{order.address}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 font-bold">रकम (Amount)</p>
                <p className="text-2xl font-extrabold text-jts-red">₹{order.amount}/-</p>
              </div>

              <hr className="border-gray-200 my-3" />

              {/* Payment Actions */}
              <div className="space-y-4">
                <div className="flex gap-4 items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-lg text-gray-700">
                    <input 
                      type="radio" 
                      name={`payment-method-${order.orderId}`} 
                      checked={order.paymentMethod === 'Cash'}
                      onChange={() => handlePaymentChange(order.rowIndex, order.orderId, order.paymentReceived, 'Cash')}
                      className="w-5 h-5 text-jts-red focus:ring-jts-red"
                    />
                    Cash
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-lg text-gray-700">
                    <input 
                      type="radio" 
                      name={`payment-method-${order.orderId}`} 
                      checked={order.paymentMethod === 'GPay'}
                      onChange={() => handlePaymentChange(order.rowIndex, order.orderId, order.paymentReceived, 'GPay')}
                      className="w-5 h-5 text-jts-red focus:ring-jts-red"
                    />
                    GPay
                  </label>
                </div>

                <SwipeButton 
                  isCompleted={order.paymentReceived} 
                  onComplete={() => handlePaymentChange(order.rowIndex, order.orderId, true, order.paymentMethod)} 
                />
                
                {order.paymentReceived && (
                  <button 
                    onClick={() => handlePaymentChange(order.rowIndex, order.orderId, false, order.paymentMethod)}
                    className="w-full py-2 text-center text-sm font-bold text-gray-400 hover:text-gray-600 underline mt-2"
                  >
                    Undo (गलती से हो गया?)
                  </button>
                )}
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DeliveryPage;
