import type { SplitType } from '@/types/split';

/**
 * How each split type is described to the user.
 *
 * Kept out of the screens so the chip in the split flow and the sentence on the
 * expense screen can never drift apart.
 */
export const SPLIT_TYPE_LABELS: Record<SplitType, string> = {
  equal: 'Equally',
  exact: 'By amount',
  percentage: 'By percentage',
  shares: 'By shares',
};

/** The shorter wording that fits on a chip. */
export const SPLIT_TYPE_CHIP_LABELS: Record<SplitType, string> = {
  equal: 'Equal',
  exact: 'Exact',
  percentage: 'Percent',
  shares: 'Shares',
};
