// Supabase-backed data layer for clients, programs, and per-client program
// history (audit log). Replaces the earlier localStorage-only version -
// see the project's ERD/schema notes for the table shapes this maps to.
//
// Design note: `programs.data` (jsonb) holds only `{ weeks, categories }`,
// not the whole ProgramData - title/startDate/endDate are real columns on
// `programs` so they stay queryable. `program_versions.program_snapshot`
// (jsonb) holds the FULL ProgramData per version, since history is an
// immutable audit log, not something queried piecemeal. Keeping the
// weeks/categories shape inside jsonb (rather than further-normalized
// tables) is deliberate: the modular block-based program redesign discussed
// separately would replace that shape entirely, and jsonb absorbs that
// kind of change in application code instead of a schema migration.

import { supabase } from './supabaseClient';
import { LEGACY_CATEGORY_TYPE_ID } from './categoryTypes';

export interface ExerciseRow {
  id: string;
  name: string;
  /** Values for this row's fixed (non-progression) columns, keyed by column id - e.g. `{ sets: '3', rest: '60s' }`. */
  fixed: Record<string, string>;
  /** One value-bag per program week, keyed by that category type's progression column id(s) - e.g. `[{ set: '3', rep: '10' }, ...]`. Empty array if the category type has no progression columns. */
  progression: Record<string, string>[];
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
  /** Whether this week's calendar shows a second (PM) row per day. Off by default - most days are one session; a coach turns it on for a week that has any double-session days. */
  showPm: boolean;
}

export interface ProgramData {
  title: string;
  /** Optional program date range, e.g. the month this program covers - ISO date strings (yyyy-mm-dd) from a date input, or '' if not set. Shown above the calendar and included in PNG/PDF exports. */
  startDate: string;
  endDate: string;
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
  /** The client's own email - mainly so the coach knows where to send their invite link (see inviteToken). No longer used to auto-match a signup; claiming is invite-link-based now. */
  email: string;
  /** Random per-client token used in that client's personal invite link - see buildInviteUrl/claimInvite. Generated automatically when the client is created. */
  inviteToken: string;
  /** When the client account first claimed this profile via their invite link, or null if they haven't yet. Informational only - claiming itself is enforced server-side by the claim_invite() RPC. */
  inviteClaimedAt: string | null;
  lastUpdated: string | null; // ISO timestamp of the last program save, null if never saved
  /** The client's own notification preferences (currently just email on/off - see NotificationSettings). */
  notificationSettings: NotificationSettings;
  /**
   * Archiving flag, set by the coach from the Dashboard client card. 'active'
   * by default. 'inactive' means: the client's own hub page shows their
   * program as blank/empty (nothing is deleted - see setClientStatus), and
   * the coach's hub page for them becomes view-only (History/Export/View
   * still work, but New Program/Edit Program/Restore are locked until
   * they're set back to active).
   */
  status: ClientStatus;
}

export type ClientStatus = 'active' | 'inactive';

/** Fields needed to create a client. Only `nickname` is required. */
export interface NewClientInput {
  nickname: string;
  firstName?: string;
  lastName?: string;
  weightKg?: number | null;
  heightCm?: number | null;
  location?: string;
  remarks?: string;
  email?: string;
}

export interface ProgramVersion {
  id: string;
  clientId: string;
  timestamp: string; // ISO
  note: string;
  program: ProgramData;
}

// --- Program migration -----------------------------------------------------
// The jsonb blobs (`programs.data`, `program_versions.program_snapshot`)
// have gone through a couple of shapes historically (from the localStorage
// era). normalizeProgram upgrades all of the above so older saved data keeps
// loading and rendering correctly even if it predates a given field.

interface StoredExerciseRow {
  id: string;
  name?: string;
  fixed?: Record<string, string>;
  progression?: unknown;
  // Legacy (pre-category-types) shape
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

interface StoredProgramWeek {
  id: number;
  am?: string[];
  pm?: string[];
  showPm?: boolean;
}

interface StoredProgramData {
  title?: string;
  startDate?: string;
  endDate?: string;
  weeks?: StoredProgramWeek[];
  categories?: StoredProgramCategory[];
}

function normalizeProgression(raw: unknown): Record<string, string>[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (entry && typeof entry === 'object') return entry as Record<string, string>;
    // Older shape: a plain string per week (single anonymous progression field).
    return { value: typeof entry === 'string' ? entry : '' };
  });
}

