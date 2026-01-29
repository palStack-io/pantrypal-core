// Main App
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
import { useDarkMode } from './hooks/useDarkMode';
import './App.css';

function AppContent() {
  const [showLanding, setShowLanding] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filters, setFilters] = useState({});
  const { isDark, toggle: toggleDark } = useDarkMode();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we're on a special route (email verification or password reset)
  const isSpecialRoute = location.pathname === '/verify-email' || location.pathname === '/reset-password';
  const urlParams = new URLSearchParams(location.search);
  const token = urlParams.get('token');

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    // First, check if server is configured
    if (!isServerConfigured()) {
      // No server configured, show landing page with server config
      setShowLanding(true);
      setCheckingAuth(false);
      return;
    }

    // Server is configured, try to authenticate
    try {
      await getItems();
      // Fetch current user info
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch (userError) {
        console.warn('Could not fetch user info:', userError);
      }
      setShowLanding(false);
    } catch (error) {
      // Show landing page for any auth errors (401) or network errors
      const isAuthError = error.response?.status === 401;
      const isNetworkError = !error.response;
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

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  // Handle special routes (email verification, password reset) without auth check
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
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🥫</div>
          <div style={{ fontSize: '18px', color: isDark ? '#d6d3d1' : '#78716c' }}>Loading PantryPal...</div>
        </div>
      </div>
    );
  }

  if (showLanding) {
    return <Routes><Route path="*" element={<LandingPage onLoginSuccess={(user) => { setCurrentUser(user); setShowLanding(false); navigate('/'); }} />} /></Routes>;
  }

  return (
    <div className="app">
      <Sidebar isOpen={sidebarOpen} currentPath={location.pathname} onNavigate={navigate} onFilterChange={handleFilterChange} currentFilters={filters} isDark={isDark} />
      <div className="main-content-wrapper">
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} currentUser={currentUser} onLogout={() => { setCurrentUser(null); setShowLanding(true); navigate('/'); }} onSettingsClick={() => navigate('/settings')} isDark={isDark} onToggleDark={toggleDark} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<InventoryPage isDark={isDark} sidebarFilters={filters} />} />
            <Route path="/inventory" element={<InventoryPage isDark={isDark} sidebarFilters={filters} />} />
            <Route path="/add" element={<AddItemPage onBack={() => navigate('/inventory')} isDark={isDark} />} />
            <Route path="/shopping" element={<ShoppingListPage isDark={isDark} />} />
            <Route path="/insights" element={<InsightsPage isDark={isDark} />} />
            <Route path="/recipes" element={<RecipesPage isDark={isDark} currentUser={currentUser} />} />
            <Route path="/settings" element={<SettingsPage currentUser={currentUser} onLogout={() => { setCurrentUser(null); setShowLanding(true); navigate('/'); }} onBack={() => navigate('/inventory')} isDark={isDark} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return <Router><AppContent /></Router>;
}

export default App;