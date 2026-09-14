export const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export const UNTITLED_PROGRAM_LABEL = 'Untitled Program';

/** Falls back to a readable label when a program was saved without a title. */
export function displayProgramTitle(title: string): string {
  return title.trim() || UNTITLED_PROGRAM_LABEL;
}

/** Formats a date input's "yyyy-mm-dd" value for display (e.g. "Sep 1, 2026"). Parsed as local time, not UTC, so it never shifts a day off. Returns '' for an empty/invalid value. */
export function formatProgramDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
