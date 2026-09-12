// Defines the column layout for each kind of program category. Picking a
// category type when adding a category decides its table's columns, so a
// coach doesn't have to hand-build a table shape every time - it's driven by
// data here, not one-off rendering code per category.
//
// Every category gets one "WEEK N" progression column per week in the
// program (Reps for a strength category, Work Time for HIIT, etc. - whatever
// that category's core metric is), the same pattern the original hand-built
// programs already used, plus a couple of fixed columns before/after that
// don't change week to week.

export interface CategoryColumn {
  key: string;
  label: string;
}

export interface CategoryTypeDef {
  id: string;
  label: string;
  fixedColumnsBefore: CategoryColumn[];
  fixedColumnsAfter: CategoryColumn[];
}

export const CATEGORY_TYPES: CategoryTypeDef[] = [
  {
    id: 'strength',
    label: 'Bodybuilding / Strength / Powerlifting / Calisthenics',
    fixedColumnsBefore: [{ key: 'sets', label: 'SETS' }],
    fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
  },
  {
    id: 'hiit',
    label: 'HIIT / Tabata',
    fixedColumnsBefore: [],
    fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
  },
  {
    id: 'circuit',
    label: 'Circuit Training',
    fixedColumnsBefore: [{ key: 'stations', label: 'STATIONS' }],
    fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
  },
  {
    id: 'cardio',
    label: 'Cardio',
    fixedColumnsBefore: [],
    fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
  },
  {
    id: 'mobility',
    label: 'Yoga / Mobility',
    fixedColumnsBefore: [],
    fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
  },
];

export const DEFAULT_CATEGORY_TYPE_ID = CATEGORY_TYPES[0].id;

/**
 * Categories saved before category types existed fall back to this. It
 * reproduces the app's original fixed table (Tempo / Week 1-4 / Rest,
 * regardless of how many weeks the program actually has) so nothing about
 * previously-saved programs or audit log history changes visually.
 */
export const LEGACY_CATEGORY_TYPE_ID = 'legacy';

const LEGACY_CATEGORY_TYPE: CategoryTypeDef = {
  id: LEGACY_CATEGORY_TYPE_ID,
  label: 'Legacy',
  fixedColumnsBefore: [{ key: 'tempo', label: 'TEMPO' }],
  fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
};

export function getCategoryType(id: string): CategoryTypeDef {
  if (id === LEGACY_CATEGORY_TYPE_ID) return LEGACY_CATEGORY_TYPE;
  return CATEGORY_TYPES.find((t) => t.id === id) ?? CATEGORY_TYPES[0];
}

/** How many WEEK N columns a category's exercise table should show. */
export function progressionColumnCount(categoryType: string, weekCount: number): number {
  return categoryType === LEGACY_CATEGORY_TYPE_ID ? 4 : Math.max(weekCount, 1);
}
