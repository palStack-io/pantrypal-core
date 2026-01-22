# Frontend Service Template Documentation

This document provides comprehensive templates for creating new frontend services (both web and mobile) in the PantryPal/PalStack ecosystem. Follow these patterns to ensure consistency across all frontends.

## Table of Contents
1. [Web UI Template (React + Vite)](#web-ui-template-react--vite)
2. [Mobile App Template (React Native + Expo)](#mobile-app-template-react-native--expo)
3. [Shared Patterns](#shared-patterns)
4. [Authentication Flow](#authentication-flow)
5. [API Integration](#api-integration)
6. [Design System](#design-system)
7. [Component Patterns](#component-patterns)
8. [State Management](#state-management)
9. [Best Practices](#best-practices)

---

## Web UI Template (React + Vite)

### Project Structure

```
web-ui/
├── public/
│   └── favicon.ico
├── src/
│   ├── pages/              # Full-page components
│   │   ├── InventoryPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── SettingsPage.jsx
│   │   └── NotFoundPage.jsx
│   ├── components/         # Reusable UI components
│   │   ├── Sidebar.jsx
│   │   ├── TopBar.jsx
│   │   ├── ItemCard.jsx
│   │   ├── Modal.jsx
│   │   └── Toast.jsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useItems.js
│   │   ├── useDarkMode.js
│   │   └── useToast.js
│   ├── utils/              # Helper functions
│   │   ├── dateUtils.js
│   │   ├── validators.js
│   │   └── exportUtils.js
│   ├── App.jsx             # Main app with routing
│   ├── LandingPage.jsx     # Auth pages (login/register)
│   ├── api.js              # API client
│   ├── colors.js           # Design system colors
│   ├── defaults.js         # Constants (categories, locations)
│   ├── main.jsx            # React entry point
│   └── index.css           # Global styles
├── Dockerfile
├── vite.config.js
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "service-name-ui",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext js,jsx"
  },
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-router-dom": "^6.28.0",
    "axios": "^1.12.2",
    "lucide-react": "^0.553.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^6.0.0",
    "eslint": "^8.57.0",
    "eslint-plugin-react": "^7.33.2"
  }
}
```

### vite.config.js

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://api-gateway:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
```

### Dockerfile (Web UI)

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf (for production build)

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass http://api-gateway:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Disable cache for index.html
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
```

---

## Mobile App Template (React Native + Expo)

### Project Structure

```
mobile/
├── src/
│   ├── screens/            # Full-screen components
│   │   ├── HomeScreen.js
│   │   ├── LoginScreen.js
│   │   ├── SettingsScreen.js
│   │   └── AddItemScreen.js
│   ├── navigation/         # Navigation configuration
│   │   ├── MainTabs.js
│   │   └── AuthStack.js
│   ├── components/         # Reusable UI components
│   │   ├── GlassCard.js
│   │   ├── GlassButton.js
│   │   └── ItemCard.js
│   ├── services/           # Services and integrations
│   │   ├── api.js
│   │   ├── biometricAuth.js
│   │   └── notifications.js
│   ├── constants/          # Design tokens
│   │   ├── colors.js
│   │   ├── typography.js
│   │   └── shadows.js
│   ├── utils/              # Helper functions
│   │   ├── dateUtils.js
│   │   └── validators.js
│   └── hooks/              # Custom hooks
│       └── useAuth.js
├── assets/                 # Images, fonts, etc.
├── App.js                  # Main app entry
├── app.json                # Expo configuration
├── package.json
└── babel.config.js
```

### package.json (Mobile)

```json
{
  "name": "service-name-mobile",
  "version": "1.0.0",
  "main": "expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~54.0.0",
    "react": "18.3.1",
    "react-native": "0.81.5",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/native-stack": "^6.9.17",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "react-native-screens": "4.5.0",
    "react-native-safe-area-context": "5.1.1",
    "@react-native-async-storage/async-storage": "2.2.0",
    "axios": "^1.6.2",
    "expo-camera": "~17.0.10",
    "expo-secure-store": "~15.0.8",
    "expo-local-authentication": "~17.0.8",
    "expo-blur": "~15.0.0",
    "expo-linear-gradient": "~15.0.0",
    "expo-notifications": "~0.29.3"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0"
  }
}
```

### app.json (Expo Configuration)

```json
{
  "expo": {
    "name": "Service Name",
    "slug": "service-name",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourorg.servicename",
      "infoPlist": {
        "NSFaceIDUsageDescription": "Use Face ID to securely log in",
        "NSCameraUsageDescription": "Camera access is needed to scan barcodes"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.yourorg.servicename",
      "permissions": [
        "CAMERA",
        "USE_BIOMETRIC",
        "USE_FINGERPRINT"
      ]
    },
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera"
        }
      ],
      [
        "expo-local-authentication",
        {
          "faceIDPermission": "Allow $(PRODUCT_NAME) to use Face ID"
        }
      ]
    ]
  }
}
```

---

## Shared Patterns

### Authentication Flow

#### 1. Check Server Configuration

Both web and mobile must first verify the API base URL is configured.

**Web (App.jsx):**
```javascript
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage';
import InventoryPage from './pages/InventoryPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiConfigured, setApiConfigured] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    // Check if API base URL is configured
    const baseUrl = localStorage.getItem('API_BASE_URL');
    if (!baseUrl) {
      setApiConfigured(false);
      setLoading(false);
      return;
    }

    setApiConfigured(true);

    try {
      // Try to fetch data to verify session
      const response = await fetch(`${baseUrl}/api/items`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('SESSION_TOKEN')}`,
          'X-API-Key': localStorage.getItem('API_KEY') || ''
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!apiConfigured || !isAuthenticated) {
    return <LandingPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<InventoryPage />} />
        {/* Add more routes */}
      </Routes>
    </Router>
  );
}

export default App;
```

**Mobile (App.js):**
```javascript
import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './src/services/api';
import AuthStack from './src/navigation/AuthStack';
import MainTabs from './src/navigation/MainTabs';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      // Check if API is configured
      const baseUrl = await AsyncStorage.getItem('API_BASE_URL');
      if (!baseUrl) {
        setLoading(false);
        return;
      }

      // Check if session token exists
      const sessionToken = await AsyncStorage.getItem('SESSION_TOKEN');
      if (!sessionToken) {
        // Try biometric login
        const biometricResult = await performBiometricLogin();
        if (biometricResult) {
          setIsAuthenticated(true);
        }
        setLoading(false);
        return;
      }

      // Validate session with server
      const response = await api.get('/api/auth/me');
      if (response.data) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
```

---

## API Integration

### API Client Pattern (Critical for Consistency)

**Web (src/api.js):**
```javascript
import axios from 'axios';

// Storage helpers with fallback for incognito mode
const storage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return window[`_${key}`] || null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      window[`_${key}`] = value;
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      delete window[`_${key}`];
    }
  }
};

// Get base URL
export const getApiBaseUrl = () => {
  return storage.getItem('API_BASE_URL') ||
         import.meta.env.VITE_API_BASE_URL ||
         'http://localhost:8000';
};

// Create axios instance
const createApiInstance = () => {
  const sessionToken = storage.getItem('SESSION_TOKEN');
  const apiKey = storage.getItem('API_KEY');

  const instance = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    }
  });

  // Add auth headers
  if (sessionToken) {
    instance.defaults.headers.common['Authorization'] = `Bearer ${sessionToken}`;
  }
  if (apiKey) {
    instance.defaults.headers.common['X-API-Key'] = apiKey;
  }

  // Add response interceptor for 401 handling
  instance.interceptors.response.use(
    response => response,
    error => {
      if (error.response?.status === 401) {
        // Clear auth and redirect to login
        storage.removeItem('SESSION_TOKEN');
        storage.removeItem('API_KEY');
        window.location.href = '/';
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// Export singleton instance
export const api = createApiInstance();

// API methods
export const authApi = {
  checkStatus: () => api.get('/api/auth/status'),
  login: (username, password) => api.post('/api/auth/login', { username, password }),
  register: (username, email, password) => api.post('/api/auth/register', { username, email, password }),
  logout: () => api.post('/api/auth/logout'),
  getMe: () => api.get('/api/auth/me'),
};

export const itemsApi = {
  list: (params) => api.get('/api/items', { params }),
  create: (data) => api.post('/api/items', data),
  update: (id, data) => api.put(`/api/items/${id}`, data),
  delete: (id) => api.delete(`/api/items/${id}`),
};
```

**Mobile (src/services/api.js):**
```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

let apiInstance = null;
let currentSessionToken = null;
let currentApiKey = null;

export const getApiBaseUrl = async () => {
  const baseUrl = await AsyncStorage.getItem('API_BASE_URL');
  return baseUrl || 'http://localhost:8000';
};

export const getApi = async () => {
  const sessionToken = await AsyncStorage.getItem('SESSION_TOKEN');
  const apiKey = await AsyncStorage.getItem('API_KEY');

  // Recreate instance if credentials changed
  if (!apiInstance ||
      currentSessionToken !== sessionToken ||
      currentApiKey !== apiKey) {

    currentSessionToken = sessionToken;
    currentApiKey = apiKey;

    const baseURL = await getApiBaseUrl();

    apiInstance = axios.create({
      baseURL,
      timeout: 3000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Add auth headers
    if (sessionToken) {
      apiInstance.defaults.headers.common['Authorization'] = `Bearer ${sessionToken}`;
    }
    if (apiKey) {
      apiInstance.defaults.headers.common['X-API-Key'] = apiKey;
    }

    // Add 401 interceptor
    apiInstance.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401) {
          await AsyncStorage.removeItem('SESSION_TOKEN');
          await AsyncStorage.removeItem('API_KEY');
          // Trigger navigation to login (use navigation ref or event emitter)
        }
        return Promise.reject(error);
      }
    );
  }

  return apiInstance;
};

// API methods
export const api = {
  auth: {
    checkStatus: async () => {
      const instance = await getApi();
      return instance.get('/api/auth/status');
    },
    login: async (username, password) => {
      const instance = await getApi();
      return instance.post('/api/auth/login', { username, password });
    },
    logout: async () => {
      const instance = await getApi();
      return instance.post('/api/auth/logout');
    },
  },
  items: {
    list: async (params) => {
      const instance = await getApi();
      return instance.get('/api/items', { params });
    },
    create: async (data) => {
      const instance = await getApi();
      return instance.post('/api/items', data);
    },
    update: async (id, data) => {
      const instance = await getApi();
      return instance.put(`/api/items/${id}`, data);
    },
    delete: async (id) => {
      const instance = await getApi();
      return instance.delete(`/api/items/${id}`);
    },
  },
};
```

---

## Design System

### Color System (src/colors.js - Web & Mobile)

```javascript
export const lightColors = {
  // Primary brand color
  primary: '#d97706',        // Amber/orange
  primaryHover: '#b45309',
  primaryLight: '#fef3c7',

  // Status colors
  success: '#10b981',        // Green
  successLight: '#d1fae5',
  warning: '#f59e0b',        // Yellow
  warningLight: '#fef3c7',
  danger: '#ef4444',         // Red
  dangerLight: '#fee2e2',
  info: '#3b82f6',          // Blue
  infoLight: '#dbeafe',

  // Text colors
  textPrimary: '#292524',    // Dark stone
  textSecondary: '#78716c',  // Medium stone
  textTertiary: '#a8a29e',   // Light stone
  textInverse: '#ffffff',

  // Background colors
  background: '#fef6ec',     // Light cream
  backgroundAlt: '#fffcf7',  // Off-white
  card: '#fffcf7',
  cardHover: '#fef6ec',

  // Border colors
  border: '#f5e6d3',
  borderLight: '#fef3c7',
  borderDark: '#e7e5e4',

  // Shadows
  shadowColor: 'rgba(0, 0, 0, 0.1)',
};

export const darkColors = {
  primary: '#f59e0b',
  primaryHover: '#d97706',
  primaryLight: '#451a03',

  success: '#10b981',
  successLight: '#022c22',
  warning: '#f59e0b',
  warningLight: '#451a03',
  danger: '#ef4444',
  dangerLight: '#450a0a',
  info: '#3b82f6',
  infoLight: '#1e3a8a',

  textPrimary: '#fafaf9',
  textSecondary: '#d6d3d1',
  textTertiary: '#a8a29e',
  textInverse: '#0c0a09',

  background: '#0c0a09',
  backgroundAlt: '#1c1917',
  card: '#1c1917',
  cardHover: '#292524',

  border: '#292524',
  borderLight: '#3f3f46',
  borderDark: '#18181b',

  shadowColor: 'rgba(0, 0, 0, 0.5)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 16,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

// Factory function for use in components
export const getColors = (isDark) => isDark ? darkColors : lightColors;
```

### Typography Constants (Mobile - src/constants/typography.js)

```javascript
export const typography = {
  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // Font weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};
```

### Shadow System (Mobile - src/constants/shadows.js)

```javascript
import { Platform } from 'react-native';

export const shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    android: {
      elevation: 2,
    },
  }),

  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
  }),

  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    android: {
      elevation: 8,
    },
  }),
};
```

---

## Component Patterns

### Card Component (Web)

**components/Card.jsx:**
```javascript
import { getColors } from '../colors';

