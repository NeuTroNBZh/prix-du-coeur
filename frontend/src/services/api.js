import axios from 'axios';

// In production (with domain), use relative URL since Nginx proxies /api
// In development, use the full URL
const API_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
    ? '' // Empty = relative URL, Nginx handles proxy
    : 'http://localhost:3002'
);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle token expiration
// Don't redirect on 401 for auth endpoints (login, register, 2FA, etc.)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Ne pas rediriger si c'est une route d'authentification
      const isAuthRoute = url.includes('/api/auth/login') || 
                          url.includes('/api/auth/register') || 
                          url.includes('/api/auth/2fa') ||
                          url.includes('/api/auth/forgot-password') ||
                          url.includes('/api/auth/reset-password');
      
      if (!isAuthRoute) {
        // Seulement pour les autres routes (token expiré)
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

console.log('🔗 API configurée sur:', API_URL);

// Auth API
export const authAPI = {
  register: (data) => {
    console.log('📡 POST /api/auth/register vers', API_URL);
    return api.post('/api/auth/register', data);
  },
  login: (data) => api.post('/api/auth/login', data),
  setup2FA: () => api.post('/api/auth/2fa/setup'),
  verify2FA: (token) => api.post('/api/auth/2fa/verify', { token }),
  disable2FA: () => api.post('/api/auth/2fa/disable'),
  get2FAStatus: () => api.get('/api/auth/2fa/status'),
  enableEmail2FA: () => api.post('/api/auth/2fa/enable-email'),
  // Nouveau flux sécurisé avec pendingToken au lieu de userId
  loginWith2FA: (pendingToken, token) => 
    api.post('/api/auth/login/2fa', { pendingToken, token }),
  // Email verification
  resendVerification: () => api.post('/api/auth/resend-verification'),
};

// Transaction API
export const transactionAPI = {
  upload: (formData) => api.post('/api/transactions/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  import: (data) => api.post('/api/transactions/import', data),
  create: (data) => api.post('/api/transactions', data),
  delete: (id) => api.delete(`/api/transactions/${id}`),
  deleteAccount: (accountId) => api.delete(`/api/transactions/accounts/${accountId}`),
  updateType: (id, data) => api.patch(`/api/transactions/${id}/type`, data),
  updateLabel: (id, label) => api.patch(`/api/transactions/${id}/label`, { label }),
  updateAmount: (id, amount) => api.patch(`/api/transactions/${id}/amount`, { amount }),
  toggleRecurring: (id, isRecurring) => api.patch(`/api/transactions/${id}/recurring`, { isRecurring }),
  getAccounts: () => api.get('/api/transactions/accounts'),
  getTransactions: (params) => api.get('/api/transactions', { params }),
  // Subscription management
  getRecurring: () => api.get('/api/transactions/recurring'),
  dismissSubscription: (label, amount, reason) => api.post('/api/transactions/subscriptions/dismiss', { label, amount, reason }),
  restoreSubscription: (label, amount) => api.delete('/api/transactions/subscriptions/dismiss', { data: { label, amount } }),
};

// Harmonization API
export const harmonizationAPI = {
  getBalance: (params) => api.get('/api/harmonization', { params }),
  settleUp: (data) => api.post('/api/harmonization/settle', data),
  deleteSettlement: (id) => api.delete(`/api/harmonization/settle/${id}`),
  getHistory: () => api.get('/api/harmonization/history'),
  updateType: (id, data) => api.patch(`/api/harmonization/transaction/${id}/type`, data),
};

// Classification API (IA Mistral)
export const classificationAPI = {
  // Get AI health status
  getHealth: () => api.get('/api/classify/health'),
  // Get classification stats
  getStats: () => api.get('/api/classify/stats'),
  // Classify transactions with AI
  classify: (transactionIds) => api.post('/api/classify', { transactionIds }),
  // Classify all unclassified transactions
  classifyAll: () => api.post('/api/classify', { all: true }),
  // Reclassify transactions (force reclassification)
  reclassify: (mode) => api.post('/api/classify/reclassify', { mode }),
  // Reset transactions for reclassification (mark as unclassified)
  resetForReclassify: (mode) => api.post('/api/classify/reset-for-reclassify', { mode }),
  // Correct a classification
  correct: (id, data) => api.patch(`/api/classify/${id}`, data),
};

// Admin API
export const adminAPI = {
  // Get all users
  getUsers: () => api.get('/api/admin/users'),
  // Get user details
  getUserDetails: (userId) => api.get(`/api/admin/users/${userId}`),
  // Toggle admin status
  toggleAdmin: (userId, isAdmin) => api.patch(`/api/admin/users/${userId}/admin`, { isAdmin }),
  // Delete a user
  deleteUser: (userId) => api.delete(`/api/admin/users/${userId}`),
  // Get stats overview
  getStats: () => api.get('/api/admin/stats'),
};

export default api;
