import axios from 'axios';

const DEFAULT_API_URL = '';  // Use relative URLs by default (same origin)

// Sensitive tokens live only in memory — never written to localStorage.
// The server sets an HttpOnly cookie on login; same-origin requests benefit
// from cookie-based persistence across refreshes automatically.
const tokenMemory = {
  API_KEY: null,
  SESSION_TOKEN: null,
};

// Scrub any tokens that a previous build may have left in localStorage.
try {
  localStorage.removeItem('SESSION_TOKEN');
  localStorage.removeItem('API_KEY');
} catch (e) { /* incognito / storage denied */ }

// Safe localStorage wrapper for non-sensitive config (API_BASE_URL only).
const storage = {
  getItem: (key) => {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value); } catch (e) { /* incognito */ }
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key); } catch (e) { /* incognito */ }
  },
};

// Get API URL from storage or use default (empty string = relative URLs)
const getApiBaseUrl = () => {
  return storage.getItem('API_BASE_URL') || DEFAULT_API_URL;
};

// Get API key from memory
const getApiKey = () => tokenMemory.API_KEY;

// Get session token from memory
const getSessionToken = () => tokenMemory.SESSION_TOKEN;

// Set API key (memory-only)
export const setApiKey = (apiKey) => {
  tokenMemory.API_KEY = (apiKey && apiKey.trim()) ? apiKey.trim() : null;
};

// Set session token (memory-only)
export const setSessionToken = (token) => {
  tokenMemory.SESSION_TOKEN = (token && token.trim()) ? token.trim() : null;
};

// Remove API key
export const removeApiKey = () => { tokenMemory.API_KEY = null; };

// Remove session token
export const removeSessionToken = () => { tokenMemory.SESSION_TOKEN = null; };

// Server configuration functions
export const setApiBaseUrl = (url) => {
  const cleanUrl = url.trim().replace(/\/+$/, ''); // Remove trailing slashes
  storage.setItem('API_BASE_URL', cleanUrl);
};

export const getApiBaseUrlFromStorage = () => {
  return storage.getItem('API_BASE_URL') || '';
};

export const removeApiBaseUrl = () => {
  storage.removeItem('API_BASE_URL');
};

export const isServerConfigured = () => {
  // Always return true — default is same-origin which is always valid.
  // Users can change the server via the "Change Server" option on the login screen.
  return true;
};

// Create axios instance with dynamic base URL and API key
const createApiInstance = () => {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Add API key header if available
  const apiKey = getApiKey();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  // Add session token as Bearer token if available
  const sessionToken = getSessionToken();
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const instance = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 10000,
    headers,
    withCredentials: true,  // Send HttpOnly session cookie on same-origin requests
  });

  // Add response interceptor to handle 401 errors
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        // Clear in-memory credentials silently
        removeApiKey();
        removeSessionToken();
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// Check authentication status
export const checkAuthStatus = async () => {
  const api = createApiInstance();
  try {
    const response = await api.get('/api/auth/status');
    return response.data;
  } catch (error) {
    console.error('Failed to check auth status:', error);
    return { auth_mode: 'unknown', requires_api_key: false };
  }
};

// Get items
export const getItems = async (location = null, search = null, limit = null, offset = 0, signal = null) => {
  const api = createApiInstance();
  const params = {};
  if (location) params.location = location;
  if (search) params.search = search;
  if (limit !== null) {
    params.limit = limit;
    params.offset = offset;
  }
  const response = await api.get('/api/items', { params, signal });
  return response.data;
};

// Add item manually
export const addItemManual = async (itemData) => {
  const api = createApiInstance();
  const response = await api.post('/api/items/manual', itemData);
  return response.data;
};

// Create item (alias for addItemManual to match the hook)
export const createItem = async (itemData) => {
  return addItemManual(itemData);
};

// Update item
export const updateItem = async (itemId, updates) => {
  const api = createApiInstance();
  const response = await api.put(`/api/items/${itemId}`, updates);
  return response.data;
};

// Delete item
export const deleteItem = async (itemId) => {
  const api = createApiInstance();
  const response = await api.delete(`/api/items/${itemId}`);
  return response.data;
};

// Get statistics
export const getStats = async () => {
  const api = createApiInstance();
  const response = await api.get('/api/stats');
  return response.data;
};

// Get locations
export const getLocations = async () => {
  const api = createApiInstance();
  const response = await api.get('/api/locations');
  return response.data;
};

// Get categories
export const getCategories = async () => {
  const api = createApiInstance();
  const response = await api.get('/api/categories');
  return response.data;
};

// Get auth mode
export const getAuthMode = async () => {
  const api = createApiInstance();
  try {
    const response = await api.get('/api/auth/mode');
    return response.data.mode || 'none';
  } catch (error) {
    console.error('Failed to get auth mode:', error);
    return 'none';
  }
};

