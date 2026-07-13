/**
 * Hard caps and documented heuristics for the opt-in soft-404 probe (Ticket 302).
 * @see docs/soft-404.md
 */
export type Soft404ProbeLimits = {
  /** Wall-clock budget for probe + audited page fetches (ms). */
  maxWallTimeMs: number;
  /** Max normalized text retained for fingerprint similarity. */
  maxFingerprintChars: number;
};

export const SOFT_404_PROBE_LIMITS: Soft404ProbeLimits = {
  maxWallTimeMs: 60_000,
  maxFingerprintChars: 2_000,
};

/**
 * Conservative similarity/status thresholds. A “possible soft 404” observation
 * requires HTTP success on the probe (2xx after redirects) plus at least one
 * signal below — never a definitive search-engine classification.
 */
export const SOFT_404_HEURISTICS = {
  /** Token Jaccard similarity between probe and audited page fingerprints. */
  contentSimilarityThreshold: 0.85,
  /** Looser similarity when body lengths are near-equal (typical SPA shell). */
  spaShellSimilarityThreshold: 0.6,
  bodyLengthRatioMin: 0.8,
  bodyLengthRatioMax: 1.2,
} as const;

/** UI display caps for soft-404 panels. */
export const SOFT_404_DISPLAY_LIMITS = {
  maxObservations: 6,
  maxCaptureRows: 2,
} as const;
