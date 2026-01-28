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
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
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
  loginWith2FA: (email, password, token) => 
    api.post('/api/auth/login/2fa', { email, password, token }),
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
  getAccounts: () => api.get('/api/transactions/accounts'),
  getTransactions: (params) => api.get('/api/transactions', { params }),
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
  // Correct a classification
  correct: (id, data) => api.patch(`/api/classify/${id}`, data),
};

export default api;
