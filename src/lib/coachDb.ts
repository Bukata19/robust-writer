// Typed access to the coach tables. The generated Supabase types file is
// Lovable-managed and doesn't include tables added by raw migrations (same as
// detection_cache before it), so this module owns the row types locally and
// funnels every query through one untyped client cast. RLS scopes all of it
// to the signed-in user; user_id is still set explicitly on writes so a row
// can never be attributed to anyone else even if a policy regresses.

import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Single confined cast — the rest of the module is fully typed.
const db = supabase as unknown as SupabaseClient;

export interface CoachSessionRow {
  id: string;
  user_id: string;
  document_id: string | null;
  session_start: string;
  session_end: string | null;
  tips_given: number;
  tips_accepted: number;
  tips_skipped: number;
  acceptance_rate: number | null;
  patterns: Record<string, number>;
  milestones: string[];
  session_focus_areas: string[];
}

export interface CoachPatternAggRow {
  user_id: string;
  pattern_type: string;
  total_occurrences: number;
  sessions_with_pattern: number;
  first_detected: string;
  last_detected: string;
}

export interface CoachTipRow {
  id?: string;
  user_id: string;
  session_id: string;
  tip_text: string;
  pattern_type: string;
  category: string;
  confidence: number;
  user_action: string;
  created_at?: string;
}

export async function createCoachSession(
  userId: string,
  documentId: string | null,
  focusAreas: string[],
): Promise<string | null> {
  const { data, error } = await db
    .from('coach_sessions')
    .insert({
      user_id: userId,
      document_id: documentId,
      session_focus_areas: focusAreas,
    })
    .select('id')
    .single();
  if (error) return null;
  return (data as { id: string }).id;
}

export interface SessionCloseData {
  tipsGiven: number;
  tipsAccepted: number;
  tipsSkipped: number;
  patterns: Record<string, number>;
  milestones: string[];
}

export async function closeCoachSession(
  sessionId: string,
  close: SessionCloseData,
): Promise<boolean> {
  const { error } = await db
    .from('coach_sessions')
    .update({
      session_end: new Date().toISOString(),
      tips_given: close.tipsGiven,
      tips_accepted: close.tipsAccepted,
      tips_skipped: close.tipsSkipped,
      patterns: close.patterns,
      milestones: close.milestones,
    })
    .eq('id', sessionId);
  return !error;
}

/**
 * Fold a finished session's pattern counts into the per-user aggregate.
 * Read-merge-upsert: coach data is single-writer (one user, one tab in
 * practice), so a lost update only costs a count, never correctness.
 */
export async function upsertPatternAggregates(
  userId: string,
  patterns: Record<string, number>,
): Promise<void> {
  const types = Object.keys(patterns);
  if (types.length === 0) return;
  const { data } = await db
    .from('coach_pattern_log')
    .select('pattern_type, total_occurrences, sessions_with_pattern, first_detected')
    .eq('user_id', userId)
    .in('pattern_type', types);
  const existing = new Map(
    ((data ?? []) as CoachPatternAggRow[]).map((r) => [r.pattern_type, r]),
  );
  const now = new Date().toISOString();
  const rows = types.map((t) => {
    const prev = existing.get(t);
    return {
      user_id: userId,
      pattern_type: t,
      total_occurrences: (prev?.total_occurrences ?? 0) + patterns[t],
      sessions_with_pattern: (prev?.sessions_with_pattern ?? 0) + 1,
      first_detected: prev?.first_detected ?? now,
      last_detected: now,
    };
  });
  await db.from('coach_pattern_log').upsert(rows, { onConflict: 'user_id,pattern_type' });
}

export async function insertTipHistory(rows: CoachTipRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.from('coach_tips_history').insert(rows);
}

export async function getRecentSessions(
  userId: string,
  limit = 10,
): Promise<CoachSessionRow[]> {
  const { data, error } = await db
    .from('coach_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('session_end', 'is', null)
    .order('session_start', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as CoachSessionRow[];
}

export async function getPatternAggregates(userId: string): Promise<CoachPatternAggRow[]> {
  const { data, error } = await db
    .from('coach_pattern_log')
    .select('*')
    .eq('user_id', userId)
    .order('total_occurrences', { ascending: false });
  if (error) return [];
  return (data ?? []) as CoachPatternAggRow[];
}

export async function getSessionsInRange(
  userId: string,
  from: Date,
  to: Date,
): Promise<CoachSessionRow[]> {
  const { data, error } = await db
    .from('coach_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('session_start', from.toISOString())
    .lte('session_start', to.toISOString())
    .order('session_start', { ascending: true });
  if (error) return [];
  return (data ?? []) as CoachSessionRow[];
}

export async function getTipsInRange(
  userId: string,
  from: Date,
  to: Date,
): Promise<CoachTipRow[]> {
  const { data, error } = await db
    .from('coach_tips_history')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as CoachTipRow[];
}
