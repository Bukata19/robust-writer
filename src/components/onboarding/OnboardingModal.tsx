import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth, CUSTOM_INSTRUCTIONS_MAX } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import {
  User, GraduationCap, Feather, BookOpen, Wand2, Check,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const TOTAL_STEPS = 5;

export const ACADEMIC_LEVELS = [
  { value: 'high_school', label: 'High school', hint: 'Clear foundations' },
  { value: 'undergraduate', label: 'Undergraduate', hint: 'Degree-level work' },
  { value: 'postgraduate', label: 'Postgraduate', hint: 'Advanced research' },
] as const;

export const WRITING_TONES = [
  { value: 'formal', label: 'Formal', hint: 'Precise & academic' },
  { value: 'balanced', label: 'Balanced', hint: 'Clear & natural' },
  { value: 'casual', label: 'Casual', hint: 'Relaxed & plain' },
] as const;

export const FIELDS_OF_STUDY = [
  'Nursing/Health',
  'Business/Management',
  'Law',
  'Engineering',
  'Computer Science/IT',
  'Education',
  'Social Sciences',
  'Natural Sciences',
  'Humanities/Arts',
  'Economics/Finance',
  'Other',
];

const STEP_META = [
  { icon: <User className="w-4 h-4" />, title: 'What should we call you?', desc: 'Used for your greeting and account menu.' },
  { icon: <GraduationCap className="w-4 h-4" />, title: 'Your academic level', desc: 'So answers are pitched at the right depth.' },
  { icon: <Feather className="w-4 h-4" />, title: 'Preferred writing tone', desc: 'How the chat assistant should sound.' },
  { icon: <BookOpen className="w-4 h-4" />, title: 'Your field of study', desc: 'Lets the assistant use relevant framing.' },
  { icon: <Wand2 className="w-4 h-4" />, title: 'Custom AI instructions', desc: 'Optional preferences for the chat assistant.' },
];

/** Deterministic scatter vectors for the confetti pieces (styling only). */
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const dist = 70 + (i % 3) * 26;
  return {
    x: `${Math.round(Math.cos(angle) * dist)}px`,
    y: `${Math.round(Math.sin(angle) * dist) - 20}px`,
    r: `${120 + (i % 5) * 90}deg`,
    delay: `${(i % 4) * 60}ms`,
  };
});

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ open, onOpenChange }) => {
  const { user, profile, updateProfile } = useAuth();
  const { settings } = useSettings();

  const emailName = useMemo(() => {
    const raw = user?.email?.split('@')[0] ?? '';
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
  }, [user?.email]);

  const [step, setStep] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [academicLevel, setAcademicLevel] = useState<string | null>(null);
  const [writingTone, setWritingTone] = useState<string | null>(null);
  const [fieldChoice, setFieldChoice] = useState<string | null>(null);
  const [fieldOther, setFieldOther] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  // Seed local state from the profile each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setCelebrating(false);
    setDisplayName(profile?.display_name || emailName);
    setAcademicLevel(profile?.academic_level ?? null);
    setWritingTone(profile?.writing_tone ?? null);
    const savedField = profile?.field_of_study ?? null;
    if (savedField && FIELDS_OF_STUDY.includes(savedField)) {
      setFieldChoice(savedField);
      setFieldOther('');
    } else if (savedField) {
      setFieldChoice('Other');
      setFieldOther(savedField);
    } else {
      setFieldChoice(null);
      setFieldOther('');
    }
    setCustomInstructions(profile?.custom_instructions ?? '');
  }, [open, profile, emailName]);

  const resolvedField = fieldChoice === 'Other'
    ? (fieldOther.trim() || 'Other')
    : fieldChoice;

  const save = async (completed: boolean) => {
    setSaving(true);
    const { error } = await updateProfile({
      display_name: displayName.trim() || emailName || null,
      academic_level: academicLevel,
      writing_tone: writingTone,
      field_of_study: resolvedField,
      custom_instructions: customInstructions.trim() || null,
      onboarding_completed: completed,
    });
    setSaving(false);
    if (error) {
      toast.error('Could not save your profile. Please try again.');
      return false;
    }
    return true;
  };

  const handleSkip = async () => {
    if (await save(true)) onOpenChange(false);
  };

  const handleFinish = async () => {
    if (!(await save(true))) return;
    setCelebrating(true);
    // Shorter dwell when motion is reduced (no animation to watch).
    const dwell = settings.reduceMotion ? 600 : 1500;
    window.setTimeout(() => onOpenChange(false), dwell);
  };

  const meta = STEP_META[step];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!celebrating) onOpenChange(v); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl p-0 gap-0 overflow-hidden">
        {celebrating ? (
          /* ── CELEBRATION ── */
          <div className="relative flex flex-col items-center justify-center py-14 px-6 text-center">
            <DialogTitle className="sr-only">Profile saved</DialogTitle>
            <DialogDescription className="sr-only">Your personalization is ready.</DialogDescription>
            <div className="relative">
              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  className="confetti-piece"
                  style={{
                    ['--cf-x' as string]: c.x,
                    ['--cf-y' as string]: c.y,
                    ['--cf-r' as string]: c.r,
                    animationDelay: c.delay,
                  }}
                />
              ))}
              <div className="check-pop w-16 h-16 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
                <Check className="w-8 h-8 text-primary" />
              </div>
            </div>
            <p className="mt-5 font-display font-semibold text-foreground">You're all set!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The chat assistant is now personalized for you.
            </p>
          </div>
        ) : (
          <>
            {/* ── HEADER + PROGRESS ── */}
            <div className="p-5 pb-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Step {step + 1} of {TOTAL_STEPS}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  disabled={saving}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </Button>
              </div>
              <Progress value={((step + 1) / TOTAL_STEPS) * 100} className="h-1.5" />
              <div className="mt-4 flex items-center gap-2">
                <span className="text-primary">{meta.icon}</span>
                <DialogTitle className="font-display text-base font-semibold text-foreground">
                  {meta.title}
                </DialogTitle>
              </div>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                {meta.desc}
              </DialogDescription>
            </div>

            {/* ── STEP BODY ── */}
            <div className="p-5 min-h-[168px]">
              {step === 0 && (
                <div className="space-y-2">
                  <Label htmlFor="ob-display-name" className="text-xs text-muted-foreground">
                    Display name
                  </Label>
                  <Input
                    id="ob-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={emailName || 'Your name'}
                    autoFocus
                  />
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-2" role="radiogroup" aria-label="Academic level">
                  {ACADEMIC_LEVELS.map((lvl) => (
                    <button
                      key={lvl.value}
                      type="button"
                      role="radio"
                      aria-checked={academicLevel === lvl.value}
                      onClick={() => setAcademicLevel(lvl.value)}
                      className={`focus-ring flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                        academicLevel === lvl.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      <span className="text-sm font-medium text-foreground">{lvl.label}</span>
                      <span className="text-xs text-muted-foreground">{lvl.hint}</span>
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-2" role="radiogroup" aria-label="Writing tone">
                  {WRITING_TONES.map((tone) => (
                    <button
                      key={tone.value}
                      type="button"
                      role="radio"
                      aria-checked={writingTone === tone.value}
                      onClick={() => setWritingTone(tone.value)}
                      className={`focus-ring flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                        writingTone === tone.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      <span className="text-sm font-medium text-foreground">{tone.label}</span>
                      <span className="text-xs text-muted-foreground">{tone.hint}</span>
                    </button>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Field of study</Label>
                    <Select
                      value={fieldChoice ?? undefined}
                      onValueChange={(v) => setFieldChoice(v)}
                    >
                      <SelectTrigger aria-label="Field of study">
                        <SelectValue placeholder="Select your field…" />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELDS_OF_STUDY.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {fieldChoice === 'Other' && (
                    <div className="space-y-2">
                      <Label htmlFor="ob-field-other" className="text-xs text-muted-foreground">
                        Tell us your field
                      </Label>
                      <Input
                        id="ob-field-other"
                        value={fieldOther}
                        onChange={(e) => setFieldOther(e.target.value)}
                        placeholder="e.g. Architecture"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ob-custom" className="text-xs text-muted-foreground">
                      Preferences (optional)
                    </Label>
                    <span
                      className={`text-[11px] tabular-nums ${
                        customInstructions.length >= CUSTOM_INSTRUCTIONS_MAX
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }`}
                      aria-live="polite"
                    >
                      {customInstructions.length}/{CUSTOM_INSTRUCTIONS_MAX}
                    </span>
                  </div>
                  <Textarea
                    id="ob-custom"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value.slice(0, CUSTOM_INSTRUCTIONS_MAX))}
                    maxLength={CUSTOM_INSTRUCTIONS_MAX}
                    rows={4}
                    placeholder={'e.g. "Always use British spelling" or "Prefer concise explanations"'}
                    className="resize-none"
                  />
                </div>
              )}
            </div>

            {/* ── FOOTER NAV ── */}
            <div className="flex items-center justify-between gap-2 p-5 pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || saving}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              {step < TOTAL_STEPS - 1 ? (
                <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={saving}>
                  Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={handleFinish} disabled={saving}>
                  <Check className="w-3.5 h-3.5 mr-1" /> {saving ? 'Saving…' : 'Finish'}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
