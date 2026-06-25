import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, LogIn, Calendar, XCircle, Search } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (phone.length !== 10) {
      return setError('Please enter a valid 10-digit mobile number');
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/manage?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const sortedOrders = (data.orders || []).sort((a, b) => {
        const [d1, m1, y1] = a.date.split('/');
        const [d2, m2, y2] = b.date.split('/');
        return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
      });
      
      setOrders(sortedOrders);
      setIsLoggedIn(true);
    } catch (err) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order? This cannot be undone.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/manage/${encodeURIComponent(orderId)}?phone=${encodeURIComponent(phone)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Remove from list
      setOrders(orders.filter(o => o.id !== orderId));
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="font-bold text-lg text-jts-navy uppercase tracking-wide" style={{ fontFamily: "'Oswald', sans-serif" }}>
              My Orders
            </h1>
            <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Manage Subscriptions</span>
          </div>
          <div className="w-10">
            {isLoggedIn && (
              <button onClick={() => setIsLoggedIn(false)} className="text-xs text-jts-red font-bold">Logout</button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-4">
        {loading && <LoadingSpinner message="Loading..." />}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {!isLoggedIn && !loading ? (
          <div className="animate-fade-in bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center mt-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn size={28} className="text-blue-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">View Your Orders</h2>
            <p className="text-sm text-gray-500 mb-6">Enter your registered mobile number to manage your upcoming recurring orders.</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <input 
                type="tel" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder="10-digit Mobile Number" 
                maxLength="10"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center font-bold text-lg tracking-wider focus:ring-2 focus:ring-jts-red focus:outline-none transition-all"
              />
              <button 
                type="submit" 
                className="w-full py-3.5 bg-jts-red text-white font-bold rounded-xl shadow-md hover:bg-jts-crimson transition-colors flex items-center justify-center gap-2"
              >
                <Search size={18} />
                Find Orders
              </button>
            </form>
          </div>
        ) : isLoggedIn && !loading ? (
          <div className="animate-fade-in space-y-4 mt-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-bold text-gray-800">Upcoming Deliveries</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{orders.length} Active</span>
            </div>

            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-8">
                <Calendar size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No upcoming orders found.</p>
                <button onClick={() => navigate('/recurring')} className="mt-4 text-jts-red font-bold text-sm hover:underline">
                  Schedule a recurring order
                </button>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-jts-navy" />
                      <span className="font-bold text-gray-800 text-sm">{order.date}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-medium text-right">Order #{order.id}</span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-medium text-gray-800 mb-2">{order.itemsSummary}</p>
                    <div className="flex justify-between items-end mt-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-0.5">Est. Total</p>
                        <p className="text-lg font-extrabold text-jts-red">₹{order.grandTotal}</p>
                      </div>
                      
                      {order.canCancel ? (
                        <button 
                          onClick={() => handleCancel(order.id)}
                          className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5"
                        >
                          <XCircle size={14} /> Cancel
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
                          Cannot cancel today
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
