/**
 * Documented DOM capture caps (Ticket 107).
 * Applied in the page collector and again when building/persisting snapshots.
 */

export const DOM_LIMITS = {
  /** Max characters retained for a single string field (title, meta, samples). */
  maxStringChars: 2_000,
  /**
   * Max characters retained for document/base URLs (Ticket 115).
   * Separate from `maxStringChars` so valid long page URLs survive capture.
   * Bounding happens in the extension process after navigation-race comparison
   * against the exact browser URL.
   */
  maxUrlChars: 8_192,
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
  /** Max link rows retained for clipboard inventory. */
  maxLinkInventory: 200,
  /** Max image rows retained for clipboard inventory. */
  maxImageInventory: 100,
  /** Soft ceiling for one PageSnapshot JSON (UTF-16 code units ≈ JS string length). */
  maxSnapshotChars: 400_000,
  /** Soft ceiling for one AuditSession JSON. */
  maxSessionChars: 1_500_000,
} as const;

export type DomCollectLimits = {
  maxStringChars: number;
  maxUrlChars: number;
  maxMetaItems: number;
  maxAlternateItems: number;
  maxJsonLdChars: number;
  maxJsonLdScripts: number;
  maxHeadingSamplesPerLevel: number;
  maxLinkInventory: number;
  maxImageInventory: number;
};

export const DEFAULT_DOM_COLLECT_LIMITS: DomCollectLimits = {
  maxStringChars: DOM_LIMITS.maxStringChars,
  maxUrlChars: DOM_LIMITS.maxUrlChars,
  maxMetaItems: DOM_LIMITS.maxMetaItems,
  maxAlternateItems: DOM_LIMITS.maxAlternateItems,
  maxJsonLdChars: DOM_LIMITS.maxJsonLdChars,
  maxJsonLdScripts: DOM_LIMITS.maxJsonLdScripts,
  maxHeadingSamplesPerLevel: DOM_LIMITS.maxHeadingSamplesPerLevel,
  maxLinkInventory: DOM_LIMITS.maxLinkInventory,
  maxImageInventory: DOM_LIMITS.maxImageInventory,
};

/** Truthful truncation metadata for a document/base URL that exceeded maxUrlChars. */
export type UrlBoundRecord = {
  truncated: true;
  reason: string;
  originalLength: number;
};

export type DomUrlBounds = {
  documentUrl?: UrlBoundRecord;
  baseUri?: UrlBoundRecord;
};

/** Bound a single URL for persistence while retaining length evidence when clipped. */
export function boundUrlString(
  url: string,
  maxChars: number = DOM_LIMITS.maxUrlChars,
): { value: string; bound?: UrlBoundRecord } {
  if (url.length <= maxChars) {
    return { value: url };
  }
  return {
    value: url.slice(0, maxChars),
    bound: {
      truncated: true,
      reason: `URL clipped to ${maxChars} characters`,
      originalLength: url.length,
    },
  };
}

/**
 * Apply URL-specific caps to collector output after navigation-race checks have
 * compared the exact browser URLs.
 */
export function boundDomFactUrls(
  facts: { documentUrl: string; baseUri: string },
  maxUrlChars: number = DOM_LIMITS.maxUrlChars,
): {
  documentUrl: string;
  baseUri: string;
  urlBounds?: DomUrlBounds;
} {
  const document = boundUrlString(facts.documentUrl, maxUrlChars);
  const base = boundUrlString(facts.baseUri, maxUrlChars);
  const urlBounds: DomUrlBounds = {
    ...(document.bound ? { documentUrl: document.bound } : {}),
    ...(base.bound ? { baseUri: base.bound } : {}),
  };
  return {
    documentUrl: document.value,
    baseUri: base.value,
    urlBounds: Object.keys(urlBounds).length > 0 ? urlBounds : undefined,
  };
}

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
