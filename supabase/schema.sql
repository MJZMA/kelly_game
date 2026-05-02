-- Run once in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
-- Safe to re-run: every statement is idempotent.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('gambling', 'investment', 'mixed')),
  difficulty text not null check (difficulty in ('easy', 'hard')),
  duration_sec int not null check (duration_sec > 0),
  score int not null check (score >= 0),
  attempts int not null check (attempts >= 0),
  played_at timestamptz not null default now()
);

create index if not exists games_user_played_at_idx
  on public.games (user_id, played_at desc);

alter table public.games enable row level security;

-- Each row is visible only to the user who owns it. Even if another user knew
-- your UID they could not query your rows — auth.uid() is taken from the JWT.
drop policy if exists "users read their own games" on public.games;
create policy "users read their own games"
  on public.games for select
  using (auth.uid() = user_id);

drop policy if exists "users insert their own games" on public.games;
create policy "users insert their own games"
  on public.games for insert
  with check (auth.uid() = user_id);
