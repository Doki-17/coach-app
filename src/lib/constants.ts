export const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export const UNTITLED_PROGRAM_LABEL = 'Untitled Program';

/** Falls back to a readable label when a program was saved without a title. */
export function displayProgramTitle(title: string): string {
  return title.trim() || UNTITLED_PROGRAM_LABEL;
}
