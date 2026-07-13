import type { Evidence, PageSnapshot } from '../lib/schemas/audit';
import { DOM_EVIDENCE_SCHEMA_VERSION } from '../lib/schemas/dom-evidence';
import {
  captureLimitsRecord,
  DEFAULT_DOM_COLLECT_LIMITS,
  type DomCollectLimits,
  type DomUrlBounds,
} from '../lib/schemas/dom-limits';
import type { DomFacts, FieldState } from './dom-collector';

function evidenceId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

function fieldToEvidence(
  id: string,
  source: string,
  field: FieldState,
  capturedAt: string,
): Evidence {
  return {
    id,
    kind: 'dom',
    source,
    value: field,
    capturedAt,
  };
}

/** Convert collector output into a Ticket 102/107 PageSnapshot. */
export function domFactsToPageSnapshot(
  facts: DomFacts,
  snapshotId: string,
  limits: DomCollectLimits = DEFAULT_DOM_COLLECT_LIMITS,
  urlBounds?: DomUrlBounds,
): PageSnapshot {
  const capturedAt = facts.collectedAt;
  const evidence: Evidence[] = [
    {
      id: evidenceId('doc', 0),
      kind: 'dom',
      source: 'document.URL',
      value: {
        documentUrl: facts.documentUrl,
        baseUri: facts.baseUri,
        ...(urlBounds ? { bounds: urlBounds } : {}),
      },
      capturedAt,
    },
    fieldToEvidence(evidenceId('title', 0), 'title', facts.title, capturedAt),
    fieldToEvidence(
      evidenceId('meta-description', 0),
      'meta[name=description]',
      facts.metaDescription,
      capturedAt,
    ),
    fieldToEvidence(
      evidenceId('meta-robots', 0),
      'meta[name=robots|googlebot]',
      facts.metaRobots,
      capturedAt,
    ),
    fieldToEvidence(evidenceId('canonical', 0), 'link[rel=canonical]', facts.canonical, capturedAt),
    fieldToEvidence(
      evidenceId('alternates', 0),
      'link[rel=alternate][hreflang]',
      facts.alternates,
      capturedAt,
    ),
    fieldToEvidence(evidenceId('og', 0), 'meta[property^=og:]', facts.openGraph, capturedAt),
    fieldToEvidence(evidenceId('twitter', 0), 'meta[name^=twitter:]', facts.twitter, capturedAt),
    fieldToEvidence(evidenceId('lang', 0), 'html[lang]', facts.language, capturedAt),
    fieldToEvidence(evidenceId('viewport', 0), 'meta[name=viewport]', facts.viewport, capturedAt),
    fieldToEvidence(evidenceId('headings', 0), 'h1-h6', facts.headings, capturedAt),
    fieldToEvidence(evidenceId('links', 0), 'a[href]', facts.links, capturedAt),
    fieldToEvidence(evidenceId('images', 0), 'img', facts.images, capturedAt),
    fieldToEvidence(evidenceId('html5', 0), 'html5-landmarks', facts.html5, capturedAt),
    fieldToEvidence(
      evidenceId('jsonld', 0),
      'script[type=application/ld+json]',
      facts.jsonLd,
      capturedAt,
    ),
  ];

  const truncatedFields = evidence
    .filter((e) => {
      const v = e.value as { limits?: { truncated?: boolean; reason?: string } } | undefined;
      return v && typeof v === 'object' && v.limits?.truncated === true;
    })
    .map((e) => {
      const v = e.value as { limits: { reason: string; omittedCount?: number } };
      return {
        source: e.source,
        reason: v.limits.reason,
        omittedCount: v.limits.omittedCount,
      };
    });

  if (urlBounds) {
    const reasons: string[] = [];
    if (urlBounds.documentUrl) reasons.push(`documentUrl: ${urlBounds.documentUrl.reason}`);
    if (urlBounds.baseUri) reasons.push(`baseUri: ${urlBounds.baseUri.reason}`);
    truncatedFields.push({
      source: 'document.URL',
      reason: reasons.join('; '),
      omittedCount: undefined,
    });
  }

  if (truncatedFields.length > 0) {
    evidence.push({
      id: evidenceId('limits', 0),
      kind: 'dom',
      source: 'capture.limits',
      value: {
        truncated: true as const,
        fields: truncatedFields,
      },
      capturedAt,
    });
  }

  const record = captureLimitsRecord(limits);

  return {
    id: snapshotId,
    url: facts.documentUrl,
    capturedAt,
    evidence,
    captureLimits: {
      ...record,
      domEvidenceSchemaVersion: DOM_EVIDENCE_SCHEMA_VERSION,
    },
  };
}
