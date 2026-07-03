import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { clearOfflineDocs } from '@/lib/offlineDocCache';
import { clearAllLocalDrafts } from '@/lib/localDraft';
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
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;

      if (data) {
        setProfile(data);
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
      value={{ session, user, loading, profile, refreshProfile, updateProfile, signUp, signIn, signOut, resetPassword, updatePassword }}
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
  
