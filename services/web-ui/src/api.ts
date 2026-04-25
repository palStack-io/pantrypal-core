import axios, { type AxiosInstance } from 'axios';
import type { Item, ShoppingItem, AuthStatus, User, Location, Category, Recipe, RecipeIntegration, ApiKey } from './types';

const DEFAULT_API_URL = '';

const tokenMemory: { API_KEY: string | null; SESSION_TOKEN: string | null } = {
  API_KEY: null,
  SESSION_TOKEN: null,
};

try {
  localStorage.removeItem('SESSION_TOKEN');
  localStorage.removeItem('API_KEY');
} catch (e) { /* incognito / storage denied */ }

const storage = {
  getItem: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch (e) { /* incognito */ }
  },
  removeItem: (key: string): void => {
    try { localStorage.removeItem(key); } catch (e) { /* incognito */ }
  },
};

const getApiBaseUrl = (): string => storage.getItem('API_BASE_URL') || DEFAULT_API_URL;
const getApiKey = (): string | null => tokenMemory.API_KEY;
const getSessionToken = (): string | null => tokenMemory.SESSION_TOKEN;

export const setApiKey = (apiKey: string | null): void => {
  tokenMemory.API_KEY = (apiKey && apiKey.trim()) ? apiKey.trim() : null;
};

export const setSessionToken = (token: string | null): void => {
  tokenMemory.SESSION_TOKEN = (token && token.trim()) ? token.trim() : null;
};

export const removeApiKey = (): void => { tokenMemory.API_KEY = null; };
export const removeSessionToken = (): void => { tokenMemory.SESSION_TOKEN = null; };

export const setApiBaseUrl = (url: string): void => {
  storage.setItem('API_BASE_URL', url.trim().replace(/\/+$/, ''));
};

export const getApiBaseUrlFromStorage = (): string => storage.getItem('API_BASE_URL') || '';
export const removeApiBaseUrl = (): void => { storage.removeItem('API_BASE_URL'); };
export const isServerConfigured = (): boolean => true;

const createApiInstance = (): AxiosInstance => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = getApiKey();
  if (apiKey) headers['X-API-Key'] = apiKey;
  const sessionToken = getSessionToken();
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

  const instance = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 10000,
    headers,
    withCredentials: true,
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        removeApiKey();
        removeSessionToken();
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

export const checkAuthStatus = async (): Promise<AuthStatus> => {
  const api = createApiInstance();
  try {
    const response = await api.get<AuthStatus>('/api/auth/status');
    return response.data;
  } catch {
    return { auth_mode: 'unknown', requires_api_key: false };
  }
};

export interface GetItemsResponse {
  items: Item[];
  total: number;
}

export const getItems = async (
  location: string | null = null,
  search: string | null = null,
  limit: number | null = null,
  offset = 0,
  signal: AbortSignal | null = null
): Promise<Item[] | GetItemsResponse> => {
  const api = createApiInstance();
  const params: Record<string, string | number> = {};
  if (location) params.location = location;
  if (search) params.search = search;
  if (limit !== null) { params.limit = limit; params.offset = offset; }
  const response = await api.get<Item[] | GetItemsResponse>('/api/items', { params, signal: signal ?? undefined });
  return response.data;
};

export const addItemManual = async (itemData: Partial<Item>): Promise<Item> => {
  const api = createApiInstance();
  const response = await api.post<Item>('/api/items/manual', itemData);
  return response.data;
};

export const createItem = async (itemData: Partial<Item>): Promise<Item> => addItemManual(itemData);

export const updateItem = async (itemId: string | number, updates: Partial<Item>): Promise<Item> => {
  const api = createApiInstance();
  const response = await api.put<Item>(`/api/items/${itemId}`, updates);
  return response.data;
};

export const deleteItem = async (itemId: string | number): Promise<unknown> => {
  const api = createApiInstance();
  const response = await api.delete(`/api/items/${itemId}`);
  return response.data;
};

export const getStats = async (): Promise<Record<string, unknown>> => {
  const api = createApiInstance();
  const response = await api.get('/api/stats');
  return response.data;
};

export const getLocations = async (): Promise<Location[]> => {
  const api = createApiInstance();
  const response = await api.get<Location[]>('/api/locations');
  return response.data;
};

export const getCategories = async (): Promise<Category[]> => {
  const api = createApiInstance();
  const response = await api.get<Category[]>('/api/categories');
  return response.data;
};

export const getAuthMode = async (): Promise<string> => {
  const api = createApiInstance();
  try {
    const response = await api.get<{ mode: string }>('/api/auth/mode');
    return response.data.mode || 'none';
  } catch {
    return 'none';
  }
};

export const getCurrentUser = async (): Promise<User> => {
  const api = createApiInstance();
  const response = await api.get<User>('/api/users/me');
  return response.data;
};

export const logout = async (): Promise<void> => {
  const api = createApiInstance();
  try {
    await api.post('/api/auth/logout');
  } catch { /* swallow — clear credentials regardless */ }
  removeApiKey();
  removeSessionToken();
};

