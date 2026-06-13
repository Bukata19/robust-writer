import React from 'react';
import { Check, X } from 'lucide-react';
import { PASSWORD_RULES, passwordStrength } from '@/lib/passwordValidation';

interface PasswordRequirementsProps {
  password: string;
  /** Hide the strength bar (e.g. when space is tight). Defaults to showing it. */
  showStrengthBar?: boolean;
}

/**
 * Live password guidance: a strength bar plus a checklist that ticks off each
 * requirement as the user types. Purely presentational.
 */
const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({
  password,
  showStrengthBar = true,
}) => {
  const strength = passwordStrength(password);

  return (
    <div className="space-y-2">
      {showStrengthBar && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-300 ${strength.barClass}`}
              style={{ width: `${strength.percent}%` }}
            />
          </div>
          {strength.label && (
            <p className="text-right text-xs text-muted-foreground">
              Strength: <span className="font-medium text-foreground">{strength.label}</span>
            </p>
          )}
        </div>
      )}

      <ul className="space-y-1">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password);
          return (
            <li
              key={rule.id}
              className={`flex items-center gap-2 text-xs transition-colors ${
                met ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {met ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
              )}
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PasswordRequirements;
