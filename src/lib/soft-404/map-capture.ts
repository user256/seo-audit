import type { SafeFetchResult } from '../network/types';
import {
  buildTextFingerprint,
  extractTitleFromHtml,
  hashText,
  stripHtmlToText,
} from './fingerprint';
import { SOFT_404_PROBE_LIMITS } from './limits';
import type { Soft404PageCapture } from './types';

export function mapFetchToPageCapture(input: {
  role: Soft404PageCapture['role'];
  requestedUrl: string;
  result: SafeFetchResult;
  skipped?: boolean;
}): Soft404PageCapture {
  const { role, requestedUrl, result, skipped = false } = input;

  if (!result.ok) {
    return {
      role,
      requestedUrl,
      finalUrl: result.finalUrl ?? null,
      status: result.status ?? null,
      contentType: null,
      title: null,
      bodyByteLength: 0,
      bodyHash: null,
      fingerprint: null,
      redirectHops: result.redirectHops,
      elapsedMs: result.timing.durationMs,
      fetchError: { code: result.code, message: result.message },
      skipped,
    };
  }

  const contentType = result.headers['content-type'] ?? null;
  const bodyText = result.bodyText ?? '';
  const plain = stripHtmlToText(bodyText, SOFT_404_PROBE_LIMITS.maxFingerprintChars);
  const fingerprint = bodyText ? buildTextFingerprint(bodyText) : null;

  return {
    role,
    requestedUrl,
    finalUrl: result.finalUrl,
    status: result.status,
    contentType,
    title: extractTitleFromHtml(bodyText),
    bodyByteLength: result.bodyByteLength,
    bodyHash: plain.text.length > 0 ? hashText(plain.text) : null,
    fingerprint,
    redirectHops: result.redirectHops,
    elapsedMs: result.timing.durationMs,
    fetchError: null,
    skipped,
  };
}
