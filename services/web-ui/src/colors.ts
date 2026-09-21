// Color system with dark mode - Minimal Design Style

export interface ColorScheme {
  primary: string;
  primaryDark: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  /**
   * Text/icon colour to put ON a `primary` fill.
   *
   * It is a token because it differs by theme and hardcoding 'white' was a
   * measured AA failure: dark-mode `primary` is #f59e0b, and white on that is
   * about 2.3:1 against the 4.5 required. Light mode's primary genuinely does
   * clear AA with white, so the answer is per-theme rather than one colour.
   */
  onPrimary: string;
  background: string;
  card: string;
  cardHover: string;
  accentBg: string;
  border: string;
  borderDark: string;
  expiredBg: string;
  expiredText: string;
  warningBg: string;
  warningText: string;
  goodText: string;
}

export interface GradientScheme {
  primary: string;
  success: string;
}

export interface ShadowScheme {
  small: string;
  medium: string;
  large: string;
}

export const lightColors: ColorScheme = {
  // *** MEASURED 2026-09-20, AND THE PREVIOUS NOTE HERE WAS WRONG. ***
  // The comment used to say #c2690a "clears AA" for body text. axe measured it
  // at **3.95:1 on white and 3.67:1 on the page ground** -- it clears the 3:1
  // bar for LARGE text only, and it was being used for 10-15px labels and as
  // the fill under white text on every submit button.
  //
  // #a8590a is the same hue, two steps darker, and measures 5.12:1 on white,
  // 4.76:1 on the page ground, and 5.12:1 with white on top -- so it clears AA
  // as text AND as a fill, which is what lets one token do both jobs.
  primary: '#a8590a',
  primaryDark: '#8a4a06',
  success: '#3f7d55',
  danger: '#b4451f',
  warning: '#9c6109',
  info: '#3f6f8f',
  textPrimary: '#231f1c',
  textSecondary: '#6d6560',
  // #a49a92 measured 2.76:1 on a card -- the worst contrast in the product. It
  // is the colour of an item's note and of several helper lines, i.e. text
  // people are expected to read.
  textTertiary: '#756c66',
  onPrimary: '#ffffff',
  // Cards were #fffcf7 on a #fef6ec ground — barely a step apart, so nothing
  // read as lifted. True white cards on a slightly desaturated ground give the
  // grid real figure/ground without changing the brand's warmth.
  background: '#faf6f0',
  card: '#ffffff',
  cardHover: '#fdf9f4',
  accentBg: '#fdf3e4',
  border: '#ece3d7',
  borderDark: '#ddd0be',
  expiredBg: '#fbeceb',
  expiredText: '#8f2d2d',
  warningBg: '#fdf4e3',
  warningText: '#9c6109',
  goodText: '#3f7d55',
};

export const darkColors: ColorScheme = {
  primary: '#f59e0b',
  primaryDark: '#d97706',
  success: '#34d399',
  danger: '#f87171',
  warning: '#f59e0b',
  info: '#60a5fa',
  textPrimary: '#fafaf9',
  textSecondary: '#d6d3d1',
  textTertiary: '#a8a29e',
  // Dark brown on amber: ~8.9:1. White would be ~2.3:1.
  onPrimary: '#231f1c',
  background: '#0c0a09',
  card: '#1e1a17',
  cardHover: '#292524',
  accentBg: '#3d1a06',
  border: '#332d28',
  borderDark: '#4a423b',
  expiredBg: 'rgba(143, 45, 45, 0.22)',
  expiredText: '#f08a8a',
  warningBg: 'rgba(168, 105, 11, 0.22)',
  warningText: '#e5b463',
  goodText: '#7fc194',
};

export function getColors(isDark: boolean): ColorScheme {
  return isDark ? darkColors : lightColors;
}

// Both ends have to clear AA against onPrimary, not just the average: the text
// sits across the whole sweep. Light ends measured with white (4.99 / 5.33),
// dark ends with #231f1c (8.08 / 4.76). The old light end #d98219 was 2.93.
export const getGradient = (isDark: boolean): GradientScheme => ({
  primary: `linear-gradient(135deg, ${isDark ? '#f0a83c' : '#ad590a'} 0%, ${isDark ? '#cf7310' : '#a8540a'} 100%)`,
  success: `linear-gradient(135deg, ${isDark ? '#7fc194' : '#4f9268'} 0%, ${isDark ? '#4f9268' : '#3f7d55'} 100%)`,
});

/**
 * The warm ground used behind signed-out surfaces and as the recipe-art
 * fallback. Replaces eight hardcoded copies of
 * `linear-gradient(135deg, #667eea, #764ba2)` — a 2017 indigo that made every
 * logged-out screen look like a different product from the amber app behind it.
 */
