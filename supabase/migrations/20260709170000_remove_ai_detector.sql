-- Remove the AI Detector / plagiarism checker feature entirely. The Writing
-- Coach replaces it. Everything here is guarded so the migration is safe to
-- re-run and safe on stacks where pg_cron was never available.

-- 1. Unschedule the nightly detection_cache prune job (if pg_cron is present
--    and the job exists). Best-effort: a failure here must not abort the chain.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule(jobid)
        from cron.job
       where jobname = 'detection-cache-prune';
    exception when others then
      raise notice 'could not unschedule detection-cache-prune (%) — remove it manually if it exists', sqlerrm;
    end;
  end if;
end
$do$;

-- 2. Drop the detection cache table (per-user scan cache; derived data only).
drop table if exists public.detection_cache;

-- 3. Drop the persisted score columns from documents (derived data only —
--    recomputable feature output, no user-authored content is lost).
alter table public.documents drop column if exists plagiarism_score;
alter table public.documents drop column if exists plagiarism_data;
