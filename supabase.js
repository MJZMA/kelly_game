// Lazy-loads the Supabase JS SDK from a CDN. Dynamic import so the game still
// boots offline when the SDK can't be fetched — DB features just become no-ops.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const isSupabaseConfigured =
  typeof SUPABASE_URL === 'string' &&
  SUPABASE_URL.length > 0 &&
  !SUPABASE_URL.startsWith('YOUR_');

let _client = null;
let _loadPromise = null;

export async function getSupabase() {
  if (!isSupabaseConfigured) return null;
  if (_client) return _client;
  if (!_loadPromise) {
    _loadPromise = import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) => {
        _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
        });
        // Diagnostic: log every auth event so we can see exactly what's happening
        // during OAuth redirect / session restore.
        _client.auth.onAuthStateChange((event, session) => {
          console.log('[auth]', event, session?.user?.email ?? '(no session)');
        });
        return _client;
      })
      .catch((err) => {
        console.warn('Supabase SDK failed to load (offline?)', err);
        _loadPromise = null;
        return null;
      });
  }
  return _loadPromise;
}
