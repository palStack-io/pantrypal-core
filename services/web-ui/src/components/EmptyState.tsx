import { type ComponentType, type ReactNode } from 'react';
import { getColors, spacing, borderRadius, typography } from '../colors';
import { useTheme } from '../context/ThemeContext';

/**
 * Centred empty-state block: illustration, title, optional body, optional action.
 *
 * Port of `mobile/src/components/EmptyState.tsx`. Web had no equivalent, so every
 * surface wrote its own bare "No X found" — most visibly on Recipes, which opens
 * on the "Expiring Soon" tab and is empty for most personas, leaving ~600px of
 * blank card as the page's default state.
 *
 * An empty screen is an invitation to act, so `action` is encouraged rather than
 * optional-by-habit.
 */
interface EmptyStateProps {
  /** Lucide icon component. Falls back to the pantry-jar illustration. */
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  body?: string;
  action?: ReactNode;
  /** Vertical padding. 'sm' for inside a panel, 'lg' for a whole-page state. */
  size?: 'sm' | 'lg';
}

export function EmptyState({ icon: Icon, title, body, action, size = 'lg' }: EmptyStateProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: `${size === 'lg' ? '56px' : '32px'} ${spacing.xl}`,
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: borderRadius.lg,
          background: colors.accentBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
          color: colors.primaryDark,
        }}
      >
        {Icon ? <Icon size={26} strokeWidth={1.6} /> : <JarGlyph color={colors.primaryDark} />}
      </div>
      <h3
        style={{
          margin: 0,
          fontSize: typography.size.lg,
          fontWeight: typography.weight.semibold,
          letterSpacing: typography.tracking.snug,
          color: colors.textPrimary,
        }}
      >
        {title}
      </h3>
      {body && (
        <p
          style={{
            margin: `${spacing.sm} 0 0`,
            fontSize: typography.size.sm,
            color: colors.textSecondary,
            lineHeight: typography.leading.normal,
            maxWidth: '44ch',
          }}
        >
          {body}
        </p>
      )}
      {action && <div style={{ marginTop: spacing.lg }}>{action}</div>}
    </div>
  );
}

/** Default mark: three jars on a shelf — the product's own object. */
function JarGlyph({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="6" height="12" rx="1.6" stroke={color} strokeWidth="1.6" />
      <rect x="5.4" y="6.6" width="3.2" height="2.4" rx="0.8" fill={color} />
      <rect x="12" y="6" width="7" height="15" rx="1.6" stroke={color} strokeWidth="1.6" />
      <rect x="13.6" y="3.4" width="3.8" height="2.6" rx="0.8" fill={color} />
      <rect x="21" y="12" width="4.5" height="9" rx="1.4" stroke={color} strokeWidth="1.6" />
      <rect x="22" y="10" width="2.5" height="2" rx="0.7" fill={color} />
      <path d="M2 22.4h24" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default EmptyState;
