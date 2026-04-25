import { type CSSProperties } from 'react';
import { getColors, borderRadius, spacing } from '../colors';
import { useTheme } from '../context/ThemeContext';

const pulse = `@keyframes skeleton-pulse { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }`;

interface SkeletonBlockProps {
  width?: string;
  height?: string;
  style?: CSSProperties;
}

function SkeletonBlock({ width = '100%', height = '16px', style = {} }: SkeletonBlockProps) {
  return <div style={{ width, height, borderRadius: borderRadius.sm, animation: 'skeleton-pulse 1.5s ease-in-out infinite', ...style }} />;
}

interface SkeletonProps {
  count?: number;
}

export function InventorySkeleton({ count = 6 }: SkeletonProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const bg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <>
      <style>{pulse}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing.lg }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ backgroundColor: colors.card, borderRadius: borderRadius.lg, border: `1px solid ${colors.border}`, padding: spacing.lg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <SkeletonBlock width="60%" height="20px" style={{ backgroundColor: bg }} />
              <SkeletonBlock width="24px" height="24px" style={{ backgroundColor: bg, borderRadius: '50%' }} />
            </div>
            <SkeletonBlock width="40%" height="14px" style={{ backgroundColor: bg, marginBottom: spacing.sm }} />
            <SkeletonBlock width="100%" height="14px" style={{ backgroundColor: bg, marginBottom: spacing.sm }} />
            <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md }}>
              <SkeletonBlock width="80px" height="28px" style={{ backgroundColor: bg, borderRadius: borderRadius.md }} />
              <SkeletonBlock width="80px" height="28px" style={{ backgroundColor: bg, borderRadius: borderRadius.md }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function RecipeSkeleton({ count = 4 }: SkeletonProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const bg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <>
      <style>{pulse}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ backgroundColor: colors.card, borderRadius: borderRadius.lg, border: `1px solid ${colors.border}`, padding: spacing.lg, display: 'flex', gap: spacing.lg, alignItems: 'center' }}>
            <SkeletonBlock width="80px" height="80px" style={{ backgroundColor: bg, borderRadius: borderRadius.md, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <SkeletonBlock width="55%" height="20px" style={{ backgroundColor: bg, marginBottom: spacing.sm }} />
              <SkeletonBlock width="80%" height="14px" style={{ backgroundColor: bg, marginBottom: spacing.sm }} />
              <SkeletonBlock width="40%" height="14px" style={{ backgroundColor: bg }} />
            </div>
            <SkeletonBlock width="80px" height="32px" style={{ backgroundColor: bg, borderRadius: borderRadius.md, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </>
  );
}
