import { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from './colors';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import { setSessionToken } from './api';
import type { User } from './types';

interface LandingPageProps {
  onLoginSuccess: (user: User) => void;
}

interface OidcConfig {
  enabled: boolean;
  provider_name: string;
}

interface DemoAccount {
  username: string;
  password: string;
}

interface FeatureProps {
  icon: string;
  text: string;
}

function Feature({ icon, text }: FeatureProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, fontSize: '18px' }}>
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function LandingPage({ onLoginSuccess }: LandingPageProps) {
  const [view, setView] = useState<'landing' | 'login' | 'signup' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [serverConfigured, setServerConfigured] = useState(true);
  const [showChangeServer, setShowChangeServer] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [oidcConfig, setOidcConfig] = useState<OidcConfig | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [demoSessionMinutes, setDemoSessionMinutes] = useState(10);
  const { toast, showSuccess, showError, hideToast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem('API_BASE_URL');
    if (stored) { setServerUrl(stored); setServerConfigured(true); }
    else {
      const checkSameOriginApi = async () => {
        try {
          const response = await fetch('/api/auth/status', { method: 'GET', headers: { 'Accept': 'application/json' } });
          if (response.ok) { localStorage.setItem('API_BASE_URL', window.location.origin); setServerUrl(window.location.origin); setServerConfigured(true); }
        } catch { /* API not at origin */ }
      };
      checkSameOriginApi();
    }
  }, []);

  useEffect(() => { if (serverConfigured) fetchOidcConfig(); }, [serverConfigured]);

  const fetchOidcConfig = async () => {
    try {
      const response = await fetch('/api/auth/status');
      if (response.ok) {
        const data = await response.json();
        if (data.oidc) setOidcConfig(data.oidc);
        if (data.demo_mode) { setDemoMode(true); setDemoAccounts(data.demo_accounts || []); setDemoSessionMinutes(data.demo_session_minutes || 10); }
      }
    } catch { /* OIDC is optional */ }
  };

  const handleOidcLogin = () => { window.location.href = '/api/auth/oidc/login'; };

  const handleConfigureServer = () => {
    if (!serverUrl.trim()) { showError('Please enter a server URL'); return; }
    let cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    cleanUrl = cleanUrl.replace(/^(https?:\/\/)+(https?:\/\/)+/gi, '$1');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) { showError('Invalid URL - must start with http:// or https://'); return; }
    localStorage.setItem('API_BASE_URL', cleanUrl);
    setServerConfigured(true);
    showSuccess('Server configured! You can now sign in or sign up.');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUsername, password: loginPassword }), credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.session_token) setSessionToken(data.session_token);
        showSuccess('Login successful!');
        onLoginSuccess(data.user);
      } else {
        const error = await response.json();
        showError(error.detail || 'Invalid credentials');
      }
    } catch { showError('Could not reach server - check your connection'); }
    finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirmPassword) { showError('Passwords do not match'); return; }
    if (signupPassword.length < 8) { showError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: signupUsername, email: signupEmail, full_name: signupFullName, password: signupPassword }), credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.session_token) setSessionToken(data.session_token);
        showSuccess('Account created successfully!');
        onLoginSuccess(data.user);
      } else {
        const error = await response.json();
        showError(error.detail || 'Could not create account');
      }
    } catch { showError('Could not reach server - check your connection'); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) });
      if (response.ok) { setResetSent(true); showSuccess('Password reset email sent!'); }
      else { const error = await response.json(); showError(error.detail || 'Could not send reset email'); }
    } catch { showError('Could not reach server - check your connection'); }
    finally { setLoading(false); }
  };

  const outerStyle = { minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing.lg };
  const cardStyle = { background: 'white', borderRadius: borderRadius.xl, padding: spacing.xl, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: '450px', width: '100%' };
  const primaryBtnStyle = { width: '100%', padding: spacing.lg, borderRadius: borderRadius.lg, border: 'none', background: colors.primary, color: colors.textPrimary, fontSize: '18px', fontWeight: 'bold' as const, cursor: loading ? 'not-allowed' : 'pointer' as const, opacity: loading ? 0.6 : 1 };
  const inputStyle = { width: '100%', padding: spacing.md, borderRadius: borderRadius.md, border: `2px solid ${colors.border}`, fontSize: '16px', backgroundColor: '#ffffff', color: '#000000' };

  if (view === 'landing') {
    return (
      <div style={{ ...outerStyle, alignItems: 'flex-start', overflow: 'auto' }}>
        <div style={{ maxWidth: '1400px', width: '100%', display: 'flex', flexWrap: 'wrap', gap: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'white', flex: '1 1 500px', minWidth: '320px', maxWidth: '600px' }}>
            <img src="/pantryPal.png" alt="pantryPal" style={{ width: '64px', height: '64px', marginBottom: spacing.md }} />
            <h1 style={{ fontSize: '48px', margin: 0, marginBottom: spacing.sm, fontWeight: 'bold' }}>pantryPal</h1>
            <p style={{ fontSize: '20px', opacity: 0.9, marginBottom: spacing.xl }}>Part of palStack - Self-hosted solutions for modern homes</p>
            <h2 style={{ fontSize: '32px', marginBottom: spacing.md }}>Never let food go to waste again</h2>
            <div style={{ marginBottom: spacing.xl }}>
              <Feature icon="📷" text="Scan barcodes with your phone" />
              <Feature icon="🔔" text="Get notified about expiring items" />
              <Feature icon="🏠" text="Integrate with Home Assistant" />
              <Feature icon="📊" text="Track everything in one place" />
              <Feature icon="🔒" text="Your data stays on your server" />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: spacing.lg, borderRadius: borderRadius.lg, borderLeft: '4px solid white' }}>
              <p style={{ margin: 0, marginBottom: spacing.sm, fontSize: '18px', fontWeight: 'bold' }}>palStack Mission</p>
              <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.6, fontStyle: 'italic' }}>
                "That's what pals do – they show up and help with the everyday stuff. At palStack, we build simple, open-source tools that make life easier."
              </p>
            </div>
            <div style={{ marginTop: spacing.xl, display: 'flex', gap: spacing.lg, flexWrap: 'wrap' }}>
              <a href="https://github.com/palStack-io/pantrypal-core" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'none', fontSize: '16px', opacity: 0.8 }}>⭐ Star on GitHub →</a>
              <a href="https://pantrypal.palstack.io" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'none', fontSize: '16px', opacity: 0.8 }}>🌐 Learn More →</a>
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: borderRadius.xl, padding: spacing.xl, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', flex: '0 1 450px', minWidth: '320px', maxWidth: '500px' }}>
            {!serverConfigured ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: spacing.xl }}><h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '28px' }}>Connect to pantryPal</h2><p style={{ color: colors.textSecondary, marginTop: spacing.sm }}>Enter your pantryPal server URL</p></div>
                <div style={{ marginBottom: spacing.lg }}>
                  <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>Server URL</label>
                  <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="http://192.168.1.100 or https://pantrypal.yourdomain.com" style={inputStyle} />
                </div>
                <button onClick={handleConfigureServer} style={{ ...primaryBtnStyle, opacity: 1 }}>Continue</button>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
                  <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '28px' }}>Get Started</h2>
                  <p style={{ color: colors.textSecondary, marginTop: spacing.sm }}>Sign in to manage your pantry</p>
                  <button onClick={() => setServerConfigured(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', fontSize: '12px', marginTop: spacing.xs }}>Change server →</button>
                </div>
                {oidcConfig?.enabled && (
                  <>
                    <button onClick={handleOidcLogin} style={{ width: '100%', padding: spacing.lg, borderRadius: borderRadius.lg, border: 'none', background: '#4285f4', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: spacing.md }}>Sign in with {oidcConfig.provider_name}</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}><div style={{ flex: 1, height: '1px', background: colors.border }} /><span style={{ color: colors.textSecondary, fontSize: '14px' }}>or</span><div style={{ flex: 1, height: '1px', background: colors.border }} /></div>
                  </>
                )}
                <div style={{ display: 'flex', gap: spacing.md }}>
                  <button onClick={() => setView('login')} style={{ flex: 1, padding: spacing.lg, borderRadius: borderRadius.lg, border: 'none', background: colors.primary, color: colors.textPrimary, fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>Sign In</button>
                  <button onClick={() => setView('signup')} style={{ flex: 1, padding: spacing.lg, borderRadius: borderRadius.lg, border: `2px solid ${colors.primary}`, background: 'white', color: colors.primary, fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>Sign Up</button>
                </div>
              </>
            )}
          </div>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} duration={toast.duration} />}
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <div style={{ marginBottom: spacing.md }}>
            <button onClick={() => setShowChangeServer(!showChangeServer)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', fontSize: '13px', padding: 0 }}>
              {showChangeServer ? '✕ Cancel' : '⚙ Change Server'}
            </button>
            {showChangeServer && (
              <div style={{ marginTop: spacing.sm, display: 'flex', gap: spacing.sm }}>
                <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="http://192.168.1.100 or https://yourserver.com" style={{ flex: 1, padding: spacing.sm, borderRadius: borderRadius.md, border: `2px solid ${colors.border}`, fontSize: '13px', color: '#000000' }} />
                <button onClick={() => { handleConfigureServer(); setShowChangeServer(false); }} style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, border: 'none', background: colors.primary, color: colors.textPrimary, fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Save</button>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            <img src="/pantryPal.png" alt="pantryPal" style={{ width: '48px', height: '48px', marginBottom: spacing.sm }} />
            <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '28px' }}>Sign In to pantryPal</h2>
          </div>
          {demoMode && demoAccounts.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.lg }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: spacing.sm }}>Try pantryPal with a Demo Account</div>
              <p style={{ fontSize: '14px', margin: 0, marginBottom: spacing.md, opacity: 0.9 }}>Sessions auto-expire after {demoSessionMinutes} minutes.</p>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, padding: spacing.md }}>
                {demoAccounts.map((account, index) => (
                  <div key={account.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing.xs} 0`, borderBottom: index < demoAccounts.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>{account.username}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '14px', opacity: 0.8 }}>{account.password}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {oidcConfig?.enabled && (
            <>
              <button onClick={handleOidcLogin} style={{ width: '100%', padding: spacing.lg, borderRadius: borderRadius.lg, border: 'none', background: '#4285f4', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: spacing.md }}>Sign in with {oidcConfig.provider_name}</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}><div style={{ flex: 1, height: '1px', background: colors.border }} /><span style={{ color: colors.textSecondary, fontSize: '14px' }}>or</span><div style={{ flex: 1, height: '1px', background: colors.border }} /></div>
            </>
          )}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: spacing.md }}>
              <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>Username or Email</label>
              <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required autoFocus autoComplete="username" style={inputStyle} />
            </div>
            <div style={{ marginBottom: spacing.md }}>
              <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showLoginPassword ? 'text' : 'password'} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} autoComplete="current-password" required style={{ ...inputStyle, paddingRight: '48px', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: colors.textSecondary, padding: 0 }}>{showLoginPassword ? '🙈' : '👁'}</button>
              </div>
            </div>
            <button type="button" onClick={() => setView('forgot')} style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', fontSize: '14px', marginBottom: spacing.lg }}>Forgot password?</button>
            <button type="submit" disabled={loading} style={primaryBtnStyle}>{loading ? '⏳ Signing in...' : 'Sign In'}</button>
          </form>
          <div style={{ marginTop: spacing.lg, textAlign: 'center', color: colors.textSecondary }}>
            Don't have an account?{' '}
            <button onClick={() => setView('signup')} style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}>Sign up</button>
          </div>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} duration={toast.duration} />}
      </div>
    );
  }

  if (view === 'signup') {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <button onClick={() => setView('landing')} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', marginBottom: spacing.md, fontSize: '16px' }}>← Back</button>
          <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            <img src="/pantryPal.png" alt="pantryPal" style={{ width: '48px', height: '48px', marginBottom: spacing.sm }} />
            <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '28px' }}>Create Your Account</h2>
            <p style={{ color: colors.textSecondary, marginTop: spacing.sm }}>Join pantryPal and start tracking your inventory</p>
          </div>
          <form onSubmit={handleSignup}>
            {[
              { label: 'Username *', value: signupUsername, onChange: setSignupUsername, type: 'text', required: true, autoFocus: true },
              { label: 'Email *', value: signupEmail, onChange: setSignupEmail, type: 'email', required: true },
              { label: 'Full Name', value: signupFullName, onChange: setSignupFullName, type: 'text' },
              { label: 'Password *', value: signupPassword, onChange: setSignupPassword, type: 'password', required: true },
              { label: 'Confirm Password *', value: signupConfirmPassword, onChange: setSignupConfirmPassword, type: 'password', required: true },
            ].map(({ label, value, onChange, type, required, autoFocus }) => (
              <div key={label} style={{ marginBottom: spacing.md }}>
                <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>{label}</label>
                <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} autoFocus={autoFocus} style={inputStyle} />
              </div>
            ))}
            <button type="submit" disabled={loading} style={{ ...primaryBtnStyle, marginTop: spacing.sm }}>{loading ? '⏳ Creating account...' : 'Create Account'}</button>
          </form>
          <div style={{ marginTop: spacing.lg, textAlign: 'center', color: colors.textSecondary }}>
            Already have an account?{' '}
            <button onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}>Sign in</button>
          </div>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} duration={toast.duration} />}
      </div>
    );
  }

  if (view === 'forgot') {
    if (resetSent) {
      return (
        <div style={outerStyle}>
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: spacing.md }}>✉️</div>
            <h2 style={{ color: colors.textPrimary, marginBottom: spacing.md }}>Check Your Email</h2>
            <p style={{ color: colors.textSecondary, lineHeight: 1.6, marginBottom: spacing.xl }}>If an account exists with that email, we've sent password reset instructions.</p>
            <button onClick={() => { setView('login'); setResetSent(false); setForgotEmail(''); }} style={{ ...primaryBtnStyle, opacity: 1 }}>Back to Sign In</button>
          </div>
          {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} duration={toast.duration} />}
        </div>
      );
    }
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <button onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', marginBottom: spacing.md, fontSize: '16px' }}>← Back</button>
          <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            <div style={{ fontSize: '48px', marginBottom: spacing.sm }}>🔑</div>
            <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '28px' }}>Reset Password</h2>
            <p style={{ color: colors.textSecondary, marginTop: spacing.sm }}>Enter your email to receive reset instructions</p>
          </div>
          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: spacing.lg }}>
              <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: '600', color: colors.textPrimary }}>Email Address</label>
              <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoFocus placeholder="your.email@example.com" style={inputStyle} />
            </div>
            <button type="submit" disabled={loading} style={primaryBtnStyle}>{loading ? '⏳ Sending...' : 'Send Reset Link'}</button>
          </form>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} duration={toast.duration} />}
      </div>
    );
  }

  return null;
}

export default LandingPage;
