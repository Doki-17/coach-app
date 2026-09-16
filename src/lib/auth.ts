// Real authentication via Supabase Auth (email + password) for coaches.
//
// `Role` below is a separate, purely local UI concern - which interface
// (coach dashboard vs. the client-preview picker) is currently showing. It
// is NOT a security boundary: the actual access control is Supabase's Row
// Level Security policies on the `clients`/`programs`/`program_versions`
// tables, keyed off the signed-in user's id (see storage.ts). A coach only
// ever ends up with role 'coach' as a side effect of a successful sign-in
// (see pages/Login.tsx), so in practice the two stay in sync.
//
// There's no real per-client login yet - "Continue as Client" (ClientHome)
// is still the placeholder it always was, picking a client profile from
// whichever coach happens to be signed in in this browser. See the ERD
// discussion this app's project notes reference: `clients.client_user_id`
// is already in the schema, nullable, ready for real client accounts later.
import { supabase } from './supabaseClient';

export type Role = 'coach' | 'client';

const ROLE_KEY = 'coachapp.role';

export function getRole(): Role | null {
  const value = localStorage.getItem(ROLE_KEY);
  return value === 'coach' || value === 'client' ? value : null;
}

export function setRole(role: Role): void {
  localStorage.setItem(ROLE_KEY, role);
}

/**
 * Creates a new account with the given role and name. Depending on the
 * Supabase project's auth settings, the account may need email
 * confirmation before signIn works - if so, signUp returns
 * confirmedImmediately: false and the caller should tell the person to
 * check their email. Role/first_name/last_name are passed as user
 * metadata, which the "handle_new_user" DB trigger reads to populate the
 * new profiles row.
 */
export async function signUp(
  email: string,
  password: string,
  role: Role,
  firstName: string,
  lastName: string
): Promise<{ confirmedImmediately: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, first_name: firstName, last_name: lastName } },
  });
  if (error) throw error;
  return { confirmedImmediately: Boolean(data.session) };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** The signed-in user's role, from their profiles row. */
export async function getMyRole(): Promise<Role> {
  const { data, error } = await supabase.from('profiles').select('role').single();
  if (error) throw error;
  return data.role as Role;
}

/** Signs out of Supabase and clears the local role flag. */
export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  localStorage.removeItem(ROLE_KEY);
}