export const exportItemsCSV = async (): Promise<void> => {
  const api = createApiInstance();
  const response = await api.get('/api/export/csv', { responseType: 'blob' });
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

export const getRecipeIntegration = async (): Promise<RecipeIntegration> => {
  const api = createApiInstance();
  const response = await api.get<RecipeIntegration>('/api/recipes/integration');
  return response.data;
};

export const createRecipeIntegration = async (integrationData: Partial<RecipeIntegration>): Promise<RecipeIntegration> => {
  const api = createApiInstance();
  const response = await api.post<RecipeIntegration>('/api/recipes/integration', integrationData);
  return response.data;
};

export const deleteRecipeIntegration = async (): Promise<unknown> => {
  const api = createApiInstance();
  const response = await api.delete('/api/recipes/integration');
  return response.data;
};

export const importRecipes = async (limit = 500): Promise<unknown> => {
  const api = createApiInstance();
  const response = await api.post('/api/recipes/import', { limit });
  return response.data;
};

export const getRecipes = async (
  limit = 50,
  offset = 0,
  sortBy = 'match_percentage',
  order = 'desc',
  favoriteOnly = false
): Promise<Recipe[]> => {
  const api = createApiInstance();
  const response = await api.get<Recipe[]>('/api/recipes/', {
    params: { limit, offset, sort_by: sortBy, order, favorite_only: favoriteOnly },
  });
  return response.data;
};

export const getRecipeSuggestions = async (minMatch = 50, limit = 20): Promise<Recipe[]> => {
  const api = createApiInstance();
  const response = await api.get<Recipe[]>('/api/recipes/suggestions', { params: { min_match: minMatch, limit } });
  return response.data;
};

export const getExpiringRecipes = async (limit = 10): Promise<Recipe[]> => {
  const api = createApiInstance();
  const response = await api.get<Recipe[]>('/api/recipes/expiring', { params: { limit } });
  return response.data;
};

export const searchRecipes = async (query: string, limit = 20): Promise<Recipe[]> => {
  const api = createApiInstance();
  const response = await api.get<Recipe[]>('/api/recipes/search', { params: { q: query, limit } });
  return response.data;
};

export const getFavoriteRecipes = async (): Promise<Recipe[]> => {
  const api = createApiInstance();
  const response = await api.get<Recipe[]>('/api/recipes/favorites');
  return response.data;
};

export const getRecipe = async (recipeId: string | number): Promise<Recipe> => {
  const api = createApiInstance();
  const response = await api.get<Recipe>(`/api/recipes/${recipeId}`);
  return response.data;
};

export const matchRecipes = async (expiringDays = 7): Promise<unknown> => {
  const api = createApiInstance();
  const response = await api.post('/api/recipes/match', { expiring_days: expiringDays });
  return response.data;
};

export const updateRecipeNotes = async (recipeId: string | number, notes: string): Promise<Recipe> => {
  const api = createApiInstance();
  const response = await api.patch<Recipe>(`/api/recipes/${recipeId}/notes`, { notes });
  return response.data;
};

export const toggleFavorite = async (recipeId: string | number): Promise<Recipe> => {
  const api = createApiInstance();
  const response = await api.post<Recipe>(`/api/recipes/${recipeId}/favorite`);
  return response.data;
};

export const markCooked = async (recipeId: string | number): Promise<unknown> => {
  const api = createApiInstance();
  const response = await api.post(`/api/recipes/${recipeId}/cooked`);
  return response.data;
};

export const deleteRecipe = async (recipeId: string | number): Promise<unknown> => {
  const api = createApiInstance();
  const response = await api.delete(`/api/recipes/${recipeId}`);
  return response.data;
};

export const getShoppingList = async (signal: AbortSignal | null = null): Promise<ShoppingItem[]> => {
  const api = createApiInstance();
  const response = await api.get<ShoppingItem[]>('/api/shopping-list', { signal: signal ?? undefined });
  return response.data;
};

export const addShoppingItem = async (itemData: Partial<ShoppingItem>): Promise<ShoppingItem> => {
  const api = createApiInstance();
  const response = await api.post<ShoppingItem>('/api/shopping-list', itemData);
  return response.data;
};

export const updateShoppingItem = async (itemId: string | number, updates: Partial<ShoppingItem>): Promise<ShoppingItem> => {
  const api = createApiInstance();
  const response = await api.put<ShoppingItem>(`/api/shopping-list/${itemId}`, updates);
  return response.data;
};

export const deleteShoppingItem = async (itemId: string | number): Promise<void> => {
  const api = createApiInstance();
  await api.delete(`/api/shopping-list/${itemId}`);
};

export const clearCheckedShoppingItems = async (): Promise<unknown> => {
  const api = createApiInstance();
  const response = await api.delete('/api/shopping-list/clear-checked');
  return response.data;
};

export const importCheckedToInventory = async (): Promise<unknown> => {
  const api = createApiInstance();
  const response = await api.post('/api/shopping-list/add-checked-to-inventory');
  return response.data;
};

export const suggestLowStock = async (): Promise<unknown> => {
  const api = createApiInstance();
  const response = await api.post('/api/shopping-list/suggest-low-stock');
  return response.data;
};

export const getApiKeys = async (): Promise<ApiKey[]> => {
  const api = createApiInstance();
  const response = await api.get<ApiKey[]>('/api/auth/keys');
  return response.data;
};

export const createApiKey = async (name: string, isReadOnly = false): Promise<ApiKey> => {
  const api = createApiInstance();
  const response = await api.post<ApiKey>('/api/auth/keys', { name, is_read_only: isReadOnly });
  return response.data;
};

export const revokeApiKey = async (keyId: string): Promise<void> => {
  const api = createApiInstance();
  await api.post(`/api/auth/keys/${keyId}/revoke`);
};

export default { createApiInstance };
