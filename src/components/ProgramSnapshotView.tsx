import React from 'react';
import { DAYS, displayProgramTitle } from '../lib/constants';
import { getCategoryType, progressionColumnCount } from '../lib/categoryTypes';
import type { ProgramData } from '../lib/storage';

/** Read-only render of a program - used for the client's current program view and for viewing a past history entry. */
export default function ProgramSnapshotView({ program }: { program: ProgramData }) {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold mb-2 uppercase tracking-wider text-center">{displayProgramTitle(program.title)}</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse table-fixed">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 w-20">Week</th>
              {DAYS.map((day) => (
                <th key={day} className="border p-2 text-center font-semibold text-gray-700 w-28">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {program.weeks.map((week) => (
              <React.Fragment key={week.id}>
                <tr>
                  <td className="border p-2 font-bold bg-gray-50 text-center" rowSpan={2}>Week {week.id}</td>
                  {week.am.map((val, i) => (
                    <td key={`am-${i}`} className="border p-2 align-top text-xs whitespace-pre-wrap">
                      <span className="block text-[10px] text-gray-400 font-medium mb-1">AM</span>{val}
                    </td>
                  ))}
                </tr>
                <tr>
                  {week.pm.map((val, i) => (
                    <td key={`pm-${i}`} className="border p-2 align-top text-xs whitespace-pre-wrap">
                      <span className="block text-[10px] text-gray-400 font-medium mb-1">PM</span>{val}
                    </td>
                  ))}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {program.categories.map((category) => {
        const type = getCategoryType(category.categoryType);
        const progCount = progressionColumnCount(category.categoryType, program.weeks.length);
        return (
          <div key={category.id}>
            <div className="mb-3 bg-gray-100 p-2 border-l-4 border-blue-600 flex items-baseline justify-between gap-3">
              <span className="text-base font-bold uppercase">{category.name}</span>
              {category.subtitle && <span className="text-sm text-gray-500">{category.subtitle}</span>}
            </div>
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border p-2 w-1/4">EXERCISE</th>
                  {type.fixedColumnsBefore.map((col) => (
                    <th key={col.key} className="border p-2 w-20 text-center">{col.label}</th>
                  ))}
                  {Array.from({ length: progCount }, (_, i) => (
                    <th key={`w-${i}`} className="border p-2 text-center">WEEK {i + 1}</th>
                  ))}
                  {type.fixedColumnsAfter.map((col) => (
                    <th key={col.key} className="border p-2 w-20 text-center">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {category.exercises.map((ex) => (
                  <tr key={ex.id}>
                    <td className="border p-2">{ex.name}</td>
                    {type.fixedColumnsBefore.map((col) => (
                      <td key={col.key} className="border p-2 text-center">{ex.fixed[col.key] ?? ''}</td>
                    ))}
                    {Array.from({ length: progCount }, (_, i) => (
                      <td key={`w-${i}`} className="border p-2 text-center">{ex.progression[i] ?? ''}</td>
                    ))}
                    {type.fixedColumnsAfter.map((col) => (
                      <td key={col.key} className="border p-2 text-center">{ex.fixed[col.key] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
