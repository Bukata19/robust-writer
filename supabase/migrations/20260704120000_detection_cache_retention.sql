-- Guaranteed 30-day retention for detection_cache (review follow-up).
--
-- The edge function's write-path prune only fires when a user scans again, so
-- an inactive user's cached reports (verbatim essay excerpts) could outlive
-- the documented 30-day window. This schedules a nightly cross-user sweep via
-- pg_cron. The whole block is guarded: on stacks where pg_cron isn't
-- available, it silently skips instead of aborting the migration (an aborted
-- migration would block every later one in the sync), and retention falls
-- back to the existing write-path prune.
--
-- The cross-user delete (no user filter) is served by the existing
-- idx_detection_cache_created index. The job is created by the migration role
-- (table owner), which bypasses RLS — required, since RLS policies only allow
-- users to delete their own rows.

do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';

    -- Replace any previous schedule with this name so re-running the
    -- migration can't stack duplicate jobs.
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'detection-cache-prune';

    perform cron.schedule(
      'detection-cache-prune',
      '17 3 * * *',  -- daily, 03:17 UTC
      $job$ delete from public.detection_cache where created_at < now() - interval '30 days' $job$
    );
  else
    raise notice 'pg_cron unavailable — detection_cache retention falls back to the write-path prune';
  end if;
end
$do$;
