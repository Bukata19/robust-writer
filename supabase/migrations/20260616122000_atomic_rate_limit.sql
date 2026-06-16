-- Make public.check_rate_limit atomic under concurrent calls.
--
-- The previous version counted rows and then inserted in two separate steps, so
-- a burst of simultaneous requests from the same user could all read a count
-- below the limit before any of them inserted — letting the effective rate
-- exceed the configured limit. Taking a transaction-scoped advisory lock keyed
-- on (user, fn) serializes concurrent calls for that key, so the count-then-
-- insert pair is effectively atomic. The lock is released automatically when
-- the function's transaction commits.

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

  -- Serialize concurrent checks for this (user, fn) so the count and insert
  -- below behave atomically. Held until this transaction commits.
  perform pg_advisory_xact_lock(hashtext(v_uid::text || ':' || p_fn)::bigint);

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

-- create or replace preserves existing privileges, but re-assert them so the
-- grant state is unambiguous if this migration is applied standalone.
revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to authenticated;