export function Card({ children, isDark, style, onClick }) {
  const colors = getColors(isDark);

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
        padding: '16px',
        boxShadow: `0 2px 4px ${colors.shadowColor}`,
        transition: 'all 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
```

### Card Component (Mobile)

**components/GlassCard.js:**
```javascript
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { getColors } from '../constants/colors';

export default function GlassCard({ children, intensity = 30, isDark = false }) {
  const colors = getColors(isDark);

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} style={styles.container}>
        {children}
      </BlurView>
    );
  }

  // Android fallback
  return (
    <View style={[
      styles.container,
      { backgroundColor: isDark ? 'rgba(28, 25, 23, 0.9)' : 'rgba(255, 252, 247, 0.9)' }
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
  },
});
```

### Button Component (Web)

**components/Button.jsx:**
```javascript
import { getColors } from '../colors';

export function Button({
  children,
  onClick,
  variant = 'primary',
  isDark,
  disabled,
  style
}) {
  const colors = getColors(isDark);

  const variants = {
    primary: {
      backgroundColor: colors.primary,
      color: '#fff',
      border: 'none',
    },
    secondary: {
      backgroundColor: 'transparent',
      color: colors.primary,
      border: `1px solid ${colors.primary}`,
    },
    danger: {
      backgroundColor: colors.danger,
      color: '#fff',
      border: 'none',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variants[variant],
        padding: '10px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
```

### Toast Component (Web)

**components/Toast.jsx:**
```javascript
import { useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import { getColors } from '../colors';

export function Toast({ message, type = 'info', onClose, duration = 3000, isDark }) {
  const colors = getColors(isDark);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle size={20} color={colors.success} />,
    error: <XCircle size={20} color={colors.danger} />,
    warning: <AlertCircle size={20} color={colors.warning} />,
    info: <Info size={20} color={colors.info} />,
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      boxShadow: `0 4px 12px ${colors.shadowColor}`,
      zIndex: 9999,
      minWidth: '300px',
      animation: 'slideIn 0.2s ease',
    }}>
      {icons[type]}
      <span style={{
        flex: 1,
        color: colors.textPrimary,
        fontSize: '14px',
      }}>
        {message}
      </span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
        }}
      >
        <X size={16} color={colors.textSecondary} />
      </button>
    </div>
  );
}
```

---

## State Management

### Custom Hooks Pattern

**hooks/useItems.js (Web):**
```javascript
import { useState, useEffect, useCallback } from 'react';
import { itemsApi } from '../api';

