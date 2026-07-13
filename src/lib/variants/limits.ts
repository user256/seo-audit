/**
 * Hard caps for opt-in URL variant redirect tests (Ticket 301).
 */
export type VariantTestLimits = {
  /** Max distinct variant URLs fetched in one run. */
  maxVariants: number;
  /** Wall-clock budget for the whole run (ms). */
  maxWallTimeMs: number;
};

export const VARIANT_TEST_LIMITS: VariantTestLimits = {
  maxVariants: 24,
  maxWallTimeMs: 90_000,
};

export const DEFAULT_INDEX_FILENAMES = [
  'index.html',
  'index.php',
  'index.htm',
  'default.aspx',
] as const;

/** UI display caps for variant test panels. */
export const VARIANT_TEST_DISPLAY_LIMITS = {
  maxResultRows: 16,
  maxObservations: 8,
  maxFinalGroups: 6,
} as const;
