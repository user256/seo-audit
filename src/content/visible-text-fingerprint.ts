/**
 * Page-world visible-text fingerprint (Ticket 303).
 *
 * `collectVisibleTextFingerprintInPage` is intentionally self-contained (no
 * imports, no closures over module bindings) so it can be passed to
 * chrome.scripting.executeScript({ func }). Chrome serialises only the
 * function source for `executeScript({ func })`; free variables become
 * ReferenceErrors in the page. Pass options as an argument instead.
 *
 * Used by the CSS/JS comparison runner to detect whether disabling CSS
 * reveals or removes rendered text, without persisting full page text.
 */

/** Default char budget for the visible-text walk (exported for callers/tests). */
export const DEFAULT_VISIBLE_TEXT_MAX_CHARS = 20_000;

export type VisibleTextFingerprint = {
  /** Number of characters in the normalized visible-text string. */
  charCount: number;
  /** FNV-1a hash of the normalized visible-text string. */
  hash: string;
  /** Short bounded sample for human-readable display only. */
  sampleText: string;
  /** True when the walk stopped early because the char budget was reached. */
  truncated: boolean;
};

/**
 * Walk visible text nodes (skipping elements hidden via `display: none` or
 * `visibility: hidden|collapse` on themselves or an ancestor) and return a
 * bounded fingerprint. Does not descend into closed shadow roots or
 * cross-origin iframes — see docs/css-js-comparison.md limitations.
 */
export function collectVisibleTextFingerprintInPage(maxChars?: number): VisibleTextFingerprint {
  // Inline default — do not reference DEFAULT_VISIBLE_TEXT_MAX_CHARS here.
  const cap = typeof maxChars === 'number' && maxChars > 0 ? maxChars : 20_000;
  const sampleCap = 200;

  const hashText = (text: string): string => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  };

  const isVisible = (el: Element | null): boolean => {
    let node: Element | null = el;
    let hops = 0;
    while (node && hops < 200) {
      let style: CSSStyleDeclaration | null = null;
      try {
        style = window.getComputedStyle(node);
      } catch {
        style = null;
      }
      if (style) {
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      }
      node = node.parentElement;
      hops += 1;
    }
    return true;
  };

  let text = '';
  let truncated = false;

  const root: Node = document.body ?? document.documentElement;
  if (root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !truncated) {
      const parent = node.parentElement;
      if (parent && isVisible(parent)) {
        const raw = (node.textContent ?? '').replace(/\s+/g, ' ');
        if (raw.trim().length > 0) {
          if (text.length + raw.length >= cap) {
            text += raw.slice(0, Math.max(0, cap - text.length));
            truncated = true;
          } else {
            text += raw;
          }
        }
      }
      node = truncated ? null : walker.nextNode();
    }
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  return {
    charCount: normalized.length,
    hash: hashText(normalized),
    sampleText: normalized.slice(0, sampleCap),
    truncated,
  };
}
