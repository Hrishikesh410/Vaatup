/**
 * Helpers for the SQLite <-> domain boundary.
 *
 * SQLite has no boolean and stores absent text as null, while the domain types
 * use `boolean` and optional properties. Converting in one place keeps every
 * repository mapper short and consistent.
 */

export function toBool(value: number | null): boolean {
  return value === 1;
}

export function fromBool(value: boolean): number {
  return value ? 1 : 0;
}

/** Drops nulls and empty strings so optional fields stay genuinely absent. */
export function optionalText(value: string | null): string | undefined {
  return value === null || value === '' ? undefined : value;
}

/** Optional text going the other way, ready to bind. */
export function toNullable(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Builds `?, ?, ?` for an IN clause of the given length. */
export function bindPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}
