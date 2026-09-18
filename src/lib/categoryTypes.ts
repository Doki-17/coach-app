// Defines the column layout for each kind of program category. Picking a
// category type when adding a category decides its table's columns, so a
// coach doesn't have to hand-build a table shape every time - it's driven by
// data here, not one-off rendering code per category.
//
// A category type has fixed columns (don't change week to week) and,
// optionally, progression columns that repeat once per program week. Most
// types have exactly one progression column (Reps, Work Time, etc.), but a
// type can have several (Workout tracks both Set and Rep per week) or none
// at all (Running and HYROX are fully fixed - no week-by-week table).

export interface CategoryColumn {
  key: string;
  label: string;
  /** If set, this column is a dropdown of these choices plus a free-text "Other" option, instead of plain text. */
  options?: string[];
}

export interface CategoryTypeDef {
  id: string;
  label: string;
  /** When set, this column replaces the generic "EXERCISE" name column - e.g. Running's "TYPE OF RUN" or HYROX's "STATION" serve as the row's identifier instead of a separate free-text exercise name. Still stored in the exercise row's `name` field. */
  exerciseColumn?: CategoryColumn;
  fixedColumnsBefore: CategoryColumn[];
  /** Column(s) repeated once per program week. Empty means this category has no week-by-week progression at all. */
  progressionColumns: CategoryColumn[];
  fixedColumnsAfter: CategoryColumn[];
}

// The selectable list a coach picks from when adding a category. Kept to
// exactly the types the actual coach described (Running, Workout, HYROX) -
// nothing speculative. See RETIRED_CATEGORY_TYPES below for the earlier
// guessed types, kept only so any data already saved under them still renders.
export const CATEGORY_TYPES: CategoryTypeDef[] = [
  {
    id: 'running',
    label: 'Running',
    // "Type of Run" IS the exercise/row identifier here, not a separate fixed column.
    exerciseColumn: { key: 'typeOfRun', label: 'TYPE OF RUN', options: ['Intervals', 'Easy Run', 'LSD', 'Progressive', 'Fartlek'] },
    fixedColumnsBefore: [
      { key: 'distance', label: 'DISTANCE' },
      { key: 'pace', label: 'PACE' },
      { key: 'heartRate', label: 'HEART RATE' },
      { key: 'time', label: 'TIME' },
    ],
    // No week-by-week progression - a run's distance/pace/etc. is fully
    // specified per entry rather than tracked across a 4-week block.
    progressionColumns: [],
    fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
  },
  {
    id: 'workout',
    label: 'Workout',
    fixedColumnsBefore: [
      { key: 'rest', label: 'REST' },
      { key: 'tempo', label: 'TEMPO' },
    ],
    // Both Set and Rep progress together, one pair per week.
    progressionColumns: [
      { key: 'set', label: 'SET' },
      { key: 'rep', label: 'REP' },
    ],
    fixedColumnsAfter: [],
  },
  {
    id: 'hyrox',
    label: 'HYROX',
    // "Station" IS the exercise/row identifier here, same treatment as Running's "Type of Run".
    exerciseColumn: {
      key: 'station',
      label: 'STATION',
      options: ['SkiErg', 'Sled Push', 'Sled Pull', 'Burpee Broad Jumps', 'Rowing', "Farmer's Carry", 'Sandbag Lunges', 'Wall Balls'],
    },
    fixedColumnsBefore: [
      { key: 'distance', label: 'DISTANCE' },
      { key: 'weight', label: 'WEIGHT' },
    ],
    progressionColumns: [],
    fixedColumnsAfter: [],
  },
];

/**
 * Category types guessed at before the coach's answers came in. No longer
 * offered when adding a new category, but kept here (not in CATEGORY_TYPES)
 * so any category already saved under one of these still renders correctly
 * instead of falling back to something wrong.
 */
const RETIRED_CATEGORY_TYPES: CategoryTypeDef[] = [
  {
    id: 'strength',
    label: 'Bodybuilding / Strength / Powerlifting / Calisthenics',
    fixedColumnsBefore: [{ key: 'sets', label: 'SETS' }],
    progressionColumns: [{ key: 'value', label: '' }],
    fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
  },
  {
    id: 'hiit',
    label: 'HIIT / Tabata',
    fixedColumnsBefore: [],
    progressionColumns: [{ key: 'value', label: '' }],
    fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
  },
  {
    id: 'circuit',
    label: 'Circuit Training',
    fixedColumnsBefore: [{ key: 'stations', label: 'STATIONS' }],
    progressionColumns: [{ key: 'value', label: '' }],
    fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
  },
  {
    id: 'cardio',
    label: 'Cardio',
    fixedColumnsBefore: [],
    progressionColumns: [{ key: 'value', label: '' }],
    fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
  },
  {
    id: 'mobility',
    label: 'Yoga / Mobility',
    fixedColumnsBefore: [],
    progressionColumns: [{ key: 'value', label: '' }],
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
  progressionColumns: [{ key: 'value', label: '' }],
  fixedColumnsAfter: [{ key: 'rest', label: 'REST' }],
};

export function getCategoryType(id: string): CategoryTypeDef {
  if (id === LEGACY_CATEGORY_TYPE_ID) return LEGACY_CATEGORY_TYPE;
  return (
    CATEGORY_TYPES.find((t) => t.id === id) ??
    RETIRED_CATEGORY_TYPES.find((t) => t.id === id) ??
    CATEGORY_TYPES[0]
  );
}

/** How many WEEK N groups a category's exercise table should show (0 if the type has no progression columns at all). */
export function progressionWeekCount(type: CategoryTypeDef, weekCount: number): number {
  if (type.progressionColumns.length === 0) return 0;
  return type.id === LEGACY_CATEGORY_TYPE_ID ? 4 : Math.max(weekCount, 1);
}
