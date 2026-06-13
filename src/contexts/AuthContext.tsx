import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const REMEMBER_KEY = 'rb_remember_me';

// Set while the user deliberately signs out, so the SIGNED_OUT handler doesn't
// misreport an intentional logout as an expired session.
let isManualSignOut = false;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
  setUser(session?.user ?? null);
  setLoading(false);

  if (event === 'SIGNED_OUT') {
    // Only surface an "expired" message for involuntary sign-outs (token expiry
    // or sign-out from another tab) — not for a deliberate logout.
    if (!isManualSignOut) {
      toast.error('Your session has expired. Please sign in again.');
    }
    isManualSignOut = false;
  }

  if (event === 'TOKEN_REFRESHED') {
    // Token silently refreshed — no action needed but good to know it's working
    console.log('Session refreshed successfully');
  }
});

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // If rememberMe is false, sign out when the browser tab closes
  useEffect(() => {
    const handleUnload = () => {
      if (localStorage.getItem(REMEMBER_KEY) === 'false') {
        supabase.auth.signOut();
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

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
    isManualSignOut = true;
    localStorage.removeItem(REMEMBER_KEY);
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
      value={{ session, user, loading, signUp, signIn, signOut, resetPassword, updatePassword }}
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
  
