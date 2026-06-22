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

export function getOrderingState(betaTesting = 'No') {
  // Allow ?simHour=X in the URL for testing — disabled in production builds
  const isDev = process.env.NODE_ENV !== 'production';
  const urlParams = new URLSearchParams(window.location.search);
  const simHourParam = isDev ? urlParams.get('simHour') : null;
  
  const now = new Date();
  const hour = simHourParam !== null ? parseInt(simHourParam, 10) : now.getHours();

  let targetDate = new Date(now);
  let status = 'OPEN'; // 'OPEN', 'LUNCH_CLOSED', 'CLOSED'
  
  if (hour >= 0 && hour < 5) {
    status = 'OPEN';
  } else if (hour >= 5 && hour < 11) {
    status = 'LUNCH_CLOSED';
  } else if (hour >= 11 && hour < 19) {
    status = 'CLOSED';
    targetDate.setDate(targetDate.getDate() + 1);
  } else {
    status = 'OPEN';
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // Beta testing bypass
  if (betaTesting === 'Yes') {
    status = 'OPEN';
  }

  return {
    status,
    targetDate,
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

  // ── Derived cart values ──────────────────────────────────────────────────────
  const cartItems    = Object.values(cart).filter(i => i.quantity > 0);
  const cartCount    = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartSubtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      cart, cartItems, cartCount, cartSubtotal,
      menu, setMenu,
      metadata, setMetadata,
      lastOrder, setLastOrder, clearLastOrder,
      updateQuantity, clearCart,
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
