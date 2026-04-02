/**
 * Toast + ToastProvider for pantryPal web UI.
 *
 * Wrap your app with <ToastProvider isDark={isDark}> once.
 * Then anywhere: const toast = useToast(); toast.success('Saved!');
 */

import { useEffect, useRef, createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { getColors, borderRadius } from '../colors';

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);
let _id = 0;

export function ToastProvider({ children, isDark = false }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback(({ message, type = 'info', duration = 4000, title } = {}) => {
    const id = ++_id;
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration, title }]);
    return id;
  }, []);

  const hide = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{
      show,
      hide,
      success: (msg, title) => show({ message: msg, type: 'success', title }),
      error:   (msg, title) => show({ message: msg, type: 'error',   title }),
      warning: (msg, title) => show({ message: msg, type: 'warning', title }),
      info:    (msg, title) => show({ message: msg, type: 'info',    title }),
    }}>
      {children}
      <ToastStack toasts={toasts} onHide={hide} isDark={isDark} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ─── Stack container ──────────────────────────────────────────────────────────
function ToastStack({ toasts, onHide, isDark }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      zIndex: 9999,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} {...t} onHide={onHide} isDark={isDark} />
      ))}
      <style>{KEYFRAMES}</style>
    </div>
  );
}

// ─── Single toast ─────────────────────────────────────────────────────────────
const CONFIG = {
  success: { icon: CheckCircle,     accent: '#10b981', bg_light: '#f0fdf4', bg_dark: '#052e16', border_light: '#bbf7d0', border_dark: '#14532d' },
  error:   { icon: XCircle,         accent: '#ef4444', bg_light: '#fef2f2', bg_dark: '#1c0707', border_light: '#fecaca', border_dark: '#450a0a' },
  warning: { icon: AlertTriangle,   accent: '#f59e0b', bg_light: '#fffbeb', bg_dark: '#1c1400', border_light: '#fde68a', border_dark: '#451a00' },
  info:    { icon: Info,             accent: '#3b82f6', bg_light: '#eff6ff', bg_dark: '#0c1a2e', border_light: '#bfdbfe', border_dark: '#1e3a5f' },
};

function ToastItem({ id, message, title, type, duration, onHide, isDark }) {
  const [leaving, setLeaving] = useState(false);
  const cfg = CONFIG[type] || CONFIG.info;
  const Icon = cfg.icon;

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onHide(id), 260);
  }, [id, onHide]);

  useEffect(() => {
    const t = setTimeout(dismiss, duration);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: borderRadius.xl,
        background: isDark ? cfg.bg_dark : cfg.bg_light,
        border: `1px solid ${isDark ? cfg.border_dark : cfg.border_light}`,
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.6)'
          : '0 4px 24px rgba(0,0,0,0.1)',
        minWidth: '300px',
        maxWidth: '420px',
        pointerEvents: 'all',
        animation: leaving ? 'toastOut 0.26s ease forwards' : 'toastIn 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards',
        cursor: 'default',
      }}
    >
      {/* Accent icon */}
      <div style={{
        flexShrink: 0,
        width: 20,
        height: 20,
        marginTop: title ? '1px' : '0',
        color: cfg.accent,
        display: 'flex',
        alignItems: 'center',
      }}>
        <Icon size={18} strokeWidth={2.2} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: isDark ? '#f9fafb' : '#111827',
            marginBottom: '2px',
            letterSpacing: '-0.1px',
          }}>{title}</div>
        )}
        <div style={{
          fontSize: '13.5px',
          lineHeight: '1.5',
          color: isDark ? '#d1d5db' : '#374151',
          fontWeight: title ? '400' : '500',
        }}>{message}</div>
      </div>

      {/* Close */}
      <button
        onClick={dismiss}
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          color: isDark ? '#6b7280' : '#9ca3af',
          display: 'flex',
          alignItems: 'center',
          borderRadius: '4px',
          transition: 'color 0.1s',
        }}
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}

const KEYFRAMES = `
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(20px) scale(0.96); }
    to   { opacity: 1; transform: translateX(0)    scale(1);    }
  }
  @keyframes toastOut {
    from { opacity: 1; transform: translateX(0)    scale(1);    }
    to   { opacity: 0; transform: translateX(20px) scale(0.95); }
  }
`;

export default ToastProvider;
