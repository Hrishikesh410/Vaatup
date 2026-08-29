import { Platform, StyleSheet, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

export const spacing = {
  /** Hairline gaps inside a control, e.g. between a stepper's buttons. */
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  /** For controls nested inside an already-rounded container. */
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/**
 * Heights for interactive elements. `md` is the floor for anything tappable
 * (both platforms' guidelines say 44); `lg` is for the primary action on a
 * screen, which should be comfortable one-handed.
 */
export const control = {
  sm: 40,
  md: 44,
  lg: 52,
  row: 64,
} as const;

export const avatar = {
  sm: 32,
  md: 38,
} as const;

export const borderWidth = {
  hairline: StyleSheet.hairlineWidth,
  thin: 1,
  thick: 2,
} as const;

/** Interaction and emphasis states, so the same feedback reads the same everywhere. */
export const opacity = {
  pressed: 0.85,
  disabled: 0.4,
  muted: 0.6,
  hint: 0.45,
} as const;

/**
 * Press feedback. Going down is quicker than coming back up, which is what
 * makes a button feel like it resists rather than wobbles.
 */
export const motion = {
  pressIn: 90,
  pressOut: 160,
  pressScale: 0.97,
} as const;

/**
 * Complete text styles rather than bare font sizes: a size without its line
 * height leaves vertical rhythm to chance and makes wrapped text cramped.
 */
export const typography = {
  amount: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  heading: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400', letterSpacing: 0 },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0,
  },
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export interface Palette {
  background: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  danger: string;
  whatsapp: string;
  onWhatsapp: string;
  /** Border colour for the focused field. */
  focus: string;
  /** Backgrounds for person initials; always light, so they take dark ink. */
  avatarPalette: readonly string[];
  avatarInk: string;
  shadow: string;
}

const light: Palette = {
  background: '#FFFFFF',
  surface: '#F4F4F6',
  surfaceStrong: '#EBEBEF',
  border: '#E2E2E7',
  text: '#131316',
  // Dark enough to clear 4.5:1 as a placeholder on `surfaceStrong`, the
  // lowest-contrast place muted text appears.
  textMuted: '#65656E',
  primary: '#131316',
  onPrimary: '#FFFFFF',
  // Darker than the #0F9D58 brand mark so it clears 4.5:1 both as text on the
  // background and as a background under white text.
  accent: '#0B7B45',
  onAccent: '#FFFFFF',
  // Also darkened: validation errors are read against `surface`, not white.
  danger: '#C62F2F',
  whatsapp: '#25D366',
  onWhatsapp: '#04361A',
  focus: '#0B7B45',
  avatarPalette: ['#F2B8B5', '#B8DFC2', '#B9CDF2', '#F2DFB8', '#DCC3F2', '#B8ECF2'],
  avatarInk: '#1A1A1A',
  shadow: '#000000',
};

const dark: Palette = {
  background: '#0C0C0F',
  surface: '#17171C',
  surfaceStrong: '#212128',
  border: '#2A2A32',
  text: '#F5F5F7',
  textMuted: '#9A9AA5',
  primary: '#F5F5F7',
  onPrimary: '#131316',
  accent: '#3DD68C',
  onAccent: '#04361A',
  danger: '#FF6369',
  whatsapp: '#25D366',
  onWhatsapp: '#04361A',
  focus: '#3DD68C',
  // Dimmed so bright pastels don't glare against a near-black background.
  avatarPalette: ['#C79996', '#9BBEA4', '#9AACCB', '#CBBB96', '#B6A2CB', '#96C2C8'],
  avatarInk: '#131316',
  shadow: '#000000',
};

export const palettes = { light, dark } as const;

/**
 * A QR code is defined as dark-on-light and scanners rely on it, so this pair
 * does not follow the theme.
 */
export const qrColors = { surface: '#FFFFFF', ink: '#000000' } as const;

/**
 * Suppresses the browser's own focus ring on web, where it would double up with
 * the focus border the fields draw themselves. `outlineStyle` is a react-native-web
 * style prop with no entry in the native `TextStyle`, hence the cast.
 */
export const webFocusReset = (
  Platform.OS === 'web' ? { outlineStyle: 'none' } : null
) as TextStyle | null;

/** Turns a `#rrggbb` token into the `rgba()` form CSS needs for a tinted shadow. */
function withAlpha(hexColor: string, alpha: number): string {
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * Lifts the sticky footer off the content scrolling under it. Dark mode keeps
 * the hairline border instead, because a black shadow on a near-black
 * background is invisible.
 *
 * The web build wants the CSS `boxShadow` shorthand; the separate `shadow*`
 * props are deprecated there and log a warning on every render.
 */
export function footerElevation(colors: Palette, isDark: boolean): ViewStyle {
  if (isDark) return {};

  if (Platform.OS === 'web') {
    return { boxShadow: `0 -2px 12px ${withAlpha(colors.shadow, 0.06)}` } as ViewStyle;
  }

  return {
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  };
}

export function useTheme(): { colors: Palette; dark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? palettes.dark : palettes.light, dark: isDark };
}
