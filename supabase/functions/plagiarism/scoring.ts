// Pure, runtime-agnostic scoring logic for the AI detector. No Deno APIs, no
// randomness, no clock reads — the score must be a pure function of the text
// so identical input always yields an identical score. Imported by the edge
// function (Deno) and unit-tested from vitest (Node).

/**
 * Bump whenever the formula, weights, caps, or normalization change. Folded
 * into the cache hash so stale detection_cache rows from an older scorer are
 * automatically cache misses.
 */
export const SCORER_VERSION = 1;

/**
 * Canonical form of the input text. Used for the cache hash, the signal
 * computation, AND the LLM prompt — one string everywhere, so whitespace or
 * line-ending variants of the same essay can't score differently or collide
 * on a cache key with different true scores.
 */
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').normalize('NFC').trim();
}

export interface ScoreSignals {
  /** 0–100 (higher = more uniform = more AI-like) */
  burstinessScore: number;
  /** per 1000 words; HIGH threshold in the signal summary is 8 */
  signatureWordDensity: number;
  /** per 1000 words; HIGH threshold in the signal summary is 15 */
  transitionDensity: number;
  /** 0–100 */
  coherenceUniformityScore: number;
}

// Density caps mirror the HIGH thresholds already used by buildSignalSummary,
// so the formula and the human-readable interpretations stay consistent.
const SIGNATURE_DENSITY_CAP = 8;
const TRANSITION_DENSITY_CAP = 15;

const W_BURSTINESS = 0.3;
const W_SIGNATURE = 0.3;
const W_TRANSITION = 0.2;
const W_COHERENCE = 0.2;

/**
 * Deterministic overall score, integer 0–100. Fixed weights over the four
 * pre-computed signals; densities are cap-normalized to 0–100 first so their
 * per-1000-words units can't under- or over-power the percentage signals.
 */
export function computeDeterministicScore(s: ScoreSignals): number {
  const burstiness = Math.max(0, Math.min(100, s.burstinessScore));
  const signature = Math.min(100, (Math.max(0, s.signatureWordDensity) / SIGNATURE_DENSITY_CAP) * 100);
  const transition = Math.min(100, (Math.max(0, s.transitionDensity) / TRANSITION_DENSITY_CAP) * 100);
  const coherence = Math.max(0, Math.min(100, s.coherenceUniformityScore));

  const weighted =
    burstiness * W_BURSTINESS +
    signature * W_SIGNATURE +
    transition * W_TRANSITION +
    coherence * W_COHERENCE;

  return Math.max(0, Math.min(100, Math.round(weighted)));
}

export type RiskLevel = 'clean' | 'low_risk' | 'moderate' | 'high_risk';

/** Fixed bands, derived in code — never by the model. */
export function deriveRiskLevel(score: number): RiskLevel {
  if (score <= 15) return 'clean';
  if (score <= 40) return 'low_risk';
  if (score <= 70) return 'moderate';
  return 'high_risk';
}

/**
 * SHA-256 hex digest of the normalized text, with SCORER_VERSION folded into
 * the digest input so formula changes invalidate old cache rows by key.
 */
export async function hashText(normalized: string): Promise<string> {
  const data = new TextEncoder().encode(`v${SCORER_VERSION}\n${normalized}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
