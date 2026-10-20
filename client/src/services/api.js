import axios from 'axios';

const API = axios.create({ baseURL: '' });

// ─── Public endpoints ─────────────────────────────────────────────────────────
export const getMenu = () => API.get('/api/menu');

export const lookupCustomer = (phone, date) =>
  API.get(`/api/customer/lookup`, { params: { phone, ...(date ? { date } : {}) } });

export const updateOrder = (orderId, phone, payload) =>
  API.put(`/api/orders/manage/${orderId}`, payload, { params: { phone } });

export const placeOrder = (data) => API.post('/api/orders', data);

export const getCustomerBilling = (phone) =>
  API.get('/api/customer/billing', { params: { phone, _t: Date.now() } });

// ─── Admin endpoints ──────────────────────────────────────────────────────────
function adminHeaders(password) {
  return { headers: { 'x-admin-password': password } };
}

export const getAdminOrders = (params, password) =>
  API.get('/api/admin/orders', { params: { ...(params || {}), _t: Date.now() }, ...adminHeaders(password) });

export const updateAdminMenu = (data, password) =>
  API.put('/api/admin/menu', data, adminHeaders(password));

export const getKitchenSummary = (date, password) =>
  API.get('/api/admin/kitchen', { params: { date }, ...adminHeaders(password) });

export const updateAdminDeliveryBatch = (updates, password) =>
  API.put('/api/admin/orders/delivery/batch', { updates }, adminHeaders(password));

export const createAdminOrder = (data, password) =>
  API.post('/api/admin/orders', data, adminHeaders(password));

export const recalculateRecurringOrders = (date, password) =>
  API.post('/api/admin/orders/recalculate-recurring', { date }, adminHeaders(password));

export const getAdminCustomers = (params, password) =>
  API.get('/api/admin/customers', { params, ...adminHeaders(password) });

export const createAdminCustomer = (data, password) =>
  API.post('/api/admin/customers', data, adminHeaders(password));

export const updateAdminCustomer = (phone, data, password) =>
  API.put(`/api/admin/customers/${phone}`, data, adminHeaders(password));

export const createAdminBulkOrder = (data, password) =>
  API.post('/api/admin/orders/bulk', data, adminHeaders(password));

export const updateAdminOrder = (orderId, data, password) =>
  API.put(`/api/admin/orders/${encodeURIComponent(orderId)}`, data, adminHeaders(password));

