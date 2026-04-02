// Color system with dark mode - Minimal Design Style

export const lightColors = {
  primary: '#d97706',
  primaryDark: '#b45309',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#d97706',
  info: '#3b82f6',
  textPrimary: '#292524',
  textSecondary: '#78716c',
  textTertiary: '#a8a29e',
  background: '#fef6ec',
  card: '#fffcf7',
  cardHover: '#fef6ec',
  accentBg: '#fef3c7',
  border: '#f5e6d3',
  borderDark: '#e8d5bb',
  expiredBg: '#fef2f2',
  expiredText: '#dc2626',
  warningBg: '#fffbeb',
  warningText: '#d97706',
  goodText: '#10b981',
};

export const darkColors = {
  primary: '#f59e0b',
  primaryDark: '#d97706',
  success: '#34d399',
  danger: '#f87171',
  warning: '#f59e0b',
  info: '#60a5fa',
  textPrimary: '#fafaf9',
  textSecondary: '#d6d3d1',
  textTertiary: '#a8a29e',
  background: '#0c0a09',
  card: '#1c1917',
  cardHover: '#292524',
  accentBg: '#451a03',
  border: '#292524',
  borderDark: '#44403c',
  expiredBg: '#450a0a',
  expiredText: '#f87171',
  warningBg: '#451a03',
  warningText: '#f59e0b',
  goodText: '#34d399',
};

export function getColors(isDark) {
  return isDark ? darkColors : lightColors;
}

export const getGradient = (isDark) => ({
  primary: `linear-gradient(135deg, ${isDark ? '#fbbf24' : '#f59e0b'} 0%, ${isDark ? '#f59e0b' : '#d97706'} 100%)`,
  success: `linear-gradient(135deg, ${isDark ? '#34d399' : '#10b981'} 0%, #059669 100%)`,
});

export const getShadows = (isDark) => ({
  small: isDark ? '0 1px 2px rgba(0, 0, 0, 0.5)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
  medium: isDark ? '0 2px 8px rgba(0, 0, 0, 0.6)' : '0 2px 8px rgba(0, 0, 0, 0.08)',
  large: isDark ? '0 4px 16px rgba(0, 0, 0, 0.7)' : '0 4px 12px rgba(217, 119, 6, 0.3)',
});

export const spacing = {
  xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px', xxxl: '48px',
};

export const borderRadius = {
  sm: '6px', md: '8px', lg: '10px', xl: '12px', full: '9999px',
};

export const shadows = {
  small: '0 1px 3px rgba(0, 0, 0, 0.05)',
  medium: '0 2px 8px rgba(0, 0, 0, 0.08)',
  large: '0 4px 12px rgba(217, 119, 6, 0.3)',
};

export const colors = lightColors;
export default colors;
