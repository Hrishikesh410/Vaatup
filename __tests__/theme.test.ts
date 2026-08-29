import { palettes, typography, type Palette } from '@/theme/theme';

/** sRGB channel to linear light, per WCAG 2.1. */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA: 4.5 for body text, 3.0 for large text and UI component boundaries. */
const AA_TEXT = 4.5;
const AA_LARGE = 3;

type Pair = [keyof Palette, keyof Palette, number];

const PAIRS: Pair[] = [
  ['text', 'background', AA_TEXT],
  ['text', 'surface', AA_TEXT],
  ['text', 'surfaceStrong', AA_TEXT],
  ['textMuted', 'background', AA_TEXT],
  ['textMuted', 'surface', AA_TEXT],
  ['textMuted', 'surfaceStrong', AA_TEXT],
  ['onPrimary', 'primary', AA_TEXT],
  ['onAccent', 'accent', AA_TEXT],
  ['onWhatsapp', 'whatsapp', AA_TEXT],
  ['accent', 'background', AA_TEXT],
  ['accent', 'surface', AA_TEXT],
  ['danger', 'background', AA_TEXT],
  ['danger', 'surface', AA_TEXT],
  ['focus', 'surfaceStrong', AA_LARGE],
];

describe.each(['light', 'dark'] as const)('%s palette', (mode) => {
  const palette = palettes[mode];

  it.each(PAIRS)('%s on %s meets %s:1', (foreground, background, floor) => {
    const fg = palette[foreground] as string;
    const bg = palette[background] as string;
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(floor);
  });

  it('keeps person initials legible on every avatar colour', () => {
    for (const colour of palette.avatarPalette) {
      expect(contrast(palette.avatarInk, colour)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});

describe('typography scale', () => {
  const variants = Object.entries(typography);

  it.each(variants)('%s has a line height with room to breathe', (_name, style) => {
    // Below ~1.15 descenders collide with the next line; above ~1.6 a single
    // line of UI text drifts away from its container.
    const scale = style.lineHeight / style.fontSize;
    expect(scale).toBeGreaterThanOrEqual(1.15);
    expect(scale).toBeLessThanOrEqual(1.6);
  });

  it('is monotonically ordered from largest to smallest', () => {
    const sizes = variants.map(([, style]) => style.fontSize);
    expect(sizes).toEqual([...sizes].sort((first, second) => second - first));
  });
});
