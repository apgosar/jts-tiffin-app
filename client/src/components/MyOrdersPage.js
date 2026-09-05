import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../App';
import { ChevronLeft, LogIn, Calendar, XCircle, Search, Edit3, CheckCircle } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const { loadCartFromItems, setEditOrder } = useCart();
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

const DEFAULT_LUNCH_OPTIONS = [
  { name: 'Mini Lunch', desc: '3 Roti, Sabji, Dal, Rice' },
  { name: 'Brunch', desc: '6 Roti, Sabji, 1/2 Dal, 1/2 Rice' },
  { name: 'Full Lunch', desc: '6 Roti, Sabji, Dal, Rice' },
  { name: 'Family Meal', desc: '9 Roti, Sabji, Dal, Rice' }
];

  const [editingOrder, setEditingOrder] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [menuItems, setMenuItems] = useState([]);

  const handleEdit = async (order) => {
    if (!order.isRecurring) {
      loadCartFromItems(order.items || []);
      setEditOrder(order);
      navigate('/');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      const list = data.menu || data.items || [];
      setMenuItems(list);

      let lunch = null;
      let choviar = false;
      let extraRoti = 0;

      (order.items || []).forEach(i => {
        if (['Full Lunch', 'Family Meal', 'Mini Lunch', 'Brunch'].includes(i.name)) {
          lunch = i.name;
        } else if (i.name === 'Choviar' || i.category === 'Choviar') {
          choviar = true;
        } else if (i.name === 'Extra Roti' || i.name === 'Roti') {
          extraRoti = i.quantity;
        }
      });

      const isChov = order.category === 'Choviar' || (order.items || []).some(i => i.name === 'Choviar' || i.category === 'Choviar');
      if (isChov && !choviar) {
        choviar = true;
      }

      setEditingOrder({ ...order, lunch, choviar, extraRoti });
      setModalError(null);
    } catch (err) {
      setError('Failed to load menu for editing');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    setModalLoading(true);
    setModalError(null);

    const isChoviarOrder = editingOrder.category === 'Choviar' || (editingOrder.items || []).some(i => i.name === 'Choviar' || i.category === 'Choviar');

    const items = [];
    if (!isChoviarOrder && editingOrder.lunch) {
      items.push({ name: editingOrder.lunch, quantity: 1 });
    }
    if (isChoviarOrder && editingOrder.choviar) {
      items.push({ name: 'Choviar', quantity: 1 });
    }
    if (editingOrder.extraRoti > 0) {
      items.push({ name: 'Extra Roti', quantity: editingOrder.extraRoti });
    }

    if (items.length === 0) {
      setModalError(!isChoviarOrder ? 'Please select a lunch option or extra roti' : 'Please select at least one item');
      setModalLoading(false);
      return;
    }

    try {
      const { updateOrder } = await import('../services/api');
      const payload = {
        customer: { ...editingOrder },
        items,
        subtotal: 0 // Server recalculates
      };
      const res = await updateOrder(editingOrder.id, phone, payload);
      
      const newItems = res.data?.items || items;
      const newSummary = res.data?.itemsSummary || newItems.map(i => `${i.name}×${i.quantity}`).join(', ');
      const newGrandTotal = res.data?.grandTotal ?? editingOrder.grandTotal;
      const newSurcharge = res.data?.surchargeTotal ?? editingOrder.surchargeTotal;

      // Update local state
      setOrders(orders.map(o => o.id === editingOrder.id ? {
        ...o,
        items: newItems,
        itemsSummary: newSummary,
        grandTotal: newGrandTotal,
        surchargeTotal: newSurcharge
      } : o));

      setEditingOrder(null);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to update order';
      setModalError(errMsg);
    } finally {
      setModalLoading(false);
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
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${order.isRecurring ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {order.isRecurring ? 'Recurring' : 'One-off'}
                      </span>
                      <span className="text-xs text-gray-500 font-medium text-right">#{order.id}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-medium text-gray-800 mb-2">{order.itemsSummary}</p>
                    <div className="flex justify-between items-end mt-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-0.5">Est. Total</p>
                        <p className="text-lg font-extrabold text-jts-red">₹{order.grandTotal}</p>
                      </div>
                      
                      {order.canEdit ? (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEdit(order)}
                            className="px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-1.5"
                          >
                            <Edit3 size={14} /> Edit
                          </button>
                          <button 
                            onClick={() => handleCancel(order.id)}
                            className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5"
                          >
                            <XCircle size={14} /> Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
                          Cannot edit/cancel today
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

      {/* EDIT MODAL */}
      {editingOrder && (() => {
        const isChoviarOrder = editingOrder.category === 'Choviar' || (editingOrder.items || []).some(i => i.name === 'Choviar' || i.category === 'Choviar');
        const lunchOptionsToDisplay = DEFAULT_LUNCH_OPTIONS.map(opt => {
          const match = menuItems.find(m => m.name === opt.name);
          return {
            ...opt,
            price: match ? match.price : null,
            desc: match?.description || opt.desc
          };
        });

        return (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/50 animate-fade-in" onClick={() => setEditingOrder(null)}>
            <div className="bg-white rounded-t-3xl p-6 w-full max-w-md mx-auto animate-slide-up max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Edit Recurring Order</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-semibold text-gray-500">{editingOrder.date}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${isChoviarOrder ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                      {isChoviarOrder ? 'Choviar' : 'Lunch'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setEditingOrder(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                  <XCircle size={24} />
                </button>
              </div>

              {modalError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium">
                  {modalError}
                </div>
              )}

              <div className="space-y-5 mb-8">
                {/* LUNCH OPTIONS (Only if Lunch order) */}
                {!isChoviarOrder && (
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Lunch Options</p>
                    <div className="space-y-2">
                      {lunchOptionsToDisplay.map(opt => {
                        const isSelected = editingOrder.lunch === opt.name;
                        return (
                          <div 
                            key={opt.name}
                            onClick={() => setEditingOrder({ ...editingOrder, lunch: opt.name })}
                            className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between
                              ${isSelected ? 'border-jts-red bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={`font-bold text-sm ${isSelected ? 'text-jts-red' : 'text-gray-800'}`}>{opt.name}</p>
                                {opt.price && <span className="text-xs font-semibold text-gray-500">₹{opt.price}</span>}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                              ${isSelected ? 'border-jts-red bg-jts-red' : 'border-gray-300'}`}>
                              {isSelected && <CheckCircle size={14} className="text-white" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CHOVIAR (Only if Choviar order) */}
                {isChoviarOrder && (
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Choviar Option</p>
                    <div 
                      onClick={() => setEditingOrder({ ...editingOrder, choviar: !editingOrder.choviar })}
                      className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between
                        ${editingOrder.choviar ? 'border-jts-red bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div>
                        <p className={`font-bold text-sm ${editingOrder.choviar ? 'text-jts-red' : 'text-gray-800'}`}>Choviar Meal</p>
                        <p className="text-xs text-gray-500 mt-0.5">Includes evening snacks and delicacies</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                        ${editingOrder.choviar ? 'border-jts-red bg-jts-red' : 'border-gray-300'}`}>
                        {editingOrder.choviar && <CheckCircle size={14} className="text-white" />}
                      </div>
                    </div>
                  </div>
                )}

                {/* ROTI */}
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Add-ons</p>
                  <div className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl bg-white">
                    <div>
                      <span className="font-bold text-gray-800 text-sm">Extra Roti</span>
                      <p className="text-xs text-gray-400">Additional rotis with order</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setEditingOrder({ ...editingOrder, extraRoti: Math.max(0, editingOrder.extraRoti - 1) })}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold"
                      >-</button>
                      <span className="font-bold text-gray-800 w-4 text-center">{editingOrder.extraRoti}</span>
                      <button 
                        onClick={() => setEditingOrder({ ...editingOrder, extraRoti: Math.min(50, (editingOrder.extraRoti || 0) + 1) })}
                        className="w-8 h-8 rounded-full border border-jts-red flex items-center justify-center text-jts-red hover:bg-red-50 font-bold"
                      >+</button>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSaveEdit}
                disabled={modalLoading}
                className="w-full py-3.5 bg-jts-red text-white font-bold rounded-xl shadow-lg hover:bg-jts-crimson active:scale-95 transition-all flex items-center justify-center"
              >
                {modalLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
