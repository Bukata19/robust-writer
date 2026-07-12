// Global Writing Coach state: preferences (profile-backed, localStorage
// fallback while auth resolves / offline) and the current coaching session
// (CoachMemory instance + reactive counters). Server sync is batched — one
// row insert at session start, one update plus tip batch at session end —
// so typing never waits on the network.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { CoachMemory, type CoachTip, type TipAction } from '@/lib/coachMemory';
import type { PatternCategory } from '@/lib/coachPatterns';
import type { CoachMode } from '@/lib/coachTips';
import {
  createCoachSession,
  closeCoachSession,
  upsertPatternAggregates,
  insertTipHistory,
  getPatternAggregates,
  getRecentSessions,
  type CoachPatternAggRow,
  type CoachSessionRow,
} from '@/lib/coachDb';

// Legacy key (pre-profile column) is read once as the initial default.
const ENABLED_KEY = 'rb_coach_enabled';
const LEGACY_ENABLED_KEY = 'ra_coach_enabled';

export interface CoachSessionState {
  sessionId: string;
  documentId: string | null;
  tipsGiven: number;
  tipsAccepted: number;
  tipsSkipped: number;
  streak: number;
}

interface CoachContextType {
  enabled: boolean;
  mode: CoachMode;
  focusAreas: PatternCategory[];
  setEnabled: (v: boolean) => void;
  setMode: (m: CoachMode) => void;
  setFocusAreas: (areas: PatternCategory[]) => void;

  session: CoachSessionState | null;
  startSession: (documentId: string | null) => void;
  endSession: () => void;
  hasSeenTip: (text: string) => boolean;
  canShowPattern: (patternType: string) => boolean;
  nextVariantIndex: (patternType: string, variantCount: number) => number;
  wasSameTextShownRecently: (text: string) => boolean;
  recordTipShown: (tip: CoachTip) => void;
  recordTipAction: (tip: CoachTip, action: Exclude<TipAction, 'shown'>) => void;
  recordPatterns: (patterns: Record<string, number>) => void;


  aggregates: CoachPatternAggRow[];
  recentSessions: CoachSessionRow[];
  statsLoading: boolean;
  refreshStats: () => Promise<void>;
}

const CoachContext = createContext<CoachContextType | undefined>(undefined);

const readStoredEnabled = (): boolean => {
  try {
    const v = localStorage.getItem(ENABLED_KEY) ?? localStorage.getItem(LEGACY_ENABLED_KEY);
    return v !== 'false';
  } catch {
    return true;
  }
};

// Profile rows are typed from the Lovable-generated file, which doesn't know
// the coach columns yet — read them defensively.
const profileCoach = (profile: unknown) => {
  const p = (profile ?? {}) as Record<string, unknown>;
  return {
    enabled: typeof p.coach_enabled === 'boolean' ? p.coach_enabled : undefined,
    mode: typeof p.coach_mode === 'string' ? (p.coach_mode as CoachMode) : undefined,
    focusAreas: Array.isArray(p.coach_focus_areas)
      ? (p.coach_focus_areas as PatternCategory[])
      : undefined,
  };
};

