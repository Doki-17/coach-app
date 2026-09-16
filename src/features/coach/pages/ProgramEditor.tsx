import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Save, Plus, Minus, Trash2, Copy } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { DAYS } from '../../../lib/constants';
import { buildExportFilename } from '../../../lib/filename';
import ExportMenu from '../../../components/ExportMenu';
import ExportPreviewModal, { type ExportPreview } from '../../../components/ExportPreviewModal';
import AddCategoryMenu from '../../../components/AddCategoryMenu';
import MobileProgramEditor from '../components/MobileProgramEditor';
import UnsavedChangesModal from '../../../components/UnsavedChangesModal';
import {
  getCategoryType,
  progressionWeekCount,
  LEGACY_CATEGORY_TYPE_ID,
  type CategoryColumn,
} from '../../../lib/categoryTypes';
import { getCategoryVisual } from '../../../lib/categoryVisuals';
import logo from '../../../assets/logo.png';
import {
  getClient,
  getProgram,
  saveProgram,
  cloneProgram,
  programsEqual,
  DEFAULT_PROGRAM,
  type ProgramWeek,
  type ProgramCategory,
  type ProgramData,
} from '../../../lib/storage';

export type ProgramEditorMode = 'edit' | 'new';

const cellInputClass = 'w-full p-3 bg-transparent outline-none text-center focus:bg-blue-50';