function normalizeExerciseRow(raw: StoredExerciseRow): ExerciseRow {
  if (raw.fixed || raw.progression) {
    return {
      id: raw.id,
      name: raw.name ?? '',
      fixed: raw.fixed ?? {},
      progression: normalizeProgression(raw.progression),
    };
  }
  // Original (pre-category-types) shape - preserve tempo/w1-4/rest exactly as before.
  return {
    id: raw.id,
    name: raw.name ?? '',
    fixed: { tempo: raw.tempo ?? '', rest: raw.rest ?? '' },
    progression: [raw.w1 ?? '', raw.w2 ?? '', raw.w3 ?? '', raw.w4 ?? ''].map((v) => ({ value: v })),
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

function normalizeWeek(raw: StoredProgramWeek): ProgramWeek {
  const am = raw.am ?? Array(7).fill('');
  const pm = raw.pm ?? Array(7).fill('');
  return {
    id: raw.id,
    am,
    pm,
    showPm: raw.showPm ?? pm.some((v) => v.trim() !== ''),
  };
}

function normalizeProgram(raw: StoredProgramData): ProgramData {
  return {
    title: raw.title ?? '',
    startDate: raw.startDate ?? '',
    endDate: raw.endDate ?? '',
    weeks: (raw.weeks ?? []).map(normalizeWeek),
    categories: (raw.categories ?? []).map(normalizeCategory),
  };
}

// Title is intentionally blank - the editor shows a "[Insert program title]"
// placeholder so the coach names each new program themselves.
export const DEFAULT_PROGRAM: ProgramData = {
  title: '',
  startDate: '',
  endDate: '',
  weeks: [{ id: 1, am: Array(7).fill(''), pm: Array(7).fill(''), showPm: false }],
  categories: [],
};

export function cloneProgram(program: ProgramData): ProgramData {
  return JSON.parse(JSON.stringify(program));
}

/**
 * Structural equality check between two programs - used to tell whether a
 * coach actually changed anything before writing a new audit log entry, and
 * to detect unsaved changes when leaving the editor.
 */
export function programsEqual(a: ProgramData, b: ProgramData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// --- row <-> app-shape mapping ----------------------------------------------

interface ClientRow {
  id: string;
  coach_id: string;
  client_user_id: string | null;
  nickname: string;
  first_name: string;
  last_name: string;
  weight_kg: number | null;
  height_cm: number | null;
  location: string;
  remarks: string;
  email: string | null;
  invite_token: string;
  invite_claimed_at: string | null;
  last_updated: string | null;
  created_at: string;
  notification_settings: unknown;
  status: string | null;
}

function rowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    nickname: row.nickname,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    weightKg: row.weight_kg,
    heightCm: row.height_cm,
    location: row.location ?? '',
    remarks: row.remarks ?? '',
    email: row.email ?? '',
    inviteToken: row.invite_token,
    inviteClaimedAt: row.invite_claimed_at,
    lastUpdated: row.last_updated,
    notificationSettings: parseNotificationSettings(row.notification_settings),
    status: row.status === 'inactive' ? 'inactive' : 'active',
  };
}

interface ProgramRow {
  id: string;
  client_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  data: { weeks?: StoredProgramWeek[]; categories?: StoredProgramCategory[] } | null;
  updated_at: string;
}

function rowToProgram(row: ProgramRow): ProgramData {
  return normalizeProgram({
    title: row.title ?? '',
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? '',
    weeks: row.data?.weeks,
    categories: row.data?.categories,
  });
}

function programToRow(program: ProgramData) {
  return {
    title: program.title,
    start_date: program.startDate || null,
    end_date: program.endDate || null,
    data: { weeks: program.weeks, categories: program.categories },
  };
}

interface ProgramVersionRow {
  id: string;
  client_id: string;
  timestamp: string;
  note: string;
  program_snapshot: StoredProgramData;
}

function rowToVersion(row: ProgramVersionRow): ProgramVersion {
  return {
    id: row.id,
    clientId: row.client_id,
    timestamp: row.timestamp,
    note: row.note,
    program: normalizeProgram(row.program_snapshot),
  };
}

async function getCurrentUser(): Promise<{ id: string; email: string | undefined }> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not signed in.');
  return { id: data.user.id, email: data.user.email };
}

