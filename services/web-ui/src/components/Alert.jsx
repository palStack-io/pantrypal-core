// Alert component for messages
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { colors, borderRadius, spacing } from '../colors';

export function Alert({ type = 'info', message, onClose, className = '' }) {
  const config = {
    success: {
      icon: CheckCircle,
      bg: '#d1fae5',
      border: colors.success,
      text: '#065f46',
    },
    error: {
      icon: AlertCircle,
      bg: '#fee2e2',
      border: colors.danger,
      text: '#991b1b',
    },
    warning: {
      icon: AlertTriangle,
      bg: '#fef3c7',
      border: colors.warning,
      text: '#92400e',
    },
    info: {
      icon: Info,
      bg: '#dbeafe',
      border: colors.info,
      text: '#1e40af',
    },
  };

  const { icon: Icon, bg, border, text } = config[type] || config.info;

  return (
    <div 
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        backgroundColor: bg,
        border: `2px solid ${border}`,
        borderRadius: borderRadius.md,
        color: text,
        marginBottom: spacing.md,
      }}
    >
      <Icon size={20} />
      <div style={{ flex: 1, fontSize: '14px' }}>{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: spacing.xs,
            color: text,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export default Alert;
