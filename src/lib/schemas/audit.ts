import { z } from 'zod';

/** Bump when the persisted shape changes; see docs/data-contract.md. */
export const AUDIT_SCHEMA_VERSION = 1 as const;

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

export const PageSnapshotSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  capturedAt: z.string().datetime(),
  evidence: z.array(EvidenceSchema),
});
export type PageSnapshot = z.infer<typeof PageSnapshotSchema>;

export const FeatureAvailabilitySchema = z.record(
  z.string(),
  z.union([z.boolean(), z.literal('unavailable')]),
);
export type FeatureAvailability = z.infer<typeof FeatureAvailabilitySchema>;

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

export function parseAuditSession(input: unknown): ParseResult<AuditSession> {
  const result = AuditSessionSchema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return {
    ok: false,
    error: 'Audit session failed schema validation.',
    issues: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}
