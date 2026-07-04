-- Per-user cache of AI-detection reports keyed by content hash, so identical
-- text returns a byte-identical report without re-running analysis or the
-- explanation model call.
--
-- Key design (from review):
--  * Composite PK (user_id, text_hash) — text_hash alone would collide across
--    users submitting identical text, breaking the second user's cache writes.
--  * scorer_version rides along and is part of the lookup predicate; the
--    version is ALSO folded into the hash input by the edge function, so a
--    formula bump automatically turns old rows into misses.
--  * Rows are immutable: select/insert/delete policies only, NO update policy,
--    which blocks cache-poisoning by overwrite. Duplicate inserts (two tabs)
--    are absorbed with ON CONFLICT DO NOTHING in the function.
--  * result jsonb stores verbatim essay excerpts, so the edge function prunes
--    the caller's rows older than 30 days on each write (mirrors the
--    self-pruning pattern of rate_limit_events).

create table if not exists public.detection_cache (
  user_id        uuid        not null references auth.users(id) on delete cascade,
  text_hash      text        not null,
  scorer_version int         not null,
  result         jsonb       not null,
  created_at     timestamptz not null default now(),
  primary key (user_id, text_hash)
);

create index if not exists idx_detection_cache_created
  on public.detection_cache (created_at);

alter table public.detection_cache enable row level security;

create policy "Users can read own detection cache"
  on public.detection_cache for select
  using (auth.uid() = user_id);

create policy "Users can insert own detection cache"
  on public.detection_cache for insert
  with check (auth.uid() = user_id);

-- Delete is needed for the retention prune; still scoped to the owner.
create policy "Users can delete own detection cache"
  on public.detection_cache for delete
  using (auth.uid() = user_id);
