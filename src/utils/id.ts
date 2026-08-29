/**
 * Local-only identifiers. There is no backend in V1, so a timestamp plus random
 * suffix is enough to keep ids unique and roughly ordered.
 */
export function createId(prefix = 'id'): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
