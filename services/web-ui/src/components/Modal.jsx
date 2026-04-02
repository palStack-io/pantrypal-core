/**
 * Modal — animated, dark-mode-aware overlay dialog.
 *
 * Usage:
 *   <Modal isOpen={open} onClose={() => setOpen(false)} title="Edit Item" isDark={isDark}>
 *     ...content
 *   </Modal>
 *
 *   // Confirmation variant
 *   <Modal
 *     isOpen={open} onClose={cancel} title="Delete Item" isDark={isDark}
 *     variant="confirm"
 *     icon="🗑️"
 *     confirmLabel="Delete" confirmVariant="danger"
 *     onConfirm={handleDelete}
 *     cancelLabel="Cancel"
 *   >
 *     This will permanently remove the item.
 *   </Modal>
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { getColors, borderRadius, spacing } from '../colors';
import Button from './Button';

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  width = '500px',
  isDark = false,
  // Confirm variant extras
  variant = 'default',
  icon,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  cancelLabel = 'Cancel',
  onConfirm,
  loading = false,
}) {
  const colors = getColors(isDark);
  const contentRef = useRef(null);

  // Trap focus & close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <>
      <style>{KEYFRAMES}</style>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          animation: 'modalBdIn 0.2s ease forwards',
        }}
      >
        {/* Dialog card */}
        <div
          ref={contentRef}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            border: `1px solid ${borderColor}`,
            boxShadow: isDark
              ? '0 24px 64px rgba(0,0,0,0.7)'
              : '0 16px 48px rgba(0,0,0,0.15)',
            width: '100%',
            maxWidth: width,
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'modalIn 0.25s cubic-bezier(0.34,1.4,0.64,1) forwards',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${spacing.lg} ${spacing.xl}`,
            borderBottom: `1px solid ${borderColor}`,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {icon && <span style={{ fontSize: '20px' }}>{icon}</span>}
              <h2
                id="modal-title"
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '700',
                  color: colors.textPrimary,
                  letterSpacing: '-0.2px',
                }}
              >
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                color: colors.textSecondary,
                transition: 'background 0.15s',
              }}
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: spacing.xl }}>
            {variant === 'confirm' && icon ? (
              <div style={{ textAlign: 'center', paddingBottom: spacing.lg }}>
                <div style={{ fontSize: '40px', marginBottom: spacing.md }}>{icon}</div>
                <p style={{ margin: 0, fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>{children}</p>
              </div>
            ) : (
              children
            )}
          </div>

          {/* Footer — only shown for confirm variant or if slot provided */}
          {variant === 'confirm' && (
            <div style={{
              display: 'flex',
              gap: spacing.md,
              justifyContent: 'flex-end',
              padding: `${spacing.md} ${spacing.xl} ${spacing.lg}`,
              borderTop: `1px solid ${borderColor}`,
              flexShrink: 0,
            }}>
              <Button variant="ghost" size="md" isDark={isDark} onClick={onClose}>
                {cancelLabel}
              </Button>
              <Button variant={confirmVariant} size="md" isDark={isDark} loading={loading} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const KEYFRAMES = `
  @keyframes modalBdIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.94) translateY(8px); }
    to   { opacity: 1; transform: scale(1)    translateY(0);   }
  }
`;

export default Modal;
