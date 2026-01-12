// Modal component
import { X } from 'lucide-react';
import { colors, borderRadius, spacing, shadows } from '../colors';

export function Modal({ isOpen, onClose, title, children, width = '500px' }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: spacing.lg,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.card,
          borderRadius: borderRadius.lg,
          boxShadow: shadows.xl,
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.xl,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: colors.textPrimary }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: spacing.sm,
              display: 'flex',
              alignItems: 'center',
              color: colors.textSecondary,
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: spacing.xl }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
