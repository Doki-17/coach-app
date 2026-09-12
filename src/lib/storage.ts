// Local-first data layer for clients, programs, and per-client program history (audit log).
// Everything here is backed by localStorage. No network/backend involved yet -
// if/when this app grows a real backend (e.g. Supabase), this module's functions
// are the seam to swap out.

export interface ExerciseRow {
  id: string;
  name: string;
  tempo: string;
  w1: string;
  w2: string;
  w3: string;
  w4: string;
  rest: string;
}

export interface ProgramCategory {
  id: string;
  name: string;
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
      exercises: [
        { id: 'default-ex-1', name: 'Single Leg Front Jump', tempo: 'X', w1: '2x10', w2: '2x12', w3: '2x14', w4: '1x14', rest: '30s' },
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
  return read<ProgramData>(programKey(clientId), cloneProgram(DEFAULT_PROGRAM));
}

/** Returns the client's audit log of past program versions, newest first. */
export function getHistory(clientId: string): ProgramVersion[] {
  return read<ProgramVersion[]>(historyKey(clientId), []);
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
