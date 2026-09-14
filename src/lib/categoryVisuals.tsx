import { Footprints, Dumbbell, Zap, ListChecks, type LucideIcon } from 'lucide-react';

export interface CategoryVisual {
  Icon: LucideIcon;
  iconBg: string;
  iconText: string;
  headerBg: string;
  headerBorder: string;
}

// A small color + icon identity per category type, so categories read apart
// from each other at a glance in the table view instead of every category -
// no matter what kind of training it is - looking like the same flat gray
// bar with a blue stripe.
const VISUALS: Record<string, CategoryVisual> = {
  running: { Icon: Footprints, iconBg: 'bg-amber-100', iconText: 'text-amber-600', headerBg: 'bg-amber-50', headerBorder: 'border-amber-400' },
  workout: { Icon: Dumbbell, iconBg: 'bg-blue-100', iconText: 'text-blue-600', headerBg: 'bg-blue-50', headerBorder: 'border-blue-400' },
  hyrox: { Icon: Zap, iconBg: 'bg-rose-100', iconText: 'text-rose-600', headerBg: 'bg-rose-50', headerBorder: 'border-rose-400' },
};

// Used for legacy/retired category types, which aren't offered as a choice
// anymore but still need to render correctly for previously-saved programs.
const DEFAULT_VISUAL: CategoryVisual = {
  Icon: ListChecks,
  iconBg: 'bg-gray-200',
  iconText: 'text-gray-600',
  headerBg: 'bg-gray-100',
  headerBorder: 'border-gray-400',
};

export function getCategoryVisual(categoryTypeId: string): CategoryVisual {
  return VISUALS[categoryTypeId] ?? DEFAULT_VISUAL;
}
