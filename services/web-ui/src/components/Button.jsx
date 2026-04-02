/**
 * Unified Button component for pantryPal web UI.
 *
 * Variants:  primary | secondary | ghost | danger | success
 * Sizes:     sm | md | lg
 *
 * Usage:
 *   <Button variant="primary" size="md" onClick={fn}>Save Item</Button>
 *   <Button variant="danger" loading={saving} icon={<Trash2 size={15} />}>Delete</Button>
 *   <Button variant="ghost" size="sm">Cancel</Button>
 */

import { useState } from 'react';
import { getColors, getGradient, borderRadius, spacing } from '../colors';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  isDark = false,
  style = {},
  type = 'button',
}) {
  const [pressed, setPressed] = useState(false);
  const colors = getColors(isDark);
  const gradient = getGradient(isDark);

  const sizeMap = {
    sm: { padding: '6px 14px', fontSize: '13px', height: '32px', iconSize: 14, gap: '5px', radius: borderRadius.md },
    md: { padding: '9px 20px', fontSize: '14px', height: '38px', iconSize: 16, gap: '6px', radius: borderRadius.lg },
    lg: { padding: '12px 28px', fontSize: '15px', height: '44px', iconSize: 18, gap: '8px', radius: borderRadius.xl },
  };

  const variantStyles = {
    primary: {
      background: gradient.primary,
      color: '#fff',
      border: 'none',
      shadow: `0 2px 8px ${isDark ? 'rgba(245,158,11,0.35)' : 'rgba(217,119,6,0.3)'}`,
      hoverShadow: `0 4px 16px ${isDark ? 'rgba(245,158,11,0.45)' : 'rgba(217,119,6,0.4)'}`,
    },
    secondary: {
      background: colors.accentBg,
      color: colors.primary,
      border: `1.5px solid ${colors.borderDark}`,
      shadow: 'none',
      hoverShadow: `0 2px 8px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.07)'}`,
    },
    ghost: {
      background: 'transparent',
      color: colors.textSecondary,
      border: `1.5px solid ${colors.border}`,
      shadow: 'none',
      hoverShadow: 'none',
    },
    danger: {
      background: 'linear-gradient(135deg, #ff3b30 0%, #d00 100%)',
      color: '#fff',
      border: 'none',
      shadow: '0 2px 8px rgba(255,59,48,0.3)',
      hoverShadow: '0 4px 16px rgba(255,59,48,0.4)',
    },
    success: {
      background: gradient.success,
      color: '#fff',
      border: 'none',
      shadow: '0 2px 8px rgba(16,185,129,0.3)',
      hoverShadow: '0 4px 16px rgba(16,185,129,0.4)',
    },
  };

  const sz = sizeMap[size] || sizeMap.md;
  const vr = variantStyles[variant] || variantStyles.primary;
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={!isDisabled ? onClick : undefined}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: sz.gap,
        padding: sz.padding,
        height: sz.height,
        fontSize: sz.fontSize,
        fontWeight: '600',
        letterSpacing: '-0.1px',
        borderRadius: sz.radius,
        background: vr.background,
        color: vr.color,
        border: vr.border,
        boxShadow: pressed ? 'none' : vr.shadow,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        transition: 'all 0.15s ease',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        width: fullWidth ? '100%' : undefined,
        outline: 'none',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...style,
      }}
    >
      {loading ? (
        <LoadingDot color={vr.color} />
      ) : (
        <>
          {icon && <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>}
          {children}
          {iconRight && <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{iconRight}</span>}
        </>
      )}
    </button>
  );
}

function LoadingDot({ color }) {
  return (
    <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: color,
            animation: `btnDot 1.2s ease-in-out ${i * 0.2}s infinite`,
            opacity: 0.7,
          }}
        />
      ))}
      <style>{`
        @keyframes btnDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </span>
  );
}
