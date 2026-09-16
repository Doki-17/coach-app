import { SportShoe, Dumbbell, Zap, ListChecks, type LucideIcon } from 'lucide-react';

export interface CategoryVisual {
  Icon: LucideIcon;
  iconBg: string;
  iconText: string;
  headerBg: string;
  headerBorder: string;
  /**
   * Dark-mode counterparts of the four fields above - used only by the
   * mobile card view (ProgramCardView), which is app UI and should follow
   * the coach/client's chosen theme. The desktop table and every PNG/PDF
   * export (ProgramSnapshotView) deliberately ignore these and always
   * render with the light values above regardless of theme - see the
   * design note in useTheme.ts on why exports must look the same no matter
   * what theme the viewer happens to be using.
   */
  darkIconBg: string;
  darkIconText: string;
  darkHeaderBg: string;
  darkHeaderBorder: string;
}

// A small color + icon identity per category type, so categories read apart
// from each other at a glance in the table view instead of every category -
// no matter what kind of training it is - looking like the same flat gray
// bar with a blue stripe.
const VISUALS: Record<string, CategoryVisual> = {
  running: {
    Icon: SportShoe,
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    headerBg: 'bg-amber-50',
    headerBorder: 'border-amber-400',
    darkIconBg: 'dark:bg-amber-900/40',
    darkIconText: 'dark:text-amber-400',
    darkHeaderBg: 'dark:bg-amber-950/40',
    darkHeaderBorder: 'dark:border-amber-800',
  },
  workout: {
    Icon: Dumbbell,
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    headerBg: 'bg-blue-50',
    headerBorder: 'border-blue-400',
    darkIconBg: 'dark:bg-blue-900/40',
    darkIconText: 'dark:text-blue-400',
    darkHeaderBg: 'dark:bg-blue-950/40',
    darkHeaderBorder: 'dark:border-blue-800',
  },
  hyrox: {
    Icon: Zap,
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-600',
    headerBg: 'bg-rose-50',
    headerBorder: 'border-rose-400',
    darkIconBg: 'dark:bg-rose-900/40',
    darkIconText: 'dark:text-rose-400',
    darkHeaderBg: 'dark:bg-rose-950/40',
    darkHeaderBorder: 'dark:border-rose-800',
  },
};

// Used for legacy/retired category types, which aren't offered as a choice
// anymore but still need to render correctly for previously-saved programs.
const DEFAULT_VISUAL: CategoryVisual = {
  Icon: ListChecks,
  iconBg: 'bg-gray-200',
  iconText: 'text-gray-600',
  headerBg: 'bg-gray-100',
  headerBorder: 'border-gray-400',
  darkIconBg: 'dark:bg-gray-700',
  darkIconText: 'dark:text-gray-300',
  darkHeaderBg: 'dark:bg-gray-800/60',
  darkHeaderBorder: 'dark:border-gray-600',
};

export function getCategoryVisual(categoryTypeId: string): CategoryVisual {
  return VISUALS[categoryTypeId] ?? DEFAULT_VISUAL;
}
