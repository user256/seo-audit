/**
 * Hard caps for opt-in hreflang cluster validation (Ticket 213).
 * Broad host_permissions (Ticket 212) do not relax these.
 */
export type HreflangClusterLimits = {
  /** Max distinct alternate URLs fetched in one validation run. */
  maxAlternates: number;
  /** Wall-clock budget for the whole cluster walk (ms). */
  maxWallTimeMs: number;
};

export const HREFLANG_CLUSTER_LIMITS: HreflangClusterLimits = {
  maxAlternates: 20,
  maxWallTimeMs: 120_000,
};

/** UI display caps for cluster validation panels. */
export const HREFLANG_CLUSTER_DISPLAY_LIMITS = {
  maxDeclaredAlternates: 12,
  maxMemberRows: 10,
  maxFindings: 8,
  maxErrors: 5,
} as const;
