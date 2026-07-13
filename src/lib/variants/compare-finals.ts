import { normalizeFinalUrl } from './normalize-final-url';
import type { VariantFinalGroup, VariantObservation, VariantTestRow } from './types';

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'unknown';
}

/**
 * Parse a canonical URL from a Link response header when present.
 */
export function canonicalFromLinkHeader(linkHeader: string | undefined): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(',');
  for (const part of parts) {
    const section = part.trim();
    const match = section.match(/^<([^>]+)>\s*(?:;\s*)?rel="?canonical"?/i);
    if (match?.[1]) {
      try {
        return new URL(match[1]).href;
      } catch {
        return match[1];
      }
    }
    if (/rel="?canonical"?/i.test(section)) {
      const urlMatch = section.match(/^<([^>]+)>/);
      if (urlMatch?.[1]) {
        try {
          return new URL(urlMatch[1]).href;
        } catch {
          return urlMatch[1];
        }
      }
    }
  }
  return null;
}

export function groupVariantFinals(rows: readonly VariantTestRow[]): VariantFinalGroup[] {
  const groups = new Map<string, VariantFinalGroup>();

  for (const row of rows) {
    if (!row.finalUrl || row.error) continue;
    const normalizedFinalUrl = normalizeFinalUrl(row.finalUrl);
    const existing = groups.get(normalizedFinalUrl);
    const member = {
      requestUrl: row.requestUrl,
      kind: row.kind,
      status: row.status,
    };
    if (existing) {
      existing.members.push(member);
    } else {
      groups.set(normalizedFinalUrl, {
        finalUrl: row.finalUrl,
        normalizedFinalUrl,
        members: [member],
      });
    }
  }

  return [...groups.values()].sort((a, b) =>
    a.normalizedFinalUrl.localeCompare(b.normalizedFinalUrl),
  );
}

/**
 * Flag inconsistent final destinations and mixed signals as observations — not pass/fail findings.
 */
export function buildVariantObservations(
  rows: readonly VariantTestRow[],
  finalGroups: readonly VariantFinalGroup[],
): VariantObservation[] {
  const observations: VariantObservation[] = [];
  const successful = rows.filter((row) => row.finalUrl && !row.error);

  if (finalGroups.length > 1) {
    const summaries = finalGroups.map(
      (group) =>
        `${group.normalizedFinalUrl} (${group.members.length} variant${group.members.length === 1 ? '' : 's'})`,
    );
    observations.push({
      id: `variant-finals-${slug(finalGroups.map((group) => group.normalizedFinalUrl).join('-'))}`,
      kind: 'inconsistent-finals',
      summary: `${finalGroups.length} distinct final URL groups after redirects`,
      detail: `Variant requests resolved to multiple destinations: ${summaries.join('; ')}. This is an observation only — no preferred host is assumed.`,
      relatedRequestUrls: successful.map((row) => row.requestUrl),
    });
  }

  for (const group of finalGroups) {
    const statuses = new Set(
      group.members
        .map((member) => member.status)
        .filter((status): status is number => status != null),
    );
    if (statuses.size > 1) {
      observations.push({
        id: `variant-mixed-status-${slug(group.normalizedFinalUrl)}`,
        kind: 'mixed-status',
        summary: `Mixed HTTP status for final ${group.normalizedFinalUrl}`,
        detail: `Requests that landed on ${group.normalizedFinalUrl} returned statuses ${[...statuses].sort((a, b) => a - b).join(', ')}.`,
        relatedRequestUrls: group.members.map((member) => member.requestUrl),
      });
    }
  }

  const canonicalByRequest = new Map<string, string>();
  for (const row of successful) {
    if (row.canonicalUrl) {
      canonicalByRequest.set(row.requestUrl, normalizeFinalUrl(row.canonicalUrl));
    }
  }
  const canonicalValues = new Set(canonicalByRequest.values());
  if (canonicalValues.size > 1) {
    observations.push({
      id: 'variant-canonical-mismatch',
      kind: 'canonical-mismatch',
      summary: 'Canonical Link headers disagree across variant responses',
      detail: `Observed canonical targets: ${[...canonicalValues].sort().join('; ')}.`,
      relatedRequestUrls: [...canonicalByRequest.keys()],
    });
  }

  return observations;
}