export const CoachProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, profileResolved, updateProfile } = useAuth();

  const [enabled, setEnabledState] = useState<boolean>(readStoredEnabled);
  const [mode, setModeState] = useState<CoachMode>('balanced');
  const [focusAreas, setFocusAreasState] = useState<PatternCategory[]>([]);

  const memoryRef = useRef<CoachMemory | null>(null);
  const [session, setSession] = useState<CoachSessionState | null>(null);
  // Store the server-returned session ID so endSession can use the real record
  const serverSessionIdRef = useRef<string | null>(null);

  const [aggregates, setAggregates] = useState<CoachPatternAggRow[]>([]);
  const [recentSessions, setRecentSessions] = useState<CoachSessionRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Adopt profile values once resolved (server is the source of truth).
  useEffect(() => {
    if (!profileResolved || !profile) return;
    const p = profileCoach(profile);
    if (p.enabled !== undefined) setEnabledState(p.enabled);
    if (p.mode !== undefined) setModeState(p.mode);
    if (p.focusAreas !== undefined) setFocusAreasState(p.focusAreas);
  }, [profileResolved, profile]);

  const persistPrefs = useCallback(
    (fields: Record<string, unknown>) => {
      // Cast: coach columns exist in the DB but not yet in the generated types.
      void updateProfile(fields as TablesUpdate<'profiles'>);
    },
    [updateProfile],
  );

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      localStorage.setItem(ENABLED_KEY, String(v));
      localStorage.removeItem(LEGACY_ENABLED_KEY);
    } catch { /* storage unavailable */ }
    persistPrefs({ coach_enabled: v });
  }, [persistPrefs]);

  const setMode = useCallback((m: CoachMode) => {
    setModeState(m);
    persistPrefs({ coach_mode: m });
  }, [persistPrefs]);

  const setFocusAreas = useCallback((areas: PatternCategory[]) => {
    const capped = areas.slice(0, 3); // UI + DB both cap at 3
    setFocusAreasState(capped);
    persistPrefs({ coach_focus_areas: capped });
  }, [persistPrefs]);

  const syncCounters = useCallback(() => {
    const m = memoryRef.current;
    if (!m) return;
    setSession((prev) =>
      prev
        ? {
            ...prev,
            tipsGiven: m.getGivenCount(),
            tipsAccepted: m.getAcceptedCount(),
            tipsSkipped: m.getSkippedCount(),
            streak: m.getStreak(),
          }
        : prev,
    );
  }, []);

  const startSession = useCallback((documentId: string | null) => {
    if (memoryRef.current) return; // one session at a time
    const sessionId = crypto.randomUUID();
    const memory = new CoachMemory(sessionId);
    memoryRef.current = memory;
    serverSessionIdRef.current = null; // will be populated by server response
    setSession({
      sessionId,
      documentId,
      tipsGiven: 0,
      tipsAccepted: 0,
      tipsSkipped: 0,
      streak: 0,
    });
    // Server row is best-effort; offline sessions just skip the sync.
    // Pass the current focusAreas instead of an empty array.
    if (user) {
      void createCoachSession(user.id, documentId, focusAreas).then((serverId) => {
        if (serverId) {
          serverSessionIdRef.current = serverId;
        }
      });
    }
  }, [user, focusAreas]);

  const endSession = useCallback(() => {
    const memory = memoryRef.current;
    const current = session;
    memoryRef.current = null;
    setSession(null);
    if (!memory || !current) return;

    const patterns = memory.getSessionPatterns();
    const tips = memory.getTipHistory();
    const close = {
      tipsGiven: memory.getGivenCount(),
      tipsAccepted: memory.getAcceptedCount(),
      tipsSkipped: memory.getSkippedCount(),
      patterns,
      milestones: [] as string[],
    };

    if (user && serverSessionIdRef.current) {
      // Batch sync using the real server session ID, then clear local state only on success.
      // A failed sync keeps the localStorage copy (swept on sign-out regardless).
      void (async () => {
        const ok = await closeCoachSession(serverSessionIdRef.current!, close);
        if (Object.keys(patterns).length > 0) {
          await upsertPatternAggregates(user.id, patterns);
        }
        if (tips.length > 0) {
          await insertTipHistory(
            tips.map((t) => ({
              user_id: user.id,
              session_id: serverSessionIdRef.current!,
              tip_text: t.text.slice(0, 500),
              pattern_type: t.patternType,
              category: t.category,
              confidence: t.confidence,
              user_action: t.action,
            })),
          );
        }
        if (ok) memory.clear();
      })();
    }
  }, [user]);

  const hasSeenTip = useCallback(
    (text: string) => memoryRef.current?.hasSeenTip(text) ?? false,
    [],
  );

  const canShowPattern = useCallback(
    (patternType: string) => memoryRef.current?.canShowPattern(patternType) ?? true,
    [],
  );

  const nextVariantIndex = useCallback(
    (patternType: string, count: number) =>
      memoryRef.current?.nextVariantIndex(patternType, count) ?? 0,
    [],
  );

  const wasSameTextShownRecently = useCallback(
    (text: string) => memoryRef.current?.wasSameTextShownRecently(text) ?? false,
    [],
  );


  const recordTipShown = useCallback((tip: CoachTip) => {
    memoryRef.current?.recordTip(tip, 'shown');
    syncCounters();
  }, [syncCounters]);

  const recordTipAction = useCallback(
    (tip: CoachTip, action: Exclude<TipAction, 'shown'>) => {
      const m = memoryRef.current;
      if (!m) return;
      m.updateTipAction(tip.text, action);
      m.updateStreak(action === 'accepted');
      syncCounters();
    },
    [syncCounters],
  );

  const recordPatterns = useCallback((patterns: Record<string, number>) => {
    const m = memoryRef.current;
    if (!m) return;
    for (const [type, count] of Object.entries(patterns)) {
      m.recordPattern(type, count);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const [aggs, sessions] = await Promise.all([
        getPatternAggregates(user.id),
        getRecentSessions(user.id, 10),
      ]);
      setAggregates(aggs);
      setRecentSessions(sessions);
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  return (
    <CoachContext.Provider
      value={{
        enabled, mode, focusAreas, setEnabled, setMode, setFocusAreas,
        session, startSession, endSession,
        hasSeenTip, canShowPattern, nextVariantIndex, wasSameTextShownRecently,
        recordTipShown, recordTipAction, recordPatterns,

        aggregates, recentSessions, statsLoading, refreshStats,
      }}
    >
      {children}
    </CoachContext.Provider>
  );
};

export function useCoach(): CoachContextType {
  const ctx = useContext(CoachContext);
  if (!ctx) throw new Error('useCoach must be used within CoachProvider');
  return ctx;
}