/** A text field, or - when the column defines `options` - a dropdown of those choices plus a free-text "Other". */
function CategoryCellInput({ column, value, onChange }: { column: CategoryColumn; value: string; onChange: (v: string) => void }) {
  const [showOther, setShowOther] = useState(() => value !== '' && !!column.options && !column.options.includes(value));

  if (!column.options) {
    return <input value={value} onChange={(e) => onChange(e.target.value)} className={cellInputClass} />;
  }

  if (showOther) {
    return (
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={column.label}
          className={cellInputClass}
        />
        <button
          type="button"
          onClick={() => { setShowOther(false); onChange(''); }}
          className="exclude-from-png text-gray-400 hover:text-gray-600 text-xs px-1"
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
      className={`${cellInputClass} bg-transparent`}
    >
      <option value="">—</option>
      {column.options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
      <option value="__other__">Other…</option>
    </select>
  );
}

export default function ProgramEditor({ mode = 'edit' }: { mode?: ProgramEditorMode }) {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const printRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientName, setClientName] = useState('Client');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Only enforced when starting a brand-new program - editing an existing one never
  // forces a re-pick, it just keeps whatever dates (if any) that program already had.
  const [dateError, setDateError] = useState(false);
  const [weeks, setWeeks] = useState<ProgramWeek[]>([]);
  const [categories, setCategories] = useState<ProgramCategory[]>([]);

  // Pristine snapshot captured once loading finishes - the saved program being
  // edited (or a blank template for a brand-new one). Comparing the live
  // fields above against this is how the editor knows whether anything has
  // actually changed, both to skip a no-op audit log entry on Save and to
  // warn before leaving with unsaved changes.
  const [initialProgram, setInitialProgram] = useState<ProgramData>(DEFAULT_PROGRAM);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!clientId) {
        setLoading(false);
        return;
      }
      try {
        const [client, program] = await Promise.all([
          getClient(clientId),
          mode === 'new' ? Promise.resolve(cloneProgram(DEFAULT_PROGRAM)) : getProgram(clientId),
        ]);
        if (cancelled) return;
        // Defense in depth - the hub page already hides the New/Edit Program
        // buttons while a client is inactive, but a direct URL would otherwise
        // still reach the editor. Bounce back to the (view-only) hub page.
        if (client?.status === 'inactive') {
          navigate(`/client/${clientId}`, { replace: true });
          return;
        }
        setClientName(client?.nickname ?? 'Client');
        setTitle(program.title);
        setStartDate(program.startDate);
        setEndDate(program.endDate);
        setWeeks(program.weeks);
        setCategories(program.categories);
        setInitialProgram(program);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load program.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [clientId, mode, navigate]);

  const addWeek = () => {
    setWeeks([...weeks, { id: weeks.length + 1, am: Array(7).fill(''), pm: Array(7).fill(''), showPm: false }]);
    // Categories with per-week progression columns need a new blank
    // progression entry on every existing exercise row to match the new
    // week count. Legacy categories and types with no progression at all
    // (e.g. Running, HYROX) don't grow.
    setCategories(categories.map((cat) => {
      const type = getCategoryType(cat.categoryType);
      if (cat.categoryType === LEGACY_CATEGORY_TYPE_ID || type.progressionColumns.length === 0) return cat;
      const blankWeek = Object.fromEntries(type.progressionColumns.map((c) => [c.key, '']));
      return {
        ...cat,
        exercises: cat.exercises.map((ex) => ({ ...ex, progression: [...ex.progression, blankWeek] })),
      };
    }));
  };

  // Most days are a single session - the PM row only exists for a week once
  // a coach turns it on. Turning it off again just hides it; any PM text
  // already typed in stays in state and reappears if it's turned back on.
  const toggleWeekPm = (weekIndex: number) => {
    const newWeeks = [...weeks];
    newWeeks[weekIndex] = { ...newWeeks[weekIndex], showPm: !newWeeks[weekIndex].showPm };
    setWeeks(newWeeks);
  };

  // Named (rather than inline) so both the desktop canvas below and the
  // phone-width MobileProgramEditor can share the exact same "typing a date
  // clears the earlier validation error" behavior.
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (dateError) setDateError(false);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    if (dateError) setDateError(false);
  };

  const updateDay = (weekIndex: number, period: 'am' | 'pm', dayIndex: number, value: string) => {
    const newWeeks = [...weeks];
    // Clone the week object and its am/pm array before writing into them - the
    // week object (and that array) loaded from storage is the same reference
    // held by `initialProgram` (the pristine snapshot used to detect unsaved
    // changes), so mutating it in place here would silently corrupt that
    // snapshot too and make Save think nothing had changed.
    const newPeriod = [...newWeeks[weekIndex][period]];
    newPeriod[dayIndex] = value;
    newWeeks[weekIndex] = { ...newWeeks[weekIndex], [period]: newPeriod };
    setWeeks(newWeeks);
  };

  const addCategory = (categoryTypeId: string) => {
    const type = getCategoryType(categoryTypeId);
    const defaultName = type.label.split(' / ')[0].toUpperCase();
    // Start with one blank exercise row already in place - an empty category
    // with no rows just looks broken/unfinished, and coaches had to know to
    // hunt for "Add Exercise" before they could type anything.
    const weekCount = progressionWeekCount(type, weeks.length);
    const blankWeek = Object.fromEntries(type.progressionColumns.map((c) => [c.key, '']));
    setCategories([...categories, {
      id: crypto.randomUUID(),
      name: defaultName,
      categoryType: categoryTypeId,
      subtitle: '',
      exercises: [{
        id: crypto.randomUUID(),
        name: '',
        fixed: {},
        progression: Array.from({ length: weekCount }, () => ({ ...blankWeek })),
      }],
    }]);
  };

  const updateCategoryName = (catIndex: number, value: string) => {
    const newCategories = [...categories];
    newCategories[catIndex] = { ...newCategories[catIndex], name: value };
    setCategories(newCategories);
  };

  const updateCategorySubtitle = (catIndex: number, value: string) => {
    const newCategories = [...categories];
    newCategories[catIndex] = { ...newCategories[catIndex], subtitle: value };
    setCategories(newCategories);
  };

  const addExercise = (catIndex: number) => {
    const newCategories = [...categories];
    const category = newCategories[catIndex];
    const type = getCategoryType(category.categoryType);
    const weekCount = progressionWeekCount(type, weeks.length);
    const blankWeek = Object.fromEntries(type.progressionColumns.map((c) => [c.key, '']));
    newCategories[catIndex] = {
      ...category,
      exercises: [...category.exercises, {
        id: crypto.randomUUID(),
        name: '',
        fixed: {},
        progression: Array.from({ length: weekCount }, () => ({ ...blankWeek })),
      }],
    };
    setCategories(newCategories);
  };

  const updateExerciseName = (catIndex: number, exIndex: number, value: string) => {
    const newCategories = [...categories];
    const exercises = [...newCategories[catIndex].exercises];
    exercises[exIndex] = { ...exercises[exIndex], name: value };
    newCategories[catIndex] = { ...newCategories[catIndex], exercises };
    setCategories(newCategories);
  };

  const updateExerciseFixed = (catIndex: number, exIndex: number, key: string, value: string) => {
    const newCategories = [...categories];
    const exercises = [...newCategories[catIndex].exercises];
    exercises[exIndex] = { ...exercises[exIndex], fixed: { ...exercises[exIndex].fixed, [key]: value } };
    newCategories[catIndex] = { ...newCategories[catIndex], exercises };
    setCategories(newCategories);
  };

  const updateExerciseProgression = (catIndex: number, exIndex: number, weekIndex: number, fieldKey: string, value: string) => {
    const newCategories = [...categories];
    const exercises = [...newCategories[catIndex].exercises];
    const progression = [...exercises[exIndex].progression];
    progression[weekIndex] = { ...progression[weekIndex], [fieldKey]: value };
    exercises[exIndex] = { ...exercises[exIndex], progression };
    newCategories[catIndex] = { ...newCategories[catIndex], exercises };
    setCategories(newCategories);
  };

  const deleteExercise = (catIndex: number, exIndex: number) => {
    const newCategories = [...categories];
    const exercises = [...newCategories[catIndex].exercises];
    exercises.splice(exIndex, 1);
    newCategories[catIndex] = { ...newCategories[catIndex], exercises };
    setCategories(newCategories);
  };

  // Inserts a copy of an exercise row directly below the original - handy for
  // near-identical exercises (e.g. left/right unilateral variants, or a
  // superset) without retyping every column. The copy gets its own id and its
  // own fixed/progression objects so editing one row never mutates the other.
  const duplicateExercise = (catIndex: number, exIndex: number) => {
    const newCategories = [...categories];
    const exercises = [...newCategories[catIndex].exercises];
    const original = exercises[exIndex];
    const duplicate = {
      ...original,
      id: crypto.randomUUID(),
      fixed: { ...original.fixed },
      progression: original.progression.map((weekValues) => ({ ...weekValues })),
    };
    exercises.splice(exIndex + 1, 0, duplicate);
    newCategories[catIndex] = { ...newCategories[catIndex], exercises };
    setCategories(newCategories);
  };

  // The program as it stands right now, for both saving and dirty-checking
  // against `initialProgram`.
  const currentProgram: ProgramData = { title, startDate, endDate, weeks, categories };
  const isDirty = !programsEqual(currentProgram, initialProgram);

  // Classifies what actually changed so the note we save (and therefore the
  // notification the client sees, since the DB trigger uses this note
  // verbatim as the message) names the real action - added, removed, or
  // edited - rather than listing all three every time. A brand new program
  // always wins regardless of what's in it; otherwise the schedule (weeks)
  // and workout (categories/exercises) are diffed independently, since a
  // save can touch either or both.
  type ChangeKind = 'added' | 'removed' | 'edited' | null;

  // Walks every am/pm day cell (plus any whole new week, which only ever
  // happens via "Add week" - weeks are never removed in this editor) and
  // buckets each cell's change into added/removed/edited by comparing it
  // against the pristine snapshot. A mix of add+remove with no direct edits
  // still reads as "edited" - that's the honest catch-all for "changed in
  // more than one way".
  const classifyScheduleChange = (): ChangeKind => {
    let added = false;
    let removed = false;
    let edited = false;

    const weekCount = Math.max(weeks.length, initialProgram.weeks.length);
    for (let w = 0; w < weekCount; w++) {
      const initialWeek = initialProgram.weeks[w];
      const currentWeek = weeks[w];
      if (!initialWeek && currentWeek) {
        added = true;
        continue;
      }
      if (initialWeek && !currentWeek) {
        removed = true;
        continue;
      }
      if (!initialWeek || !currentWeek) continue;

      (['am', 'pm'] as const).forEach((period) => {
        for (let d = 0; d < 7; d++) {
          const before = initialWeek[period][d] ?? '';
          const after = currentWeek[period][d] ?? '';
          if (before === after) continue;
          if (!before && after) added = true;
          else if (before && !after) removed = true;
          else edited = true;
        }
      });
    }

    if (edited || (added && removed)) return 'edited';
    if (added) return 'added';
    if (removed) return 'removed';
    return null;
  };

  // Same idea for workout content, matched by id (categories, then
  // exercises within each shared category) so a rename doesn't look like a
  // remove+add, and a duplicated/new exercise correctly reads as "added".
  const classifyWorkoutChange = (): ChangeKind => {
    let added = false;
    let removed = false;
    let edited = false;

    const initialIds = new Set(initialProgram.categories.map((c) => c.id));
    const currentIds = new Set(categories.map((c) => c.id));
    categories.forEach((c) => { if (!initialIds.has(c.id)) added = true; });
    initialProgram.categories.forEach((c) => { if (!currentIds.has(c.id)) removed = true; });

    categories.forEach((currentCategory) => {
      const initialCategory = initialProgram.categories.find((c) => c.id === currentCategory.id);
      if (!initialCategory) return; // already counted as added above

      if (currentCategory.name !== initialCategory.name || currentCategory.subtitle !== initialCategory.subtitle) {
        edited = true;
      }

      const initialExerciseIds = new Set(initialCategory.exercises.map((e) => e.id));
      const currentExerciseIds = new Set(currentCategory.exercises.map((e) => e.id));
      currentCategory.exercises.forEach((e) => { if (!initialExerciseIds.has(e.id)) added = true; });
      initialCategory.exercises.forEach((e) => { if (!currentExerciseIds.has(e.id)) removed = true; });

      currentCategory.exercises.forEach((currentExercise) => {
        const initialExercise = initialCategory.exercises.find((e) => e.id === currentExercise.id);
        if (!initialExercise) return; // already counted as added above
        if (JSON.stringify(currentExercise) !== JSON.stringify(initialExercise)) edited = true;
      });
    });

    if (edited || (added && removed)) return 'edited';
    if (added) return 'added';
    if (removed) return 'removed';
    return null;
  };

  const describeChange = (): string => {
    if (mode === 'new') return 'Your coach created a new program';

    const scheduleChange = classifyScheduleChange();
    const workoutChange = classifyWorkoutChange();

    if (scheduleChange && workoutChange) {
      return `Your coach updated your program - Schedule ${scheduleChange} & Workout ${workoutChange}`;
    }
    if (scheduleChange) {
      return `Your coach updated your program - Schedule ${scheduleChange}`;
    }
    if (workoutChange) {
      return `Your coach updated your program - Workout ${workoutChange}`;
    }
    // Only the title/dates changed - still a real edit, just not one that
    // fits either bucket above.
    return 'Your coach updated your program';
  };

  const handleSave = async () => {
    if (!clientId) return;
    // A new program needs its own date range - an edit already has one (or
    // intentionally has none yet) carried over from the current program, so
    // it's never blocked here.
    if (mode === 'new' && (!startDate || !endDate)) {
      setDateError(true);
      return;
    }
    setDateError(false);

    if (!isDirty) {
      // Nothing was actually changed since this program was loaded - skip
      // writing a no-op entry to the audit log, just head back.
      navigate(`/client/${clientId}`);
      return;
    }

    await saveProgram(clientId, currentProgram, describeChange());
    // Saving is the end of the edit flow - head back to the client's landing
    // page, which will show the details we just saved.
    navigate(`/client/${clientId}`, { state: { justSaved: true } });
  };

  // Warn before leaving with unsaved changes - both via the in-app "Back"
  // button (handleBackClick + the confirm modal below) and via closing the
  // tab/refreshing/navigating to a different URL entirely (beforeunload).
  const handleBackClick = () => {
    if (isDirty) {
      setShowLeaveConfirm(true);
    } else {
      navigate(`/client/${clientId}`);
    }
  };

  const handleLeaveSave = () => {
    setShowLeaveConfirm(false);
    handleSave();
  };

  const handleLeaveDiscard = () => {
    setShowLeaveConfirm(false);
    navigate(`/client/${clientId}`);
  };

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const captureSnapshot = async () => {
    if (!printRef.current) return null;
    const width = printRef.current.offsetWidth;
    const height = printRef.current.offsetHeight;
    const dataUrl = await toPng(printRef.current, {
      cacheBust: true,
      backgroundColor: '#f8f9fa', // Matches the cool-toned off-white canvas background (not stark white)
      filter: (node) => {
        // Removes UI buttons from the final image
        return !(node as HTMLElement).classList?.contains('exclude-from-png');
      }
    });
    return { dataUrl, width, height };
  };

  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);

  const handleExportPNG = async () => {
    try {
      const captured = await captureSnapshot();
      if (!captured) return;
      setExportPreview({ format: 'png', ...captured });
    } catch (err) {
      console.error('Error generating PNG', err);
    }
  };

  const handleExportPDF = async () => {
    try {
      const captured = await captureSnapshot();
      if (!captured) return;
      setExportPreview({ format: 'pdf', ...captured });
    } catch (err) {
      console.error('Error generating PDF', err);
    }
  };

  const handleConfirmExport = () => {
    if (!exportPreview) return;
    const { format, dataUrl, width, height } = exportPreview;
    if (format === 'png') {
      const link = document.createElement('a');
      link.download = buildExportFilename(clientName, title, 'png');
      link.href = dataUrl;
      link.click();
    } else {
      const pdf = new jsPDF({
        orientation: width >= height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      pdf.save(buildExportFilename(clientName, title, 'pdf'));
    }
    setExportPreview(null);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <p className="text-red-500">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-6">
        <button onClick={handleBackClick} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to {clientName}
        </button>
        <div className="flex items-center gap-3">
          <ExportMenu onExportPNG={handleExportPNG} onExportPDF={handleExportPDF} />
          <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        {mode === 'new' ? `New program for ${clientName}` : `Editing ${clientName}'s program`}
      </p>

      {/* The card below is the exported/viewed "output" - it should always render at
          its full designed width (never squished), so the fixed header layout can
          never overlap itself. On a narrow screen this scrolls horizontally instead,
          same as the tables inside it already do. */}
      {/* Tablet / desktop: the original editable table, unchanged. */}
      <div className="hidden sm:block overflow-x-auto">
      <div className="bg-off-white p-8 rounded-xl shadow-sm border border-gray-200 min-w-[1100px] text-gray-900">
        <div className="relative mb-6 min-h-44 flex items-center justify-center">
          {/* Date range - upper left. Absolutely positioned (out of flow) so its
              width never shifts the title away from true center, and vertically
              centered (top-1/2 -translate-y-1/2) to sit on the same middle line
              as the title and logo. */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <input
                type="date"
                autoComplete="off"
                required={mode === 'new'}
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className={`border rounded-lg px-2 py-1 text-xs font-medium text-blue-900 outline-none bg-off-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors ${dateError ? 'border-red-400' : 'border-blue-200'}`}
              />
              <span className="text-xs font-medium text-blue-400">to</span>
              <input
                type="date"
                autoComplete="off"
                required={mode === 'new'}
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className={`border rounded-lg px-2 py-1 text-xs font-medium text-blue-900 outline-none bg-off-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors ${dateError ? 'border-red-400' : 'border-blue-200'}`}
              />
            </div>
            {dateError && (
              <p className="text-[11px] font-medium text-red-500 whitespace-nowrap">Start and end dates are required</p>
            )}
          </div>

          {/* Title - always dead-center of the header, regardless of the
              date/logo widths on either side (they're out of flow). */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="[Insert program title]"
            className="w-full max-w-2xl text-2xl font-bold uppercase tracking-wider text-center bg-transparent outline-none focus:bg-blue-50 rounded transition-colors placeholder:normal-case placeholder:text-gray-400"
          />

          {/* Coach's logo - upper right, on the same middle line as the date and title. */}
          <img src={logo} alt="" className="absolute right-0 top-1/2 -translate-y-1/2 w-40 h-40 object-contain pointer-events-none" />
        </div>

        <div className="mb-10">
          <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-collapse table-fixed">
            <thead className="bg-blue-50">
              <tr>
                <th className="border p-3 w-24 text-center text-blue-900 font-bold text-xs uppercase tracking-wide">Week</th>
                {DAYS.map(day => (
                  <th key={day} className="border p-3 text-center font-bold text-blue-900 text-xs uppercase tracking-wide w-32">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wIndex) => {
                const isDoubleDay = (dIndex: number) => week.am[dIndex].trim() !== '' && week.pm[dIndex].trim() !== '';
                // Subtle alternating fill so a long program is easier to scan week to week.
                const rowBg = wIndex % 2 === 1 ? 'bg-gray-50' : 'bg-off-white';
                return (
                  <React.Fragment key={week.id}>
                    <tr>
                      <td className={`border p-3 text-center align-middle ${rowBg}`} rowSpan={week.showPm ? 2 : 1}>
                        <div className="font-bold text-gray-900">Week {week.id}</div>
                        {/* Subtle, reversible per-week toggle - most weeks are single-session, so the PM row only exists once a coach asks for it. */}
                        <button
                          type="button"
                          onClick={() => toggleWeekPm(wIndex)}
                          className="exclude-from-png mt-1 flex items-center gap-0.5 mx-auto text-[10px] font-normal text-gray-400 hover:text-blue-600"
                        >
                          {week.showPm ? <><Minus className="w-2.5 h-2.5" /> PM row</> : <><Plus className="w-2.5 h-2.5" /> PM row</>}
                        </button>
                      </td>
                      {DAYS.map((_, dIndex) => {
                        // The line between a day's AM and PM cells only earns its keep when the
                        // day genuinely has both sessions filled in - otherwise it reads as a
                        // stray divider through one block of text, so we drop it for that column.
                        const showDivider = week.showPm && isDoubleDay(dIndex);
                        return (
                          <td
                            key={`am-${dIndex}`}
                            className={`border-l border-r border-t p-0 h-20 align-middle relative ${rowBg} ${!week.showPm || showDivider ? 'border-b' : 'border-b-0'}`}
                          >
                            {/* AM/PM labels only matter when a day genuinely has two sessions - otherwise they're just noise. */}
                            {showDivider && <span className="absolute top-1 left-1 text-[10px] text-gray-400 font-medium">AM</span>}
                            {/* While editing, a faint guide line still marks the AM/PM split even with no text yet, so it's clear the cell is divided - but it's UI-only and drops out of the exported PNG/PDF, which only ever shows a line where both sessions actually have text. */}
                            {week.showPm && !showDivider && (
                              <div className="exclude-from-png absolute bottom-0 left-1 right-1 h-px bg-gray-200" />
                            )}
                            {/* A flex wrapper (rather than a plain h-full textarea) is what actually lets short entries sit vertically centered instead of pinned to the top. */}
                            <div className="w-full h-full flex items-center justify-center focus-within:bg-blue-50 transition-colors">
                              <textarea
                                value={week.am[dIndex]}
                                onChange={(e) => updateDay(wIndex, 'am', dIndex, e.target.value)}
                                className="w-full p-2 resize-none outline-none bg-transparent text-sm text-center"
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    {week.showPm && (
                      <tr>
                        {DAYS.map((_, dIndex) => {
                          const showDivider = isDoubleDay(dIndex);
                          return (
                            <td
                              key={`pm-${dIndex}`}
                              className={`border-l border-r border-b p-0 h-20 align-middle relative ${rowBg} ${showDivider ? 'border-t' : 'border-t-0'}`}
                            >
                              {showDivider && <span className="absolute top-1 left-1 text-[10px] text-gray-400 font-medium">PM</span>}
                              <div className="w-full h-full flex items-center justify-center focus-within:bg-blue-50 transition-colors">
                                <textarea
                                  value={week.pm[dIndex]}
                                  onChange={(e) => updateDay(wIndex, 'pm', dIndex, e.target.value)}
                                  className="w-full p-2 resize-none outline-none bg-transparent text-sm text-center"
                                />
                              </div>
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

          <button className="exclude-from-png mt-3 flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline" onClick={addWeek}>
            <Plus className="w-4 h-4" /> Add Week
          </button>
        </div>

        <div className="space-y-8">
          {categories.map((category, catIndex) => {
            const type = getCategoryType(category.categoryType);
            const weekCount = progressionWeekCount(type, weeks.length);
            const multiField = type.progressionColumns.length > 1;
            const visual = getCategoryVisual(category.categoryType);
            return (
              <div key={category.id}>
                <div className={`flex items-center gap-3 mb-4 p-3 rounded-lg border-l-4 ${visual.headerBg} ${visual.headerBorder}`}>
                  <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${visual.iconBg}`}>
                    <visual.Icon className={`w-5 h-5 ${visual.iconText}`} />
                  </div>
                  <input
                    value={category.name}
                    onChange={(e) => updateCategoryName(catIndex, e.target.value)}
                    className="text-lg font-bold bg-transparent outline-none uppercase flex-1 min-w-0 focus:bg-white focus:px-2 rounded transition-all"
                  />
                  <input
                    value={category.subtitle}
                    onChange={(e) => updateCategorySubtitle(catIndex, e.target.value)}
                    placeholder="Subtitle (optional)"
                    className="text-sm text-gray-500 bg-transparent outline-none flex-1 min-w-0 text-right focus:bg-white focus:px-2 rounded transition-all placeholder:text-gray-400"
                  />
                </div>
                <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className={visual.headerBg}>
                    {multiField ? (
                      <>
                        <tr>
                          <th className="border p-3 w-1/4" rowSpan={2}>{type.exerciseColumn?.label ?? 'EXERCISE'}</th>
                          {type.fixedColumnsBefore.map((col) => (
                            <th key={col.key} className="border p-3 w-20 text-center" rowSpan={2}>{col.label}</th>
                          ))}
                          {Array.from({ length: weekCount }, (_, i) => (
                            <th key={`wk-${i}`} className="border p-3 text-center" colSpan={type.progressionColumns.length}>WEEK {i + 1}</th>
                          ))}
                          {type.fixedColumnsAfter.map((col) => (
                            <th key={col.key} className="border p-3 w-20 text-center" rowSpan={2}>{col.label}</th>
                          ))}
                          <th className="border p-3 w-16 exclude-from-png" rowSpan={2}></th>
                        </tr>
                        <tr>
                          {Array.from({ length: weekCount }, (_, i) => (
                            type.progressionColumns.map((col) => (
                              <th key={`wk-${i}-${col.key}`} className="border p-2 text-center text-xs font-medium">{col.label}</th>
                            ))
                          ))}
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <th className="border p-3 w-1/4">{type.exerciseColumn?.label ?? 'EXERCISE'}</th>
                        {type.fixedColumnsBefore.map((col) => (
                          <th key={col.key} className="border p-3 w-20 text-center">{col.label}</th>
                        ))}
                        {Array.from({ length: weekCount }, (_, i) => (
                          <th key={`w-${i}`} className="border p-3 text-center">WEEK {i + 1}</th>
                        ))}
                        {type.fixedColumnsAfter.map((col) => (
                          <th key={col.key} className="border p-3 w-20 text-center">{col.label}</th>
                        ))}
                        <th className="border p-3 w-16 exclude-from-png"></th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {category.exercises.map((ex, exIndex) => (
                      <tr key={ex.id} className="group hover:bg-gray-50">
                        <td className="border p-0">
                          {type.exerciseColumn ? (
                            <CategoryCellInput column={type.exerciseColumn} value={ex.name} onChange={(v) => updateExerciseName(catIndex, exIndex, v)} />
                          ) : (
                            <input value={ex.name} onChange={(e) => updateExerciseName(catIndex, exIndex, e.target.value)} className="w-full p-3 bg-transparent outline-none focus:bg-blue-50" />
                          )}
                        </td>
                        {type.fixedColumnsBefore.map((col) => (
                          <td key={col.key} className="border p-0">
                            <CategoryCellInput column={col} value={ex.fixed[col.key] ?? ''} onChange={(v) => updateExerciseFixed(catIndex, exIndex, col.key, v)} />
                          </td>
                        ))}
                        {Array.from({ length: weekCount }, (_, i) => (
                          type.progressionColumns.map((col) => (
                            <td key={`${i}-${col.key}`} className="border p-0">
                              <input
                                value={ex.progression[i]?.[col.key] ?? ''}
                                onChange={(e) => updateExerciseProgression(catIndex, exIndex, i, col.key, e.target.value)}
                                className={cellInputClass}
                              />
                            </td>
                          ))
                        ))}
                        {type.fixedColumnsAfter.map((col) => (
                          <td key={col.key} className="border p-0">
                            <CategoryCellInput column={col} value={ex.fixed[col.key] ?? ''} onChange={(v) => updateExerciseFixed(catIndex, exIndex, col.key, v)} />
                          </td>
                        ))}
                        <td className="border p-0 text-center exclude-from-png">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => duplicateExercise(catIndex, exIndex)}
                              title="Duplicate row"
                              className="text-gray-400 hover:text-blue-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteExercise(catIndex, exIndex)}
                              title="Delete row"
                              className="text-gray-400 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                </div>
                <button className="exclude-from-png mt-2 flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline" onClick={() => addExercise(catIndex)}>
                  <Plus className="w-4 h-4" /> Add Exercise Row
                </button>
              </div>
            );
          })}
        </div>

        <AddCategoryMenu onAdd={addCategory} />
      </div>
      </div>

      {/* Phones: a stack of focused-editor cards instead of the wide scrolling table above -
          tap a week or an exercise to edit just that one item on its own screen, mirroring
          the read-only card view the client sees (see ProgramCardView) but editable. */}
      <div className="sm:hidden">
        <MobileProgramEditor
          mode={mode}
          title={title}
          onTitleChange={setTitle}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          dateError={dateError}
          weeks={weeks}
          onToggleWeekPm={toggleWeekPm}
          onUpdateDay={updateDay}
          onAddWeek={addWeek}
          categories={categories}
          onUpdateCategoryName={updateCategoryName}
          onUpdateCategorySubtitle={updateCategorySubtitle}
          onAddCategory={addCategory}
          onAddExercise={addExercise}
          onUpdateExerciseName={updateExerciseName}
          onUpdateExerciseFixed={updateExerciseFixed}
          onUpdateExerciseProgression={updateExerciseProgression}
          onDeleteExercise={deleteExercise}
          onDuplicateExercise={duplicateExercise}
        />
      </div>

      {/* Off-screen, always mounted regardless of viewport - the only node PNG/PDF export
          ever captures, so a download always looks like the table above, never the phone
          cards, no matter what device it was exported from (same pattern as
          ClientProgramView's client-facing export copy). */}
      <div className="fixed top-0 left-0 w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div ref={printRef} className="bg-off-white p-8 rounded-xl shadow-sm border border-gray-200 min-w-[1100px] text-gray-900">
        <div className="relative mb-6 min-h-44 flex items-center justify-center">
          {/* Date range - upper left. Absolutely positioned (out of flow) so its
              width never shifts the title away from true center, and vertically
              centered (top-1/2 -translate-y-1/2) to sit on the same middle line
              as the title and logo. */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <input
                type="date"
                autoComplete="off"
                required={mode === 'new'}
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className={`border rounded-lg px-2 py-1 text-xs font-medium text-blue-900 outline-none bg-off-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors ${dateError ? 'border-red-400' : 'border-blue-200'}`}
              />
              <span className="text-xs font-medium text-blue-400">to</span>
              <input
                type="date"
                autoComplete="off"
                required={mode === 'new'}
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className={`border rounded-lg px-2 py-1 text-xs font-medium text-blue-900 outline-none bg-off-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors ${dateError ? 'border-red-400' : 'border-blue-200'}`}
              />
            </div>
            {dateError && (
              <p className="text-[11px] font-medium text-red-500 whitespace-nowrap">Start and end dates are required</p>
            )}
          </div>

          {/* Title - always dead-center of the header, regardless of the
              date/logo widths on either side (they're out of flow). */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="[Insert program title]"
            className="w-full max-w-2xl text-2xl font-bold uppercase tracking-wider text-center bg-transparent outline-none focus:bg-blue-50 rounded transition-colors placeholder:normal-case placeholder:text-gray-400"
          />

          {/* Coach's logo - upper right, on the same middle line as the date and title. */}
          <img src={logo} alt="" className="absolute right-0 top-1/2 -translate-y-1/2 w-40 h-40 object-contain pointer-events-none" />
        </div>

        <div className="mb-10">
          <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-collapse table-fixed">
            <thead className="bg-blue-50">
              <tr>
                <th className="border p-3 w-24 text-center text-blue-900 font-bold text-xs uppercase tracking-wide">Week</th>
                {DAYS.map(day => (
                  <th key={day} className="border p-3 text-center font-bold text-blue-900 text-xs uppercase tracking-wide w-32">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wIndex) => {
                const isDoubleDay = (dIndex: number) => week.am[dIndex].trim() !== '' && week.pm[dIndex].trim() !== '';
                // Subtle alternating fill so a long program is easier to scan week to week.
                const rowBg = wIndex % 2 === 1 ? 'bg-gray-50' : 'bg-off-white';
                return (
                  <React.Fragment key={week.id}>
                    <tr>
                      <td className={`border p-3 text-center align-middle ${rowBg}`} rowSpan={week.showPm ? 2 : 1}>
                        <div className="font-bold text-gray-900">Week {week.id}</div>
                        {/* Subtle, reversible per-week toggle - most weeks are single-session, so the PM row only exists once a coach asks for it. */}
                        <button
                          type="button"
                          onClick={() => toggleWeekPm(wIndex)}
                          className="exclude-from-png mt-1 flex items-center gap-0.5 mx-auto text-[10px] font-normal text-gray-400 hover:text-blue-600"
                        >
                          {week.showPm ? <><Minus className="w-2.5 h-2.5" /> PM row</> : <><Plus className="w-2.5 h-2.5" /> PM row</>}
                        </button>
                      </td>
                      {DAYS.map((_, dIndex) => {
                        // The line between a day's AM and PM cells only earns its keep when the
                        // day genuinely has both sessions filled in - otherwise it reads as a
                        // stray divider through one block of text, so we drop it for that column.
                        const showDivider = week.showPm && isDoubleDay(dIndex);
                        return (
                          <td
                            key={`am-${dIndex}`}
                            className={`border-l border-r border-t p-0 h-20 align-middle relative ${rowBg} ${!week.showPm || showDivider ? 'border-b' : 'border-b-0'}`}
                          >
                            {/* AM/PM labels only matter when a day genuinely has two sessions - otherwise they're just noise. */}
                            {showDivider && <span className="absolute top-1 left-1 text-[10px] text-gray-400 font-medium">AM</span>}
                            {/* While editing, a faint guide line still marks the AM/PM split even with no text yet, so it's clear the cell is divided - but it's UI-only and drops out of the exported PNG/PDF, which only ever shows a line where both sessions actually have text. */}
                            {week.showPm && !showDivider && (
                              <div className="exclude-from-png absolute bottom-0 left-1 right-1 h-px bg-gray-200" />
                            )}
                            {/* A flex wrapper (rather than a plain h-full textarea) is what actually lets short entries sit vertically centered instead of pinned to the top. */}
                            <div className="w-full h-full flex items-center justify-center focus-within:bg-blue-50 transition-colors">
                              <textarea
                                value={week.am[dIndex]}
                                onChange={(e) => updateDay(wIndex, 'am', dIndex, e.target.value)}
                                className="w-full p-2 resize-none outline-none bg-transparent text-sm text-center"
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    {week.showPm && (
                      <tr>
                        {DAYS.map((_, dIndex) => {
                          const showDivider = isDoubleDay(dIndex);
                          return (
                            <td
                              key={`pm-${dIndex}`}
                              className={`border-l border-r border-b p-0 h-20 align-middle relative ${rowBg} ${showDivider ? 'border-t' : 'border-t-0'}`}
                            >
                              {showDivider && <span className="absolute top-1 left-1 text-[10px] text-gray-400 font-medium">PM</span>}
                              <div className="w-full h-full flex items-center justify-center focus-within:bg-blue-50 transition-colors">
                                <textarea
                                  value={week.pm[dIndex]}
                                  onChange={(e) => updateDay(wIndex, 'pm', dIndex, e.target.value)}
                                  className="w-full p-2 resize-none outline-none bg-transparent text-sm text-center"
                                />
                              </div>
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

          <button className="exclude-from-png mt-3 flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline" onClick={addWeek}>
            <Plus className="w-4 h-4" /> Add Week
          </button>
        </div>

        <div className="space-y-8">
          {categories.map((category, catIndex) => {
            const type = getCategoryType(category.categoryType);
            const weekCount = progressionWeekCount(type, weeks.length);
            const multiField = type.progressionColumns.length > 1;
            const visual = getCategoryVisual(category.categoryType);
            return (
              <div key={category.id}>
                <div className={`flex items-center gap-3 mb-4 p-3 rounded-lg border-l-4 ${visual.headerBg} ${visual.headerBorder}`}>
                  <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${visual.iconBg}`}>
                    <visual.Icon className={`w-5 h-5 ${visual.iconText}`} />
                  </div>
                  <input
                    value={category.name}
                    onChange={(e) => updateCategoryName(catIndex, e.target.value)}
                    className="text-lg font-bold bg-transparent outline-none uppercase flex-1 min-w-0 focus:bg-white focus:px-2 rounded transition-all"
                  />
                  <input
                    value={category.subtitle}
                    onChange={(e) => updateCategorySubtitle(catIndex, e.target.value)}
                    placeholder="Subtitle (optional)"
                    className="text-sm text-gray-500 bg-transparent outline-none flex-1 min-w-0 text-right focus:bg-white focus:px-2 rounded transition-all placeholder:text-gray-400"
                  />
                </div>
                <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className={visual.headerBg}>
                    {multiField ? (
                      <>
                        <tr>
                          <th className="border p-3 w-1/4" rowSpan={2}>{type.exerciseColumn?.label ?? 'EXERCISE'}</th>
                          {type.fixedColumnsBefore.map((col) => (
                            <th key={col.key} className="border p-3 w-20 text-center" rowSpan={2}>{col.label}</th>
                          ))}
                          {Array.from({ length: weekCount }, (_, i) => (
                            <th key={`wk-${i}`} className="border p-3 text-center" colSpan={type.progressionColumns.length}>WEEK {i + 1}</th>
                          ))}
                          {type.fixedColumnsAfter.map((col) => (
                            <th key={col.key} className="border p-3 w-20 text-center" rowSpan={2}>{col.label}</th>
                          ))}
                          <th className="border p-3 w-16 exclude-from-png" rowSpan={2}></th>
                        </tr>
                        <tr>
                          {Array.from({ length: weekCount }, (_, i) => (
                            type.progressionColumns.map((col) => (
                              <th key={`wk-${i}-${col.key}`} className="border p-2 text-center text-xs font-medium">{col.label}</th>
                            ))
                          ))}
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <th className="border p-3 w-1/4">{type.exerciseColumn?.label ?? 'EXERCISE'}</th>
                        {type.fixedColumnsBefore.map((col) => (
                          <th key={col.key} className="border p-3 w-20 text-center">{col.label}</th>
                        ))}
                        {Array.from({ length: weekCount }, (_, i) => (
                          <th key={`w-${i}`} className="border p-3 text-center">WEEK {i + 1}</th>
                        ))}
                        {type.fixedColumnsAfter.map((col) => (
                          <th key={col.key} className="border p-3 w-20 text-center">{col.label}</th>
                        ))}
                        <th className="border p-3 w-16 exclude-from-png"></th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {category.exercises.map((ex, exIndex) => (
                      <tr key={ex.id} className="group hover:bg-gray-50">
                        <td className="border p-0">
                          {type.exerciseColumn ? (
                            <CategoryCellInput column={type.exerciseColumn} value={ex.name} onChange={(v) => updateExerciseName(catIndex, exIndex, v)} />
                          ) : (
                            <input value={ex.name} onChange={(e) => updateExerciseName(catIndex, exIndex, e.target.value)} className="w-full p-3 bg-transparent outline-none focus:bg-blue-50" />
                          )}
                        </td>
                        {type.fixedColumnsBefore.map((col) => (
                          <td key={col.key} className="border p-0">
                            <CategoryCellInput column={col} value={ex.fixed[col.key] ?? ''} onChange={(v) => updateExerciseFixed(catIndex, exIndex, col.key, v)} />
                          </td>
                        ))}
                        {Array.from({ length: weekCount }, (_, i) => (
                          type.progressionColumns.map((col) => (
                            <td key={`${i}-${col.key}`} className="border p-0">
                              <input
                                value={ex.progression[i]?.[col.key] ?? ''}
                                onChange={(e) => updateExerciseProgression(catIndex, exIndex, i, col.key, e.target.value)}
                                className={cellInputClass}
                              />
                            </td>
                          ))
                        ))}
                        {type.fixedColumnsAfter.map((col) => (
                          <td key={col.key} className="border p-0">
                            <CategoryCellInput column={col} value={ex.fixed[col.key] ?? ''} onChange={(v) => updateExerciseFixed(catIndex, exIndex, col.key, v)} />
                          </td>
                        ))}
                        <td className="border p-0 text-center exclude-from-png">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => duplicateExercise(catIndex, exIndex)}
                              title="Duplicate row"
                              className="text-gray-400 hover:text-blue-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteExercise(catIndex, exIndex)}
                              title="Delete row"
                              className="text-gray-400 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                </div>
                <button className="exclude-from-png mt-2 flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline" onClick={() => addExercise(catIndex)}>
                  <Plus className="w-4 h-4" /> Add Exercise Row
                </button>
              </div>
            );
          })}
        </div>

        <AddCategoryMenu onAdd={addCategory} />
      </div>
      </div>

      {exportPreview && (
        <ExportPreviewModal
          preview={exportPreview}
          filename={buildExportFilename(clientName, title, exportPreview.format)}
          onConfirm={handleConfirmExport}
          onClose={() => setExportPreview(null)}
        />
      )}

      {showLeaveConfirm && (
        <UnsavedChangesModal
          onSave={handleLeaveSave}
          onDiscard={handleLeaveDiscard}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}
    </div>
  );
}
