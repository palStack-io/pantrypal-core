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
import TourOverlay from './components/onboarding/TourOverlay';
import { useTour } from './components/onboarding/useTour';
import { tourSteps } from './components/onboarding/tourSteps';
import { useIsMobile, MOBILE_BREAKPOINT } from './hooks/useIsMobile';
import { Menu, X } from 'lucide-react';
import type { User } from './types';
import './App.css';

function AppContent() {
  const [showLanding, setShowLanding] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // *** ON A PHONE THE NAVIGATION WAS UNREACHABLE. ***
  // `.sidebar` is parked at `left: -280px` under 768px and only `.sidebar.open`
  // brings it back -- but nothing ever added that class, `setSidebarOpen` was
  // never called from anywhere, and `Navbar.tsx` (which owns the hamburger)
  // is not rendered by this app at all. So on any phone-width viewport there
  // was no way to reach All Items, Shopping List, Insights, Recipes, any
  // filter, or Add New Item.
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(() => !(typeof window !== 'undefined' && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches));
  const [filters, setFilters] = useState<Record<string, string | null>>({});
  const { isDark, toggle: toggleDark } = useTheme();
  const isAuthenticated = !checkingAuth && !showLanding;
  const { active: tourActive, step: tourStep, next: tourNext, prev: tourPrev, goTo: tourGoTo, end: tourEnd, replay: tourReplay } = useTour(isAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();

  const isSpecialRoute = location.pathname === '/verify-email' || location.pathname === '/reset-password';
  const urlParams = new URLSearchParams(location.search);
  const token = urlParams.get('token');

  useEffect(() => { checkAuth(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Crossing the breakpoint resets to that layout's sensible default:
  // open on desktop, closed on a phone.
  useEffect(() => { setSidebarOpen(!isMobile); }, [isMobile]);

  // Every tour step spotlights something inside the sidebar, so on a phone
  // the tour would dim the screen and point at nothing.
  useEffect(() => { if (tourActive && isMobile) setSidebarOpen(true); }, [tourActive, isMobile]);

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
        onReplayTour={() => { tourReplay(); navigate('/'); }}
      />
    );
  }

  return (
    <div className="app">
      {/* First in the DOM on purpose: tab order follows DOM order, so a skip
          link placed after the sidebar is only reachable by tabbing through
          the ~30 stops it exists to skip. It is off-screen until focused. */}
      <a className="skip-link" href="#main">Skip to content</a>
      {tourActive && (
        <TourOverlay
          step={tourStep}
          total={tourSteps.length}
          onNext={tourNext}
          onPrev={tourPrev}
          onGoTo={tourGoTo}
          onEnd={tourEnd}
        />
      )}
      {isMobile && (
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
          onClick={() => setSidebarOpen(o => !o)}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}
      {isMobile && sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        isOpen={sidebarOpen}
        currentPath={location.pathname}
        onNavigate={(path) => { navigate(path); if (isMobile) setSidebarOpen(false); }}
        onFilterChange={handleFilterChange}
        currentFilters={filters}
      />
      <TopBar currentUser={currentUser} onLogout={() => { setCurrentUser(null); setShowLanding(true); navigate('/'); }} onSettingsClick={() => navigate('/settings')} onToggleDark={toggleDark} />
      <div className="main-content-wrapper">
        <main
          className="main-content"
          id="main"
          /* tabIndex 0, not -1: `.main-content` is the scroll
             container, and a scrollable region that cannot be focused
             cannot be scrolled with the arrow keys. 0 serves the skip
             link just as well as -1 did. */
          tabIndex={0}
        >
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
