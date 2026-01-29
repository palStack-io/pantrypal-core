import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from './colors';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import { setSessionToken } from './api';

function LandingPage({ onLoginSuccess }) {
  const [view, setView] = useState('landing'); // landing, login, signup, forgot
  const [loading, setLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [serverConfigured, setServerConfigured] = useState(false);

  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // OIDC configuration
  const [oidcConfig, setOidcConfig] = useState(null);

  // Demo mode configuration
  const [demoMode, setDemoMode] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [demoSessionMinutes, setDemoSessionMinutes] = useState(10);

  // Toast notifications
  const { toast, showSuccess, showError, hideToast } = useToast();

  useEffect(() => {
    // Check if server is already configured
    const stored = localStorage.getItem('API_BASE_URL');
    if (stored) {
      setServerUrl(stored);
      setServerConfigured(true);
    }
  }, []);

  useEffect(() => {
    // Fetch OIDC configuration when server is configured
    if (serverConfigured) {
      fetchOidcConfig();
    }
  }, [serverConfigured]);

  const fetchOidcConfig = async () => {
    try {
      const response = await fetch('/api/auth/status');
      if (response.ok) {
        const data = await response.json();
        if (data.oidc) {
          setOidcConfig(data.oidc);
        }
        // Set demo mode config
        if (data.demo_mode) {
          setDemoMode(true);
          setDemoAccounts(data.demo_accounts || []);
          setDemoSessionMinutes(data.demo_session_minutes || 10);
        }
      }
    } catch (error) {
      // Silently fail - OIDC is optional
    }
  };

  const handleOidcLogin = () => {
    // Redirect to OIDC login endpoint
    window.location.href = '/api/auth/oidc/login';
  };

  const handleConfigureServer = () => {
    if (!serverUrl.trim()) {
      showError('Please enter a server URL');
      return;
    }

    let cleanUrl = serverUrl.trim().replace(/\/+$/, '');

    // Remove any duplicate http:// or https:// prefixes
    cleanUrl = cleanUrl.replace(/^(https?:\/\/)+(https?:\/\/)+/gi, '$1');

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      showError('Invalid URL - must start with http:// or https://');
      return;
    }

    localStorage.setItem('API_BASE_URL', cleanUrl);
    setServerConfigured(true);
    showSuccess('Server configured! You can now sign in or sign up.');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        // Store session token if provided
        if (data.session_token) {
          setSessionToken(data.session_token);
        }
        showSuccess('Login successful!');
        onLoginSuccess(data.user);
      } else {
        const error = await response.json();
        showError(error.detail || 'Invalid credentials');
      }
    } catch (error) {
      showError('Could not reach server - check your connection');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (signupPassword !== signupConfirmPassword) {
      showError('Passwords do not match');
      return;
    }

    if (signupPassword.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signupUsername,
          email: signupEmail,
          full_name: signupFullName,
          password: signupPassword
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        // Store session token if provided
        if (data.session_token) {
          setSessionToken(data.session_token);
        }
        showSuccess('Account created successfully!');
        onLoginSuccess(data.user);
      } else {
        const error = await response.json();
        showError(error.detail || 'Could not create account');
      }
    } catch (error) {
      showError('Could not reach server - check your connection');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });

      if (response.ok) {
        setResetSent(true);
        showSuccess('Password reset email sent!');
      } else {
        const error = await response.json();
        showError(error.detail || 'Could not send reset email');
      }
    } catch (error) {
      showError('Could not reach server - check your connection');
    } finally {
      setLoading(false);
    }
  };

  // Landing view
  if (view === 'landing') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        overflow: 'auto',
      }}>
        <div style={{
          maxWidth: '1400px',
          width: '100%',
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing.xl,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Left: Hero Section */}
          <div style={{ 
            color: 'white',
            flex: '1 1 500px',
            minWidth: '320px',
            maxWidth: '600px',
          }}>
            <div style={{ fontSize: '64px', marginBottom: spacing.md }}>🥫</div>
            <h1 style={{ fontSize: '48px', margin: 0, marginBottom: spacing.sm, fontWeight: 'bold' }}>
              PantryPal
            </h1>
            <p style={{ fontSize: '20px', opacity: 0.9, marginBottom: spacing.xl }}>
              Part of PalStack - Self-hosted solutions for modern homes
            </p>
            
            <h2 style={{ fontSize: '32px', marginBottom: spacing.md }}>
              Never let food go to waste again
            </h2>
            
            <div style={{ marginBottom: spacing.xl }}>
              <Feature icon="📷" text="Scan barcodes with your phone" />
              <Feature icon="🔔" text="Get notified about expiring items" />
              <Feature icon="🏠" text="Integrate with Home Assistant" />
              <Feature icon="📊" text="Track everything in one place" />
              <Feature icon="🔒" text="Your data stays on your server" />
            </div>
            
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: spacing.lg,
              borderRadius: borderRadius.lg,
              borderLeft: '4px solid white',
            }}>
              <p style={{ margin: 0, marginBottom: spacing.sm, fontSize: '18px', fontWeight: 'bold' }}>
                PalStack Mission
              </p>
              <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.6, fontStyle: 'italic' }}>
                "That's what pals do – they show up and help with the everyday stuff. 
                At PalStack, we build simple, open-source tools that make life easier. 
                Track what's in your pantry, manage home repairs, stay on top of your budget – 
                all without compromising your privacy or freedom.
              </p>
              <p style={{ margin: 0, marginTop: spacing.sm, fontSize: '15px', lineHeight: 1.6, fontStyle: 'italic' }}>
                Self-host for complete control, modify them to fit your needs, or use our 
                affordable hosted option. Either way, your pal's got your back."
              </p>
            </div>
            
            <div style={{ marginTop: spacing.xl }}>
              <a 
                href="https://github.com/harung1993/PantryPal" 
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '16px',
                  opacity: 0.8,
                }}
              >
                ⭐ Star on GitHub →
              </a>
            </div>
          </div>
          
          {/* Right: Auth Card */}
          <div style={{
            background: 'white',
            borderRadius: borderRadius.xl,
            padding: spacing.xl,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            flex: '0 1 450px',
            minWidth: '320px',
            maxWidth: '500px',
          }}>
            {!serverConfigured ? (
              // Server configuration view
              <>
                <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
                  <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '28px' }}>
                    Connect to PantryPal
                  </h2>
                  <p style={{ color: colors.textSecondary, marginTop: spacing.sm }}>
                    Enter your PantryPal server URL
                  </p>
                </div>

                <div style={{ marginBottom: spacing.lg }}>
                  <label style={{
                    display: 'block',
                    marginBottom: spacing.sm,
                    fontWeight: '600',
                    color: colors.textPrimary,
                  }}>
                    Server URL
                  </label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://192.168.1.100 or https://pantrypal.yourdomain.com"
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: `2px solid ${colors.border}`,
                      fontSize: '16px',
                      marginBottom: spacing.sm,
                      color: '#000000',
                    }}
                  />
                  <p style={{
                    fontSize: '13px',
                    color: colors.textSecondary,
                    margin: 0,
                    lineHeight: 1.5,
                  }}>
                    Examples:<br/>
                    • http://192.168.68.119<br/>
                    • http://macmini.local<br/>
                    • https://pantrypal.example.com
                  </p>
                </div>

                <button
                  onClick={handleConfigureServer}
                  style={{
                    width: '100%',
                    padding: spacing.lg,
                    borderRadius: borderRadius.lg,
                    border: 'none',
                    background: colors.primary,
                    color: colors.textPrimary,
                    fontSize: '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  Continue
                </button>

                <div style={{
                  marginTop: spacing.lg,
                  padding: spacing.md,
                  background: '#f9fafb',
                  borderRadius: borderRadius.md,
                  fontSize: '13px',
                  color: colors.textSecondary,
                  lineHeight: 1.5,
                }}>
                  💡 This is the URL where your PantryPal backend is running.
                  If you're at home, you can also access directly without this step.
                </div>
              </>
            ) : (
              // Auth options view (original)
              <>
                <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
                  <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '28px' }}>
                    Get Started
                  </h2>
                  <p style={{ color: colors.textSecondary, marginTop: spacing.sm }}>
                    Sign in to manage your pantry
                  </p>
                  <button
                    onClick={() => setServerConfigured(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.textSecondary,
                      cursor: 'pointer',
                      fontSize: '12px',
                      marginTop: spacing.xs,
                    }}
                  >
                    Change server →
                  </button>
                </div>

                {/* Demo Mode Banner */}
                {demoMode && demoAccounts.length > 0 && (
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    marginBottom: spacing.lg,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: spacing.xs }}>
                      Demo Mode Active
                    </div>
                    <p style={{ fontSize: '13px', margin: 0, opacity: 0.9 }}>
                      Try the app with demo accounts - click Sign In to see credentials
                    </p>
                  </div>
                )}

                {/* OIDC Login Button (if enabled) */}
                {oidcConfig?.enabled && (
                  <>
                    <button
                      onClick={handleOidcLogin}
                      style={{
                        width: '100%',
                        padding: spacing.lg,
                        borderRadius: borderRadius.lg,
                        border: 'none',
                        background: '#4285f4',
                        color: 'white',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        marginBottom: spacing.md,
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      Sign in with {oidcConfig.provider_name}
                    </button>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.md,
                      marginBottom: spacing.md,
                    }}>
                      <div style={{ flex: 1, height: '1px', background: colors.border }}></div>
                      <span style={{ color: colors.textSecondary, fontSize: '14px' }}>or</span>
                      <div style={{ flex: 1, height: '1px', background: colors.border }}></div>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: spacing.md }}>
                  <button
                    onClick={() => setView('login')}
                    style={{
                      flex: 1,
                      padding: spacing.lg,
                      borderRadius: borderRadius.lg,
                      border: 'none',
                      background: colors.primary,
                      color: colors.textPrimary,
                      fontSize: '18px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setView('signup')}
                    style={{
                      flex: 1,
                      padding: spacing.lg,
                      borderRadius: borderRadius.lg,
                      border: `2px solid ${colors.primary}`,
                      background: 'white',
                      color: colors.primary,
                      fontSize: '18px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    Sign Up
                  </button>
                </div>
                
                <div style={{
                  marginTop: spacing.xl,
                  padding: spacing.lg,
                  background: '#f9fafb',
                  borderRadius: borderRadius.md,
                  textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>
                    💡 <strong>At home?</strong> You can access PantryPal directly without logging in!
                    This login is only needed for external access.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} duration={toast.duration} />}
      </div>
    );
  }

  // Login view
  if (view === 'login') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
      }}>
        <div style={{
          background: 'white',
          borderRadius: borderRadius.xl,
          padding: spacing.xl,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: '450px',
          width: '100%',
        }}>
          <button
            onClick={() => setView('landing')}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              marginBottom: spacing.md,
              fontSize: '16px',
            }}
          >
            ← Back
          </button>
          
          <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            <div style={{ fontSize: '48px', marginBottom: spacing.sm }}>🥫</div>
            <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '28px' }}>
              Sign In to PantryPal
            </h2>
          </div>

          {/* Demo Mode Banner */}
          {demoMode && demoAccounts.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: spacing.lg,
              borderRadius: borderRadius.lg,
              marginBottom: spacing.lg,
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: spacing.sm }}>
                Try PantryPal with a Demo Account
              </div>
              <p style={{ fontSize: '14px', margin: 0, marginBottom: spacing.md, opacity: 0.9 }}>
                Use any of these accounts to explore the app. Sessions auto-expire after {demoSessionMinutes} minutes.
              </p>
              <div style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: borderRadius.md,
                padding: spacing.md,
              }}>
                {demoAccounts.map((account, index) => (
                  <div
                    key={account.username}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${spacing.xs} 0`,
                      borderBottom: index < demoAccounts.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                      {account.username}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '14px', opacity: 0.8 }}>
                      {account.password}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', margin: 0, marginTop: spacing.sm, opacity: 0.7 }}>
                Note: Demo accounts cannot create API keys
              </p>
            </div>
          )}

          {/* OIDC Login Button (if enabled) */}
          {oidcConfig?.enabled && (
            <>
              <button
                onClick={handleOidcLogin}
                style={{
                  width: '100%',
                  padding: spacing.lg,
                  borderRadius: borderRadius.lg,
                  border: 'none',
                  background: '#4285f4',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  marginBottom: spacing.md,
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Sign in with {oidcConfig.provider_name}
              </button>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                marginBottom: spacing.md,
              }}>
                <div style={{ flex: 1, height: '1px', background: colors.border }}></div>
                <span style={{ color: colors.textSecondary, fontSize: '14px' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: colors.border }}></div>
              </div>
            </>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: spacing.md }}>
              <label style={{
                display: 'block',
                marginBottom: spacing.sm,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                Username
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  border: `2px solid ${colors.border}`,
                  fontSize: '16px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                }}
              />
            </div>
            
            <div style={{ marginBottom: spacing.md }}>
              <label style={{
                display: 'block',
                marginBottom: spacing.sm,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  border: `2px solid ${colors.border}`,
                  fontSize: '16px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                }}
              />
            </div>
            
            <button
              type="button"
              onClick={() => setView('forgot')}
              style={{
                background: 'none',
                border: 'none',
                color: colors.primary,
                cursor: 'pointer',
                fontSize: '14px',
                marginBottom: spacing.lg,
              }}
            >
              Forgot password?
            </button>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: spacing.lg,
                borderRadius: borderRadius.lg,
                border: 'none',
                background: colors.primary,
                color: colors.textPrimary,
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '⏳ Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <div style={{
            marginTop: spacing.lg,
            textAlign: 'center',
            color: colors.textSecondary,
          }}>
            Don't have an account?{' '}
            <button
              onClick={() => setView('signup')}
              style={{
                background: 'none',
                border: 'none',
                color: colors.primary,
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
              }}
            >
              Sign up
            </button>
          </div>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} duration={toast.duration} />}
      </div>
    );
  }

  // Signup view
  if (view === 'signup') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
      }}>
        <div style={{
          background: 'white',
          borderRadius: borderRadius.xl,
          padding: spacing.xl,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: '450px',
          width: '100%',
        }}>
          <button
            onClick={() => setView('landing')}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              marginBottom: spacing.md,
              fontSize: '16px',
            }}
          >
            ← Back
          </button>
          
          <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            <div style={{ fontSize: '48px', marginBottom: spacing.sm }}>🥫</div>
            <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '28px' }}>
              Create Your Account
            </h2>
            <p style={{ color: colors.textSecondary, marginTop: spacing.sm }}>
              Join PantryPal and start tracking your inventory
            </p>
          </div>
          
          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: spacing.md }}>
              <label style={{
                display: 'block',
                marginBottom: spacing.sm,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                Username *
              </label>
              <input
                type="text"
                value={signupUsername}
                onChange={(e) => setSignupUsername(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  border: `2px solid ${colors.border}`,
                  fontSize: '16px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                }}
              />
            </div>
            
            <div style={{ marginBottom: spacing.md }}>
              <label style={{
                display: 'block',
                marginBottom: spacing.sm,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                Email *
              </label>
              <input
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  border: `2px solid ${colors.border}`,
                  fontSize: '16px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                }}
              />
            </div>
            
            <div style={{ marginBottom: spacing.md }}>
              <label style={{
                display: 'block',
                marginBottom: spacing.sm,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                Full Name
              </label>
              <input
                type="text"
                value={signupFullName}
                onChange={(e) => setSignupFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  border: `2px solid ${colors.border}`,
                  fontSize: '16px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                }}
              />
            </div>
            
            <div style={{ marginBottom: spacing.md }}>
              <label style={{
                display: 'block',
                marginBottom: spacing.sm,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                Password *
              </label>
              <input
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
                minLength={8}
                style={{
                  width: '100%',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  border: `2px solid ${colors.border}`,
                  fontSize: '16px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                }}
              />
              <p style={{ fontSize: '12px', color: colors.textSecondary, marginTop: spacing.xs, marginBottom: 0 }}>
                Minimum 8 characters
              </p>
            </div>
            
            <div style={{ marginBottom: spacing.lg }}>
              <label style={{
                display: 'block',
                marginBottom: spacing.sm,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                Confirm Password *
              </label>
              <input
                type="password"
                value={signupConfirmPassword}
                onChange={(e) => setSignupConfirmPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  border: `2px solid ${colors.border}`,
                  fontSize: '16px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: spacing.lg,
                borderRadius: borderRadius.lg,
                border: 'none',
                background: colors.primary,
                color: colors.textPrimary,
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '⏳ Creating account...' : 'Create Account'}
            </button>
          </form>
          
          <div style={{
            marginTop: spacing.lg,
            textAlign: 'center',
            color: colors.textSecondary,
          }}>
            Already have an account?{' '}
            <button
              onClick={() => setView('login')}
              style={{
                background: 'none',
                border: 'none',
                color: colors.primary,
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
              }}
            >
              Sign in
            </button>
          </div>
          
          <div style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            background: '#f9fafb',
            borderRadius: borderRadius.md,
            fontSize: '12px',
            color: colors.textSecondary,
            lineHeight: 1.5,
          }}>
            By creating an account, you agree to use PantryPal responsibly. 
            All data is stored locally on your server.
          </div>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} duration={toast.duration} />}
      </div>
    );
  }

  // Forgot password view
  if (view === 'forgot') {
    if (resetSent) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}>
          <div style={{
            background: 'white',
            borderRadius: borderRadius.xl,
            padding: spacing.xl,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            maxWidth: '450px',
            width: '100%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '64px', marginBottom: spacing.md }}>✉️</div>
            <h2 style={{ color: colors.textPrimary, marginBottom: spacing.md }}>
              Check Your Email
            </h2>
            <p style={{ color: colors.textSecondary, lineHeight: 1.6, marginBottom: spacing.xl }}>
              If an account exists with that email, we've sent password reset instructions.
              Check your inbox and spam folder.
            </p>
            <button
              onClick={() => {
                setView('login');
                setResetSent(false);
                setForgotEmail('');
              }}
              style={{
                width: '100%',
                padding: spacing.lg,
                borderRadius: borderRadius.lg,
                border: 'none',
                background: colors.primary,
                color: colors.textPrimary,
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Back to Sign In
            </button>
          </div>
          {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} duration={toast.duration} />}
        </div>
      );
    }

    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
      }}>
        <div style={{
          background: 'white',
          borderRadius: borderRadius.xl,
          padding: spacing.xl,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: '450px',
          width: '100%',
        }}>
          <button
            onClick={() => setView('login')}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              marginBottom: spacing.md,
              fontSize: '16px',
            }}
          >
            ← Back
          </button>
          
          <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            <div style={{ fontSize: '48px', marginBottom: spacing.sm }}>🔑</div>
            <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '28px' }}>
              Reset Password
            </h2>
            <p style={{ color: colors.textSecondary, marginTop: spacing.sm }}>
              Enter your email to receive reset instructions
            </p>
          </div>
          
          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: spacing.lg }}>
              <label style={{
                display: 'block',
                marginBottom: spacing.sm,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                autoFocus
                placeholder="your.email@example.com"
                style={{
                  width: '100%',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  border: `2px solid ${colors.border}`,
                  fontSize: '16px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: spacing.lg,
                borderRadius: borderRadius.lg,
                border: 'none',
                background: colors.primary,
                color: colors.textPrimary,
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '⏳ Sending...' : 'Send Reset Link'}
            </button>
          </form>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} duration={toast.duration} />}
      </div>
    );
  }

  return null;
}

// Feature component for landing page
function Feature({ icon, text }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
      fontSize: '18px',
    }}>
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

export default LandingPage;