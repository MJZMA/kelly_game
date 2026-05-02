// Supabase project config — fill these in after creating your Supabase project.
//
// 1. Create a free project at https://supabase.com/dashboard
// 2. Project Settings → API → copy "Project URL" and "anon / public" key below.
// 3. Authentication → Providers → enable Google. (Use your own Google OAuth client,
//    or for quick local testing accept Supabase's prompt to use a shared one.)
// 4. SQL editor → run the contents of `supabase/schema.sql`.
// 5. Set OWNER_EMAIL to the Google account email you sign in with.
//
// The anon key is safe to commit — data is isolated server-side via row-level security.

export const SUPABASE_URL = 'YOUR_SUPABASE_URL';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Only this email's games are recorded to the DB and shown on the dashboard.
// Other visitors can play but get localStorage-only (existing behavior).
export const OWNER_EMAIL = 'YOUR_EMAIL@example.com';
