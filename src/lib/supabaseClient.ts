// Single shared Supabase client for the app. storage.ts and auth.ts both
// import this rather than creating their own client.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseKey = import.meta.env.SUPABASE_PUBLISH_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_PUBLISH_KEY in .env (see .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
