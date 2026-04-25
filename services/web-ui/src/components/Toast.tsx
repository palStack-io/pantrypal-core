import { useEffect, useCallback, createContext, useContext, useState, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { getColors, borderRadius } from '../colors';
import { useTheme } from '../context/ThemeContext';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastData {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
  title?: string;
  action?: ToastAction;
}

interface ShowOptions {
  message: string;
  type?: ToastData['type'];
  duration?: number;
  title?: string;
  action?: ToastAction;
}

interface ToastContextValue {
  show: (opts?: ShowOptions) => number;
  hide: (id: number) => void;
  success: (msg: string, title?: string) => number;
  error: (msg: string, title?: string) => number;
  warning: (msg: string, title?: string) => number;
  info: (msg: string, title?: string) => number;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const show = useCallback((opts: ShowOptions = { message: '' }): number => {
    const { message, type = 'info', duration = 4000, title, action } = opts;
    const id = ++_id;
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration, title, action }]);
    return id;
  }, []);

  const hide = useCallback((id: number) => {
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
      <ToastStack toasts={toasts} onHide={hide} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext) as ToastContextValue;

function ToastStack({ toasts, onHide }: { toasts: ToastData[]; onHide: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 9999, pointerEvents: 'none' }}>
      {toasts.map(t => <ToastItem key={t.id} {...t} onHide={onHide} />)}
      <style>{KEYFRAMES}</style>
    </div>
  );
}

const CONFIG = {
  success: { icon: CheckCircle,   accent: '#10b981', bg_light: '#f0fdf4', bg_dark: '#052e16', border_light: '#bbf7d0', border_dark: '#14532d' },
  error:   { icon: XCircle,       accent: '#ef4444', bg_light: '#fef2f2', bg_dark: '#1c0707', border_light: '#fecaca', border_dark: '#450a0a' },
  warning: { icon: AlertTriangle, accent: '#f59e0b', bg_light: '#fffbeb', bg_dark: '#1c1400', border_light: '#fde68a', border_dark: '#451a00' },
  info:    { icon: Info,           accent: '#3b82f6', bg_light: '#eff6ff', bg_dark: '#0c1a2e', border_light: '#bfdbfe', border_dark: '#1e3a5f' },
};

function ToastItem({ id, message, title, type, duration, action, onHide }: ToastData & { onHide: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false);
  const { isDark } = useTheme();
  const cfg = CONFIG[type] || CONFIG.info;
  const Icon = cfg.icon;

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onHide(id), 260);
  }, [id, onHide]);

  useEffect(() => {
    const t = setTimeout(dismiss, duration);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
      aria-atomic="true"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px',
        borderRadius: borderRadius.xl,
        background: isDark ? cfg.bg_dark : cfg.bg_light,
        border: `1px solid ${isDark ? cfg.border_dark : cfg.border_light}`,
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 4px 24px rgba(0,0,0,0.1)',
        minWidth: '300px', maxWidth: '420px', pointerEvents: 'all',
        animation: leaving ? 'toastOut 0.26s ease forwards' : 'toastIn 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards',
        cursor: 'default',
      }}
    >
      <div style={{ flexShrink: 0, width: 20, height: 20, marginTop: title ? '1px' : '0', color: cfg.accent, display: 'flex', alignItems: 'center' }}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: '14px', fontWeight: '600', color: isDark ? '#f9fafb' : '#111827', marginBottom: '2px', letterSpacing: '-0.1px' }}>{title}</div>}
        <div style={{ fontSize: '13.5px', lineHeight: '1.5', color: isDark ? '#d1d5db' : '#374151', fontWeight: title ? '400' : '500' }}>{message}</div>
      </div>
      {action && (
        <button onClick={() => { action.onClick(); dismiss(); }} style={{ flexShrink: 0, background: 'none', border: `1px solid ${cfg.accent}`, borderRadius: '6px', cursor: 'pointer', padding: '4px 10px', color: cfg.accent, fontSize: '12.5px', fontWeight: '700', alignSelf: 'center', whiteSpace: 'nowrap' }}>
          {action.label}
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss notification" style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: isDark ? '#6b7280' : '#9ca3af', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'color 0.1s' }}>
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}

const KEYFRAMES = `
  @keyframes toastIn  { from{opacity:0;transform:translateX(20px) scale(0.96)} to{opacity:1;transform:translateX(0) scale(1)} }
  @keyframes toastOut { from{opacity:1;transform:translateX(0) scale(1)} to{opacity:0;transform:translateX(20px) scale(0.95)} }
`;

export default ToastProvider;
