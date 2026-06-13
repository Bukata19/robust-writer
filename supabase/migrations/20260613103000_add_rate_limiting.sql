-- Per-user, per-function rate limiting for the AI edge functions.
--
-- A single SECURITY DEFINER function owns all access to the backing table so
-- callers can neither read nor tamper with their counters; RLS is enabled with
-- no policies, which denies every client role direct access. Edge functions
-- invoke public.check_rate_limit(...) on the user-scoped client; auth.uid()
-- inside the function identifies the caller from their JWT.

create table if not exists public.rate_limit_events (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null,
  fn         text        not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_events_lookup
  on public.rate_limit_events (user_id, fn, created_at desc);

-- Lock the table down: RLS on, no policies => no direct access for anon /
-- authenticated. Only the SECURITY DEFINER function below can touch it.
alter table public.rate_limit_events enable row level security;

create or replace function public.check_rate_limit(
  p_fn             text,
  p_limit          int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
begin
  -- Unauthenticated callers can never pass.
  if v_uid is null then
    return false;
  end if;

  -- Keep the table bounded: drop this user's rows older than an hour.
  delete from public.rate_limit_events
   where user_id = v_uid
     and created_at < now() - interval '1 hour';

  select count(*) into v_count
    from public.rate_limit_events
   where user_id = v_uid
     and fn = p_fn
     and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return false;            -- over the limit; deny
  end if;

  insert into public.rate_limit_events (user_id, fn) values (v_uid, p_fn);
  return true;               -- within the limit; allow
end;
$$;

-- Only authenticated users may invoke the limiter.
revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to authenticated;
