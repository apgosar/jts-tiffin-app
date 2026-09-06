import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MenuPage from './components/MenuPage';
import CheckoutPage from './components/CheckoutPage';
import ConfirmationPage from './components/ConfirmationPage';
import AdminPage from './components/AdminPage';
import DeliveryPage from './components/DeliveryPage';

import RecurringPage from './components/RecurringPage';
import MyOrdersPage from './components/MyOrdersPage';

// ─── Cart Context ─────────────────────────────────────────────────────────────
export const CartContext = createContext(null);

export function useCart() {
  return useContext(CartContext);
}

const CART_STORAGE_KEY  = 'jts-tiffin:cart';
const ORDER_STORAGE_KEY = 'jts-tiffin:last-order';

function getStoredJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function getOrderingState(metadata = {}) {
  // Allow ?simHour=X in the URL for testing — disabled in production builds
  const isDev = process.env.NODE_ENV !== 'production';
  const urlParams = new URLSearchParams(window.location.search);
  const simHourParam = isDev ? urlParams.get('simHour') : null;
  
  const now = new Date();
  const hour = simHourParam !== null ? parseInt(simHourParam, 10) : now.getHours();

  const currentTime = new Date(now);
  if (simHourParam !== null) {
    currentTime.setHours(hour, 0, 0, 0);
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  let targetDate = null;

  // 1. If admin explicitly published liveMenuDate, use that if it's today or future
  if (metadata.liveMenuDate && /^\d{2}\/\d{2}\/\d{4}$/.test(metadata.liveMenuDate)) {
    const [d, m, y] = metadata.liveMenuDate.split('/');
    const liveDateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    liveDateObj.setHours(0, 0, 0, 0);
    if (liveDateObj >= today) {
      targetDate = liveDateObj;
    }
  }

  // 2. Default target date logic if liveMenuDate is not set or in the past
  if (!targetDate) {
    targetDate = new Date(today);
    // Rollover to tomorrow if 7 PM or later
    if (hour >= 19) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
  }

  const getCutoff = (timeStr, dayPref, date) => {
    const [h = '5', min = '0'] = (timeStr || '05:00').split(':');
    const cTime = new Date(date);
    if (dayPref === 'Previous Day') cTime.setDate(cTime.getDate() - 1);
    cTime.setHours(parseInt(h, 10), parseInt(min, 10), 0, 0);
    return cTime;
  };

  let lunchCutoffTime = getCutoff(metadata.lunchCutoff || '05:00', metadata.lunchCutoffDay || 'Same Day', targetDate);
  let choviarCutoffTime = getCutoff(metadata.choviarCutoff || '11:00', metadata.choviarCutoffDay || 'Same Day', targetDate);

  let lunchMissed = currentTime >= lunchCutoffTime;
  let choviarMissed = currentTime >= choviarCutoffTime;

  // If both cutoffs for targetDate have already passed, advance to the next day and recalculate cutoffs
  if (lunchMissed && choviarMissed) {
    targetDate.setDate(targetDate.getDate() + 1);
    lunchCutoffTime = getCutoff(metadata.lunchCutoff || '05:00', metadata.lunchCutoffDay || 'Same Day', targetDate);
    choviarCutoffTime = getCutoff(metadata.choviarCutoff || '11:00', metadata.choviarCutoffDay || 'Same Day', targetDate);
    lunchMissed = currentTime >= lunchCutoffTime;
    choviarMissed = currentTime >= choviarCutoffTime;
  }

  let status = 'OPEN';
  if (lunchMissed && choviarMissed) {
    status = 'CLOSED';
  } else if (lunchMissed && !choviarMissed) {
    status = 'LUNCH_CLOSED';
  } else if (!lunchMissed && choviarMissed) {
    status = 'CHOVIAR_CLOSED';
  } else {
    status = 'OPEN';
  }

  // Beta testing bypass
  if (metadata.betaTesting === 'Yes') {
    status = 'OPEN';
  }

  const liveMenuDateStr = metadata.liveMenuDate;
  // Menu is live if liveMenuDate isn't set, OR if targetDate is <= liveMenuDate
  let isMenuLive = true;
  if (liveMenuDateStr && /^\d{2}\/\d{2}\/\d{4}$/.test(liveMenuDateStr)) {
    const [d, m, y] = liveMenuDateStr.split('/');
    const liveDateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    liveDateObj.setHours(0, 0, 0, 0);
    if (targetDate > liveDateObj) {
      isMenuLive = false;
    }
  }

  return {
    status,
    isMenuLive,
    targetDate,
    lunchCutoffTime,
    choviarCutoffTime,
    targetDateLabel: targetDate.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // cart: { "ItemName": { name, description, price, quantity } }
  const [cart, setCart] = useState(() => getStoredJson(CART_STORAGE_KEY, {}));
  const [menu, setMenu] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [lastOrder, setLastOrder] = useState(() => getStoredJson(ORDER_STORAGE_KEY, null));
  const [editOrder, setEditOrder] = useState(null);

  // Persist cart
  useEffect(() => {
    try {
      const active = Object.fromEntries(
        Object.entries(cart).filter(([, item]) => (item?.quantity || 0) > 0)
      );
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(active));
    } catch { /* ignore */ }
  }, [cart]);

  // Persist last order
  useEffect(() => {
    try {
      if (lastOrder) {
        window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(lastOrder));
      } else {
        window.localStorage.removeItem(ORDER_STORAGE_KEY);
      }
    } catch { /* ignore */ }
  }, [lastOrder]);

  // ── Cart operations ──────────────────────────────────────────────────────────
  const updateQuantity = (itemName, delta, customItem = null) => {
    setCart(prev => {
      const current = prev[itemName]?.quantity || 0;
      const newQty  = current + delta;

      const menuItem = customItem || menu.find(i => i.name === itemName);
      if (delta > 0 && menuItem && menuItem.available === false) return prev;

      if (newQty <= 0) {
        const { [itemName]: _removed, ...rest } = prev;
        return rest;
      }

      const base = prev[itemName] || (menuItem ? { ...menuItem } : { name: itemName, price: 0 });
      return { ...prev, [itemName]: { ...base, quantity: newQty } };
    });
  };

  const clearCart    = () => setCart({});
  const clearLastOrder = () => setLastOrder(null);
  const loadCartFromItems = (items) => {
    const newCart = {};
    items.forEach(item => {
      newCart[item.name] = { ...item };
    });
    setCart(newCart);
  };

  // ── Derived cart values ──────────────────────────────────────────────────────
  const cartItems    = Object.values(cart).filter(i => i.quantity > 0);
  const cartCount    = cartItems.length;
  const cartSubtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      cart, cartItems, cartCount, cartSubtotal,
      menu, setMenu,
      metadata, setMetadata,
      lastOrder, setLastOrder, clearLastOrder,
      updateQuantity, clearCart, loadCartFromItems,
      editOrder, setEditOrder,
    }}>
      <Router>
        <Routes>
          <Route path="/"             element={<MenuPage />} />
          <Route path="/checkout"     element={<CheckoutPage />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
          <Route path="/admin"        element={<AdminPage />} />
          <Route path="/delivery"     element={<DeliveryPage />} />
          <Route path="/recurring"    element={<RecurringPage />} />
          <Route path="/my-orders"    element={<MyOrdersPage />} />
        </Routes>
      </Router>
    </CartContext.Provider>
  );
}
