-- Writing Coach: per-user coaching preferences on profiles, plus three
-- tables — sessions (one row per editor session), a cross-session pattern
-- aggregate, and a tip history log. All access is per-user via RLS
-- (auth.uid() = user_id), rows die with the user (cascade), and payload
-- columns carry size caps so a compromised client can't bloat storage.

-- ── 1. Profile columns ──────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists coach_enabled boolean not null default true,
  add column if not exists coach_mode text not null default 'balanced',
  add column if not exists coach_focus_areas text[] not null default '{}';

do $do$
begin
  alter table public.profiles
    add constraint profiles_coach_mode_check
    check (coach_mode in ('encouraging', 'balanced', 'strict'));
exception when duplicate_object then null;
end
$do$;

-- Focus areas are capped at 3 (the UI enforces it too; this is the backstop).
do $do$
begin
  alter table public.profiles
    add constraint profiles_coach_focus_areas_check
    check (coalesce(array_length(coach_focus_areas, 1), 0) <= 3);
exception when duplicate_object then null;
end
$do$;

-- ── 2. coach_sessions ───────────────────────────────────────────────────────
create table if not exists public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Sessions outlive documents (analytics survive doc deletion).
  document_id uuid references public.documents(id) on delete set null,
  session_start timestamptz not null default now(),
  session_end timestamptz,
  tips_given integer not null default 0 check (tips_given >= 0),
  tips_accepted integer not null default 0 check (tips_accepted >= 0),
  tips_skipped integer not null default 0 check (tips_skipped >= 0),
  acceptance_rate double precision generated always as (
    tips_accepted::double precision / nullif(tips_given, 0)
  ) stored,
  patterns jsonb not null default '{}'::jsonb check (pg_column_size(patterns) <= 8192),
  milestones jsonb not null default '[]'::jsonb check (pg_column_size(milestones) <= 4096),
  session_focus_areas text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_sessions enable row level security;

do $do$
begin
  create policy "Users can view own coach sessions"
    on public.coach_sessions for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end
$do$;

do $do$
begin
  create policy "Users can insert own coach sessions"
    on public.coach_sessions for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end
$do$;

do $do$
begin
  create policy "Users can update own coach sessions"
    on public.coach_sessions for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end
$do$;

do $do$
begin
  create policy "Users can delete own coach sessions"
    on public.coach_sessions for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end
$do$;

create index if not exists idx_coach_sessions_user_start
  on public.coach_sessions (user_id, session_start desc);

-- ── 3. coach_pattern_log — cross-session aggregate per (user, pattern) ──────
-- Per-session detail already lives in coach_sessions.patterns; this table is
-- the cheap cross-session rollup the coach reads to prioritize repeat issues.
create table if not exists public.coach_pattern_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern_type text not null check (char_length(pattern_type) <= 64),
  total_occurrences integer not null default 0 check (total_occurrences >= 0),
  sessions_with_pattern integer not null default 0 check (sessions_with_pattern >= 0),
  first_detected timestamptz not null default now(),
  last_detected timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, pattern_type)
);

alter table public.coach_pattern_log enable row level security;

do $do$
begin
  create policy "Users can view own pattern log"
    on public.coach_pattern_log for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end
$do$;

do $do$
begin
  create policy "Users can insert own pattern log"
    on public.coach_pattern_log for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end
$do$;

do $do$
begin
  create policy "Users can update own pattern log"
    on public.coach_pattern_log for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end
$do$;

do $do$
begin
  create policy "Users can delete own pattern log"
    on public.coach_pattern_log for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end
$do$;

-- ── 4. coach_tips_history — immutable per-tip log ───────────────────────────
-- Insert-only by design (no UPDATE policy): the user_action is final when the
-- batch is written at session end, and an immutable log can't be rewritten by
-- a compromised client.
create table if not exists public.coach_tips_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.coach_sessions(id) on delete cascade,
  tip_text text not null check (char_length(tip_text) <= 500),
  pattern_type text not null check (char_length(pattern_type) <= 64),
  category text not null check (category in ('clarity', 'conciseness', 'tone', 'structure', 'grammar')),
  confidence real not null default 0 check (confidence >= 0 and confidence <= 1),
  user_action text not null check (user_action in ('accepted', 'skipped', 'learned', 'shown')),
  created_at timestamptz not null default now()
);

alter table public.coach_tips_history enable row level security;

do $do$
begin
  create policy "Users can view own tip history"
    on public.coach_tips_history for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end
$do$;

do $do$
begin
  create policy "Users can insert own tip history"
    on public.coach_tips_history for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end
$do$;

do $do$
begin
  create policy "Users can delete own tip history"
    on public.coach_tips_history for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end
$do$;

create index if not exists idx_coach_tips_user_created
  on public.coach_tips_history (user_id, created_at desc);
create index if not exists idx_coach_tips_session
  on public.coach_tips_history (session_id);

-- ── 5. updated_at triggers (same pattern as profiles) ───────────────────────
create or replace function public.tg_coach_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coach_sessions_set_updated_at on public.coach_sessions;
create trigger coach_sessions_set_updated_at
  before update on public.coach_sessions
  for each row execute function public.tg_coach_set_updated_at();

drop trigger if exists coach_pattern_log_set_updated_at on public.coach_pattern_log;
create trigger coach_pattern_log_set_updated_at
  before update on public.coach_pattern_log
  for each row execute function public.tg_coach_set_updated_at();
