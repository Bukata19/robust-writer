-- User profiles for onboarding + personalization.
--
-- One row per auth user. The app creates a blank row on first login
-- (onboarding_completed = false) and the onboarding flow / settings fill it in.
-- Personalization from this table feeds the CHAT assistant only.

create table if not exists public.profiles (
  user_id              uuid        primary key references auth.users(id) on delete cascade,
  display_name         text,
  academic_level       text,       -- 'high_school' | 'undergraduate' | 'postgraduate'
  writing_tone         text,       -- 'formal' | 'balanced' | 'casual'
  field_of_study       text,
  custom_instructions  text,       -- app layer enforces max 600 chars
  onboarding_completed boolean     not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Keep updated_at fresh on every update.
create or replace function public.tg_profiles_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_profiles_set_updated_at();

-- RLS: users may read and write only their own row. No delete policy —
-- rows are removed via the auth.users cascade only.
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
