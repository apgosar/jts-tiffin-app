import React, { useState, useEffect } from 'react';

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

  const handlePaymentChange = async (rowIndex, orderId, paymentReceived, paymentMethod, amountReceived) => {
    setSavingOrderId(orderId);
    
    // Optimistic update
    setOrders(prev => prev.map(o => 
      o.rowIndex === rowIndex 
        ? { ...o, paymentReceived, paymentMethod, amountReceived }
        : o
    ));

    try {
      const res = await fetch('/api/delivery/orders/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex, paymentReceived, paymentMethod, amountReceived })
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch (err) {
      alert('सेव करने में त्रुटि (Error saving). कृपया पुनः प्रयास करें।');
      fetchOrders();
    } finally {
      setTimeout(() => {
        setSavingOrderId(null);
      }, 1000);
    }
  };

  const handleLocalAmountChange = (orderId, newAmount) => {
    // Only whole numbers or empty
    if (newAmount && !/^\d+$/.test(newAmount)) return;
    
    setOrders(prev => prev.map(o => 
      o.orderId === orderId 
        ? { ...o, amountReceived: newAmount }
        : o
    ));
  };

  const handleAmountBlur = (order) => {
    // Save amount when input loses focus
    handlePaymentChange(order.rowIndex, order.orderId, order.paymentReceived, order.paymentMethod, order.amountReceived);
  };

  const handleCheckboxToggle = (order) => {
    const isNowChecked = !order.paymentReceived;
    // Default amountReceived to receivable amount if checking, unless it's already set
    let newAmountReceived = order.amountReceived;
    if (isNowChecked && (!newAmountReceived || newAmountReceived === '')) {
      newAmountReceived = order.amount.toString();
    } else if (!isNowChecked) {
      // Clear amount if unchecking
      newAmountReceived = '';
    }
    handlePaymentChange(order.rowIndex, order.orderId, isNowChecked, order.paymentMethod, newAmountReceived);
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
  const activeOrders = orders
    .filter(o => o.deliveryPerson === activeTab)
    .sort((a, b) => a.routeOrder - b.routeOrder);

  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  const totalCash = activeOrders.reduce((sum, order) => {
    if (order.paymentReceived && order.paymentMethod === 'Cash' && order.amountReceived) {
      return sum + parseInt(order.amountReceived, 10);
    }
    return sum;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-jts-red text-white p-4 sticky top-0 z-10 shadow-md">
        <h1 className="text-2xl font-bold text-center" style={{ fontFamily: "'Oswald', sans-serif" }}>
          JTS Delivery Portal
        </h1>
        <p className="text-center text-red-200 text-xs mt-1 font-medium tracking-wide">
          Delivery Date: {todayStr}
        </p>
      </header>

      {riders.length > 0 && (
        <div className="flex overflow-x-auto bg-white shadow-sm hide-scrollbar sticky top-[68px] z-10">
          {riders.map(rider => (
            <button
              key={rider}
              onClick={() => setActiveTab(rider)}
              className={`flex-1 min-w-[120px] py-3 text-center font-bold text-lg border-b-4 transition-colors ${
                activeTab === rider 
                  ? 'border-jts-red text-jts-red bg-red-50' 
                  : 'border-transparent text-gray-500 hover:bg-gray-50'
              }`}
            >
              {rider}
            </button>
          ))}
        </div>
      )}

      {riders.length > 0 && (
        <div className="bg-green-100 text-green-900 px-4 py-3 text-center font-bold text-lg shadow-sm border-b border-green-200 sticky top-[118px] z-10">
          Total Cash Received : ₹{totalCash}
        </div>
      )}

      {riders.length === 0 && (
        <div className="p-8 text-center text-gray-500 font-bold text-lg">
          आज के लिए कोई ऑर्डर असाइन नहीं किया गया है।
        </div>
      )}

      <div className="p-2 mx-auto max-w-4xl mt-2">
        {activeOrders.length > 0 && (
          <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-300">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-100 border-b border-gray-300 text-gray-800 uppercase tracking-wider">
                <tr>
                  <th className="border-r border-gray-300 px-1 py-2 text-center w-8">#</th>
                  <th className="border-r border-gray-300 px-2 py-2 w-1/3">Details</th>
                  <th className="border-r border-gray-300 px-1 py-2 text-center w-12">Amt</th>
                  <th className="px-1 py-2 text-center">Collection</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map(order => (
                  <tr key={order.orderId} className={`border-b border-gray-300 transition ${order.paymentReceived ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}>
                    <td className="border-r border-gray-300 px-1 py-2 text-center align-middle font-bold text-gray-700">
                      {order.routeOrder}
                    </td>
                    <td className="border-r border-gray-300 px-2 py-2 align-middle">
                      <div className="flex justify-between items-start gap-1 mb-1">
                        <div className="font-bold text-gray-900 text-sm">{order.name}</div>
                        {order.phone && (
                          <a 
                            href={`tel:${order.phone}`}
                            className="bg-jts-red text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap"
                          >
                            📞 Call
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-gray-700 leading-snug break-words">
                        {order.address}
                      </div>
                    </td>
                    <td className="border-r border-gray-300 px-2 py-2 text-center align-middle font-black text-jts-red text-base">
                      ₹{order.amount}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      {savingOrderId === order.orderId && <div className="text-[10px] text-blue-600 font-bold mb-1 animate-pulse text-right">Saving...</div>}
                      <div className="flex flex-col gap-2">
                        {/* Status Checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 rounded p-1.5 hover:border-gray-300 shadow-sm">
                          <input 
                            type="checkbox" 
                            checked={order.paymentReceived}
                            onChange={() => handleCheckboxToggle(order)}
                            className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                          />
                          <span className={`font-bold ${order.paymentReceived ? 'text-green-700' : 'text-gray-600'}`}>
                            {order.paymentReceived ? 'Received ✅' : 'Pending'}
                          </span>
                        </label>
                        
                        {/* Method & Amount Input */}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <div className="flex items-center gap-3 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input 
                                type="radio" 
                                name={`method-${order.orderId}`} 
                                checked={order.paymentMethod === 'Cash'}
                                onChange={() => handlePaymentChange(order.rowIndex, order.orderId, order.paymentReceived, 'Cash', order.amountReceived)}
                                className="w-3.5 h-3.5 text-jts-red focus:ring-jts-red"
                              />
                              <span className="text-[11px] font-bold text-gray-700">Cash</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input 
                                type="radio" 
                                name={`method-${order.orderId}`} 
                                checked={order.paymentMethod === 'GPay'}
                                onChange={() => handlePaymentChange(order.rowIndex, order.orderId, order.paymentReceived, 'GPay', order.amountReceived)}
                                className="w-3.5 h-3.5 text-jts-red focus:ring-jts-red"
                              />
                              <span className="text-[11px] font-bold text-gray-700">GPay</span>
                            </label>
                          </div>
                          
                          <div className="flex items-center gap-1 ml-auto">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Amt</span>
                            <input 
                              type="text"
                              value={order.amountReceived || ''}
                              onChange={(e) => handleLocalAmountChange(order.orderId, e.target.value)}
                              onBlur={() => handleAmountBlur(order)}
                              placeholder="₹"
                              className="w-16 px-1.5 py-1 text-sm font-bold text-center border border-gray-300 rounded focus:outline-none focus:border-jts-red"
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeliveryPage;
