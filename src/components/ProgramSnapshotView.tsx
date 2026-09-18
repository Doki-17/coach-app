import React from 'react';
import { DAYS, currentProgramWeekNumber, displayProgramTitle, formatProgramDate } from '../lib/constants';
import { getCategoryType, progressionWeekCount } from '../lib/categoryTypes';
import { getCategoryVisual } from '../lib/categoryVisuals';
import logo from '../assets/logo.png';
import type { ProgramData } from '../lib/storage';

/** Read-only render of a program - used for the client's current program view and for viewing a past history entry. */
export default function ProgramSnapshotView({
  program,
  hideCompletedWeeks = false,
}: {
  program: ProgramData;
  /** When true, weeks that are fully in the past (based on the program's start date) are dropped from the weekly calendar - the exercise tables below it are unaffected. */
  hideCompletedWeeks?: boolean;
}) {
  const currentWeek = hideCompletedWeeks ? currentProgramWeekNumber(program.startDate) : null;
  const visibleWeeks = currentWeek == null ? program.weeks : program.weeks.filter((w) => w.id >= currentWeek);

  return (
    <div className="space-y-8">
      <div className="relative mb-4 min-h-44 flex items-center justify-center">
        {/* Date range - upper left. Absolutely positioned (out of flow) so its
            width never shifts the title away from true center, and vertically
            centered to sit on the same middle line as the title and logo. */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-900 whitespace-nowrap">
          {(program.startDate || program.endDate) && (
            <>{formatProgramDate(program.startDate) || '—'} <span className="text-blue-400">to</span> {formatProgramDate(program.endDate) || '—'}</>
          )}
        </div>

        <h2 className="w-full max-w-2xl text-2xl font-bold uppercase tracking-wider text-center">{displayProgramTitle(program.title)}</h2>

        {/* Coach's logo - upper right */}
        <img src={logo} alt="" className="absolute right-0 top-1/2 -translate-y-1/2 w-40 h-40 object-contain pointer-events-none" />
      </div>

      {visibleWeeks.length > 0 ? (
      <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-center border-collapse table-fixed">
          <thead className="bg-blue-50">
            <tr>
              <th className="border p-2 w-20 text-center text-blue-900 font-bold text-xs uppercase tracking-wide">Week</th>
              {DAYS.map((day) => (
                <th key={day} className="border p-2 text-center font-bold text-blue-900 text-xs uppercase tracking-wide w-28">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleWeeks.map((week, wIndex) => {
              const isDoubleDay = (i: number) => week.am[i].trim() !== '' && week.pm[i].trim() !== '';
              // Subtle alternating fill so a long program is easier to scan week to week.
              const rowBg = wIndex % 2 === 1 ? 'bg-gray-50' : 'bg-off-white';
              return (
                <React.Fragment key={week.id}>
                  <tr>
                    <td className={`border p-2 text-center align-middle ${rowBg}`} rowSpan={week.showPm ? 2 : 1}>
                      <span className="font-bold text-gray-900">Week {week.id}</span>
                    </td>
                    {week.am.map((val, i) => {
                      // Only draw the AM/PM divider for a day that genuinely uses both -
                      // otherwise it reads as a stray line through one block of text.
                      const showDivider = week.showPm && isDoubleDay(i);
                      return (
                        <td
                          key={`am-${i}`}
                          className={`border-l border-r border-t p-2 align-middle text-xs whitespace-pre-wrap ${rowBg} ${!week.showPm || showDivider ? 'border-b' : 'border-b-0'}`}
                        >
                          {showDivider && <span className="block text-[10px] text-gray-400 font-medium mb-1">AM</span>}{val}
                        </td>
                      );
                    })}
                  </tr>
                  {week.showPm && (
                    <tr>
                      {week.pm.map((val, i) => {
                        const showDivider = isDoubleDay(i);
                        return (
                          <td
                            key={`pm-${i}`}
                            className={`border-l border-r border-b p-2 align-middle text-xs whitespace-pre-wrap ${rowBg} ${showDivider ? 'border-t' : 'border-t-0'}`}
                          >
                            {showDivider && <span className="block text-[10px] text-gray-400 font-medium mb-1">PM</span>}{val}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>
      ) : (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
        <p>This program's weeks are all complete.</p>
      </div>
      )}
      {program.categories.map((category) => {
        const type = getCategoryType(category.categoryType);
        const weekCount = progressionWeekCount(type, program.weeks.length);
        const multiField = type.progressionColumns.length > 1;
        const visual = getCategoryVisual(category.categoryType);
        return (
          <div key={category.id}>
            <div className={`mb-3 p-3 rounded-lg border-l-4 flex items-center gap-3 ${visual.headerBg} ${visual.headerBorder}`}>
              <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${visual.iconBg}`}>
                <visual.Icon className={`w-4 h-4 ${visual.iconText}`} />
              </div>
              <div className="flex-1 flex items-baseline justify-between gap-3 min-w-0">
                <span className="text-base font-bold uppercase truncate">{category.name}</span>
                {category.subtitle && <span className="text-sm text-gray-500 shrink-0">{category.subtitle}</span>}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className={visual.headerBg}>
                {multiField ? (
                  <>
                    <tr>
                      <th className="border p-2 w-1/4" rowSpan={2}>{type.exerciseColumn?.label ?? 'EXERCISE'}</th>
                      {type.fixedColumnsBefore.map((col) => (
                        <th key={col.key} className="border p-2 w-20 text-center" rowSpan={2}>{col.label}</th>
                      ))}
                      {Array.from({ length: weekCount }, (_, i) => (
                        <th key={`wk-${i}`} className="border p-2 text-center" colSpan={type.progressionColumns.length}>WEEK {i + 1}</th>
                      ))}
                      {type.fixedColumnsAfter.map((col) => (
                        <th key={col.key} className="border p-2 w-20 text-center" rowSpan={2}>{col.label}</th>
                      ))}
                    </tr>
                    <tr>
                      {Array.from({ length: weekCount }, (_, i) => (
                        type.progressionColumns.map((col) => (
                          <th key={`wk-${i}-${col.key}`} className="border p-1 text-center text-xs font-medium">{col.label}</th>
                        ))
                      ))}
                    </tr>
                  </>
                ) : (
                  <tr>
                    <th className="border p-2 w-1/4">{type.exerciseColumn?.label ?? 'EXERCISE'}</th>
                    {type.fixedColumnsBefore.map((col) => (
                      <th key={col.key} className="border p-2 w-20 text-center">{col.label}</th>
                    ))}
                    {Array.from({ length: weekCount }, (_, i) => (
                      <th key={`w-${i}`} className="border p-2 text-center">WEEK {i + 1}</th>
                    ))}
                    {type.fixedColumnsAfter.map((col) => (
                      <th key={col.key} className="border p-2 w-20 text-center">{col.label}</th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {category.exercises.map((ex) => (
                  <tr key={ex.id}>
                    <td className="border p-2">{ex.name}</td>
                    {type.fixedColumnsBefore.map((col) => (
                      <td key={col.key} className="border p-2 text-center">{ex.fixed[col.key] ?? ''}</td>
                    ))}
                    {Array.from({ length: weekCount }, (_, i) => (
                      type.progressionColumns.map((col) => (
                        <td key={`${i}-${col.key}`} className="border p-2 text-center">{ex.progression[i]?.[col.key] ?? ''}</td>
                      ))
                    ))}
                    {type.fixedColumnsAfter.map((col) => (
                      <td key={col.key} className="border p-2 text-center">{ex.fixed[col.key] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
