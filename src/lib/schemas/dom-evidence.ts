import { z } from 'zod';
import { DOM_LIMITS } from './dom-limits';

/** Bump when Sprint 1 DOM evidence payload shapes change. */
export const DOM_EVIDENCE_SCHEMA_VERSION = 1 as const;

const TruncationSchema = z.object({
  truncated: z.literal(true),
  reason: z.string().min(1),
  omittedCount: z.number().int().nonnegative().optional(),
});

export const FieldStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('absent') }),
  z.object({
    state: z.literal('empty'),
    raw: z.string(),
    selector: z.string().min(1),
  }),
  z.object({
    state: z.literal('present'),
    value: z.unknown(),
    raw: z.string().optional(),
    selector: z.string().min(1),
    count: z.number().int().nonnegative().optional(),
    limits: TruncationSchema.optional(),
  }),
  z.object({
    state: z.literal('duplicate'),
    values: z.array(z.unknown()),
    selectors: z.array(z.string()),
    count: z.number().int().positive(),
    limits: TruncationSchema.optional(),
  }),
  z.object({
    state: z.literal('malformed'),
    raw: z.string(),
    selector: z.string().min(1),
    detail: z.string().min(1),
  }),
  z.object({
    state: z.literal('inaccessible'),
    detail: z.string().min(1),
  }),
]);
export type FieldStateParsed = z.infer<typeof FieldStateSchema>;

export const JsonLdEntrySchema = z.object({
  index: z.number().int().nonnegative(),
  selector: z.string().min(1),
  raw: z.string().max(DOM_LIMITS.maxJsonLdChars),
  truncated: z.boolean(),
  parseStatus: z.enum(['ok', 'invalid-json', 'empty', 'truncated']),
  parseDetail: z.string().optional(),
});

export const ImagesSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  withAlt: z.number().int().nonnegative(),
  emptyAlt: z.number().int().nonnegative(),
  missingAlt: z.number().int().nonnegative(),
});

export const LinksSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  internal: z.number().int().nonnegative(),
  external: z.number().int().nonnegative(),
  other: z.number().int().nonnegative(),
});

export const DomFactsSchema = z.object({
  documentUrl: z.string(),
  baseUri: z.string(),
  collectedAt: z.string().datetime(),
  title: FieldStateSchema,
  metaDescription: FieldStateSchema,
  metaRobots: FieldStateSchema,
  canonical: FieldStateSchema,
  alternates: FieldStateSchema,
  openGraph: FieldStateSchema,
  twitter: FieldStateSchema,
  language: FieldStateSchema,
  viewport: FieldStateSchema,
  headings: FieldStateSchema,
  links: FieldStateSchema,
  images: FieldStateSchema,
  html5: FieldStateSchema,
  jsonLd: FieldStateSchema,
});
export type DomFactsParsed = z.infer<typeof DomFactsSchema>;

export type DomEvidenceParseResult =
  | { ok: true; value: DomFactsParsed }
  | { ok: false; error: string; issues: string[] };

export function parseDomFacts(input: unknown): DomEvidenceParseResult {
  const result = DomFactsSchema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return {
    ok: false,
    error: 'DOM evidence failed schema validation.',
    issues: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

/** Known DOM evidence sources written by domFactsToPageSnapshot. */
export const DOM_EVIDENCE_SOURCES = [
  'document.URL',
  'title',
  'meta[name=description]',
  'meta[name=robots|googlebot]',
  'link[rel=canonical]',
  'link[rel=alternate][hreflang]',
  'meta[property^=og:]',
  'meta[name^=twitter:]',
  'html[lang]',
  'meta[name=viewport]',
  'h1-h6',
  'a[href]',
  'img',
  'script[type=application/ld+json]',
  'capture.limits',
] as const;

export function parseDomFieldState(input: unknown): FieldStateParsed | null {
  const result = FieldStateSchema.safeParse(input);
  return result.success ? result.data : null;
}
