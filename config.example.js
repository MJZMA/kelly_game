// Template — copy this file to `config.js` and fill in your own values.
// `config.js` is gitignored; this template is what's committed to the repo.
//
// 1. Create a free project at https://supabase.com/dashboard
// 2. Run `supabase/schema.sql` in the SQL editor.
// 3. Authentication → Providers → enable Google.
// 4. Project Settings → API → copy "Project URL" and the publishable key below.
// 5. Set OWNER_EMAIL to the Google account email you sign in with.
//
// The publishable key is safe to share — RLS is what protects your data.

export const SUPABASE_URL = 'YOUR_SUPABASE_URL';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';

// Only this email's games are recorded to the DB and shown on the dashboard.
// Other visitors can play but get localStorage-only (existing behavior).
export const OWNER_EMAIL = 'YOUR_EMAIL@example.com';