// --- Clients -----------------------------------------------------------

/** Returns the signed-in coach's clients. Relies on RLS to scope this to "my" clients, plus an explicit filter for clarity. */
export async function getClients(): Promise<Client[]> {
  const { id: coachId } = await getCurrentUser();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ClientRow[]).map(rowToClient);
}

export async function createClient(input: NewClientInput): Promise<Client> {
  const { id: coachId } = await getCurrentUser();
  const { data, error } = await supabase
    .from('clients')
    .insert({
      coach_id: coachId,
      nickname: input.nickname.trim(),
      first_name: input.firstName?.trim() ?? '',
      last_name: input.lastName?.trim() ?? '',
      weight_kg: input.weightKg ?? null,
      height_cm: input.heightCm ?? null,
      location: input.location?.trim() ?? '',
      remarks: input.remarks?.trim() ?? '',
      email: input.email?.trim() ?? '',
    })
    .select()
    .single();
  if (error) throw error;
  return rowToClient(data as ClientRow);
}

export async function getClient(clientId: string): Promise<Client | undefined> {
  const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (error) throw error;
  return data ? rowToClient(data as ClientRow) : undefined;
}

/** Updates an existing client's profile fields. A blank nickname is ignored (existing nickname kept), matching the form's own "nickname required" rule. */
export async function updateClient(clientId: string, input: NewClientInput): Promise<Client | null> {
  const nickname = input.nickname.trim();
  const { data, error } = await supabase
    .from('clients')
    .update({
      nickname: nickname || undefined,
      first_name: input.firstName?.trim() ?? '',
      last_name: input.lastName?.trim() ?? '',
      weight_kg: input.weightKg ?? null,
      height_cm: input.heightCm ?? null,
      location: input.location?.trim() ?? '',
      remarks: input.remarks?.trim() ?? '',
      email: input.email?.trim() ?? '',
    })
    .eq('id', clientId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? rowToClient(data as ClientRow) : null;
}

/**
 * Flips a client between active and inactive (see the `status` doc on
 * `Client`). Only touches the `status` column - the client's profile,
 * saved program, and full history are completely untouched either way, so
 * reactivating puts things back exactly as they were.
 */
export async function setClientStatus(clientId: string, status: ClientStatus): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .update({ status })
    .eq('id', clientId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? rowToClient(data as ClientRow) : null;
}

async function touchClient(clientId: string, timestamp: string): Promise<void> {
  const { error } = await supabase.from('clients').update({ last_updated: timestamp }).eq('id', clientId);
  if (error) throw error;
}

// --- Programs + history --------------------------------------------------

const MAX_HISTORY_PER_CLIENT = 200;

/** Returns the client's current program, or a blank default template if they don't have one yet. */
export async function getProgram(clientId: string): Promise<ProgramData> {
  const { data, error } = await supabase.from('programs').select('*').eq('client_id', clientId).maybeSingle();
  if (error) throw error;
  if (!data) return cloneProgram(DEFAULT_PROGRAM);
  return rowToProgram(data as ProgramRow);
}

/** Returns the client's audit log of past program versions, newest first. */
export async function getHistory(clientId: string): Promise<ProgramVersion[]> {
  const { data, error } = await supabase
    .from('program_versions')
    .select('*')
    .eq('client_id', clientId)
    .order('timestamp', { ascending: false })
    .limit(MAX_HISTORY_PER_CLIENT);
  if (error) throw error;
  return (data as ProgramVersionRow[]).map(rowToVersion);
}

/** Saves `program` as the client's current program and appends a new audit log entry for it. */
export async function saveProgram(clientId: string, program: ProgramData, note = 'Saved'): Promise<ProgramVersion> {
  const timestamp = new Date().toISOString();

  const { error: upsertError } = await supabase
    .from('programs')
    .upsert({ client_id: clientId, ...programToRow(program), updated_at: timestamp }, { onConflict: 'client_id' });
  if (upsertError) throw upsertError;

  await touchClient(clientId, timestamp);

  const { data, error } = await supabase
    .from('program_versions')
    .insert({
      client_id: clientId,
      timestamp,
      note,
      program_snapshot: cloneProgram(program),
    })
    .select()
    .single();
  if (error) throw error;

  return rowToVersion(data as ProgramVersionRow);
}

/**
 * Rolls the client's current program back to a past version. This overwrites
 * whatever is currently saved (any unsaved edits in an open editor are not
 * preserved) and logs the restore as a new audit log entry, so restoring is
 * itself auditable.
 */
export async function restoreVersion(clientId: string, versionId: string): Promise<ProgramData | null> {
  const { data, error } = await supabase
    .from('program_versions')
    .select('*')
    .eq('id', versionId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const version = rowToVersion(data as ProgramVersionRow);
  const restored = cloneProgram(version.program);
  const restoredAtLabel = new Date(version.timestamp).toLocaleString();
  await saveProgram(clientId, restored, `Restored from version saved ${restoredAtLabel}`);
  return restored;
}

// --- Client notifications --------------------------------------------------
// A row lands here automatically (via a DB trigger on program_versions -
// see the migration SQL) every time a coach saves a new version of a
// client's program - a real edit, a fresh "New Program", or a restore.
// Purely client-facing: a coach never reads this table.

export interface ClientNotification {
  id: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

interface NotificationRow {
  id: string;
  client_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

function rowToNotification(row: NotificationRow): ClientNotification {
  return {
    id: row.id,
    message: row.message,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

/** This client's notifications, newest first. RLS scopes this to the signed-in client's own profile. */
export async function getNotifications(clientId: string): Promise<ClientNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as NotificationRow[]).map(rowToNotification);
}

/** Marks all of this client's unread notifications as read - call this when they open the notification bell. */
export async function markNotificationsRead(clientId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .is('read_at', null);
  if (error) throw error;
}

/**
 * A client's own notification preferences - stored as jsonb on their row so
 * more settings (push, digest frequency, etc.) can be added later without a
 * new migration. Email notifications aren't actually sent anywhere yet
 * (that's a future Resend integration) - this just lets a client opt in
 * ahead of time.
 */
export interface NotificationSettings {
  emailEnabled: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = { emailEnabled: false };

function parseNotificationSettings(raw: unknown): NotificationSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_NOTIFICATION_SETTINGS;
  const obj = raw as Record<string, unknown>;
  return { emailEnabled: obj.email_enabled === true };
}

/**
 * Updates the signed-in client's own notification settings via the
 * update_notification_settings() RPC (security definer, same pattern as
 * claim_invite) - it only ever touches the notification_settings column on
 * the caller's own client row, never anyone else's and nothing else on it.
 */
export async function updateNotificationSettings(emailEnabled: boolean): Promise<NotificationSettings> {
  const { data, error } = await supabase.rpc('update_notification_settings', { p_email_enabled: emailEnabled });
  if (error) throw error;
  return parseNotificationSettings((data as ClientRow).notification_settings);
}

/**
 * For a signed-in CLIENT account: returns the client profile linked to
 * them (client_user_id = this account), or null if they haven't claimed
 * one yet. Claiming itself happens once, via their personal invite link -
 * see claimInvite() and pages/InvitePage.tsx - not automatically here.
 */
export async function getMyClientProfile(): Promise<Client | null> {
  const { id: userId } = await getCurrentUser();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('client_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToClient(data as ClientRow) : null;
}

/**
 * Links the signed-in account to the client profile that owns `token`,
 * via the `claim_invite` Postgres function (security definer, so it can
 * bypass RLS just enough to perform this one linkage check server-side -
 * see the schema notes). Safe to call again for an account that already
 * claimed this same profile; throws if the token is unknown or already
 * claimed by a different account.
 */
export async function claimInvite(token: string): Promise<Client> {
  const { data, error } = await supabase.rpc('claim_invite', { p_token: token });
  if (error) throw error;
  return rowToClient(data as ClientRow);
}

/** The personal invite link for a client - the only way that client can sign up or sign back in. Share it with them directly (it is not a public URL). */
export function buildInviteUrl(client: Pick<Client, 'inviteToken'>): string {
  return `${window.location.origin}/invite/${client.inviteToken}`;
}
