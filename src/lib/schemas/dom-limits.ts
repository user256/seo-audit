/**
 * Documented DOM capture caps (Ticket 107).
 * Applied in the page collector and again when building/persisting snapshots.
 */

export const DOM_LIMITS = {
  /** Max characters retained for a single string field (title, meta, samples). */
  maxStringChars: 2_000,
  /** Max Open Graph / Twitter meta entries retained. */
  maxMetaItems: 40,
  /** Max hreflang alternate entries retained. */
  maxAlternateItems: 50,
  /** Max JSON-LD raw characters across all scripts. */
  maxJsonLdChars: 50_000,
  /** Max JSON-LD script entries inspected. */
  maxJsonLdScripts: 25,
  /** Heading text samples kept per heading level. */
  maxHeadingSamplesPerLevel: 5,
  /** Soft ceiling for one PageSnapshot JSON (UTF-16 code units ≈ JS string length). */
  maxSnapshotChars: 400_000,
  /** Soft ceiling for one AuditSession JSON. */
  maxSessionChars: 1_500_000,
} as const;

export type DomCollectLimits = {
  maxStringChars: number;
  maxMetaItems: number;
  maxAlternateItems: number;
  maxJsonLdChars: number;
  maxJsonLdScripts: number;
  maxHeadingSamplesPerLevel: number;
};

export const DEFAULT_DOM_COLLECT_LIMITS: DomCollectLimits = {
  maxStringChars: DOM_LIMITS.maxStringChars,
  maxMetaItems: DOM_LIMITS.maxMetaItems,
  maxAlternateItems: DOM_LIMITS.maxAlternateItems,
  maxJsonLdChars: DOM_LIMITS.maxJsonLdChars,
  maxJsonLdScripts: DOM_LIMITS.maxJsonLdScripts,
  maxHeadingSamplesPerLevel: DOM_LIMITS.maxHeadingSamplesPerLevel,
};

export type CaptureLimitsRecord = {
  schemaVersion: 1;
  applied: DomCollectLimits;
  maxSnapshotChars: number;
  maxSessionChars: number;
};

export function captureLimitsRecord(
  applied: DomCollectLimits = DEFAULT_DOM_COLLECT_LIMITS,
): CaptureLimitsRecord {
  return {
    schemaVersion: 1,
    applied: { ...applied },
    maxSnapshotChars: DOM_LIMITS.maxSnapshotChars,
    maxSessionChars: DOM_LIMITS.maxSessionChars,
  };
}
