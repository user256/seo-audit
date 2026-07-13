import { SOFT_404_HEURISTICS } from './limits';
import {
  bodyLengthRatio,
  isHttpSuccess,
  jaccardSimilarity,
  looksLikeErrorPageTitle,
} from './fingerprint';
import type { Soft404Observation, Soft404PageCapture } from './types';

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'unknown';
}

function requestedPathname(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

function isHomePath(pathname: string): boolean {
  return pathname === '/' || pathname === '';
}

/**
 * Probe redirected to the site root while the requested path was non-root.
 */
export function isRedirectToHome(capture: Soft404PageCapture, origin: string): boolean {
  if (!capture.finalUrl) return false;
  const requestedPath = requestedPathname(capture.requestedUrl);
  const finalPath = requestedPathname(capture.finalUrl);
  if (!requestedPath || !finalPath) return false;
  if (isHomePath(requestedPath)) return false;
  try {
    const final = new URL(capture.finalUrl);
    if (final.origin !== origin) return false;
  } catch {
    return false;
  }
  return isHomePath(finalPath);
}

/**
 * Evaluate conservative soft-404 heuristics. Returns observations only — never a
 * definitive server or search-engine classification.
 */
export function evaluateSoft404Heuristics(input: {
  origin: string;
  probe: Soft404PageCapture;
  audited: Soft404PageCapture;
}): Soft404Observation[] {
  const { origin, probe, audited } = input;
  const observations: Soft404Observation[] = [];

  if (!isHttpSuccess(probe.status)) {
    return observations;
  }

  if (probe.status === 404 || probe.status === 410) {
    return observations;
  }

  const probeFingerprint = probe.fingerprint;
  const auditedFingerprint = audited.fingerprint;
  const similarity =
    probeFingerprint && auditedFingerprint
      ? jaccardSimilarity(probeFingerprint.tokens, auditedFingerprint.tokens)
      : 0;

  if (
    probe.bodyHash &&
    audited.bodyHash &&
    probe.bodyHash === audited.bodyHash &&
    probe.bodyByteLength > 0
  ) {
    observations.push({
      id: `soft-404-possible-identical-body-${slug(probe.requestedUrl)}`,
      ruleId: 'soft-404-possible',
      kind: 'identical-body-hash',
      summary: 'Probe returned success with an identical body hash to the audited page',
      detail:
        'The nonexistent probe URL returned HTTP success and the same bounded body hash as the audited page. This may indicate a soft 404 template — it is an observation only, not a definitive classification.',
    });
  }

  if (similarity >= SOFT_404_HEURISTICS.contentSimilarityThreshold) {
    observations.push({
      id: `soft-404-possible-similar-content-${slug(probe.requestedUrl)}`,
      ruleId: 'soft-404-possible',
      kind: 'similar-content',
      summary: `Probe content is highly similar to the audited page (${Math.round(similarity * 100)}% token overlap)`,
      detail: `Fingerprint token similarity is ${similarity.toFixed(2)} (threshold ${SOFT_404_HEURISTICS.contentSimilarityThreshold}). A missing URL returning near-identical content may be a soft 404 — heuristic only.`,
    });
  }

  const ratio = bodyLengthRatio(probe.bodyByteLength, audited.bodyByteLength);
  if (
    ratio != null &&
    ratio >= SOFT_404_HEURISTICS.bodyLengthRatioMin &&
    ratio <= SOFT_404_HEURISTICS.bodyLengthRatioMax &&
    similarity >= SOFT_404_HEURISTICS.spaShellSimilarityThreshold
  ) {
    observations.push({
      id: `soft-404-possible-spa-fallback-${slug(probe.requestedUrl)}`,
      ruleId: 'soft-404-possible',
      kind: 'spa-fallback',
      summary:
        'Probe success with near-equal body size and moderate content overlap (possible SPA fallback)',
      detail: `Body-length ratio ${ratio.toFixed(2)} with fingerprint similarity ${similarity.toFixed(2)}. Single-page apps sometimes serve the app shell for unknown routes — this is not crawler parity.`,
    });
  }

  if (isRedirectToHome(probe, origin)) {
    observations.push({
      id: `soft-404-possible-redirect-home-${slug(probe.requestedUrl)}`,
      ruleId: 'soft-404-possible',
      kind: 'redirect-to-home',
      summary: 'Probe redirected to the site root while requesting a deep path',
      detail: `Requested ${probe.requestedUrl} but the final URL was ${probe.finalUrl ?? '(unknown)'}. Redirecting missing URLs to the homepage can look like a soft 404 to crawlers — observed behaviour only.`,
    });
  }

  if (looksLikeErrorPageTitle(probe.title)) {
    observations.push({
      id: `soft-404-possible-error-template-${slug(probe.title ?? 'untitled')}`,
      ruleId: 'soft-404-possible',
      kind: 'error-template-title',
      summary: 'Probe returned HTTP success with an error-style page title',
      detail: `Title "${probe.title ?? ''}" matches common not-found wording while status was ${probe.status}. This may be a soft 404 error template — not a definitive Google soft-404 verdict.`,
    });
  }

  return observations;
}
