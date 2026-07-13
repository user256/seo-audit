/**
 * Page-world CSS-disable injection (Ticket 303).
 *
 * `disableCssInPage` is intentionally self-contained (no imports, no closures
 * over module bindings) so it can be passed to
 * chrome.scripting.executeScript({ func }). It does NOT use the browser
 * DevTools "Disable CSS" affordance — that is not scriptable from an
 * extension. Instead it:
 *
 *   1. Disables every reachable stylesheet in `document.styleSheets`
 *      (covers both `<link rel="stylesheet">` and `<style>` elements).
 *   2. Removes every element's inline `style` attribute (inline styles are
 *      also CSS and would otherwise keep hiding/positioning content).
 *   3. Appends a marker `<style data-seo-audit-css-kill>` element so the
 *      result is detectable and so any late-registered same-document
 *      stylesheet added *after* this point is visibly distinguishable from
 *      the ones this run disabled.
 *
 * It intentionally does NOT force elements visible (e.g. no
 * `* { display: revert !important }` override) — that would fabricate a
 * rendering state no browser produces. The goal is an honest "author CSS
 * absent" approximation, not a "reveal everything" trick.
 *
 * Limitations (see docs/css-js-comparison.md):
 *   - Cannot enumerate or disable stylesheets inside closed shadow roots or
 *     cross-origin iframes.
 *   - Constructed/adopted stylesheets (`CSSStyleSheet` objects assigned via
 *     `adoptedStyleSheets`) are not enumerated by `document.styleSheets` and
 *     are not disabled by this method.
 *   - `[hidden]` attributes and UA default styles are left intact — that is
 *     correct: they are not author CSS.
 */

export const CSS_DISABLE_METHOD_VERSION = 'css-injection-disable-v1' as const;

export type CssDisableInjectionResult = {
  methodVersion: typeof CSS_DISABLE_METHOD_VERSION;
  /** Stylesheets this run successfully disabled. */
  disabledStylesheetCount: number;
  /** Total stylesheets seen in document.styleSheets (disabled + inaccessible). */
  totalStylesheetCount: number;
  /** Stylesheets that could not be accessed/disabled (e.g. cross-origin CSSOM restrictions). */
  inaccessibleStylesheetCount: number;
  /** Elements whose inline `style` attribute was removed. */
  removedInlineStyleAttrCount: number;
  appliedAt: string;
};

export function disableCssInPage(): CssDisableInjectionResult {
  const methodVersion = 'css-injection-disable-v1' as const;
  let disabledStylesheetCount = 0;
  let inaccessibleStylesheetCount = 0;
  const totalStylesheetCount = document.styleSheets.length;

  for (let i = 0; i < document.styleSheets.length; i += 1) {
    const sheet = document.styleSheets[i];
    if (!sheet) continue;
    try {
      if (!sheet.disabled) sheet.disabled = true;
      disabledStylesheetCount += 1;
    } catch {
      inaccessibleStylesheetCount += 1;
    }
  }

  let removedInlineStyleAttrCount = 0;
  try {
    const styled = document.querySelectorAll('[style]');
    for (let i = 0; i < styled.length; i += 1) {
      styled[i]?.removeAttribute('style');
      removedInlineStyleAttrCount += 1;
    }
  } catch {
    // Best-effort — leave count at whatever succeeded before the failure.
  }

  try {
    const marker = document.createElement('style');
    marker.setAttribute('data-seo-audit-css-kill', methodVersion);
    marker.disabled = true;
    marker.textContent = '/* seo-audit: author stylesheets disabled for comparison capture */';
    (document.head ?? document.documentElement).appendChild(marker);
  } catch {
    // Marker is diagnostic only; capture still proceeds without it.
  }

  return {
    methodVersion,
    disabledStylesheetCount,
    totalStylesheetCount,
    inaccessibleStylesheetCount,
    removedInlineStyleAttrCount,
    appliedAt: new Date().toISOString(),
  };
}
