import type { RecurrenceFrequency } from '@/types/recurring';
import { addDaysIso, addMonthsIso } from '@/utils/date';

/** The next occurrence after `from`, for the given cadence. */
export function nextOccurrence(from: string, frequency: RecurrenceFrequency): string {
  switch (frequency) {
    case 'weekly':
      return addDaysIso(from, 7);
    case 'monthly':
      return addMonthsIso(from, 1);
    case 'yearly':
      return addMonthsIso(from, 12);
  }
}
