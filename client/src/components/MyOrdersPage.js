import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../App';
import { 
  ChevronLeft, LogIn, Calendar, XCircle, Search, Edit3, 
  CheckCircle, CreditCard, Package, Copy, Check, AlertCircle, 
  MessageCircle, QrCode, ArrowUpRight, RefreshCw 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import LoadingSpinner from './LoadingSpinner';

const UPI_ID = 'keyus2525-1@okhdfcbank';
const PAYEE_NAME = 'Keyur Shah';
const WHATSAPP_PHONE = '918779084488';

const getFirstDayOfMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const getTodayDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const { loadCartFromItems, setEditOrder } = useCart();
  const [phone, setPhone] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Navigation tab
  const [activeTab, setActiveTab] = useState('billing'); // 'billing' or 'deliveries'

  // Deliveries state
  const [orders, setOrders] = useState([]);
  const [cancelOrderModal, setCancelOrderModal] = useState(null);
  const [cancelling, setCancelling]             = useState(false);
  const [cancelError, setCancelError]           = useState(null);

  // Billing state
  const [billingOrders, setBillingOrders]       = useState([]);
  const [billingCustomer, setBillingCustomer]   = useState(null);
  const [billingLoading, setBillingLoading]     = useState(false);
  const [billingError, setBillingError]         = useState(null);
  const [startDate, setStartDate]               = useState(getFirstDayOfMonth);
  const [endDate, setEndDate]                   = useState(getTodayDate);
  const [billingFilter, setBillingFilter]       = useState('all'); // 'all' | 'unpaid' | 'paid'
  const [payModalOpen, setPayModalOpen]         = useState(false);
  const [copiedToast, setCopiedToast]           = useState(false);

  const fetchOrdersForPhone = async (phoneNumber) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/manage?phone=${encodeURIComponent(phoneNumber)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const sortedOrders = (data.orders || []).sort((a, b) => {
        const [d1, m1, y1] = a.date.split('/');
        const [d2, m2, y2] = b.date.split('/');
        return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
      });

      setOrders(sortedOrders);
    } catch (err) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchBillingForPhone = async (phoneNumber) => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const res = await fetch(`/api/customer/billing?phone=${encodeURIComponent(phoneNumber)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBillingOrders(data.orders || []);
      setBillingCustomer(data.customer || null);
    } catch (err) {
      setBillingError(err.message || 'Failed to fetch billing information');
    } finally {
      setBillingLoading(false);
    }
  };

  const loadAllCustomerData = async (phoneNumber) => {
    setIsLoggedIn(true);
    await Promise.all([
      fetchOrdersForPhone(phoneNumber),
      fetchBillingForPhone(phoneNumber)
    ]);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('phone') || '';
    if (/^[6-9]\d{9}$/.test(p)) {
      setPhone(p);
      loadAllCustomerData(p);
    } else {
      try {
        const saved = localStorage.getItem('jts_customer_profile');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.phone && /^[6-9]\d{9}$/.test(parsed.phone)) {
            setPhone(parsed.phone);
          }
        }
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      return setError('Please enter a valid 10-digit mobile number');
    }
    await loadAllCustomerData(phone.trim());
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setOrders([]);
    setBillingOrders([]);
    setBillingCustomer(null);
    setPayModalOpen(false);
  };

  const handleConfirmCancel = async () => {
    if (!cancelOrderModal) return;
    const orderId = cancelOrderModal.orderId || cancelOrderModal.id;
    const phoneToUse = cancelOrderModal.phone || phone;

    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/orders/manage/${encodeURIComponent(orderId)}?phone=${encodeURIComponent(phoneToUse)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel order');

      // Remove from active list
      setOrders(prev => prev.filter(o => (o.orderId || o.id) !== orderId));
      setCancelOrderModal(null);
      // Refresh billing list too
      fetchBillingForPhone(phoneToUse);
    } catch (err) {
      console.error('Cancel order failed:', err);
      setCancelError(err.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
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
  const [modalError, setModalError]     = useState(null);
  const [menuItems, setMenuItems]       = useState([]);

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
        subtotal: 0
      };
      const res = await updateOrder(editingOrder.id, phone, payload);
      
      const newItems = res.data?.items || items;
      const newSummary = res.data?.itemsSummary || newItems.map(i => `${i.name}×${i.quantity}`).join(', ');
      const newGrandTotal = res.data?.grandTotal ?? editingOrder.grandTotal;
      const newSurcharge = res.data?.surchargeTotal ?? editingOrder.surchargeTotal;

      setOrders(orders.map(o => o.id === editingOrder.id ? {
        ...o,
        items: newItems,
        itemsSummary: newSummary,
        grandTotal: newGrandTotal,
        surchargeTotal: newSurcharge
      } : o));

      setEditingOrder(null);
      fetchBillingForPhone(phone);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to update order';
      setModalError(errMsg);
    } finally {
      setModalLoading(false);
    }
  };

  // ─── Billing Calculations ───────────────────────────────────────────────────
  const parseOrderDate = (dStr) => {
    if (!dStr) return new Date(0);
    const [d, m, y] = dStr.split('/');
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  };

  const startObj = startDate ? new Date(startDate + 'T00:00:00') : null;
  const endObj   = endDate   ? new Date(endDate + 'T23:59:59')   : null;

  const filteredBillingOrders = billingOrders.filter(o => {
    const oDate = parseOrderDate(o.date);
    if (startObj && oDate < startObj) return false;
    if (endObj && oDate > endObj) return false;
    return true;
  });

  const totalBilled = filteredBillingOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
  const totalPaid = filteredBillingOrders.reduce((sum, o) => sum + (Number(o.paid) || 0), 0);
  const totalOutstanding = filteredBillingOrders.reduce((sum, o) => sum + (Number(o.outstanding) || 0), 0);
  const unpaidCount = filteredBillingOrders.filter(o => o.outstanding > 0).length;
  const paidCount = filteredBillingOrders.filter(o => o.outstanding === 0).length;

  const displayedBillingOrders = filteredBillingOrders.filter(o => {
    if (billingFilter === 'unpaid') return o.outstanding > 0;
    if (billingFilter === 'paid') return o.outstanding === 0;
    return true;
  });

  const upiUri = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${totalOutstanding}&cu=INR&tn=${encodeURIComponent('JTS Tiffin Bill')}`;
  const waUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(`Hi Keyur, I have paid ₹${totalOutstanding} for my tiffin bill via UPI. Please find the payment screenshot attached.`)}`;

  const handlePayNow = () => {
    if (totalOutstanding <= 0) return;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = upiUri;
    }
    setPayModalOpen(true);
  };

  const handleCopyUPI = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      // fallback
    }
  };

  const setLastMonthDates = () => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = prevMonth.getFullYear();
    const m = String(prevMonth.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, prevMonth.getMonth() + 1, 0).getDate();
    setStartDate(`${y}-${m}-01`);
    setEndDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full" aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="font-bold text-lg text-jts-navy uppercase tracking-wide" style={{ fontFamily: "'Oswald', sans-serif" }}>
              Customer Portal
            </h1>
            <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">
              {isLoggedIn ? (activeTab === 'billing' ? 'Billing & Payments' : 'Manage Subscriptions') : 'Login'}
            </span>
          </div>
          <div className="w-12 text-right">
            {isLoggedIn && (
              <button onClick={handleLogout} className="text-xs text-jts-red font-bold hover:underline">
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-4">
        {(loading || billingLoading) && <LoadingSpinner message="Loading your details..." />}

        {(error || billingError) && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium flex items-center justify-between">
            <span>{error || billingError}</span>
            <button onClick={() => { setError(null); setBillingError(null); }} className="text-red-400 hover:text-red-700">
              <XCircle size={16} />
            </button>
          </div>
        )}

        {!isLoggedIn && !loading ? (
          <div className="animate-fade-in bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center mt-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn size={28} className="text-blue-500" />
            </div>
            <h2 className="text-xl font-bold mb-1">Customer Login</h2>
            <p className="text-xs text-gray-500 mb-6">Enter your registered 10-digit mobile number to view your billing, payments, and upcoming deliveries.</p>
            
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
                Access Portal
              </button>
            </form>
          </div>
        ) : isLoggedIn ? (
          <div className="animate-fade-in space-y-4">
            {/* Top Navigation Tabs */}
            <div className="flex bg-gray-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('billing')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'billing' 
                    ? 'bg-white text-jts-navy shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CreditCard size={15} className={activeTab === 'billing' ? 'text-jts-red' : ''} />
                <span>My Billing</span>
                {totalOutstanding > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                    Due
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('deliveries')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'deliveries' 
                    ? 'bg-white text-jts-navy shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Package size={15} className={activeTab === 'deliveries' ? 'text-jts-red' : ''} />
                <span>Upcoming Deliveries</span>
                {orders.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {orders.length}
                  </span>
                )}
              </button>
            </div>

            {/* ════════════════════ BILLING SECTION ════════════════════ */}
            {activeTab === 'billing' && (
              <div className="space-y-4">
                {/* Customer Greeting Header */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account</span>
                    <h2 className="font-bold text-base text-gray-800 leading-tight">
                      {billingCustomer?.name || 'Valued Customer'}
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">{phone}</p>
                  </div>
                  <button 
                    onClick={() => fetchBillingForPhone(phone)} 
                    title="Refresh billing data" 
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>

                {/* Date Selection Card */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                      <Calendar size={14} className="text-jts-red" />
                      Billing Period
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => { setStartDate(getFirstDayOfMonth()); setEndDate(getTodayDate()); }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                      >
                        This Month
                      </button>
                      <button
                        type="button"
                        onClick={setLastMonthDates}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                      >
                        Last Month
                      </button>
                      <button
                        type="button"
                        onClick={() => { setStartDate(''); setEndDate(''); }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                      >
                        All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        From Date
                      </label>
                      <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-jts-red"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        To Date
                      </label>
                      <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-jts-red"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary Totals */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100">
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Total Billed</p>
                    <p className="text-xl font-black text-gray-800 mt-0.5">₹{totalBilled.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">{filteredBillingOrders.length} orders</p>
                  </div>
                  <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100">
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Total Paid</p>
                    <p className="text-xl font-black text-green-600 mt-0.5">₹{totalPaid.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">{paidCount} cleared</p>
                  </div>
                </div>

                {/* Outstanding & Pay Now Card */}
                {totalOutstanding > 0 ? (
                  <div className="bg-gradient-to-br from-red-500 via-rose-600 to-jts-crimson rounded-3xl p-5 text-white shadow-xl shadow-red-500/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="inline-block bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider uppercase backdrop-blur-sm mb-1">
                          Payment Due
                        </span>
                        <p className="text-xs text-red-100 font-semibold">Total Outstanding Balance</p>
                        <p className="text-3xl font-black text-white tracking-tight mt-0.5">
                          ₹{totalOutstanding.toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-red-100/90 font-medium mt-1">
                          {unpaidCount} unpaid {unpaidCount === 1 ? 'order' : 'orders'} in selected period
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                        <CreditCard size={22} className="text-white" />
                      </div>
                    </div>

                    <div className="mt-5 space-y-2">
                      <button 
                        type="button" 
                        onClick={handlePayNow}
                        className="w-full py-3.5 bg-white text-jts-crimson hover:bg-gray-50 font-black text-sm rounded-2xl shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                      >
                        <span>Pay ₹{totalOutstanding.toLocaleString('en-IN')} Now via UPI</span>
                        <ArrowUpRight size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayModalOpen(true)}
                        className="w-full text-center text-xs font-bold text-red-100 hover:text-white py-1 flex items-center justify-center gap-1.5 transition"
                      >
                        <QrCode size={14} />
                        <span>Scan UPI QR Code / View Payee Details</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 text-center">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                      <CheckCircle size={28} />
                    </div>
                    <h3 className="font-bold text-emerald-900 text-base">All Dues Cleared!</h3>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      You have no pending balance for the selected billing period. Thank you!
                    </p>
                  </div>
                )}

                {/* Orders Breakdown Filter & List */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-bold text-gray-800 text-sm">Order Breakdown</h3>
                    <div className="flex bg-gray-100 p-0.5 rounded-lg text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setBillingFilter('all')}
                        className={`px-2.5 py-1 rounded-md transition ${billingFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                      >
                        All ({filteredBillingOrders.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingFilter('unpaid')}
                        className={`px-2.5 py-1 rounded-md transition ${billingFilter === 'unpaid' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                      >
                        Unpaid ({unpaidCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingFilter('paid')}
                        className={`px-2.5 py-1 rounded-md transition ${billingFilter === 'paid' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
                      >
                        Paid ({paidCount})
                      </button>
                    </div>
                  </div>

                  {displayedBillingOrders.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                      <Calendar size={36} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 font-medium text-xs">No orders found for the selected filter or date range.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {displayedBillingOrders.map(order => {
                        const isPaid = order.outstanding === 0;
                        const isPartial = order.paid > 0 && order.outstanding > 0;

                        return (
                          <div 
                            key={order.orderId} 
                            className={`bg-white rounded-2xl p-4 shadow-sm border transition ${
                              isPaid ? 'border-gray-200' : 'border-red-200 bg-red-50/10'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-800 text-sm">{order.date}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                  order.category === 'Choviar' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                }`}>
                                  {order.category || 'Lunch'}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono font-semibold text-gray-400">
                                #{order.orderId}
                              </span>
                            </div>

                            <p className="text-xs text-gray-600 font-medium mt-1.5 leading-relaxed">
                              {order.itemsSummary}
                            </p>

                            <div className="flex justify-between items-end mt-3 pt-2.5 border-t border-gray-100">
                              <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                  Order Total
                                </span>
                                <span className="text-base font-extrabold text-gray-900">
                                  ₹{order.grandTotal}
                                </span>
                              </div>

                              <div className="text-right">
                                {isPaid ? (
                                  <div className="flex flex-col items-end">
                                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-full">
                                      <CheckCircle size={12} />
                                      Paid
                                    </span>
                                    {order.paymentMethod && (
                                      <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                                        via {order.paymentMethod} {order.paymentDate ? `(${order.paymentDate})` : ''}
                                      </span>
                                    )}
                                  </div>
                                ) : isPartial ? (
                                  <div className="flex flex-col items-end">
                                    <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">
                                      Partial
                                    </span>
                                    <span className="text-[10px] font-bold text-jts-red mt-0.5">
                                      Due: ₹{order.outstanding} (₹{order.paid} paid)
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
                                      <AlertCircle size={12} />
                                      Unpaid
                                    </span>
                                    <span className="text-[10px] font-bold text-jts-red mt-0.5">
                                      Due: ₹{order.outstanding}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════════ DELIVERIES SECTION ════════════════════ */}
            {activeTab === 'deliveries' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="font-bold text-gray-800">Upcoming Deliveries</h2>
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                    {orders.length} Active
                  </span>
                </div>

                {orders.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-4">
                    <Calendar size={40} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No upcoming deliveries found.</p>
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
                          
                          {order.canEdit || order.canCancel ? (
                            <div className="flex gap-2">
                              {order.canEdit && (
                                <button 
                                  onClick={() => handleEdit(order)}
                                  className="px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-1.5"
                                >
                                  <Edit3 size={14} /> Edit
                                </button>
                              )}
                              {order.canCancel && (
                                <button 
                                  onClick={() => {
                                    setCancelError(null);
                                    setCancelOrderModal(order);
                                  }}
                                  className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5"
                                >
                                  <XCircle size={14} /> Cancel
                                </button>
                              )}
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
            )}
          </div>
        ) : null}
      </main>

      {/* ════════════════════ UPI PAYMENT / QR MODAL ════════════════════ */}
      {payModalOpen && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setPayModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 animate-slide-up text-center max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div className="text-left">
                <h3 className="text-lg font-bold text-gray-900 leading-tight">Pay via UPI</h3>
                <p className="text-xs text-gray-500 font-medium">Jain Tiffin Service</p>
              </div>
              <button 
                onClick={() => setPayModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Amount Banner */}
            <div className="bg-red-50 border border-red-100 rounded-2xl p-3.5 mb-4">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">Total Amount Due</span>
              <span className="text-3xl font-black text-jts-red tracking-tight">₹{totalOutstanding.toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-gray-500 font-medium block mt-0.5">Payee: {PAYEE_NAME}</span>
            </div>

            {/* Direct Open Button for Mobile */}
            <div className="mb-4">
              <a
                href={upiUri}
                className="w-full py-3.5 bg-jts-red text-white font-black text-sm rounded-xl shadow-lg hover:bg-jts-crimson active:scale-[0.99] transition flex items-center justify-center gap-2"
              >
                <CreditCard size={18} />
                <span>Open in UPI App (GPay / PhonePe)</span>
              </a>
              <p className="text-[10px] text-gray-400 mt-1">Directly opens installed UPI app with prefilled details</p>
            </div>

            {/* QR Code Section */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-4">
              <p className="text-xs font-bold text-gray-700 mb-2">Or Scan QR with Any UPI App</p>
              <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-200 inline-block">
                <QRCodeSVG value={upiUri} size={160} level="M" />
              </div>
              
              {/* Copy UPI ID */}
              <div className="mt-3 flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2">
                <span className="text-xs font-mono font-bold text-gray-800 truncate mr-2">{UPI_ID}</span>
                <button
                  type="button"
                  onClick={handleCopyUPI}
                  className="shrink-0 text-xs font-bold text-jts-red hover:text-jts-crimson flex items-center gap-1"
                >
                  {copiedToast ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  <span>{copiedToast ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* WhatsApp Confirmation Section (Option 1 Workflow) */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 text-left mb-3">
              <div className="flex items-center gap-1.5 mb-1 text-emerald-900 font-bold text-xs">
                <MessageCircle size={15} className="text-emerald-600" />
                <span>Step 2: Share Confirmation</span>
              </div>
              <p className="text-[11px] text-emerald-800 mb-2 leading-relaxed">
                After paying, please share a screenshot on WhatsApp so we can verify and mark your bill as paid.
              </p>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                <span>Share Screenshot on WhatsApp</span>
              </a>
            </div>

            <button
              type="button"
              onClick={() => setPayModalOpen(false)}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════ EDIT MODAL ════════════════════ */}
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

      {/* ════════════════════ CANCEL CONFIRMATION MODAL ════════════════════ */}
      {cancelOrderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => !cancelling && setCancelOrderModal(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
              <XCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-1">Cancel Order?</h3>
            <p className="text-xs text-gray-500 text-center mb-4 font-medium">
              Are you sure you want to cancel this order? This action cannot be undone.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 mb-4 text-xs space-y-2">
              <div className="flex justify-between items-center font-bold text-gray-800">
                <span className="tracking-wide">Order #{cancelOrderModal.orderId || cancelOrderModal.id}</span>
                <span className="text-jts-red font-black text-sm">₹{cancelOrderModal.grandTotal}</span>
              </div>
              <div className="flex justify-between text-gray-600 font-medium">
                <span>Delivery Date:</span>
                <span className="font-semibold text-gray-800">{cancelOrderModal.date}</span>
              </div>
              <div className="text-gray-700 font-medium pt-1.5 border-t border-gray-200/60 leading-relaxed">
                {cancelOrderModal.itemsSummary}
              </div>
            </div>

            {cancelError && (
              <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-700 font-medium text-center">
                {cancelError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={handleConfirmCancel}
                className="w-full py-3.5 bg-jts-red text-white font-bold rounded-xl text-sm hover:bg-jts-crimson shadow-md active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Cancelling…
                  </>
                ) : (
                  'Yes, Cancel Order'
                )}
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelOrderModal(null)}
                className="w-full py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200 transition"
              >
                Keep Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
