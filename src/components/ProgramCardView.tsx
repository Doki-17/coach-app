import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DAYS, currentProgramWeekNumber, displayProgramTitle, formatProgramDate } from '../lib/constants';
import { getCategoryType, progressionWeekCount } from '../lib/categoryTypes';
import { getCategoryVisual } from '../lib/categoryVisuals';
import type { ProgramData } from '../lib/storage';

/**
 * Mobile-friendly read-only render of a program: same data as
 * ProgramSnapshotView's wide table, laid out as two vertical accordions
 * instead - one week per item under "Schedule this month", one category per
 * item under "Exercises". Each accordion only ever has one item open at a
 * time (opening Week 4 closes Week 3; the exercises accordion is entirely
 * separate, so a week and a category can both be open together).
 *
 * Used only for on-screen viewing on small screens (see ClientProgramView);
 * the desktop view and every PNG/PDF export still go through
 * ProgramSnapshotView's table, so downloads always look the same as before,
 * regardless of what the viewer's screen looks like.
 */
export default function ProgramCardView({
  program,
  hideCompletedWeeks = false,
}: {
  program: ProgramData;
  hideCompletedWeeks?: boolean;
}) {
  // Same rule as ProgramSnapshotView - kept in sync there, not shared as its
  // own helper since it's two lines and pulling it out isn't worth another
  // module for this small an amount of logic.
  const currentWeek = hideCompletedWeeks ? currentProgramWeekNumber(program.startDate) : null;
  const visibleWeeks = currentWeek == null ? program.weeks : program.weeks.filter((w) => w.id >= currentWeek);

  // Start with the most relevant item already open in each accordion - the
  // first (soonest) visible week, and the first category - rather than
  // everything collapsed with nothing to see.
  const [openWeekId, setOpenWeekId] = useState<number | null>(() => visibleWeeks[0]?.id ?? null);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(() => program.categories[0]?.id ?? null);

  return (
    <div className="space-y-8">
      <div className="text-center">
        {(program.startDate || program.endDate) && (
          <p className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-1">
            {formatProgramDate(program.startDate) || '—'} <span className="text-blue-400">to</span> {formatProgramDate(program.endDate) || '—'}
          </p>
        )}
        <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">{displayProgramTitle(program.title)}</h2>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Schedule this month:</h3>
        {visibleWeeks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            This program's weeks are all complete.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleWeeks.map((week) => {
              // Only list days that actually have something scheduled - a
              // table can afford to show every day as an empty cell, but a
              // card reads much better when it's just the days that matter.
              const days = DAYS.map((day, i) => ({ day, am: week.am[i]?.trim() ?? '', pm: week.pm[i]?.trim() ?? '' })).filter(
                (d) => d.am || d.pm
              );
              const isOpen = openWeekId === week.id;
              return (
                <div key={week.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenWeekId(isOpen ? null : week.id)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-2 bg-blue-50 dark:bg-blue-950/40 px-4 py-3.5 text-left"
                  >
                    <span className="font-bold text-blue-900 dark:text-blue-300 text-sm">Week {week.id}</span>
                    <ChevronDown className={`w-4 h-4 text-blue-900 dark:text-blue-300 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {/* CSS-only collapse: animating a grid track (rather than height/display)
                      transitions smoothly without needing to measure content height in JS. */}
                  <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      {days.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-gray-400 dark:text-gray-500">Rest week - nothing scheduled.</p>
                      ) : (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                          {days.map(({ day, am, pm }) => (
                            <li key={day} className="px-4 py-3.5">
                              <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{day}</p>
                              {am && (
                                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                  {week.showPm && pm && <span className="text-[10px] text-gray-400 font-medium mr-1">AM</span>}
                                  {am}
                                </p>
                              )}
                              {week.showPm && pm && (
                                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mt-0.5">
                                  <span className="text-[10px] text-gray-400 font-medium mr-1">PM</span>
                                  {pm}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider between the calendar and the exercise breakdown. */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Exercises:</h3>
        <div className="space-y-4">
          {program.categories.map((category) => {
            const type = getCategoryType(category.categoryType);
            const weekCount = progressionWeekCount(type, program.weeks.length);
            const visual = getCategoryVisual(category.categoryType);
            const isOpen = openCategoryId === category.id;
            return (
              <div key={category.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenCategoryId(isOpen ? null : category.id)}
                  aria-expanded={isOpen}
                  className={`w-full flex items-center gap-3 p-4 text-left border-l-4 ${visual.headerBg} ${visual.darkHeaderBg} ${visual.headerBorder} ${visual.darkHeaderBorder}`}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${visual.iconBg} ${visual.darkIconBg}`}>
                    <visual.Icon className={`w-4 h-4 ${visual.iconText} ${visual.darkIconText}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold uppercase truncate block text-gray-900 dark:text-gray-100">{category.name}</span>
                    {category.subtitle && <span className="text-xs text-gray-500 dark:text-gray-400">{category.subtitle}</span>}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden">
                    <div className="p-4 space-y-3">
                      {category.exercises.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500">No exercises added yet.</p>
                      ) : (
                        category.exercises.map((ex) => {
                          const before = type.fixedColumnsBefore.filter((col) => ex.fixed[col.key]);
                          const after = type.fixedColumnsAfter.filter((col) => ex.fixed[col.key]);
                          const weekLines = Array.from({ length: weekCount }, (_, i) => {
                            const parts = type.progressionColumns
                              .map((col) => {
                                const v = ex.progression[i]?.[col.key];
                                return v ? (col.label ? `${col.label} ${v}` : v) : null;
                              })
                              .filter((v): v is string => Boolean(v));
                            return parts.length > 0 ? { week: i + 1, text: parts.join(' · ') } : null;
                          }).filter((line): line is { week: number; text: string } => line !== null);

                          return (
                            <div key={ex.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                              <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{ex.name || '—'}</p>

                              {before.length > 0 && (
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-2">
                                  {before.map((col) => (
                                    <span key={col.key} className="text-gray-600 dark:text-gray-300">
                                      <span className="text-gray-400 dark:text-gray-500">{col.label}: </span>
                                      {ex.fixed[col.key]}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {weekLines.length > 0 && (
                                <div className="space-y-1 mb-2">
                                  {weekLines.map(({ week, text }) => (
                                    <p key={week} className="text-sm text-gray-600 dark:text-gray-300">
                                      <span className="text-gray-400 dark:text-gray-500">Week {week}: </span>
                                      {text}
                                    </p>
                                  ))}
                                </div>
                              )}

                              {after.length > 0 && (
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                  {after.map((col) => (
                                    <span key={col.key} className="text-gray-600 dark:text-gray-300">
                                      <span className="text-gray-400 dark:text-gray-500">{col.label}: </span>
                                      {ex.fixed[col.key]}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
