import { z } from 'zod';
import { DOM_LIMITS } from './dom-limits';

/** Bump when Sprint 1 DOM evidence payload shapes change. */
export const DOM_EVIDENCE_SCHEMA_VERSION = 2 as const;
export const HISTORICAL_DOM_EVIDENCE_SCHEMA_VERSION = 1 as const;

const BoundedString = z.string().max(DOM_LIMITS.maxStringChars);
/** Document/base URLs use a dedicated cap so valid long page URLs are not rejected. */
const BoundedUrlString = z.string().max(DOM_LIMITS.maxUrlChars);
const BoundedSelector = BoundedString.min(1);
const NonNegativeInteger = z.number().int().nonnegative();

const TruncationSchema = z.object({
  truncated: z.literal(true),
  reason: BoundedString.min(1),
  omittedCount: NonNegativeInteger.optional(),
});

const UrlBoundRecordSchema = z.object({
  truncated: z.literal(true),
  reason: BoundedString.min(1),
  originalLength: z.number().int().positive(),
});
const DomUrlBoundsSchema = z
  .object({
    documentUrl: UrlBoundRecordSchema.optional(),
    baseUri: UrlBoundRecordSchema.optional(),
  })
  .refine((value) => value.documentUrl !== undefined || value.baseUri !== undefined, {
    message: 'At least one URL bound must be present',
  });

const AbsentFieldSchema = z.object({ state: z.literal('absent') });
const InaccessibleFieldSchema = z.object({
  state: z.literal('inaccessible'),
  detail: BoundedString.min(1),
});
const EmptyFieldSchema = z.object({
  state: z.literal('empty'),
  raw: BoundedString,
  selector: BoundedSelector,
});
const MalformedFieldSchema = z.object({
  state: z.literal('malformed'),
  raw: BoundedString,
  selector: BoundedSelector,
  detail: BoundedString.min(1),
});

function presentField<Value extends z.ZodTypeAny>(value: Value) {
  return z.object({
    state: z.literal('present'),
    value,
    raw: BoundedString.optional(),
    selector: BoundedSelector,
    count: NonNegativeInteger.optional(),
    limits: TruncationSchema.optional(),
  });
}

function duplicateField<Value extends z.ZodTypeAny>(value: Value) {
  return z.object({
    state: z.literal('duplicate'),
    values: z.array(value).max(DOM_LIMITS.maxMetaItems),
    selectors: z.array(BoundedSelector).max(DOM_LIMITS.maxMetaItems),
    count: z.number().int().positive(),
    limits: TruncationSchema.optional(),
  });
}

function fieldSchema<Value extends z.ZodTypeAny>(value: Value, duplicateValue?: z.ZodTypeAny) {
  return z.discriminatedUnion('state', [
    AbsentFieldSchema,
    InaccessibleFieldSchema,
    EmptyFieldSchema,
    MalformedFieldSchema,
    presentField(value),
    ...(duplicateValue ? [duplicateField(duplicateValue)] : []),
  ]);
}

/** Generic field state retained for rule helpers; collector parsing uses the source-specific forms below. */
export const FieldStateSchema = z.discriminatedUnion('state', [
  AbsentFieldSchema,
  InaccessibleFieldSchema,
  EmptyFieldSchema,
  MalformedFieldSchema,
  presentField(z.unknown()),
  duplicateField(z.unknown()),
]);
export type FieldStateParsed = z.infer<typeof FieldStateSchema>;

