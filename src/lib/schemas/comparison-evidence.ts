import { z } from 'zod';
import { SOFT_404_PROBE_LIMITS } from '../soft-404/limits';
import { VARIANT_TEST_LIMITS } from '../variants/limits';

/** Keys that must never appear in persisted comparison-run payloads. */
const FORBIDDEN_RAW_BODY_KEYS = new Set([
  'bodyText',
  'rawBody',
  'responseBody',
  'htmlBody',
  'html',
  'body',
]);

function collectForbiddenRawBodyKeys(value: unknown, path: string[] = []): string[] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectForbiddenRawBodyKeys(item, [...path, String(index)]),
    );
  }
  const issues: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_RAW_BODY_KEYS.has(key)) {
      issues.push([...path, key].join('.') || key);
    }
    issues.push(...collectForbiddenRawBodyKeys(child, [...path, key]));
  }
  return issues;
}

function rejectRawResponseBodies<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T> {
  return schema.superRefine((value, ctx) => {
    for (const keyPath of collectForbiddenRawBodyKeys(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Raw response bodies must not be persisted (${keyPath}).`,
      });
    }
  });
}

export const RedirectHopSchema = z.object({
  fromUrl: z.string().min(1),
  toUrl: z.string().min(1),
  status: z.number().int(),
});

/**
 * Ticket 305 user-agent profile disclosure attached to variant/soft-404 runs.
 * Optional in the persisted schema so sessions saved before Ticket 305 still
 * validate on load (there is nothing to migrate — the field was simply absent).
 */
export const UaProfileResultSchema = z.object({
  profileId: z.enum(['browser-default', 'googlebot-style', 'custom']),
  label: z.string().min(1),
  userAgent: z.string().nullable(),
  method: z.enum(['extension-fetch-header', 'none']),
  limitations: z.array(z.string()),
});

export const VariantFetchErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export const VariantKindSchema = z.enum([
  'base',
  'scheme',
  'www',
  'trailing-slash',
  'case',
  'index-filename',
]);

export const VariantKindOptionsSchema = z.object({
  scheme: z.boolean(),
  www: z.boolean(),
  trailingSlash: z.boolean(),
  case: z.boolean(),
  indexFilenames: z.boolean(),
});

export const VariantTestLimitsSchema = z.object({
  maxVariants: z.number().int().positive(),
  maxWallTimeMs: z.number().int().positive(),
});

export const VariantTestRowSchema = z
  .object({
    kind: VariantKindSchema,
    label: z.string(),
    requestUrl: z.string().min(1),
    finalUrl: z.string().nullable(),
    status: z.number().nullable(),
    redirectHops: z.array(RedirectHopSchema),
    elapsedMs: z.number(),
    contentType: z.string().nullable(),
    canonicalUrl: z.string().nullable(),
    error: VariantFetchErrorSchema.nullable(),
    skipped: z.boolean(),
  })
  .strict();

export const VariantFinalGroupSchema = z.object({
  finalUrl: z.string().min(1),
  normalizedFinalUrl: z.string().min(1),
  members: z.array(
    z.object({
      requestUrl: z.string().min(1),
      kind: VariantKindSchema,
      status: z.number().nullable(),
    }),
  ),
});

export const VariantObservationSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['inconsistent-finals', 'mixed-status', 'canonical-mismatch']),
  summary: z.string(),
  detail: z.string(),
  relatedRequestUrls: z.array(z.string().min(1)),
});

export const VariantTestRunResultSchema = rejectRawResponseBodies(
  z.object({
    requestId: z.string().min(1),
    baseUrl: z.string().min(1),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    cancelled: z.boolean(),
    limits: VariantTestLimitsSchema,
    kindOptions: VariantKindOptionsSchema,
    method: z.enum(['HEAD', 'GET']),
    results: z.array(VariantTestRowSchema),
    finalGroups: z.array(VariantFinalGroupSchema),
    observations: z.array(VariantObservationSchema),
    /** Optional: absent on sessions saved before Ticket 305. */
    uaProfile: UaProfileResultSchema.optional(),
    limitations: z.array(z.string()),
    truncation: z.object({
      totalGenerated: z.number().int().nonnegative(),
      fetchTargets: z.number().int().nonnegative(),
      completedCount: z.number().int().nonnegative(),
      variantCapHit: z.boolean(),
      wallTimeExceeded: z.boolean(),
    }),
  }),
);

export type VariantTestRunResultPersisted = z.infer<typeof VariantTestRunResultSchema>;

export const Soft404TextFingerprintSchema = z.object({
  normalizedText: z.string(),
  tokens: z.array(z.string()),
  truncated: z.boolean(),
});

export const Soft404PageCaptureSchema = z
  .object({
    role: z.enum(['probe', 'audited']),
    requestedUrl: z.string().min(1),
    finalUrl: z.string().nullable(),
    status: z.number().nullable(),
    contentType: z.string().nullable(),
    title: z.string().nullable(),
    bodyByteLength: z.number().int().nonnegative(),
    bodyHash: z.string().nullable(),
    fingerprint: Soft404TextFingerprintSchema.nullable(),
    redirectHops: z.array(RedirectHopSchema),
    elapsedMs: z.number(),
    fetchError: VariantFetchErrorSchema.nullable(),
    skipped: z.boolean(),
  })
  .strict();

export const Soft404ObservationSchema = z.object({
  id: z.string().min(1),
  ruleId: z.literal('soft-404-possible'),
  kind: z.enum([
    'similar-content',
    'identical-body-hash',
    'spa-fallback',
    'redirect-to-home',
    'error-template-title',
  ]),
  summary: z.string(),
  detail: z.string(),
});

export const Soft404ProbeLimitsSchema = z.object({
  maxWallTimeMs: z.number().int().positive(),
  maxFingerprintChars: z.number().int().positive(),
});

export const Soft404ProbeResultSchema = rejectRawResponseBodies(
  z.object({
    requestId: z.string().min(1),
    auditedUrl: z.string().min(1),
    probeUrl: z.string().min(1),
    origin: z.string().min(1),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    cancelled: z.boolean(),
    limits: Soft404ProbeLimitsSchema,
    probe: Soft404PageCaptureSchema,
    audited: Soft404PageCaptureSchema,
    observations: z.array(Soft404ObservationSchema),
    /** Optional: absent on sessions saved before Ticket 305. */
    uaProfile: UaProfileResultSchema.optional(),
    limitations: z.array(z.string()),
  }),
);

export type Soft404ProbeResultPersisted = z.infer<typeof Soft404ProbeResultSchema>;

export function parseVariantTestRunResult(
  input: unknown,
): z.SafeParseReturnType<unknown, VariantTestRunResultPersisted> {
  return VariantTestRunResultSchema.safeParse(input);
}

export function parseSoft404ProbeResult(
  input: unknown,
): z.SafeParseReturnType<unknown, Soft404ProbeResultPersisted> {
  return Soft404ProbeResultSchema.safeParse(input);
}

/** Minimal bounded fixtures for schema and repository tests. */
export function sampleVariantTestRunResult(
  overrides: Partial<VariantTestRunResultPersisted> = {},
): VariantTestRunResultPersisted {
  return {
    requestId: 'vt-sample',
    baseUrl: 'https://example.com/page',
    startedAt: '2026-07-13T12:00:00.000Z',
    endedAt: '2026-07-13T12:00:01.000Z',
    cancelled: false,
    limits: { ...VARIANT_TEST_LIMITS },
    kindOptions: {
      scheme: true,
      www: true,
      trailingSlash: true,
      case: false,
      indexFilenames: true,
    },
    method: 'HEAD',
    results: [
      {
        kind: 'base',
        label: 'Base URL',
        requestUrl: 'https://example.com/page',
        finalUrl: 'https://example.com/page',
        status: 200,
        redirectHops: [],
        elapsedMs: 50,
        contentType: 'text/html',
        canonicalUrl: null,
        error: null,
        skipped: false,
      },
    ],
    finalGroups: [
      {
        finalUrl: 'https://example.com/page',
        normalizedFinalUrl: 'https://example.com/page',
        members: [{ requestUrl: 'https://example.com/page', kind: 'base', status: 200 }],
      },
    ],
    observations: [],
    uaProfile: {
      profileId: 'browser-default',
      label: 'Browser default',
      userAgent: null,
      method: 'none',
      limitations: ['Uses the extension fetch default User-Agent header (no override attempted).'],
    },
    limitations: ['Extension fetch only.'],
    truncation: {
      totalGenerated: 1,
      fetchTargets: 1,
      completedCount: 1,
      variantCapHit: false,
      wallTimeExceeded: false,
    },
    ...overrides,
  };
}

export function sampleSoft404ProbeResult(
  overrides: Partial<Soft404ProbeResultPersisted> = {},
): Soft404ProbeResultPersisted {
  const emptyCapture = (role: 'probe' | 'audited', url: string) => ({
    role,
    requestedUrl: url,
    finalUrl: url,
    status: 200,
    contentType: 'text/html',
    title: role === 'audited' ? 'Product' : 'Not found',
    bodyByteLength: 120,
    bodyHash: role === 'probe' ? 'hash-probe' : 'hash-audited',
    fingerprint: {
      normalizedText: 'bounded fingerprint text',
      tokens: ['bounded', 'fingerprint'],
      truncated: false,
    },
    redirectHops: [],
    elapsedMs: 40,
    fetchError: null,
    skipped: false,
  });

  return {
    requestId: 'sf-sample',
    auditedUrl: 'https://example.com/product',
    probeUrl: 'https://example.com/missing-probe',
    origin: 'https://example.com',
    startedAt: '2026-07-13T12:00:00.000Z',
    endedAt: '2026-07-13T12:00:02.000Z',
    cancelled: false,
    limits: { ...SOFT_404_PROBE_LIMITS },
    probe: emptyCapture('probe', 'https://example.com/missing-probe'),
    audited: emptyCapture('audited', 'https://example.com/product'),
    observations: [],
    uaProfile: {
      profileId: 'browser-default',
      label: 'Browser default',
      userAgent: null,
      method: 'none',
      limitations: ['Uses the extension fetch default User-Agent header (no override attempted).'],
    },
    limitations: ['Heuristic comparison only.'],
    ...overrides,
  };
}
