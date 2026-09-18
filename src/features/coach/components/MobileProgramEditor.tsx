import { useState } from 'react';
import { ArrowLeft, ChevronRight, Copy, Minus, Plus, Trash2 } from 'lucide-react';
import { DAYS } from '../../../lib/constants';
import { getCategoryType, progressionWeekCount, type CategoryColumn } from '../../../lib/categoryTypes';
import { getCategoryVisual } from '../../../lib/categoryVisuals';
import type { ProgramCategory, ProgramWeek, ExerciseRow } from '../../../lib/storage';
import AddCategoryMenu from '../../../components/AddCategoryMenu';
import type { ProgramEditorMode } from '../pages/ProgramEditor';

/**
 * Phone-width editing experience for the program editor. The desktop editor
 * is one big scrolling table with an input in every cell - fine with a mouse
 * and a wide screen, unusable on a phone (see ProgramEditor.tsx, which keeps
 * that table for sm: and up).
 *
 * This instead mirrors the read-only card view a client sees on their phone
 * (ProgramCardView - one card per week, one card per exercise category), but
 * editable: tapping a week or an exercise doesn't expand it in place, it
 * pushes a full-screen "focused editor" for just that one item (see the
 * three *Panel components below), the same way a native app drills into a
 * single record instead of cramming an edit form into a list row. Back out
 * of that panel and you're right back at the list.
 *
 * All the actual state lives in ProgramEditor - this component only ever
 * calls the mutator callbacks it's given, exactly like the desktop table
 * does, so a save/undo/dirty-check up there behaves identically no matter
 * which UI made the edit.
 */
export interface MobileProgramEditorProps {
  mode: ProgramEditorMode;
  title: string;
  onTitleChange: (value: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  dateError: boolean;
  weeks: ProgramWeek[];
  onToggleWeekPm: (weekIndex: number) => void;
  onUpdateDay: (weekIndex: number, period: 'am' | 'pm', dayIndex: number, value: string) => void;
  onAddWeek: () => void;
  onDeleteWeek: (weekIndex: number) => void;
  categories: ProgramCategory[];
  onUpdateCategoryName: (catIndex: number, value: string) => void;
  onUpdateCategorySubtitle: (catIndex: number, value: string) => void;
  onAddCategory: (categoryTypeId: string) => void;
  onDeleteCategory: (catIndex: number) => void;
  onAddExercise: (catIndex: number) => void;
  onUpdateExerciseName: (catIndex: number, exIndex: number, value: string) => void;
  onUpdateExerciseFixed: (catIndex: number, exIndex: number, key: string, value: string) => void;
  onUpdateExerciseProgression: (catIndex: number, exIndex: number, weekIndex: number, fieldKey: string, value: string) => void;
  onDeleteExercise: (catIndex: number, exIndex: number) => void;
  onDuplicateExercise: (catIndex: number, exIndex: number) => void;
}

/**
 * Like the desktop table's CategoryCellInput (a plain field, or - when the
 * column defines `options` - a dropdown of those choices plus a free-text
 * "Other") but styled as a standalone labeled form field instead of a
 * borderless table cell. Same "Other" behavior, different chrome.
 */
function MobileCellInput({ column, value, onChange }: { column: CategoryColumn; value: string; onChange: (v: string) => void }) {
  const [showOther, setShowOther] = useState(() => value !== '' && !!column.options && !column.options.includes(value));
  const baseClass =
    'w-full rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 bg-transparent text-gray-900 dark:text-gray-100';

  if (!column.options) {
    return <input value={value} onChange={(e) => onChange(e.target.value)} className={baseClass} />;
  }

  if (showOther) {
    return (
      <div className="flex items-center gap-1.5">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={column.label} className={baseClass} />
        <button
          type="button"
          onClick={() => { setShowOther(false); onChange(''); }}
          className="shrink-0 text-gray-400 hover:text-gray-600 text-sm px-2"
          title="Back to list"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === '__other__') {
          setShowOther(true);
          onChange('');
        } else {
          onChange(e.target.value);
        }
      }}
      className={baseClass}
    >
      <option value="">—</option>
      {column.options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
      <option value="__other__">Other…</option>
    </select>
  );
}

