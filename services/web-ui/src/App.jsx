// Main App
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import InventoryPage from './pages/InventoryPage';
import AddItemPage from './pages/AddItemPage';
import { ShoppingListPage } from './pages/ShoppingListPage';
import SettingsPage from './SettingsPage';
import LandingPage from './LandingPage';
import { getItems, getCurrentUser } from './api';
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

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
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
      }
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

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