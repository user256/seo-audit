import { z } from 'zod';
import {
  DOM_EVIDENCE_SCHEMA_VERSION,
  HISTORICAL_DOM_EVIDENCE_SCHEMA_VERSION,
  parseDomEvidenceValue,
} from './dom-evidence';
import { DOM_LIMITS } from './dom-limits';

/** Bump when the persisted shape changes; see docs/data-contract.md. */
export const AUDIT_SCHEMA_VERSION = 3 as const;

export const SeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

export const EvidenceKindSchema = z.enum([
  'dom',
  'header',
  'network',
  'robots',
  'sitemap',
  'other',
]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

/**
 * Captured browser fact. Keep values compact — do not store full HTML bodies,
 * cookies, request bodies, or credentials by default.
 */
export const EvidenceSchema = z.object({
  id: z.string().min(1),
  kind: EvidenceKindSchema,
  source: z.string().min(1),
  value: z.unknown(),
  capturedAt: z.string().datetime(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Derived rule result. Always separate from Evidence / CaptureError.
 * Spec fields: severity, category, affected URL, description, evidence,
 * recommendation, source reference — plus stable ruleId and capture timestamp.
 */
export const FindingSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  severity: SeveritySchema,
  category: z.string().min(1),
  affectedUrl: z.string().min(1),
  description: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)),
  recommendation: z.string().min(1),
  sourceRef: z.string().min(1),
  capturedAt: z.string().datetime(),
});
export type Finding = z.infer<typeof FindingSchema>;

/**
 * Failed or unavailable capture. Never coerce these into pass/fail findings.
 */
export const CaptureErrorSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  source: z.string().min(1),
  message: z.string().min(1),
  url: z.string().optional(),
  capturedAt: z.string().datetime(),
});
export type CaptureError = z.infer<typeof CaptureErrorSchema>;

export const CaptureLimitsSchema = z.object({
  schemaVersion: z.literal(1),
  applied: z.object({
    maxStringChars: z.number().int().positive(),
    maxUrlChars: z.number().int().positive().optional(),
    maxMetaItems: z.number().int().positive(),
    maxAlternateItems: z.number().int().positive(),
    maxJsonLdChars: z.number().int().positive(),
    maxJsonLdScripts: z.number().int().positive(),
    maxHeadingSamplesPerLevel: z.number().int().positive(),
    maxLinkInventory: z.number().int().positive().optional(),
    maxImageInventory: z.number().int().positive().optional(),
  }),
  maxSnapshotChars: z.number().int().positive(),
  maxSessionChars: z.number().int().positive(),
  domEvidenceSchemaVersion: z
    .union([
      z.literal(HISTORICAL_DOM_EVIDENCE_SCHEMA_VERSION),
      z.literal(DOM_EVIDENCE_SCHEMA_VERSION),
    ])
    .optional(),
});
export type CaptureLimits = z.infer<typeof CaptureLimitsSchema>;

export const PageSnapshotSchema = z
  .object({
    id: z.string().min(1),
    url: z.string().min(1),
    capturedAt: z.string().datetime(),
    evidence: z.array(EvidenceSchema),
    /** Caps applied during DOM capture (Ticket 107). Optional for migrated v1 rows. */
    captureLimits: CaptureLimitsSchema.optional(),
  })
  .superRefine((snapshot, ctx) => {
    // Ticket 114: skip source-specific checks only for explicitly migrated
    // historical snapshots. Missing or current markers always validate, so new
    // writes cannot bypass the v2 boundary by omitting the version field.
    if (
      snapshot.captureLimits?.domEvidenceSchemaVersion === HISTORICAL_DOM_EVIDENCE_SCHEMA_VERSION
    ) {
      return;
    }
    snapshot.evidence.forEach((evidence, index) => {
      if (evidence.kind !== 'dom') return;
      const parsed = parseDomEvidenceValue(evidence.source, evidence.value);
      if (parsed.ok) return;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidence', index, 'value'],
        message: parsed.issues.join('; '),
      });
    });
  });
export type PageSnapshot = z.infer<typeof PageSnapshotSchema>;

export const FeatureAvailabilitySchema = z.record(
  z.string(),
  z.union([z.boolean(), z.literal('unavailable')]),
);
export type FeatureAvailability = z.infer<typeof FeatureAvailabilitySchema>;

