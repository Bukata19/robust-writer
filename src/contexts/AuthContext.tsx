import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { clearOfflineDocs } from '@/lib/offlineDocCache';
import { clearAllLocalDrafts } from '@/lib/localDraft';
import { clearAllCoachSessions } from '@/lib/coachMemory';
import { sweepLocalStorageKeysWithPrefix } from '@/lib/storageSweep';
import { DASHBOARD_TOUR_KEY, EDITOR_TOUR_KEY } from '@/hooks/useIntroTour';
import { toast } from 'sonner';

const REMEMBER_KEY = 'rb_remember_me';

export type Profile = Tables<'profiles'>;

/** Max length for custom AI instructions, enforced in the app layer. */
export const CUSTOM_INSTRUCTIONS_MAX = 600;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  /** True once the profile load has settled (success, no-row-created, or
      terminal failure). Lets consumers distinguish "still loading" from
      "failed — profile is null for this session". */
  profileResolved: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (fields: TablesUpdate<'profiles'>) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileResolved, setProfileResolved] = useState(false);
  // Scoped to this component instance — avoids module-level mutable state.
  const isManualSignOutRef = React.useRef(false);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        // Only surface an "expired" message for involuntary sign-outs (token
        // expiry or sign-out from another tab) — not for a deliberate logout.
        if (!isManualSignOutRef.current) {
          toast.error('Your session has expired. Please sign in again.');
        }
        isManualSignOutRef.current = false;
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // If rememberMe is false, sign out when the browser tab closes. This is
  // necessarily best-effort: the page is unloading, so the request can't be
  // awaited. Mark it as intentional so any SIGNED_OUT that does fire isn't
  // misreported as an expired session.
  useEffect(() => {
    const handleUnload = () => {
      if (localStorage.getItem(REMEMBER_KEY) === 'false') {
        isManualSignOutRef.current = true;
        void supabase.auth.signOut();
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // Load the user's profile once per login; create a blank row on first login
  // so onboarding_completed=false drives the onboarding flow for new AND
  // existing users who predate the profiles table.
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileResolved(false);
      return;
    }
    let cancelled = false;
    setProfileResolved(false);

    // Fetch with retry: transient errors (network blip, cold PWA start) used
    // to be swallowed silently, leaving profile null for the whole session
    // and suppressing every onboarding surface. Retry twice with backoff,
    // then settle — consumers can see the load resolved via profileResolved.
    const fetchProfile = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled || !error) return { data, error: null };
        if (attempt === 2) {
          console.error('profile load failed:', error.message);
          return { data: null, error };
        }
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1) * 2));
        if (cancelled) return { data: null, error };
      }
      return { data: null, error: null };
    };

    const load = async () => {
      // profileResolved is settled in `finally` so no path — including an
      // unexpected throw from the insert/refetch below — can leave consumers
      // stuck in a permanent "still loading" state.
      try {
        const { data, error } = await fetchProfile();
        if (cancelled) return;

        if (data) {
          setProfile(data);
          return;
        }
        if (error) {
          // Terminal failure — settle with a null profile rather than looking
          // permanently "still loading".
          setProfile(null);
          return;
        }

        // No row yet — create a blank one. On a duplicate-key race (two tabs),
        // fall through to a re-fetch so both tabs converge on the same row.
        const { data: created } = await supabase
          .from('profiles')
          .insert({ user_id: user.id })
          .select('*')
          .single();
        if (cancelled) return;

        if (created) {
          setProfile(created);
        } else {
          const { data: refetched } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          if (!cancelled) setProfile(refetched ?? null);
        }
      } catch (err) {
        console.error('profile load failed unexpectedly:', err);
        if (!cancelled) setProfile(null);
      } finally {
        // A cancelled run must not stamp state owned by the newer effect run.
        if (!cancelled) setProfileResolved(true);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setProfile(data);
  };

  const updateProfile = async (fields: TablesUpdate<'profiles'>) => {
    if (!user) return { error: new Error('Not signed in') };
    // Defensive app-layer cap regardless of caller.
    const sanitized = { ...fields };
    if (typeof sanitized.custom_instructions === 'string') {
      sanitized.custom_instructions = sanitized.custom_instructions.slice(0, CUSTOM_INSTRUCTIONS_MAX);
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(sanitized)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (!error && data) setProfile(data);
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string, rememberMe: boolean = true) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      localStorage.setItem(REMEMBER_KEY, rememberMe ? 'true' : 'false');
    }
    return { error: error as Error | null };
  };

  const signOut = async () => {
    isManualSignOutRef.current = true;
    localStorage.removeItem(REMEMBER_KEY);
    // Offline caches hold full document text + drafts. Purge them on sign-out
    // so a shared/library machine never leaves one user's writing readable to
    // the next person who signs in.
    clearOfflineDocs();
    clearAllLocalDrafts();
    // Coach session memory and decoded-assignment state carry the user's
    // writing patterns and assignment text — per-user data, same sweep.
    clearAllCoachSessions();
    sweepLocalStorageKeysWithPrefix('rb_decoder_');
    // Onboarding/tour state is also per-user: sweep it so the next account on
    // this browser gets its own onboarding modal and tours instead of
    // inheriting the previous user's "already seen" flags.
    localStorage.removeItem(DASHBOARD_TOUR_KEY);
    localStorage.removeItem(EDITOR_TOUR_KEY);
    sessionStorage.removeItem('rb_onboarding_autoshown');
    sessionStorage.removeItem('rb_onboarding_banner_dismissed');
    await supabase.auth.signOut();
  };

  // Sends a password-reset email; the link lands the user on /reset-password.
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  // Updates the password for the currently authenticated (incl. recovery) session.
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider
      value={{ session, user, loading, profile, profileResolved, refreshProfile, updateProfile, signUp, signIn, signOut, resetPassword, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
  
