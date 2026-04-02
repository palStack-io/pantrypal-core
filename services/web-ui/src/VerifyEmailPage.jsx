import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from './colors';

function VerifyEmailPage({ token, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Automatically verify the email when component mounts
    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token })
        });

        if (response.ok) {
          setVerified(true);
          // Auto-redirect to login after 3 seconds
          setTimeout(() => {
            onSuccess();
          }, 3000);
        } else {
          const errorData = await response.json();
          setError(errorData.detail || 'Invalid or expired verification token');
        }
      } catch (err) {
        setError('Could not reach server. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifyEmail();
    } else {
      setError('No verification token provided');
      setLoading(false);
    }
  }, [token, onSuccess]);

  // Loading state
  if (loading) {
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
          <div style={{ fontSize: '64px', marginBottom: spacing.md }}>⏳</div>
          <h2 style={{ color: colors.textPrimary, marginBottom: spacing.md }}>
            Verifying Your Email
          </h2>
          <p style={{ color: colors.textSecondary, lineHeight: 1.6 }}>
            Please wait while we verify your email address...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
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
          <div style={{ fontSize: '64px', marginBottom: spacing.md }}>❌</div>
          <h2 style={{ color: colors.textPrimary, marginBottom: spacing.md }}>
            Verification Failed
          </h2>
          <p style={{ color: colors.textSecondary, lineHeight: 1.6, marginBottom: spacing.xl }}>
            {error}
          </p>
          <button
            onClick={onSuccess}
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
      </div>
    );
  }

  // Success state
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
        <div style={{ fontSize: '64px', marginBottom: spacing.md }}>✅</div>
        <h2 style={{ color: colors.textPrimary, marginBottom: spacing.md }}>
          Email Verified!
        </h2>
        <p style={{ color: colors.textSecondary, lineHeight: 1.6, marginBottom: spacing.xl }}>
          Your email has been successfully verified. You can now sign in to your account.
        </p>
        <p style={{
          color: colors.textSecondary,
          fontSize: '14px',
          marginBottom: spacing.lg,
          fontStyle: 'italic'
        }}>
          Redirecting to sign in page in 3 seconds...
        </p>
        <button
          onClick={onSuccess}
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
          Sign In Now
        </button>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