/** A durable description of audit coverage, including every omitted check. */
export const AuditCheckSelectionSchema = z.object({
  selectedCheckIds: z.array(z.string().min(1)),
  skippedChecks: z.array(
    z.object({
      checkId: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
  /** Used only for sessions created before check selection was recorded. */
  recordingNote: z.string().min(1).optional(),
});
export type AuditCheckSelection = z.infer<typeof AuditCheckSelectionSchema>;

export const AuditSessionSchema = z.object({
  schemaVersion: z.literal(AUDIT_SCHEMA_VERSION),
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  tabUrl: z.string().min(1),
  finalUrl: z.string().min(1),
  captureTime: z.string().datetime(),
  extensionVersion: z.string().min(1),
  featureAvailability: FeatureAvailabilitySchema,
  snapshots: z.array(PageSnapshotSchema),
  findings: z.array(FindingSchema),
  captureErrors: z.array(CaptureErrorSchema),
  /** Checks that ran and checks intentionally or necessarily skipped (Ticket 210). */
  checkSelection: AuditCheckSelectionSchema,
  /** Markdown source for the session report (Ticket 105). Preview HTML is never persisted. */
  reportMarkdown: z.string().default(''),
});
export type AuditSession = z.infer<typeof AuditSessionSchema>;

export const QuarantinedRecordSchema = z.object({
  id: z.string().min(1),
  quarantinedAt: z.string().datetime(),
  reason: z.string().min(1),
  originalSchemaVersion: z.unknown(),
  payload: z.unknown(),
});
export type QuarantinedRecord = z.infer<typeof QuarantinedRecordSchema>;

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; issues?: string[] };

/**
 * Save-boundary guard (Ticket 114). New writes must declare the current DOM
 * evidence schema and cannot claim the historical migration marker.
 * `parseAuditSession` remains lenient for migrated reads.
 */
export function assertDomEvidenceSaveBoundary(session: AuditSession): ParseResult<true> {
  const issues: string[] = [];
  session.snapshots.forEach((snapshot, snapIndex) => {
    const hasDom = snapshot.evidence.some((item) => item.kind === 'dom');
    if (!hasDom) return;
    const version = snapshot.captureLimits?.domEvidenceSchemaVersion;
    if (version !== DOM_EVIDENCE_SCHEMA_VERSION) {
      issues.push(
        `snapshots.${snapIndex}.captureLimits.domEvidenceSchemaVersion: new writes with DOM evidence must declare version ${DOM_EVIDENCE_SCHEMA_VERSION} (received ${version ?? 'missing'})`,
      );
    }
  });
  if (issues.length > 0) {
    return {
      ok: false,
      error: 'DOM evidence save boundary rejected the session.',
      issues,
    };
  }
  return { ok: true, value: true };
}

/**
 * Lift a Ticket 102/106 schemaVersion-1 session into the current contract.
 * Historical DOM evidence stays readable; captureLimits are filled with documented defaults.
 */
export function migrateAuditSessionToCurrent(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const raw = input as Record<string, unknown>;
  if (raw.schemaVersion !== 1 && raw.schemaVersion !== 2) return input;

  const snapshots =
    raw.schemaVersion === 1 && Array.isArray(raw.snapshots)
      ? raw.snapshots.map((snap) => {
          if (!snap || typeof snap !== 'object') return snap;
          const s = snap as Record<string, unknown>;
          if (s.captureLimits) return s;
          return {
            ...s,
            captureLimits: {
              schemaVersion: 1,
              applied: {
                maxStringChars: DOM_LIMITS.maxStringChars,
                maxUrlChars: DOM_LIMITS.maxUrlChars,
                maxMetaItems: DOM_LIMITS.maxMetaItems,
                maxAlternateItems: DOM_LIMITS.maxAlternateItems,
                maxJsonLdChars: DOM_LIMITS.maxJsonLdChars,
                maxJsonLdScripts: DOM_LIMITS.maxJsonLdScripts,
                maxHeadingSamplesPerLevel: DOM_LIMITS.maxHeadingSamplesPerLevel,
                maxLinkInventory: DOM_LIMITS.maxLinkInventory,
                maxImageInventory: DOM_LIMITS.maxImageInventory,
              },
              maxSnapshotChars: DOM_LIMITS.maxSnapshotChars,
              maxSessionChars: DOM_LIMITS.maxSessionChars,
              domEvidenceSchemaVersion: HISTORICAL_DOM_EVIDENCE_SCHEMA_VERSION,
            },
          };
        })
      : raw.snapshots;

  const v2 = {
    ...raw,
    schemaVersion: 2,
    snapshots,
    reportMarkdown: typeof raw.reportMarkdown === 'string' ? raw.reportMarkdown : '',
  };

  return {
    ...v2,
    schemaVersion: AUDIT_SCHEMA_VERSION,
    checkSelection: {
      selectedCheckIds: [],
      skippedChecks: [],
      recordingNote: 'Check selection was not recorded for this historical audit.',
    },
  };
}

export function parseAuditSession(input: unknown): ParseResult<AuditSession> {
  const candidate = migrateAuditSessionToCurrent(input);

  const result = AuditSessionSchema.safeParse(candidate);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return {
    ok: false,
    error: 'Audit session failed schema validation.',
    issues: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}
