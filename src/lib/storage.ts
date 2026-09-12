// Local-first data layer for clients, programs, and per-client program history (audit log).
// Everything here is backed by localStorage. No network/backend involved yet -
// if/when this app grows a real backend (e.g. Supabase), this module's functions
// are the seam to swap out.

import { LEGACY_CATEGORY_TYPE_ID } from './categoryTypes';

export interface ExerciseRow {
  id: string;
  name: string;
  /** Values for this row's fixed (non-progression) columns, keyed by column id - e.g. `{ sets: '3', rest: '60s' }`. */
  fixed: Record<string, string>;
  /** One value per program week (Reps, Work Time, Distance/Time, etc. depending on the category's type). */
  progression: string[];
}

export interface ProgramCategory {
  id: string;
  name: string;
  /** Which column layout this category uses - see `src/lib/categoryTypes.ts`. Fixed at creation. */
  categoryType: string;
  /** Optional free-text label to tell apart two categories of the same type in one program, e.g. "Push" vs "Pull". */
  subtitle: string;
  exercises: ExerciseRow[];
}

export interface ProgramWeek {
  id: number;
  am: string[];
  pm: string[];
}

export interface ProgramData {
  title: string;
  weeks: ProgramWeek[];
  categories: ProgramCategory[];
}

export interface Client {
  id: string;
  nickname: string; // required - the primary display name used everywhere
  firstName: string;
  lastName: string;
  weightKg: number | null;
  heightCm: number | null;
  location: string; // gym / training location - useful for coaches who travel to clients
  remarks: string;
  lastUpdated: string | null; // ISO timestamp of the last program save, null if never saved
}

/** Fields needed to create a client. Only `nickname` is required. */
export interface NewClientInput {
  nickname: string;
  firstName?: string;
  lastName?: string;
  weightKg?: number | null;
  heightCm?: number | null;
  location?: string;
  remarks?: string;
}

// Older saved clients only had `{ id, name, lastUpdated }`. This shape covers
// both old and new records so existing localStorage data keeps working.
interface StoredClientRecord {
  id: string;
  name?: string;
  nickname?: string;
  firstName?: string;
  lastName?: string;
  weightKg?: number | null;
  heightCm?: number | null;
  location?: string;
  remarks?: string;
  lastUpdated?: string | null;
}

function normalizeClient(raw: StoredClientRecord): Client {
  return {
    id: raw.id,
    nickname: raw.nickname ?? raw.name ?? 'Client',
    firstName: raw.firstName ?? '',
    lastName: raw.lastName ?? '',
    weightKg: raw.weightKg ?? null,
    heightCm: raw.heightCm ?? null,
    location: raw.location ?? '',
    remarks: raw.remarks ?? '',
    lastUpdated: raw.lastUpdated ?? null,
  };
}

export interface ProgramVersion {
  id: string;
  clientId: string;
  timestamp: string; // ISO
  note: string;
  program: ProgramData;
}

// --- Program migration -----------------------------------------------------
// Programs saved before category types existed stored exercise rows as
// `{ tempo, w1, w2, w3, w4, rest }` and categories had no `categoryType`.
// These shapes cover both the old and new forms so previously-saved current
// programs and audit log history keep loading and rendering correctly -
// normalizeProgram tags anything without a categoryType as 'legacy', which
// reproduces the original fixed Tempo/Week1-4/Rest table exactly.

interface StoredExerciseRow {
  id: string;
  name?: string;
  // New shape
  fixed?: Record<string, string>;
  progression?: string[];
  // Legacy shape
  tempo?: string;
  w1?: string;
  w2?: string;
  w3?: string;
  w4?: string;
  rest?: string;
}

interface StoredProgramCategory {
  id: string;
  name?: string;
  categoryType?: string;
  subtitle?: string;
  exercises?: StoredExerciseRow[];
}

interface StoredProgramData {
  title?: string;
  weeks?: ProgramWeek[];
  categories?: StoredProgramCategory[];
}

function normalizeExerciseRow(raw: StoredExerciseRow): ExerciseRow {
  if (raw.fixed || raw.progression) {
    return {
      id: raw.id,
      name: raw.name ?? '',
      fixed: raw.fixed ?? {},
      progression: raw.progression ?? [],
    };
  }
  // Legacy shape - preserve tempo/w1-4/rest exactly as before.
  return {
    id: raw.id,
    name: raw.name ?? '',
    fixed: { tempo: raw.tempo ?? '', rest: raw.rest ?? '' },
    progression: [raw.w1 ?? '', raw.w2 ?? '', raw.w3 ?? '', raw.w4 ?? ''],
  };
}

function normalizeCategory(raw: StoredProgramCategory): ProgramCategory {
  const categoryType = raw.categoryType ?? LEGACY_CATEGORY_TYPE_ID;
  return {
    id: raw.id,
    name: raw.name ?? '',
    categoryType,
    subtitle: raw.subtitle ?? '',
    exercises: (raw.exercises ?? []).map(normalizeExerciseRow),
  };
}

function normalizeProgram(raw: StoredProgramData): ProgramData {
  return {
    title: raw.title ?? '',
    weeks: raw.weeks ?? [],
    categories: (raw.categories ?? []).map(normalizeCategory),
  };
}

