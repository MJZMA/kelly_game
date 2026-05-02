import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { OWNER_EMAIL } from './config.js';

export { isSupabaseConfigured, OWNER_EMAIL };

export async function getUser() {
  const sb = await getSupabase();
  if (!sb) return null;
  // getSession() reads from localStorage only — no network call, no exceptions
  // on flaky connections. The session object already contains the user.
  try {
    const { data } = await sb.auth.getSession();
    return data?.session?.user ?? null;
  } catch (e) {
    console.warn('getUser failed:', e);
    return null;
  }
}

export async function isOwner() {
  const user = await getUser();
  return !!user && user.email === OWNER_EMAIL;
}

export async function signInWithGoogle() {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  });
}

export async function signOut() {
  const sb = await getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

// Subscribe to sign-in / sign-out events. Returns an unsubscribe function.
export async function onAuthChange(cb) {
  const sb = await getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}