export function useItems(initialFilters = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await itemsApi.list(filters);
      setItems(response.data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const addItem = async (itemData) => {
    try {
      const response = await itemsApi.create(itemData);
      setItems(prev => [response.data, ...prev]);
      return { success: true, data: response.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateItem = async (id, itemData) => {
    try {
      const response = await itemsApi.update(id, itemData);
      setItems(prev => prev.map(item =>
        item.id === id ? response.data : item
      ));
      return { success: true, data: response.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteItem = async (id) => {
    try {
      await itemsApi.delete(id);
      setItems(prev => prev.filter(item => item.id !== id));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  return {
    items,
    loading,
    error,
    filters,
    addItem,
    updateItem,
    deleteItem,
    refresh: loadItems,
    updateFilters,
    clearFilters,
  };
}
```

**hooks/useDarkMode.js (Web):**
```javascript
import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggle = () => setIsDark(prev => !prev);

  return { isDark, toggle };
}
```

**hooks/useToast.js (Web):**
```javascript
import { useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({ message, type, duration });
  };

  const hideToast = () => {
    setToast(null);
  };

  return {
    toast,
    showToast,
    showSuccess: (msg) => showToast(msg, 'success'),
    showError: (msg) => showToast(msg, 'error'),
    showWarning: (msg) => showToast(msg, 'warning'),
    showInfo: (msg) => showToast(msg, 'info'),
    hideToast,
  };
}
```

---

## Best Practices

### ✅ Do's

1. **Use the design system consistently**
   - Always use `getColors(isDark)` for colors
   - Use spacing constants from design system
   - Use borderRadius constants

2. **Handle loading and error states**
   ```javascript
   if (loading) return <LoadingSpinner />;
   if (error) return <ErrorMessage error={error} />;
   return <YourContent />;
   ```

3. **Validate forms on client-side**
   ```javascript
   const validateForm = (data) => {
     const errors = {};
     if (!data.name) errors.name = 'Name is required';
     if (data.name && data.name.length < 3) errors.name = 'Name too short';
     return errors;
   };
   ```

4. **Use custom hooks for shared logic**
   - Extract data fetching to hooks
   - Extract form handling to hooks
   - Extract complex calculations to hooks

5. **Provide user feedback**
   - Show toasts for success/error
   - Show loading spinners during async operations
   - Disable buttons during submission

6. **Handle 401 responses globally**
   - Add axios interceptor
   - Clear auth tokens
   - Redirect to login

7. **Support offline mode (mobile)**
   - Cache data in AsyncStorage
   - Show offline indicator
   - Sync when connection restored

### ❌ Don'ts

1. **Don't hardcode colors**
   ```javascript
   // ❌ Bad
   style={{ backgroundColor: '#fff' }}

   // ✅ Good
   style={{ backgroundColor: colors.card }}
   ```

2. **Don't ignore errors**
   ```javascript
   // ❌ Bad
   try {
     await api.create(data);
   } catch (err) {
     // Silent failure
   }

   // ✅ Good
   try {
     await api.create(data);
     showSuccess('Created successfully');
   } catch (err) {
     showError(err.message);
   }
   ```

3. **Don't forget to clean up effects**
   ```javascript
   // ✅ Good
   useEffect(() => {
     const timer = setTimeout(() => {}, 1000);
     return () => clearTimeout(timer);
   }, []);
   ```

4. **Don't mutate state directly**
   ```javascript
   // ❌ Bad
   items.push(newItem);

   // ✅ Good
   setItems(prev => [...prev, newItem]);
   ```

5. **Don't forget accessibility**
   - Add `aria-label` to icon buttons
   - Use semantic HTML
   - Support keyboard navigation

---

## Complete Example Page

**pages/InventoryPage.jsx:**
```javascript
import { useState } from 'react';
import { useItems } from '../hooks/useItems';
import { useDarkMode } from '../hooks/useDarkMode';
import { useToast } from '../hooks/useToast';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Toast } from '../components/Toast';
import { getColors } from '../colors';

export default function InventoryPage() {
  const { isDark, toggle } = useDarkMode();
  const { items, loading, error, addItem, deleteItem } = useItems();
  const { toast, showSuccess, showError, hideToast } = useToast();
  const colors = getColors(isDark);

  const [showAddModal, setShowAddModal] = useState(false);

  const handleAdd = async (itemData) => {
    const result = await addItem(itemData);
    if (result.success) {
      showSuccess('Item added successfully');
      setShowAddModal(false);
    } else {
      showError(result.error);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure?')) {
      const result = await deleteItem(id);
      if (result.success) {
        showSuccess('Item deleted');
      } else {
        showError(result.error);
      }
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{
      backgroundColor: colors.background,
      minHeight: '100vh',
      padding: '20px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        <h1 style={{ color: colors.textPrimary }}>Inventory</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button onClick={toggle} variant="secondary" isDark={isDark}>
            {isDark ? '☀️' : '🌙'}
          </Button>
          <Button onClick={() => setShowAddModal(true)} isDark={isDark}>
            Add Item
          </Button>
        </div>
      </div>

      {error && (
        <div style={{ color: colors.danger, marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px',
      }}>
        {items.map(item => (
          <Card key={item.id} isDark={isDark}>
            <h3 style={{ color: colors.textPrimary }}>{item.name}</h3>
            <p style={{ color: colors.textSecondary }}>{item.description}</p>
            <Button
              onClick={() => handleDelete(item.id)}
              variant="danger"
              isDark={isDark}
              style={{ marginTop: '10px' }}
            >
              Delete
            </Button>
          </Card>
        ))}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
          duration={toast.duration}
          isDark={isDark}
        />
      )}
    </div>
  );
}
```

---

## Reference Implementations

### Web UI
- **Full App**: `backend/services/web-ui/src/`
- **Auth Flow**: `backend/services/web-ui/src/App.jsx:36-70`
- **API Client**: `backend/services/web-ui/src/api.js`
- **Design System**: `backend/services/web-ui/src/colors.js`
- **Custom Hooks**: `backend/services/web-ui/src/hooks/`

### Mobile
- **Full App**: `mobile/`
- **Auth Flow**: `mobile/App.js:84-188`
- **API Client**: `mobile/src/services/api.js`
- **Design System**: `mobile/src/constants/colors.js`
- **Biometric Auth**: `mobile/src/services/biometricAuth.js`

---

## Next Steps

1. Choose web or mobile template based on your needs
2. Copy the appropriate project structure
3. Install dependencies with `npm install`
4. Configure API base URL
5. Implement your pages/screens
6. Create reusable components
7. Add custom hooks for data logic
8. Test authentication flow
9. Build and deploy

This template ensures consistency across all frontend services in the PalStack ecosystem!
