/**
 * API Service Layer
 * Centralized Axios client connecting React frontend to FastAPI backend
 */

import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// ── AXIOS INSTANCE ──
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 200000,
  headers: { 'Content-Type': 'application/json' },
});

// ── REQUEST INTERCEPTOR: attach JWT ──
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dept_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── RESPONSE INTERCEPTOR: handle 401 ──
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('dept_refresh_token');
        if (refresh) {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem('dept_token', data.access_token);
          localStorage.setItem('dept_refresh_token', data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        }
      } catch {
        // Refresh failed — force logout
        localStorage.removeItem('dept_token');
        localStorage.removeItem('dept_refresh_token');
        localStorage.removeItem('dept_user');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);


// ══════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════
export const authAPI = {
  register: (data) => api.post('/auth/register', data).then(r => r.data),
  login: (email, password) => api.post('/auth/login', { email, password }).then(r => r.data),
  adminLogin: (email, password) => api.post('/auth/admin/login', { email, password }).then(r => r.data),
  refresh: (refresh_token) => api.post('/auth/refresh', { refresh_token }).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
};

// ══════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════
export const chatAPI = {
  sendMessage: (message, session_id, conversation_history = []) =>
    api.post('/chat/message', { message, session_id, conversation_history }).then(r => r.data),
  getHistory: (limit = 20) => api.get(`/chat/history?limit=${limit}`).then(r => r.data),
};

// ══════════════════════════════════════════════
// FAQs (admin)
// ══════════════════════════════════════════════
export const faqAPI = {
  list: (category, activeOnly) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (activeOnly) params.set('active_only', 'true');
    return api.get(`/faqs/?${params}`).then(r => r.data);
  },
  create: (data) => api.post('/faqs/', data).then(r => r.data),
  update: (id, data) => api.put(`/faqs/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/faqs/${id}`),
  categories: () => api.get('/faqs/categories').then(r => r.data),
};

// ══════════════════════════════════════════════
// PROCEDURES (admin)
// ══════════════════════════════════════════════
export const procedureAPI = {
  list: (category) => {
    const params = category ? `?category=${category}` : '';
    return api.get(`/procedures/${params}`).then(r => r.data);
  },
  create: (data) => api.post('/procedures/', data).then(r => r.data),
  update: (id, data) => api.put(`/procedures/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/procedures/${id}`),
};

// ══════════════════════════════════════════════
// DOCUMENTS (admin)
// ══════════════════════════════════════════════
export const documentAPI = {
  list: () => api.get('/documents/').then(r => r.data),
  upload: (file, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress && onProgress(Math.round(e.loaded * 100 / e.total)),
    }).then(r => r.data);
  },
  reindex: (id) => api.post(`/documents/${id}/reindex`).then(r => r.data),
  delete: (id) => api.delete(`/documents/${id}`),
  stats: () => api.get('/documents/stats').then(r => r.data),
};

// ══════════════════════════════════════════════
// ADMIN
// ══════════════════════════════════════════════
export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard').then(r => r.data),
  performance: () => api.get('/admin/performance').then(r => r.data),
  logs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/admin/logs?${qs}`).then(r => r.data);
  },
  rateLog: (id, rating) => api.patch(`/admin/logs/${id}/rate?rating=${rating}`).then(r => r.data),
  users: () => api.get('/admin/users').then(r => r.data),
  toggleUser: (id) => api.post(`/admin/users/${id}/toggle`).then(r => r.data),
  seed: () => api.post('/admin/seed').then(r => r.data),
};

export default api;
