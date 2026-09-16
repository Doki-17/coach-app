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

/**
 * Which program week (1-indexed) "today" falls into, counting 7-day blocks
 * from the program's start date - e.g. days 0-6 are week 1, 7-13 are week 2,
 * etc. Returns null when there's no start date to count from, since without
 * one there's no way to know which weeks are "done" yet.
 */
export function currentProgramWeekNumber(startDate: string): number | null {
  if (!startDate) return null;
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0) return 1; // program hasn't started yet - nothing is "done"
  return Math.floor(diffDays / 7) + 1;
}
