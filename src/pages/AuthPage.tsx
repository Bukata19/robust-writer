import { usePageTitle } from '@/hooks/usePageTitle';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PasswordRequirements from '@/components/PasswordRequirements';
import {
  isValidEmail,
  passwordMeetsAll,
  mapAuthError,
} from '@/lib/passwordValidation';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';
import {
  FileText,
  Bot,
  Eye,
  EyeOff,
  AlertCircle,
  MailCheck,
  ArrowLeft,
} from 'lucide-react';

type Mode = 'login' | 'signup' | 'forgot';

/** Password input with an inline show/hide toggle. */
const PasswordInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { id: string }
> = ({ id, className, ...props }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        className={`bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10 ${className ?? ''}`}
        {...props}
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
  );
};

const AuthPage: React.FC = () => {
  usePageTitle(
    'Sign In',
    'Sign in to RobAssister — your AI-powered writing assistant for essays, research papers and assignments.'
  );

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const emailValid = isValidEmail(email);
  const showEmailError = emailTouched && email.length > 0 && !emailValid;
  const passwordsMatch = password === confirmPassword;

  const signupReady =
    emailValid && passwordMeetsAll(password) && passwordsMatch && confirmPassword.length > 0;

  const switchMode = (next: Mode) => {
    setMode(next);
    setFormError(null);
    setPassword('');
    setConfirmPassword('');
    setSignupDone(false);
    setResetSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!emailValid) {
      setEmailTouched(true);
      setFormError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password, rememberMe);
        if (error) {
          const msg = mapAuthError(error);
          setFormError(msg);
          toast.error(msg);
        } else {
          toast.success('Welcome back!');
          navigate('/dashboard');
        }
      } else if (mode === 'signup') {
        if (!signupReady) {
          setFormError('Please meet all password requirements and confirm your password.');
          return;
        }
        const { error } = await signUp(email, password);
        if (error) {
          const msg = mapAuthError(error);
          setFormError(msg);
          toast.error(msg);
        } else {
          setSignupDone(true);
          toast.success('Account created! Check your email to confirm.');
        }
      } else {
        // forgot password
        const { error } = await resetPassword(email);
        if (error) {
          const msg = mapAuthError(error);
          setFormError(msg);
          toast.error(msg);
        } else {
          setResetSent(true);
          toast.success('Reset link sent — check your inbox.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const emailField = (
    <div className="space-y-2">
      <Label htmlFor="email" className="text-foreground text-sm">Email</Label>
      <Input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setEmailTouched(true)}
        placeholder="you@example.com"
        autoComplete="email"
        required
        aria-invalid={showEmailError}
        className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
      />
      {showEmailError && (
        <p className="text-xs text-destructive">Please enter a valid email address.</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <Logo size="lg" className="mb-4" />
          <p className="text-muted-foreground text-sm">
            AI-powered assignment editor
          </p>
        </div>

        {/* Features pills */}
        <div className="flex justify-center gap-3 mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
            <FileText className="w-3 h-3" /> Templates
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
            <Bot className="w-3 h-3" /> AI Tools
          </span>
        </div>

        {/* Auth Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-[var(--shadow-card)]">
          {/* Success: account created */}
          {mode === 'signup' && signupDone ? (
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MailCheck className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-display font-semibold text-foreground">Check your inbox</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation link to <span className="text-foreground">{email}</span>.
                  Click it to activate your account, then sign in.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => switchMode('login')}>
                Back to sign in
              </Button>
            </div>
          ) : mode === 'forgot' && resetSent ? (
            /* Success: reset link sent */
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MailCheck className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-display font-semibold text-foreground">Reset link sent</h2>
                <p className="text-sm text-muted-foreground">
                  If an account exists for <span className="text-foreground">{email}</span>, a
                  password reset link is on its way. Check your inbox.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => switchMode('login')}>
                Back to sign in
              </Button>
            </div>
          ) : mode === 'forgot' ? (
            /* Forgot-password request form */
            <>
              <button
                onClick={() => switchMode('login')}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h2 className="text-lg font-display font-semibold text-foreground mb-1">Reset your password</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Enter your email and we’ll send you a link to set a new password.
              </p>

              {formError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {emailField}
                <Button type="submit" disabled={loading || !emailValid} className="w-full">
                  {loading ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
            </>
          ) : (
            /* Sign in / Sign up */
            <>
              {/* Tabs */}
              <div className="flex mb-6 bg-secondary rounded-lg p-1">
                <button
                  onClick={() => switchMode('login')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    mode === 'login'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => switchMode('signup')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    mode === 'signup'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {formError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {emailField}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground text-sm">Password</Label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'login' ? undefined : 8}
                  />
                  {mode === 'signup' && password.length > 0 && (
                    <div className="pt-1">
                      <PasswordRequirements password={password} />
                    </div>
                  )}
                </div>

                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-foreground text-sm">
                      Confirm password
                    </Label>
                    <PasswordInput
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                    {confirmPassword.length > 0 && !passwordsMatch && (
                      <p className="text-xs text-destructive">Passwords don’t match.</p>
                    )}
                  </div>
                )}

                {mode === 'login' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-border bg-muted accent-primary"
                    />
                    <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || (mode === 'signup' && !signupReady)}
                  className="w-full"
                >
                  {loading ? 'Loading…' : mode === 'login' ? 'Sign In' : 'Create Account'}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Secure authentication powered by Supabase
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
