import type { Evidence, PageSnapshot } from '../lib/schemas/audit';
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

/** Convert collector output into a Ticket 102 PageSnapshot. */
export function domFactsToPageSnapshot(facts: DomFacts, snapshotId: string): PageSnapshot {
  const capturedAt = facts.collectedAt;
  const evidence: Evidence[] = [
    {
      id: evidenceId('doc', 0),
      kind: 'dom',
      source: 'document.URL',
      value: {
        documentUrl: facts.documentUrl,
        baseUri: facts.baseUri,
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
    fieldToEvidence(
      evidenceId('jsonld', 0),
      'script[type=application/ld+json]',
      facts.jsonLd,
      capturedAt,
    ),
  ];

  return {
    id: snapshotId,
    url: facts.documentUrl,
    capturedAt,
    evidence,
  };
}
