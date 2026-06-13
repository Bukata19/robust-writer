// Shared client-side validation for the auth flows (sign-up + password reset).
// Kept framework-free so it can be reused by any form.

export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

// Requirements shown as a live checklist on sign-up / reset. Stricter than
// Supabase's default 6-char minimum, but intentionally without a special-char
// rule to avoid frustrating users.
export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { id: 'number', label: 'One number', test: (pw) => /[0-9]/.test(pw) },
];

export function passwordMeetsAll(pw: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(pw));
}

export interface PasswordStrength {
  score: number; // 0–4
  label: string;
  // Tailwind classes for the Progress indicator + percentage width.
  barClass: string;
  percent: number;
}

// Score = number of satisfied rules, with a small bonus for longer passwords.
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) {
    return { score: 0, label: '', barClass: 'bg-muted', percent: 0 };
  }

  let score = PASSWORD_RULES.reduce((acc, rule) => acc + (rule.test(pw) ? 1 : 0), 0);
  if (pw.length >= 12 && score === PASSWORD_RULES.length) {
    score = 4; // already capped, but keep explicit "strong" at full + length
  }

  const levels: Array<{ label: string; barClass: string }> = [
    { label: 'Very weak', barClass: 'bg-destructive' },
    { label: 'Weak', barClass: 'bg-destructive' },
    { label: 'Fair', barClass: 'bg-yellow-500' },
    { label: 'Good', barClass: 'bg-yellow-400' },
    { label: 'Strong', barClass: 'bg-primary' },
  ];

  const level = levels[score] ?? levels[0];
  return {
    score,
    label: level.label,
    barClass: level.barClass,
    percent: (score / PASSWORD_RULES.length) * 100,
  };
}

// Pragmatic email check — good enough for inline UX feedback; the server is the
// source of truth.
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Maps Supabase auth errors to clear, user-facing messages. Falls back to a
// clean generic line so we never surface raw internal text.
export function mapAuthError(error: { message?: string; status?: number } | null): string {
  if (!error) return 'Something went wrong. Please try again.';

  const msg = (error.message ?? '').toLowerCase();
  const status = error.status;

  if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return 'Incorrect email or password.';
  }
  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return 'Please confirm your email first — check your inbox for the link.';
  }
  if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already')) {
    return 'An account with this email already exists — try signing in instead.';
  }
  if (msg.includes('password should be') || msg.includes('password is too')) {
    return 'That password doesn’t meet the requirements.';
  }
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }
  if (msg.includes('same password') || msg.includes('should be different')) {
    return 'Your new password must be different from the old one.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Network error. Check your connection and try again.';
  }

  return error.message || 'Something went wrong. Please try again.';
}