const MetaRobotsValueSchema = z.object({
  name: BoundedString,
  content: BoundedString,
  selector: BoundedSelector,
});
const CanonicalPresentValueSchema = z.object({
  href: BoundedString,
  absolute: BoundedString,
});
const CanonicalDuplicateValueSchema = z.object({
  href: BoundedString,
  absolute: BoundedString.nullable(),
  selector: BoundedSelector,
  detail: BoundedString.optional(),
});
const AlternateValueSchema = z.object({
  href: BoundedString,
  hreflang: BoundedString,
  absolute: BoundedString.nullable(),
  selector: BoundedSelector,
  detail: BoundedString.optional(),
});
const MetaEntrySchema = z.object({ key: BoundedString, content: BoundedString });
const HeadingSummarySchema = z.object({
  levels: z.object({
    h1: NonNegativeInteger,
    h2: NonNegativeInteger,
    h3: NonNegativeInteger,
    h4: NonNegativeInteger,
    h5: NonNegativeInteger,
    h6: NonNegativeInteger,
  }),
  samples: z
    .array(z.object({ level: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']), text: BoundedString }))
    .max(6 * DOM_LIMITS.maxHeadingSamplesPerLevel),
});
const LinkInventoryEntrySchema = z.object({
  href: BoundedString,
  absolute: BoundedString.nullable(),
  text: BoundedString,
});
const LinksSummarySchema = z.object({
  total: NonNegativeInteger,
  internal: NonNegativeInteger,
  external: NonNegativeInteger,
  other: NonNegativeInteger,
  inventory: z.array(LinkInventoryEntrySchema).max(DOM_LIMITS.maxLinkInventory),
});
const ImageInventoryEntrySchema = z.object({
  src: BoundedString,
  alt: BoundedString.nullable(),
  altState: z.enum(['missing', 'empty', 'present']),
});
export const ImagesSummarySchema = z.object({
  total: NonNegativeInteger,
  withAlt: NonNegativeInteger,
  emptyAlt: NonNegativeInteger,
  missingAlt: NonNegativeInteger,
  inventory: z.array(ImageInventoryEntrySchema).max(DOM_LIMITS.maxImageInventory),
});
const Html5SummarySchema = z.object({
  doctype: BoundedString.nullable(),
  counts: z.object({
    main: NonNegativeInteger,
    nav: NonNegativeInteger,
    header: NonNegativeInteger,
    footer: NonNegativeInteger,
    article: NonNegativeInteger,
    section: NonNegativeInteger,
    aside: NonNegativeInteger,
  }),
  hasMain: z.boolean(),
  landmarkTotal: NonNegativeInteger,
});
export const JsonLdEntrySchema = z.object({
  index: NonNegativeInteger,
  selector: BoundedSelector,
  raw: z.string().max(DOM_LIMITS.maxJsonLdChars),
  truncated: z.boolean(),
  parseStatus: z.enum(['ok', 'invalid-json', 'empty', 'truncated']),
  parseDetail: BoundedString.optional(),
});

const TitleFieldSchema = fieldSchema(BoundedString, BoundedString);
const StringMetaFieldSchema = fieldSchema(BoundedString, BoundedString);
const MetaRobotsFieldSchema = fieldSchema(MetaRobotsValueSchema, MetaRobotsValueSchema);
const CanonicalFieldSchema = z.discriminatedUnion('state', [
  AbsentFieldSchema,
  InaccessibleFieldSchema,
  EmptyFieldSchema,
  MalformedFieldSchema,
  presentField(CanonicalPresentValueSchema),
  duplicateField(CanonicalDuplicateValueSchema),
]);
const AlternatesFieldSchema = fieldSchema(
  z.array(AlternateValueSchema).max(DOM_LIMITS.maxAlternateItems),
);
const MetaGroupFieldSchema = fieldSchema(z.array(MetaEntrySchema).max(DOM_LIMITS.maxMetaItems));
const HeadingsFieldSchema = fieldSchema(HeadingSummarySchema);
const LinksFieldSchema = fieldSchema(LinksSummarySchema);
const ImagesFieldSchema = fieldSchema(ImagesSummarySchema);
const Html5FieldSchema = fieldSchema(Html5SummarySchema);
const JsonLdFieldSchema = fieldSchema(z.array(JsonLdEntrySchema).max(DOM_LIMITS.maxJsonLdScripts));

export const DomFactsSchema = z.object({
  documentUrl: BoundedUrlString,
  baseUri: BoundedUrlString,
  collectedAt: z.string().datetime(),
  title: TitleFieldSchema,
  metaDescription: StringMetaFieldSchema,
  metaRobots: MetaRobotsFieldSchema,
  canonical: CanonicalFieldSchema,
  alternates: AlternatesFieldSchema,
  openGraph: MetaGroupFieldSchema,
  twitter: MetaGroupFieldSchema,
  language: StringMetaFieldSchema,
  viewport: StringMetaFieldSchema,
  headings: HeadingsFieldSchema,
  links: LinksFieldSchema,
  images: ImagesFieldSchema,
  html5: Html5FieldSchema,
  jsonLd: JsonLdFieldSchema,
});
export type DomFactsParsed = z.infer<typeof DomFactsSchema>;

export type DomEvidenceParseResult =
  | { ok: true; value: DomFactsParsed }
  | { ok: false; error: string; issues: string[] };

export function parseDomFacts(input: unknown): DomEvidenceParseResult {
  const result = DomFactsSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
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
  'html5-landmarks',
  'script[type=application/ld+json]',
  'capture.limits',
] as const;

const DocumentUrlEvidenceSchema = z.object({
  documentUrl: BoundedUrlString,
  baseUri: BoundedUrlString,
  bounds: DomUrlBoundsSchema.optional(),
});

const DomEvidenceValueSchemas = {
  'document.URL': DocumentUrlEvidenceSchema,
  title: TitleFieldSchema,
  'meta[name=description]': StringMetaFieldSchema,
  'meta[name=robots|googlebot]': MetaRobotsFieldSchema,
  'link[rel=canonical]': CanonicalFieldSchema,
  'link[rel=alternate][hreflang]': AlternatesFieldSchema,
  'meta[property^=og:]': MetaGroupFieldSchema,
  'meta[name^=twitter:]': MetaGroupFieldSchema,
  'html[lang]': StringMetaFieldSchema,
  'meta[name=viewport]': StringMetaFieldSchema,
  'h1-h6': HeadingsFieldSchema,
  'a[href]': LinksFieldSchema,
  img: ImagesFieldSchema,
  'html5-landmarks': Html5FieldSchema,
  'script[type=application/ld+json]': JsonLdFieldSchema,
  'capture.limits': z.object({
    truncated: z.literal(true),
    fields: z.array(
      z.object({
        source: BoundedString.min(1),
        reason: BoundedString.min(1),
        omittedCount: NonNegativeInteger.optional(),
      }),
    ),
  }),
} as const;

/** Validate a persisted DOM evidence row once its source is known. */
export function parseDomEvidenceValue(source: string, value: unknown): DomEvidenceParseResult {
  const schema = DomEvidenceValueSchemas[source as keyof typeof DomEvidenceValueSchemas];
  if (!schema) {
    return {
      ok: false,
      error: 'DOM evidence failed schema validation.',
      issues: [`source: unknown DOM source ${source}`],
    };
  }
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, value: result.data as DomFactsParsed };
  return {
    ok: false,
    error: 'DOM evidence failed schema validation.',
    issues: result.error.issues.map(
      (i) => `${source}.${i.path.join('.') || 'value'}: ${i.message}`,
    ),
  };
}

export function parseDomFieldState(input: unknown): FieldStateParsed | null {
  const result = FieldStateSchema.safeParse(input);
  return result.success ? result.data : null;
}
