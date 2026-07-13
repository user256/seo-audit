import { SOFT_404_PROBE_LIMITS } from './limits';
import type { Soft404TextFingerprint } from './types';

const HTML_TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;
const SCRIPT_STYLE_RE = /<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi;
const TAG_RE = /<[^>]+>/g;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Extract the document title from HTML when present. */
export function extractTitleFromHtml(html: string): string | null {
  const match = html.match(HTML_TITLE_RE);
  if (!match?.[1]) return null;
  const title = collapseWhitespace(match[1]);
  return title.length > 0 ? title : null;
}

/** Strip tags and scripts to bounded plain text for fingerprinting. */
export function stripHtmlToText(
  html: string,
  maxChars = SOFT_404_PROBE_LIMITS.maxFingerprintChars,
): {
  text: string;
  truncated: boolean;
} {
  const withoutBlocks = html.replace(SCRIPT_STYLE_RE, ' ');
  const withoutTags = withoutBlocks.replace(TAG_RE, ' ');
  const collapsed = collapseWhitespace(withoutTags);
  if (collapsed.length <= maxChars) {
    return { text: collapsed, truncated: false };
  }
  return { text: collapsed.slice(0, maxChars), truncated: true };
}

/** FNV-1a 32-bit hash rendered as 8 hex chars — stable, dependency-free. */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const TOKEN_RE = /[a-z0-9]{3,}/g;

export function tokenizeForSimilarity(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens = lower.match(TOKEN_RE) ?? [];
  return [...new Set(tokens)];
}

/** Jaccard similarity on unique word tokens. */
export function jaccardSimilarity(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 && right.length === 0) return 1;
  if (left.length === 0 || right.length === 0) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  const union = leftSet.size + rightSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function buildTextFingerprint(
  bodyText: string,
  maxChars = SOFT_404_PROBE_LIMITS.maxFingerprintChars,
): Soft404TextFingerprint {
  const { text, truncated } = stripHtmlToText(bodyText, maxChars);
  return {
    normalizedText: text,
    tokens: tokenizeForSimilarity(text),
    truncated,
  };
}

const ERROR_TITLE_RE =
  /\b(404|410|not[\s-]?found|page[\s-]?not[\s-]?found|error|does(?:n't| not) exist|no[\s-]?longer[\s-]?available)\b/i;

export function looksLikeErrorPageTitle(title: string | null): boolean {
  if (!title) return false;
  return ERROR_TITLE_RE.test(title);
}

export function isHttpSuccess(status: number | null): boolean {
  return status != null && status >= 200 && status < 300;
}

export function bodyLengthRatio(probeBytes: number, auditedBytes: number): number | null {
  if (auditedBytes <= 0 || probeBytes < 0) return null;
  return probeBytes / auditedBytes;
}