/** Full-screen focused editor for one week - every day's AM (and PM, once turned on) box, stacked instead of a 7-wide table row. */
function WeekEditorPanel({
  week,
  onBack,
  onTogglePm,
  onUpdateDay,
  onDelete,
}: {
  week: ProgramWeek;
  onBack: () => void;
  onTogglePm: () => void;
  onUpdateDay: (period: 'am' | 'pm', dayIndex: number, value: string) => void;
  onDelete?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-off-white dark:bg-gray-900 flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-gray-900 dark:text-gray-100 font-bold">
          <ArrowLeft className="w-4 h-4" /> Week {week.id}
        </button>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={onTogglePm} className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
            {week.showPm ? (<><Minus className="w-3.5 h-3.5" /> PM row</>) : (<><Plus className="w-3.5 h-3.5" /> PM row</>)}
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} title="Delete week" className="text-gray-400 hover:text-red-500 p-0.5">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {DAYS.map((day, dIndex) => (
          <div key={day} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">{day}</p>
            <div className={week.showPm ? 'divide-y divide-gray-100 dark:divide-gray-700' : ''}>
              <div className="p-3">
                {week.showPm && <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mb-1">AM</p>}
                <textarea
                  value={week.am[dIndex]}
                  onChange={(e) => onUpdateDay('am', dIndex, e.target.value)}
                  rows={2}
                  placeholder="Nothing scheduled"
                  className="w-full resize-none outline-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                />
              </div>
              {week.showPm && (
                <div className="p-3">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mb-1">PM</p>
                  <textarea
                    value={week.pm[dIndex]}
                    onChange={(e) => onUpdateDay('pm', dIndex, e.target.value)}
                    rows={2}
                    placeholder="Nothing scheduled"
                    className="w-full resize-none outline-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full-screen focused editor for one exercise - name, fixed columns, and one labeled block per progression week instead of a wide multi-column row. */
function ExerciseEditorPanel({
  categoryName,
  exercise,
  type,
  weekCount,
  onBack,
  onUpdateName,
  onUpdateFixed,
  onUpdateProgression,
  onDuplicate,
  onDelete,
}: {
  categoryName: string;
  exercise: ExerciseRow;
  type: ReturnType<typeof getCategoryType>;
  weekCount: number;
  onBack: () => void;
  onUpdateName: (value: string) => void;
  onUpdateFixed: (key: string, value: string) => void;
  onUpdateProgression: (weekIndex: number, fieldKey: string, value: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-off-white dark:bg-gray-900 flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 min-w-0 text-gray-900 dark:text-gray-100 font-bold">
          <ArrowLeft className="w-4 h-4 shrink-0" /> <span className="truncate">{categoryName}</span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onDuplicate} title="Duplicate" className="text-gray-400 hover:text-blue-600 p-1.5">
            <Copy className="w-4 h-4" />
          </button>
          <button type="button" onClick={onDelete} title="Delete" className="text-gray-400 hover:text-red-500 p-1.5">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
            {type.exerciseColumn?.label ?? 'Exercise'}
          </label>
          {type.exerciseColumn ? (
            <MobileCellInput column={type.exerciseColumn} value={exercise.name} onChange={onUpdateName} />
          ) : (
            <input
              value={exercise.name}
              onChange={(e) => onUpdateName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 bg-transparent text-gray-900 dark:text-gray-100"
            />
          )}
        </div>

        {type.fixedColumnsBefore.map((col) => (
          <div key={col.key}>
            <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{col.label}</label>
            <MobileCellInput column={col} value={exercise.fixed[col.key] ?? ''} onChange={(v) => onUpdateFixed(col.key, v)} />
          </div>
        ))}

        {weekCount > 0 && (
          <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
            {Array.from({ length: weekCount }, (_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 uppercase tracking-wide mb-2">Week {i + 1}</p>
                <div className="grid grid-cols-2 gap-3">
                  {type.progressionColumns.map((col) => (
                    <div key={col.key}>
                      {col.label && <label className="block text-[11px] text-gray-400 dark:text-gray-500 mb-1">{col.label}</label>}
                      <input
                        value={exercise.progression[i]?.[col.key] ?? ''}
                        onChange={(e) => onUpdateProgression(i, col.key, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 p-2 text-sm text-center outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 bg-transparent text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {type.fixedColumnsAfter.map((col) => (
          <div key={col.key}>
            <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{col.label}</label>
            <MobileCellInput column={col} value={exercise.fixed[col.key] ?? ''} onChange={(v) => onUpdateFixed(col.key, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full-screen focused editor for one category - name/subtitle up top, then its exercises as a tappable list (each opening its own ExerciseEditorPanel). */
function CategoryEditorPanel({
  category,
  onBack,
  onUpdateName,
  onUpdateSubtitle,
  onAddExercise,
  onOpenExercise,
  onDuplicateExercise,
  onDeleteExercise,
  onDelete,
}: {
  category: ProgramCategory;
  onBack: () => void;
  onUpdateName: (value: string) => void;
  onUpdateSubtitle: (value: string) => void;
  onAddExercise: () => void;
  onOpenExercise: (exIndex: number) => void;
  onDuplicateExercise: (exIndex: number) => void;
  onDeleteExercise: (exIndex: number) => void;
  onDelete?: () => void;
}) {
  const visual = getCategoryVisual(category.categoryType);

  return (
    <div className="fixed inset-0 z-40 bg-off-white dark:bg-gray-900 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button type="button" onClick={onBack} className="shrink-0 text-gray-900 dark:text-gray-100">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${visual.iconBg} ${visual.darkIconBg}`}>
          <visual.Icon className={`w-4 h-4 ${visual.iconText} ${visual.darkIconText}`} />
        </div>
        <input
          value={category.name}
          onChange={(e) => onUpdateName(e.target.value)}
          className="flex-1 min-w-0 text-base font-bold uppercase bg-transparent outline-none text-gray-900 dark:text-gray-100"
        />
        {onDelete && (
          <button type="button" onClick={onDelete} title="Delete category" className="shrink-0 text-gray-400 hover:text-red-500 p-0.5">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <input
          value={category.subtitle}
          onChange={(e) => onUpdateSubtitle(e.target.value)}
          placeholder="Subtitle (optional)"
          className="w-full text-sm text-gray-500 dark:text-gray-400 bg-transparent outline-none border-b border-dashed border-gray-200 dark:border-gray-700 pb-2 placeholder:text-gray-400 dark:placeholder:text-gray-600"
        />

        <div className="space-y-2">
          {category.exercises.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No exercises added yet.</p>
          ) : (
            category.exercises.map((ex, exIndex) => (
              <div key={ex.id} className="flex items-center gap-0.5 rounded-xl border border-gray-200 dark:border-gray-700 pl-1 pr-1">
                <button type="button" onClick={() => onOpenExercise(exIndex)} className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-2.5 text-left">
                  <span className="min-w-0">
                    <span className="block font-semibold text-gray-900 dark:text-gray-100 truncate">{ex.name || 'Untitled exercise'}</span>
                    <span className="block text-xs text-gray-400 dark:text-gray-500">Tap to edit</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                </button>
                <button type="button" onClick={() => onDuplicateExercise(exIndex)} title="Duplicate" className="shrink-0 text-gray-400 hover:text-blue-600 p-2">
                  <Copy className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => onDeleteExercise(exIndex)} title="Delete" className="shrink-0 text-gray-400 hover:text-red-500 p-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <button type="button" onClick={onAddExercise} className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">
          <Plus className="w-4 h-4" /> Add Exercise
        </button>
      </div>
    </div>
  );
}

export default function MobileProgramEditor({
  mode,
  title,
  onTitleChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  dateError,
  weeks,
  onToggleWeekPm,
  onUpdateDay,
  onAddWeek,
  onDeleteWeek,
  categories,
  onUpdateCategoryName,
  onUpdateCategorySubtitle,
  onAddCategory,
  onDeleteCategory,
  onAddExercise,
  onUpdateExerciseName,
  onUpdateExerciseFixed,
  onUpdateExerciseProgression,
  onDeleteExercise,
  onDuplicateExercise,
}: MobileProgramEditorProps) {
  // Which week/category/exercise (if any) currently owns the full screen.
  // These are independent - opening an exercise leaves its parent category
  // "open" underneath it, so backing out of the exercise lands you back on
  // the category's exercise list rather than the top-level week/category list.
  const [openWeekIndex, setOpenWeekIndex] = useState<number | null>(null);
  const [openCategoryIndex, setOpenCategoryIndex] = useState<number | null>(null);
  const [openExercise, setOpenExercise] = useState<{ catIndex: number; exIndex: number } | null>(null);

  if (openExercise) {
    const category = categories[openExercise.catIndex];
    const exercise = category?.exercises[openExercise.exIndex];
    if (category && exercise) {
      const type = getCategoryType(category.categoryType);
      return (
        <ExerciseEditorPanel
          categoryName={category.name}
          exercise={exercise}
          type={type}
          weekCount={progressionWeekCount(type, weeks.length)}
          onBack={() => setOpenExercise(null)}
          onUpdateName={(v) => onUpdateExerciseName(openExercise.catIndex, openExercise.exIndex, v)}
          onUpdateFixed={(key, v) => onUpdateExerciseFixed(openExercise.catIndex, openExercise.exIndex, key, v)}
          onUpdateProgression={(weekIndex, key, v) => onUpdateExerciseProgression(openExercise.catIndex, openExercise.exIndex, weekIndex, key, v)}
          onDuplicate={onDuplicateExercise.bind(null, openExercise.catIndex, openExercise.exIndex)}
          onDelete={() => {
            onDeleteExercise(openExercise.catIndex, openExercise.exIndex);
            setOpenExercise(null);
          }}
        />
      );
    }
  }

  if (openCategoryIndex !== null) {
    const category = categories[openCategoryIndex];
    if (category) {
      return (
        <CategoryEditorPanel
          category={category}
          onBack={() => setOpenCategoryIndex(null)}
          onUpdateName={(v) => onUpdateCategoryName(openCategoryIndex, v)}
          onUpdateSubtitle={(v) => onUpdateCategorySubtitle(openCategoryIndex, v)}
          onAddExercise={() => onAddExercise(openCategoryIndex)}
          onOpenExercise={(exIndex) => setOpenExercise({ catIndex: openCategoryIndex, exIndex })}
          onDuplicateExercise={(exIndex) => onDuplicateExercise(openCategoryIndex, exIndex)}
          onDeleteExercise={(exIndex) => onDeleteExercise(openCategoryIndex, exIndex)}
          onDelete={() => {
            onDeleteCategory(openCategoryIndex);
            setOpenCategoryIndex(null);
          }}
        />
      );
    }
  }

  if (openWeekIndex !== null) {
    const week = weeks[openWeekIndex];
    if (week) {
      return (
        <WeekEditorPanel
          week={week}
          onBack={() => setOpenWeekIndex(null)}
          onTogglePm={() => onToggleWeekPm(openWeekIndex)}
          onUpdateDay={(period, dayIndex, value) => onUpdateDay(openWeekIndex, period, dayIndex, value)}
          onDelete={weeks.length > 1 ? () => {
            onDeleteWeek(openWeekIndex);
            setOpenWeekIndex(null);
          } : undefined}
        />
      );
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="[Insert program title]"
          className="w-full text-xl font-bold uppercase tracking-wide text-center bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950/40 rounded transition-colors placeholder:normal-case placeholder:text-gray-400 text-gray-900 dark:text-gray-100"
        />
        <div className="flex items-center justify-center gap-2">
          <input
            type="date"
            autoComplete="off"
            required={mode === 'new'}
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className={`border rounded-lg px-2 py-1.5 text-xs font-medium text-blue-900 dark:text-blue-300 dark:bg-gray-800 outline-none bg-off-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors ${dateError ? 'border-red-400' : 'border-blue-200 dark:border-blue-800'}`}
          />
          <span className="text-xs font-medium text-blue-400">to</span>
          <input
            type="date"
            autoComplete="off"
            required={mode === 'new'}
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className={`border rounded-lg px-2 py-1.5 text-xs font-medium text-blue-900 dark:text-blue-300 dark:bg-gray-800 outline-none bg-off-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors ${dateError ? 'border-red-400' : 'border-blue-200 dark:border-blue-800'}`}
          />
        </div>
        {dateError && <p className="text-[11px] font-medium text-red-500 text-center">Start and end dates are required</p>}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Schedule this month:</h3>
        <div className="space-y-2">
          {weeks.map((week, wIndex) => {
            const filledDays = DAYS.filter((_, i) => week.am[i].trim() || week.pm[i].trim()).length;
            return (
              <div
                key={week.id}
                className="flex items-center gap-0.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-950/40 pl-1 pr-1"
              >
                <button
                  type="button"
                  onClick={() => setOpenWeekIndex(wIndex)}
                  className="flex-1 min-w-0 flex items-center justify-between gap-2 px-3 py-3 text-left"
                >
                  <span className="font-bold text-blue-900 dark:text-blue-300 text-sm">Week {week.id}</span>
                  <span className="flex items-center gap-2 text-xs text-blue-700/70 dark:text-blue-400/70">
                    {filledDays > 0 ? `${filledDays} day${filledDays === 1 ? '' : 's'} scheduled` : 'Nothing scheduled yet'}
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </button>
                {weeks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteWeek(wIndex)}
                    title="Delete week"
                    className="shrink-0 text-blue-700/50 dark:text-blue-400/50 hover:text-red-500 p-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={onAddWeek} className="mt-3 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">
          <Plus className="w-4 h-4" /> Add Week
        </button>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Exercises:</h3>
        <div className="space-y-2">
          {categories.map((category, catIndex) => {
            const visual = getCategoryVisual(category.categoryType);
            return (
              <div
                key={category.id}
                className={`flex items-center gap-0.5 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 pl-1 pr-1 ${visual.headerBg} ${visual.darkHeaderBg} ${visual.headerBorder} ${visual.darkHeaderBorder}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenCategoryIndex(catIndex)}
                  className="flex-1 min-w-0 flex items-center gap-3 p-2 text-left"
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${visual.iconBg} ${visual.darkIconBg}`}>
                    <visual.Icon className={`w-4 h-4 ${visual.iconText} ${visual.darkIconText}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold uppercase truncate block text-gray-900 dark:text-gray-100">{category.name || 'Untitled category'}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {category.exercises.length} exercise{category.exercises.length === 1 ? '' : 's'}
                      {category.subtitle ? ` · ${category.subtitle}` : ''}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCategory(catIndex)}
                  title="Delete category"
                  className="shrink-0 text-gray-400 dark:text-gray-500 hover:text-red-500 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <AddCategoryMenu onAdd={onAddCategory} />
        </div>
      </div>
    </div>
  );
}
