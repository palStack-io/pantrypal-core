import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius } from './colors';

function ResetPasswordPage({ token, onSuccess }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          new_password: newPassword
        })
      });
      
      if (response.ok) {
        alert('✅ Password reset successful!\n\nYou can now sign in with your new password.');
        onSuccess();
      } else {
        const error = await response.json();
        if (error.detail.includes('expired')) {
          setTokenValid(false);
        }
        alert('❌ Reset failed\n\n' + (error.detail || 'Invalid or expired token'));
      }
    } catch (error) {
      alert('❌ Connection error\n\nCould not reach server');
    } finally {
      setLoading(false);
    }
  };

  if (!tokenValid) {
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
          <div style={{ fontSize: '64px', marginBottom: spacing.md }}>⚠️</div>
          <h2 style={{ color: colors.textPrimary, marginBottom: spacing.md }}>
            Link Expired
          </h2>
          <p style={{ color: colors.textSecondary, lineHeight: 1.6, marginBottom: spacing.xl }}>
            This password reset link has expired or has already been used.
            Please request a new password reset.
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
        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          <div style={{ fontSize: '48px', marginBottom: spacing.sm }}>🔒</div>
          <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: '28px' }}>
            Create New Password
          </h2>
          <p style={{ color: colors.textSecondary, marginTop: spacing.sm }}>
            Enter your new password below
          </p>
        </div>
        
        <form onSubmit={handleResetPassword}>
          <div style={{ marginBottom: spacing.md }}>
            <label style={{
              display: 'block',
              marginBottom: spacing.sm,
              fontWeight: '600',
              color: colors.textPrimary,
            }}>
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
              style={{
                width: '100%',
                padding: spacing.md,
                borderRadius: borderRadius.md,
                border: `2px solid ${colors.border}`,
                fontSize: '16px',
                backgroundColor: '#ffffff',
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
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: spacing.md,
                borderRadius: borderRadius.md,
                border: `2px solid ${colors.border}`,
                fontSize: '16px',
                backgroundColor: '#ffffff',
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
            {loading ? '⏳ Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ResetPasswordPage;