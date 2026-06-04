import axios from 'axios';

const API = axios.create({ baseURL: '' });

// ─── Public endpoints ─────────────────────────────────────────────────────────
export const getMenu = () => API.get('/api/menu');

export const lookupCustomer = (phone) =>
  API.get(`/api/customer/lookup`, { params: { phone } });

export const placeOrder = (data) => API.post('/api/orders', data);

// ─── Admin endpoints ──────────────────────────────────────────────────────────
function adminHeaders(password) {
  return { headers: { 'x-admin-password': password } };
}

export const getAdminOrders = (params, password) =>
  API.get('/api/admin/orders', { params, ...adminHeaders(password) });

export const updateAdminMenu = (data, password) =>
  API.put('/api/admin/menu', data, adminHeaders(password));

export const getKitchenSummary = (date, password) =>
  API.get('/api/admin/kitchen', { params: { date }, ...adminHeaders(password) });