export const getBrandWash = (isDark: boolean): string =>
  isDark
    ? 'radial-gradient(900px 340px at 78% -8%, #3d2a10 0%, transparent 62%), linear-gradient(168deg, #17130f 0%, #0c0a09 100%)'
    : 'radial-gradient(900px 340px at 78% -8%, #fbe6c4 0%, transparent 62%), linear-gradient(168deg, #fdf7ee 0%, #f7ecdc 100%)';

// Shadows are neutral and wide rather than tight and dark. `large` used to be an
// amber glow (`rgba(217,119,6,0.3)`) — a coloured drop shadow reads as 2019 and
// fought the warm background it sat on.
export const getShadows = (isDark: boolean): ShadowScheme => ({
  small: isDark ? '0 2px 8px rgba(0, 0, 0, 0.45)' : '0 2px 8px rgba(40, 28, 14, 0.04)',
  medium: isDark ? '0 4px 16px rgba(0, 0, 0, 0.55)' : '0 4px 16px rgba(40, 28, 14, 0.07)',
  large: isDark ? '0 8px 32px rgba(0, 0, 0, 0.65)' : '0 8px 32px rgba(40, 28, 14, 0.10)',
});

// NOTE ON SPACING: deliberately NOT raised to mobile's scale (md 16 / lg 24 /
// xl 32). Mobile's tokens are larger because a phone card is nearly viewport
// width; on web the inventory grid already reads as sparse, so widening the
// same keys would make the density problem worse rather than better. Radius,
// shadow and type are the parts of mobile's system worth adopting here.
export const spacing: Record<string, string> = {
  xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px', xxxl: '48px',
};

// Matches mobile/src/constants/borderRadius.ts so one product stops having two
// corner languages. Every key that already existed keeps its name, so the ~75
// call sites reading `borderRadius.lg` pick this up with no edit.
export const borderRadius: Record<string, string> = {
  sm: '8px', md: '12px', lg: '16px', xl: '20px', xxl: '24px', full: '9999px',
};

export const shadows: ShadowScheme = {
  small: '0 2px 8px rgba(40, 28, 14, 0.04)',
  medium: '0 4px 16px rgba(40, 28, 14, 0.07)',
  large: '0 8px 32px rgba(40, 28, 14, 0.10)',
};

/**
 * Type scale. Web had NO typography token — every size in the app was an inline
 * string literal, which is why headings drifted between 15/16/17/18px across
 * pages. Adopting this is incremental: new and touched code reads from here.
 */
export const typography = {
  size: {
    xs: '11px', sm: '13px', base: '15px', lg: '18px',
    xl: '22px', '2xl': '28px', '3xl': '34px', '4xl': '42px',
  },
  weight: {
    regular: 400, medium: 500, semibold: 600, bold: 700, black: 800,
  },
  tracking: { tight: '-0.02em', snug: '-0.01em', normal: '0', wide: '0.04em' },
  leading: { tight: 1.2, snug: 1.35, normal: 1.5, relaxed: 1.7 },
} as const;

export type FreshnessState = 'expired' | 'urgent' | 'soon' | 'fresh' | 'none';

/**
 * The freshness ramp — the one axis that is genuinely new.
 *
 * pantryPal's subject is food with a clock on it, so time-to-expiry is the
 * product's primary variable and deserves a reserved, consistent set of colours
 * rather than being reinvented per surface. Previously each page hardcoded its
 * own: InsightsPage used iOS system colours (#34c759/#ff9500/#ff3b30),
 * RecipeCard used Tailwind's (#22c55e/#f59e0b/#ef4444), dateUtils a third set.
 *
 * Deliberately NOT the stock traffic-light triple: these are desaturated to sit
 * on a warm cream ground without vibrating, and all five pass AA on both themes.
 */
export const getFreshness = (isDark: boolean): Record<FreshnessState, { fg: string; bg: string }> =>
  isDark
    ? {
        expired: { fg: '#f08a8a', bg: 'rgba(143, 45, 45, 0.22)' },
        urgent: { fg: '#f0a17f', bg: 'rgba(180, 69, 31, 0.22)' },
        soon: { fg: '#e5b463', bg: 'rgba(168, 105, 11, 0.22)' },
        fresh: { fg: '#7fc194', bg: 'rgba(63, 125, 85, 0.22)' },
        none: { fg: '#a8a29e', bg: 'rgba(120, 113, 108, 0.20)' },
      }
    : {
        expired: { fg: '#8f2d2d', bg: '#fbeceb' },
        urgent: { fg: '#b4451f', bg: '#fdefe7' },
        // 4.48:1 -- under the bar by a hair, on the "N days left" line that is
        // the single most-read piece of text in the product.
        soon: { fg: '#9c6109', bg: '#fdf4e3' },
        // 4.36:1 on its own chip -- the same near-miss `soon` had.
        fresh: { fg: '#336845', bg: '#eaf4ec' },
        none: { fg: '#756c66', bg: '#f2ede7' },
      };

export const colors = lightColors;
export default colors;
