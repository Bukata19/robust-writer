import { useEffect, useRef } from 'react';
import introJs from 'intro.js';
import 'intro.js/introjs.css';

// Single source of truth for the live tour done-keys. Both the tour effects
// and SettingsDrawer's resetTour import these, so bumping a tour version is a
// one-line change that can't silently strand the reset button on an old key.
export const DASHBOARD_TOUR_KEY = 'rb_dashboard_tour_v3_done';
export const EDITOR_TOUR_KEY = 'rb_editor_tour_v4_done';

export interface IntroTourStep {
  element?: string;
  intro: string;
}

interface UseIntroTourOptions {
  /** localStorage done-key; tour is skipped when set. */
  storageKey: string;
  steps: IntroTourStep[];
  /** Gate: the tour only arms while true (e.g. after onboarding resolves). */
  enabled: boolean;
  /** Delay before the tour starts once enabled. */
  delayMs?: number;
  doneLabel?: string;
}

/**
 * Shared intro.js tour launcher used by the Dashboard and Editor tours.
 * Carries the once-per-mount guard, the done-key persistence, and — unlike
 * the old hand-rolled copies — tears a live tour down on unmount so the
 * overlay can never orphan over the next route. A programmatic teardown does
 * NOT write the done-key, so an interrupted tour re-offers on the next visit
 * (matching previous behavior).
 */
export function useIntroTour({
  storageKey,
  steps,
  enabled,
  delayMs = 600,
  doneLabel = 'Done',
}: UseIntroTourOptions) {
  // Blocks a second instance if deps churn re-fires the effect after the tour
  // started but before its done-key is written.
  const startedRef = useRef(false);
  // Steps are defined inline at call sites; keep the latest without making
  // them an effect dependency (they're a fresh array every render).
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const doneLabelRef = useRef(doneLabel);
  doneLabelRef.current = doneLabel;

  useEffect(() => {
    if (!enabled) return;
    if (localStorage.getItem(storageKey)) return;
    if (startedRef.current) return;

    let intro: ReturnType<typeof introJs> | null = null;
    let tornDown = false;

    const timer = setTimeout(() => {
      startedRef.current = true;
      intro = introJs();
      intro.setOptions({
        steps: stepsRef.current,
        showBullets: false,
        showProgress: true,
        exitOnOverlayClick: true,
        nextLabel: 'Next →',
        prevLabel: '← Back',
        doneLabel: doneLabelRef.current,
      });
      const markDone = () => {
        if (!tornDown) localStorage.setItem(storageKey, 'true');
      };
      // intro.js v8 camelCase API (oncomplete/onexit are deprecated aliases).
      intro.onComplete(markDone);
      intro.onExit(markDone);
      intro.start();
    }, delayMs);

    return () => {
      clearTimeout(timer);
      // Tear down a live tour so its overlay can't outlive this page.
      // tornDown suppresses the done-key write for this programmatic exit.
      tornDown = true;
      intro?.exit(true);
    };
  }, [enabled, storageKey, delayMs]);
}
