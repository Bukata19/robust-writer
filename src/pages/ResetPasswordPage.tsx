import { usePageTitle } from '@/hooks/usePageTitle';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PasswordRequirements from '@/components/PasswordRequirements';
import { passwordMeetsAll, mapAuthError } from '@/lib/passwordValidation';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

/**
 * Landing page for the password-reset email link. supabase-js parses the
 * recovery token from the URL hash (detectSessionInUrl is on by default) and
 * fires a PASSWORD_RECOVERY event, establishing a recovery session. This route
 * is intentionally NOT wrapped in PublicRoute/ProtectedRoute, so that recovery
 * session doesn't bounce the user to /dashboard before they set a new password.
 */
const ResetPasswordPage: React.FC = () => {
  usePageTitle('Reset Password', 'Set a new password for your RobAssister account.');

  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [ready, setReady] = useState(false);   // recovery session present?
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let resolved = false;

    // A recovery session arrives either as a PASSWORD_RECOVERY event or as an
    // already-parsed session by the time we mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        resolved = true;
        setReady(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
        setChecking(false);
      } else if (!resolved) {
        // Give the URL-hash parse a brief moment before declaring the link invalid.
        setTimeout(() => {
          if (!resolved) setChecking(false);
        }, 1200);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const passwordsMatch = password === confirmPassword;
  const ready2submit = passwordMeetsAll(password) && passwordsMatch && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!ready2submit) {
      setFormError('Please meet all password requirements and confirm your password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        const msg = mapAuthError(error);
        setFormError(msg);
        toast.error(msg);
      } else {
        toast.success('Password updated. You’re all set!');
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <Logo size="lg" className="mb-4" />
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-[var(--shadow-card)]">
          {checking ? (
            <p className="text-center text-sm text-muted-foreground py-6">Verifying your reset link…</p>
          ) : !ready ? (
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-display font-semibold text-foreground">Link invalid or expired</h2>
                <p className="text-sm text-muted-foreground">
                  This password reset link is no longer valid. Please request a new one.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-display font-semibold text-foreground mb-1">Set a new password</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Choose a strong password for your account.
              </p>

              {formError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-foreground text-sm">New password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={visible ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setVisible((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={visible ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="pt-1">
                      <PasswordRequirements password={password} />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword" className="text-foreground text-sm">
                    Confirm new password
                  </Label>
                  <Input
                    id="confirmNewPassword"
                    type={visible ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-destructive">Passwords don’t match.</p>
                  )}
                </div>

                <Button type="submit" disabled={loading || !ready2submit} className="w-full">
                  {loading ? 'Updating…' : 'Update password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