// Get current user
export const getCurrentUser = async () => {
  const api = createApiInstance();
  const response = await api.get('/api/users/me');
  return response.data;
};

// Logout
export const logout = async () => {
  const api = createApiInstance();
  try {
    await api.post('/api/auth/logout');
    removeApiKey();
    removeSessionToken();
  } catch (error) {
    console.error('Logout error:', error);
    removeApiKey();
    removeSessionToken();
  }
};

export const exportItemsCSV = async () => {
  const api = createApiInstance();
  const response = await api.get('/api/export/csv', {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `pantrypal_export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Recipe Integration
export const getRecipeIntegration = async () => {
  const api = createApiInstance();
  const response = await api.get('/api/recipes/integration');
  return response.data;
};

export const createRecipeIntegration = async (integrationData) => {
  const api = createApiInstance();
  const response = await api.post('/api/recipes/integration', integrationData);
  return response.data;
};

export const deleteRecipeIntegration = async () => {
  const api = createApiInstance();
  const response = await api.delete('/api/recipes/integration');
  return response.data;
};

// Recipe Import
export const importRecipes = async (limit = 500) => {
  const api = createApiInstance();
  const response = await api.post('/api/recipes/import', { limit });
  return response.data;
};

// Recipe Queries
export const getRecipes = async (limit = 50, offset = 0, sortBy = 'match_percentage', order = 'desc', favoriteOnly = false) => {
  const api = createApiInstance();
  const response = await api.get('/api/recipes/', {
    params: { limit, offset, sort_by: sortBy, order, favorite_only: favoriteOnly }
  });
  return response.data;
};

export const getRecipeSuggestions = async (minMatch = 50, limit = 20) => {
  const api = createApiInstance();
  const response = await api.get('/api/recipes/suggestions', {
    params: { min_match: minMatch, limit }
  });
  return response.data;
};

export const getExpiringRecipes = async (limit = 10) => {
  const api = createApiInstance();
  const response = await api.get('/api/recipes/expiring', { params: { limit } });
  return response.data;
};

export const searchRecipes = async (query, limit = 20) => {
  const api = createApiInstance();
  const response = await api.get('/api/recipes/search', {
    params: { q: query, limit }
  });
  return response.data;
};

export const getFavoriteRecipes = async () => {
  const api = createApiInstance();
  const response = await api.get('/api/recipes/favorites');
  return response.data;
};

export const getRecipe = async (recipeId) => {
  const api = createApiInstance();
  const response = await api.get(`/api/recipes/${recipeId}`);
  return response.data;
};

// Recipe Matching
export const matchRecipes = async (expiringDays = 7) => {
  const api = createApiInstance();
  const response = await api.post('/api/recipes/match', { expiring_days: expiringDays });
  return response.data;
};

// Recipe Management
export const updateRecipeNotes = async (recipeId, notes) => {
  const api = createApiInstance();
  const response = await api.patch(`/api/recipes/${recipeId}/notes`, { notes });
  return response.data;
};

export const toggleFavorite = async (recipeId) => {
  const api = createApiInstance();
  const response = await api.post(`/api/recipes/${recipeId}/favorite`);
  return response.data;
};

export const markCooked = async (recipeId) => {
  const api = createApiInstance();
  const response = await api.post(`/api/recipes/${recipeId}/cooked`);
  return response.data;
};

export const deleteRecipe = async (recipeId) => {
  const api = createApiInstance();
  const response = await api.delete(`/api/recipes/${recipeId}`);
  return response.data;
};

// Shopping List
export const getShoppingList = async (signal = null) => {
  const api = createApiInstance();
  const response = await api.get('/api/shopping-list', { signal });
  return response.data;
};

export const addShoppingItem = async (itemData) => {
  const api = createApiInstance();
  const response = await api.post('/api/shopping-list', itemData);
  return response.data;
};

export const updateShoppingItem = async (itemId, updates) => {
  const api = createApiInstance();
  const response = await api.put(`/api/shopping-list/${itemId}`, updates);
  return response.data;
};

export const deleteShoppingItem = async (itemId) => {
  const api = createApiInstance();
  await api.delete(`/api/shopping-list/${itemId}`);
};

export const clearCheckedShoppingItems = async () => {
  const api = createApiInstance();
  const response = await api.delete('/api/shopping-list/clear-checked');
  return response.data;
};

export const importCheckedToInventory = async () => {
  const api = createApiInstance();
  const response = await api.post('/api/shopping-list/add-checked-to-inventory');
  return response.data;
};

export const suggestLowStock = async () => {
  const api = createApiInstance();
  const response = await api.post('/api/shopping-list/suggest-low-stock');
  return response.data;
};

export default { createApiInstance };