const CLIENTS_KEY = 'coachapp:clients';
const programKey = (clientId: string) => `coachapp:program:${clientId}`;
const historyKey = (clientId: string) => `coachapp:history:${clientId}`;

const MAX_HISTORY_PER_CLIENT = 100;

// Title is intentionally blank - the editor shows a "[Insert program title]"
// placeholder so the coach names each new program themselves.
export const DEFAULT_PROGRAM: ProgramData = {
  title: '',
  weeks: [{ id: 1, am: Array(7).fill(''), pm: Array(7).fill('') }],
  categories: [
    {
      id: 'default-plyo',
      name: 'PLYO',
      categoryType: 'strength',
      subtitle: '',
      exercises: [
        {
          id: 'default-ex-1',
          name: 'Single Leg Front Jump',
          fixed: { sets: '2', rest: '30s' },
          progression: ['10'],
        },
      ],
    },
  ],
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to write ${key} to localStorage`, err);
  }
}

export function cloneProgram(program: ProgramData): ProgramData {
  return JSON.parse(JSON.stringify(program));
}

export function getClients(): Client[] {
  const raw = read<StoredClientRecord[]>(CLIENTS_KEY, []);
  if (raw.length === 0) {
    // Seed with the original mock client so the app isn't empty on first run.
    const seeded: Client[] = [normalizeClient({ id: '1', name: 'Elle' })];
    write(CLIENTS_KEY, seeded);
    return seeded;
  }
  return raw.map(normalizeClient);
}

export function createClient(input: NewClientInput): Client {
  const clients = getClients();
  const client: Client = {
    id: crypto.randomUUID(),
    nickname: input.nickname.trim(),
    firstName: input.firstName?.trim() ?? '',
    lastName: input.lastName?.trim() ?? '',
    weightKg: input.weightKg ?? null,
    heightCm: input.heightCm ?? null,
    location: input.location?.trim() ?? '',
    remarks: input.remarks?.trim() ?? '',
    lastUpdated: null,
  };
  write(CLIENTS_KEY, [...clients, client]);
  return client;
}

export function getClient(clientId: string): Client | undefined {
  return getClients().find((c) => c.id === clientId);
}

/** Updates an existing client's profile fields (nickname, name, weight/height, location, remarks). */
export function updateClient(clientId: string, input: NewClientInput): Client | null {
  const clients = getClients();
  const idx = clients.findIndex((c) => c.id === clientId);
  if (idx === -1) return null;

  const nickname = input.nickname.trim();
  const updated: Client = {
    ...clients[idx],
    nickname: nickname || clients[idx].nickname,
    firstName: input.firstName?.trim() ?? '',
    lastName: input.lastName?.trim() ?? '',
    weightKg: input.weightKg ?? null,
    heightCm: input.heightCm ?? null,
    location: input.location?.trim() ?? '',
    remarks: input.remarks?.trim() ?? '',
  };
  clients[idx] = updated;
  write(CLIENTS_KEY, clients);
  return updated;
}

function touchClient(clientId: string, timestamp: string): void {
  const clients = getClients();
  const idx = clients.findIndex((c) => c.id === clientId);
  if (idx === -1) return;
  clients[idx] = { ...clients[idx], lastUpdated: timestamp };
  write(CLIENTS_KEY, clients);
}

/** Returns the client's current program, or a blank default template if they don't have one yet. */
export function getProgram(clientId: string): ProgramData {
  const raw = read<StoredProgramData | null>(programKey(clientId), null);
  if (!raw) return cloneProgram(DEFAULT_PROGRAM);
  return normalizeProgram(raw);
}

/** Returns the client's audit log of past program versions, newest first. */
export function getHistory(clientId: string): ProgramVersion[] {
  interface StoredProgramVersion {
    id: string;
    clientId: string;
    timestamp: string;
    note: string;
    program: StoredProgramData;
  }
  const raw = read<StoredProgramVersion[]>(historyKey(clientId), []);
  return raw.map((v) => ({ ...v, program: normalizeProgram(v.program) }));
}

/** Saves `program` as the client's current program and appends a new audit log entry for it. */
export function saveProgram(clientId: string, program: ProgramData, note = 'Saved'): ProgramVersion {
  const timestamp = new Date().toISOString();
  write(programKey(clientId), program);
  touchClient(clientId, timestamp);

  const version: ProgramVersion = {
    id: crypto.randomUUID(),
    clientId,
    timestamp,
    note,
    program: cloneProgram(program),
  };
  const history = [version, ...getHistory(clientId)].slice(0, MAX_HISTORY_PER_CLIENT);
  write(historyKey(clientId), history);
  return version;
}

/**
 * Rolls the client's current program back to a past version. This overwrites
 * whatever is currently saved (any unsaved edits in an open editor are not
 * preserved) and logs the restore as a new audit log entry, so restoring is
 * itself auditable.
 */
export function restoreVersion(clientId: string, versionId: string): ProgramData | null {
  const version = getHistory(clientId).find((v) => v.id === versionId);
  if (!version) return null;
  const restored = cloneProgram(version.program);
  const restoredAtLabel = new Date(version.timestamp).toLocaleString();
  saveProgram(clientId, restored, `Restored from version saved ${restoredAtLabel}`);
  return restored;
}
