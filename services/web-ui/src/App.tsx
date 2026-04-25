import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import InventoryPage from './pages/InventoryPage';
import AddItemPage from './pages/AddItemPage';
import { ShoppingListPage } from './pages/ShoppingListPage';
import { InsightsPage } from './pages/InsightsPage';
import { RecipesPage } from './pages/RecipesPage';
import SettingsPage from './SettingsPage';
import LandingPage from './LandingPage';
import VerifyEmailPage from './VerifyEmailPage';
import ResetPasswordPage from './ResetPasswordPage';
import { getItems, getCurrentUser, isServerConfigured } from './api';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import { DialogProvider } from './components/DialogProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { User } from './types';
import './App.css';

function AppContent() {
  const [showLanding, setShowLanding] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filters, setFilters] = useState<Record<string, string | null>>({});
  const { isDark, toggle: toggleDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isSpecialRoute = location.pathname === '/verify-email' || location.pathname === '/reset-password';
  const urlParams = new URLSearchParams(location.search);
  const token = urlParams.get('token');

  useEffect(() => { checkAuth(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuth = async () => {
    if (!isServerConfigured()) {
      setShowLanding(true);
      setCheckingAuth(false);
      return;
    }

    try {
      await getItems();
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch (userError) {
        console.warn('Could not fetch user info:', userError);
      }
      setShowLanding(false);
    } catch (error) {
      const isAuthError = (error as any)?.response?.status === 401;
      const isNetworkError = !(error as any)?.response;
      setShowLanding(isAuthError || isNetworkError);

      if (isAuthError) {
        console.log('Authentication required - showing login page');
      } else if (isNetworkError) {
        console.log('Cannot reach server - showing landing page');
      }
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleFilterChange = (newFilters: Record<string, string | null>) => {
    setFilters(newFilters);
  };

  if (isSpecialRoute) {
    if (location.pathname === '/verify-email') {
      return <VerifyEmailPage token={token} onSuccess={() => { setShowLanding(true); navigate('/'); }} />;
    }
    if (location.pathname === '/reset-password') {
      return <ResetPasswordPage token={token} onSuccess={() => { setShowLanding(true); navigate('/'); }} />;
    }
  }

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: isDark ? '#0c0a09' : '#fafaf9' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/pantryPal.png" alt="pantryPal" style={{ width: '48px', height: '48px', marginBottom: '16px' }} />
          <div style={{ fontSize: '18px', color: isDark ? '#d6d3d1' : '#6b6460' }}>Loading pantryPal...</div>
        </div>
      </div>
    );
  }

  if (showLanding) {
    return <Routes><Route path="*" element={<LandingPage onLoginSuccess={(user) => { setCurrentUser(user); setShowLanding(false); navigate('/'); }} />} /></Routes>;
  }

  if (location.pathname === '/settings') {
    return (
      <SettingsPage
        currentUser={currentUser}
        onBack={() => navigate('/')}
      />
    );
  }

  return (
    <div className="app">
      <Sidebar isOpen={sidebarOpen} currentPath={location.pathname} onNavigate={navigate} onFilterChange={handleFilterChange} currentFilters={filters} />
      <TopBar currentUser={currentUser} onLogout={() => { setCurrentUser(null); setShowLanding(true); navigate('/'); }} onSettingsClick={() => navigate('/settings')} onToggleDark={toggleDark} />
      <div className="main-content-wrapper">
        <main className="main-content">
          <Routes>
            <Route path="/" element={<InventoryPage sidebarFilters={filters} />} />
            <Route path="/inventory" element={<InventoryPage sidebarFilters={filters} />} />
            <Route path="/add" element={<AddItemPage onBack={() => navigate('/inventory')} />} />
            <Route path="/shopping" element={<ShoppingListPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/recipes" element={<RecipesPage currentUser={currentUser} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <ToastProvider>
            <DialogProvider>
              <AppContent />
            </DialogProvider>
          </ToastProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
