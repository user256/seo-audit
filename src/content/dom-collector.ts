/**
 * Page-world DOM collector (Tickets 103 + 107).
 *
 * `collectDomFactsInPage` is intentionally self-contained (no imports) so it can
 * be passed to chrome.scripting.executeScript. Helpers used only in the
 * extension process live in dom-facts-to-snapshot.ts.
 */

export const DEFAULT_MAX_JSON_LD_CHARS = 50_000;

export type DomCollectLimits = {
  maxStringChars: number;
  /** Document/base URL cap (applied in the extension process after race checks). */
  maxUrlChars: number;
  maxMetaItems: number;
  maxAlternateItems: number;
  maxJsonLdChars: number;
  maxJsonLdScripts: number;
  maxHeadingSamplesPerLevel: number;
  maxLinkInventory: number;
  maxImageInventory: number;
};

export const DEFAULT_DOM_COLLECT_LIMITS: DomCollectLimits = {
  maxStringChars: 2_000,
  maxUrlChars: 8_192,
  maxMetaItems: 40,
  maxAlternateItems: 50,
  maxJsonLdChars: DEFAULT_MAX_JSON_LD_CHARS,
  maxJsonLdScripts: 25,
  maxHeadingSamplesPerLevel: 5,
  maxLinkInventory: 200,
  maxImageInventory: 100,
};

export type FieldLimits = {
  truncated: true;
  reason: string;
  omittedCount?: number;
};

export type FieldState =
  | { state: 'absent' }
  | { state: 'empty'; raw: string; selector: string }
  | {
      state: 'present';
      value: unknown;
      raw?: string;
      selector: string;
      count?: number;
      limits?: FieldLimits;
    }
  | {
      state: 'duplicate';
      values: unknown[];
      selectors: string[];
      count: number;
      limits?: FieldLimits;
    }
  | { state: 'malformed'; raw: string; selector: string; detail: string }
  | { state: 'inaccessible'; detail: string };

export type JsonLdEntry = {
  index: number;
  selector: string;
  raw: string;
  truncated: boolean;
  parseStatus: 'ok' | 'invalid-json' | 'empty' | 'truncated';
  parseDetail?: string;
};

export type DomFacts = {
  documentUrl: string;
  baseUri: string;
  collectedAt: string;
  title: FieldState;
  metaDescription: FieldState;
  metaRobots: FieldState;
  canonical: FieldState;
  alternates: FieldState;
  openGraph: FieldState;
  twitter: FieldState;
  language: FieldState;
  viewport: FieldState;
  headings: FieldState;
  links: FieldState;
  images: FieldState;
  html5: FieldState;
  jsonLd: FieldState;
};

/**
 * Collect normalised SEO DOM facts from the current page document.
 * Safe to inject via chrome.scripting.executeScript({ func: collectDomFactsInPage }).
 *
 * IMPORTANT: this function must not close over module bindings. Chrome serialises
 * only the function source for `executeScript({ func })`; free variables become
 * ReferenceErrors in the page and the result comes back as `null`.
 */
export function collectDomFactsInPage(limits?: DomCollectLimits | number): DomFacts {
  // Inline defaults — do not reference DEFAULT_DOM_COLLECT_LIMITS here.
  const fallback: DomCollectLimits = {
    maxStringChars: 2_000,
    maxUrlChars: 8_192,
    maxMetaItems: 40,
    maxAlternateItems: 50,
    maxJsonLdChars: 50_000,
    maxJsonLdScripts: 25,
    maxHeadingSamplesPerLevel: 5,
    maxLinkInventory: 200,
    maxImageInventory: 100,
  };
  // Back-compat: Ticket 103 callers passed maxJsonLdChars as a bare number.
  const caps: DomCollectLimits =
    typeof limits === 'number'
      ? { ...fallback, maxJsonLdChars: limits }
      : { ...fallback, ...(limits ?? {}) };

  const collectedAt = new Date().toISOString();

  const clip = (text: string): { text: string; truncated: boolean } => {
    if (text.length <= caps.maxStringChars) return { text, truncated: false };
    return { text: text.slice(0, caps.maxStringChars), truncated: true };
  };

  const limitsFor = (
    omitted: number,
    stringTruncated: boolean,
    itemLabel: string,
    itemCap: number,
  ): FieldLimits | undefined => {
    const reasons: string[] = [];
    if (omitted > 0) reasons.push(`${itemLabel} clipped to ${itemCap} entries`);
    if (stringTruncated) reasons.push(`String clipped to ${caps.maxStringChars} characters`);
    return reasons.length > 0
      ? { truncated: true, reason: reasons.join('; '), omittedCount: omitted || undefined }
      : undefined;
  };

  const safe = <T>(label: string, fn: () => T): T | FieldState => {
    try {
      return fn();
    } catch (err) {
      const detail = clip(err instanceof Error ? err.message : String(err)).text;
      return { state: 'inaccessible', detail: `${label}: ${detail}` };
    }
  };

  const metaContent = (selector: string): FieldState => {
    const nodes = Array.from(document.querySelectorAll(selector));
    if (nodes.length === 0) return { state: 'absent' };
    const all = nodes.map((n) => {
      const clipped = clip((n.getAttribute('content') ?? '').trim());
      return { raw: clipped.text, selector, truncated: clipped.truncated };
    });
    const omitted = Math.max(0, all.length - caps.maxMetaItems);
    const values = all.slice(0, caps.maxMetaItems);
    if (all.length > 1) {
      return {
        state: 'duplicate',
        values: values.map((v) => v.raw),
        selectors: values.map((v) => v.selector),
        count: all.length,
        limits: limitsFor(
          omitted,
          all.some((v) => v.truncated),
          'Meta duplicate list',
          caps.maxMetaItems,
        ),
      };
    }
    const only = values[0]!;
    if (only.raw === '' && !only.truncated) return { state: 'empty', raw: '', selector };
    return {
      state: 'present',
      value: only.raw,
      raw: only.raw,
      selector,
      count: 1,
      limits: limitsFor(0, only.truncated, 'Meta duplicate list', caps.maxMetaItems),
    };
  };

  const title = safe('title', (): FieldState => {
    // `querySelectorAll('title')` matches by tag name across namespaces, so it
    // also picks up SVG <title> elements (accessible names for icons/graphics,
    // e.g. payment-method sprites) — those are unrelated to the document
    // title and must not count toward a title-duplicate finding.
    const nodes = Array.from(document.querySelectorAll('title')).filter(
      (n): n is HTMLTitleElement => n instanceof HTMLTitleElement,
    );
    if (nodes.length === 0) return { state: 'absent' };
    const all = nodes.map((n, i) => {
      const clipped = clip((n.textContent ?? '').trim());
      return {
        raw: clipped.text,
        selector: `title:nth-of-type(${i + 1})`,
        truncated: clipped.truncated,
      };
    });
    const omitted = Math.max(0, all.length - caps.maxMetaItems);
    const values = all.slice(0, caps.maxMetaItems);
    if (all.length > 1) {
      return {
        state: 'duplicate',
        values: values.map((v) => v.raw),
        selectors: values.map((v) => v.selector),
        count: all.length,
        limits: limitsFor(
          omitted,
          all.some((v) => v.truncated),
          'Title duplicate list',
          caps.maxMetaItems,
        ),
      };
    }
    const only = values[0]!;
    if (only.raw === '' && !only.truncated) return { state: 'empty', raw: '', selector: 'title' };
    return {
      state: 'present',
      value: only.raw,
      raw: only.raw,
      selector: 'title',
      count: 1,
      limits: limitsFor(0, only.truncated, 'Title duplicate list', caps.maxMetaItems),
    };
  });

  const metaDescription = safe('metaDescription', () => metaContent('meta[name="description" i]'));

  const metaRobots = safe('metaRobots', (): FieldState => {
    const nodes = Array.from(
      document.querySelectorAll('meta[name="robots" i], meta[name="googlebot" i]'),
    );
    if (nodes.length === 0) return { state: 'absent' };
    const all = nodes.map((n, i) => {
      const name = (n.getAttribute('name') ?? 'robots').toLowerCase();
      const clipped = clip((n.getAttribute('content') ?? '').trim());
      return {
        name,
        content: clipped.text,
        selector: `meta[name="${name}" i]:nth-of-type(${i + 1})`,
        truncated: clipped.truncated,
      };
    });
    const omitted = Math.max(0, all.length - caps.maxMetaItems);
    const values = all.slice(0, caps.maxMetaItems);
    if (all.length > 1) {
      return {
        state: 'duplicate',
        values: values.map(({ name, content, selector }) => ({ name, content, selector })),
        selectors: values.map((v) => v.selector),
        count: all.length,
        limits: limitsFor(
          omitted,
          all.some((v) => v.truncated),
          'Robots duplicate list',
          caps.maxMetaItems,
        ),
      };
    }
    const only = values[0]!;
    if (only.content === '' && !only.truncated) {
      return { state: 'empty', raw: '', selector: only.selector };
    }
    return {
      state: 'present',
      value: { name: only.name, content: only.content, selector: only.selector },
      raw: only.content,
      selector: only.selector,
      count: 1,
      limits: limitsFor(0, only.truncated, 'Robots duplicate list', caps.maxMetaItems),
    };
  });

  const resolveUrl = (href: string): { href: string; absolute: string | null; detail?: string } => {
    try {
      return { href, absolute: new URL(href, document.baseURI).toString() };
    } catch (err) {
      const detail = clip(err instanceof Error ? err.message : String(err)).text;
      return { href, absolute: null, detail };
    }
  };

  const canonical = safe('canonical', (): FieldState => {
    const nodes = Array.from(document.querySelectorAll('link[rel="canonical" i]'));
    if (nodes.length === 0) return { state: 'absent' };
    const all = nodes.map((n, i) => {
      const href = n.getAttribute('href') ?? '';
      const resolved = resolveUrl(href);
      const hrefClipped = clip(href);
      const absoluteClipped = resolved.absolute === null ? null : clip(resolved.absolute);
      const detailClipped = resolved.detail === undefined ? undefined : clip(resolved.detail);
      return {
        href: hrefClipped.text,
        absolute: absoluteClipped?.text ?? null,
        selector: `link[rel="canonical" i]:nth-of-type(${i + 1})`,
        detail: detailClipped?.text,
        truncated:
          hrefClipped.truncated ||
          Boolean(absoluteClipped?.truncated) ||
          Boolean(detailClipped?.truncated),
      };
    });
    const omitted = Math.max(0, all.length - caps.maxMetaItems);
    const values = all.slice(0, caps.maxMetaItems);
    if (all.length > 1) {
      return {
        state: 'duplicate',
        values: values.map(({ truncated: _truncated, ...value }) => value),
        selectors: values.map((v) => v.selector),
        count: all.length,
        limits: limitsFor(
          omitted,
          all.some((v) => v.truncated),
          'Canonical duplicate list',
          caps.maxMetaItems,
        ),
      };
    }
    const only = values[0]!;
    if (!only.href.trim()) {
      return { state: 'empty', raw: '', selector: only.selector };
    }
    if (only.absolute === null) {
      return {
        state: 'malformed',
        raw: only.href,
        selector: only.selector,
        detail: only.detail ?? 'Could not resolve canonical URL',
      };
    }
    return {
      state: 'present',
      value: { href: only.href, absolute: only.absolute },
      raw: only.href,
      selector: only.selector,
      count: 1,
      limits: limitsFor(0, only.truncated, 'Canonical duplicate list', caps.maxMetaItems),
    };
  });

  const alternates = safe('alternates', (): FieldState => {
    const nodes = Array.from(document.querySelectorAll('link[rel="alternate" i][hreflang]'));
    if (nodes.length === 0) return { state: 'absent' };
    const all = nodes.map((n, i) => {
      const href = n.getAttribute('href') ?? '';
      const hreflang = n.getAttribute('hreflang') ?? '';
      const resolved = resolveUrl(href);
      const hrefClipped = clip(href);
      const hreflangClipped = clip(hreflang);
      const absoluteClipped = resolved.absolute === null ? null : clip(resolved.absolute);
      const detailClipped = resolved.detail === undefined ? undefined : clip(resolved.detail);
      return {
        href: hrefClipped.text,
        hreflang: hreflangClipped.text,
        absolute: absoluteClipped?.text ?? null,
        selector: `link[rel="alternate" i][hreflang]:nth-of-type(${i + 1})`,
        detail: detailClipped?.text,
        truncated:
          hrefClipped.truncated ||
          hreflangClipped.truncated ||
          Boolean(absoluteClipped?.truncated) ||
          Boolean(detailClipped?.truncated),
      };
    });
    const omitted = Math.max(0, all.length - caps.maxAlternateItems);
    const values = all
      .slice(0, caps.maxAlternateItems)
      .map(({ truncated: _truncated, ...value }) => value);
    return {
      state: 'present',
      value: values,
      selector: 'link[rel="alternate" i][hreflang]',
      count: all.length,
      limits: limitsFor(
        omitted,
        all.some((v) => v.truncated),
        'Alternate list',
        caps.maxAlternateItems,
      ),
    };
  });

  const namedMetaGroup = (prefix: string, attr: 'property' | 'name'): FieldState => {
    const selector = `meta[${attr}^="${prefix}" i]`;
    const nodes = Array.from(document.querySelectorAll(selector));
    if (nodes.length === 0) return { state: 'absent' };
    const all = nodes.map((n) => {
      const keyClipped = clip(n.getAttribute(attr) ?? '');
      const contentClipped = clip((n.getAttribute('content') ?? '').trim());
      return {
        key: keyClipped.text,
        content: contentClipped.text,
        truncated: keyClipped.truncated || contentClipped.truncated,
      };
    });
    const omitted = Math.max(0, all.length - caps.maxMetaItems);
    const values = all.slice(0, caps.maxMetaItems).map(({ key, content }) => ({ key, content }));
    const stringTruncated = all.some((v) => v.truncated);
    return {
      state: 'present',
      value: values,
      selector,
      count: all.length,
      limits: limitsFor(omitted, stringTruncated, 'Item list', caps.maxMetaItems),
    };
  };

  const openGraph = safe('openGraph', () => namedMetaGroup('og:', 'property'));
  const twitter = safe('twitter', () => namedMetaGroup('twitter:', 'name'));

  const language = safe('language', (): FieldState => {
    const html = document.documentElement;
    if (!html) return { state: 'absent' };
    const clipped = clip((html.getAttribute('lang') ?? '').trim());
    if (clipped.text === '' && !clipped.truncated) {
      return { state: 'empty', raw: '', selector: 'html[lang]' };
    }
    return {
      state: 'present',
      value: clipped.text,
      raw: clipped.text,
      selector: 'html[lang]',
      count: 1,
      limits: clipped.truncated
        ? {
            truncated: true,
            reason: `String clipped to ${caps.maxStringChars} characters`,
          }
        : undefined,
    };
  });

  const viewport = safe('viewport', () => metaContent('meta[name="viewport" i]'));

  const headings = safe('headings', (): FieldState => {
    const levels: Record<string, number> = {
      h1: 0,
      h2: 0,
      h3: 0,
      h4: 0,
      h5: 0,
      h6: 0,
    };
    const samples: { level: string; text: string }[] = [];
    let anyTruncated = false;
    for (const level of Object.keys(levels)) {
      const nodes = Array.from(document.querySelectorAll(level));
      levels[level] = nodes.length;
      for (const n of nodes.slice(0, caps.maxHeadingSamplesPerLevel)) {
        const clipped = clip((n.textContent ?? '').trim());
        if (clipped.truncated) anyTruncated = true;
        samples.push({ level, text: clipped.text });
      }
    }
    return {
      state: 'present',
      value: { levels, samples },
      selector: 'h1–h6',
      count: Object.values(levels).reduce((a, b) => a + b, 0),
      limits: anyTruncated
        ? {
            truncated: true,
            reason: `String clipped to ${caps.maxStringChars} characters`,
          }
        : undefined,
    };
  });

  const links = safe('links', (): FieldState => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    let internal = 0;
    let external = 0;
    let other = 0;
    const pageOrigin = (() => {
      try {
        return new URL(document.URL).origin;
      } catch {
        return null;
      }
    })();
    const inventory: { href: string; absolute: string | null; text: string }[] = [];
    for (const a of anchors) {
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
        other += 1;
      } else {
        try {
          const abs = new URL(href, document.baseURI);
          if (pageOrigin && abs.origin === pageOrigin) internal += 1;
          else if (abs.protocol === 'http:' || abs.protocol === 'https:') external += 1;
          else other += 1;
        } catch {
          other += 1;
        }
      }
      if (inventory.length < caps.maxLinkInventory) {
        const resolved = resolveUrl(href);
        const hrefClipped = clip(href);
        const absoluteClipped = resolved.absolute === null ? null : clip(resolved.absolute);
        const textClipped = clip((a.textContent ?? '').trim());
        inventory.push({
          href: hrefClipped.text,
          absolute: absoluteClipped?.text ?? null,
          text: textClipped.text,
        });
      }
    }
    const omitted = Math.max(0, anchors.length - inventory.length);
    return {
      state: 'present',
      value: { total: anchors.length, internal, external, other, inventory },
      selector: 'a[href]',
      count: anchors.length,
      limits:
        omitted > 0
          ? {
              truncated: true,
              reason: `Link inventory clipped to ${caps.maxLinkInventory} rows`,
              omittedCount: omitted,
            }
          : undefined,
    };
  });

  const images = safe('images', (): FieldState => {
    const imgs = Array.from(document.querySelectorAll('img'));
    let withAlt = 0;
    let emptyAlt = 0;
    let missingAlt = 0;
    const inventory: {
      src: string;
      alt: string | null;
      altState: 'missing' | 'empty' | 'present';
    }[] = [];
    for (const img of imgs) {
      let altState: 'missing' | 'empty' | 'present';
      let alt: string | null;
      if (!img.hasAttribute('alt')) {
        missingAlt += 1;
        altState = 'missing';
        alt = null;
      } else if ((img.getAttribute('alt') ?? '').trim() === '') {
        emptyAlt += 1;
        altState = 'empty';
        alt = '';
      } else {
        withAlt += 1;
        altState = 'present';
        alt = clip(img.getAttribute('alt') ?? '').text;
      }
      if (inventory.length < caps.maxImageInventory) {
        inventory.push({
          src: clip(img.getAttribute('src') ?? '').text,
          alt,
          altState,
        });
      }
    }
    const omitted = Math.max(0, imgs.length - inventory.length);
    return {
      state: 'present',
      value: { total: imgs.length, withAlt, emptyAlt, missingAlt, inventory },
      selector: 'img',
      count: imgs.length,
      limits:
        omitted > 0
          ? {
              truncated: true,
              reason: `Image inventory clipped to ${caps.maxImageInventory} rows`,
              omittedCount: omitted,
            }
          : undefined,
    };
  });

  const html5 = safe('html5', (): FieldState => {
    const tags = ['main', 'nav', 'header', 'footer', 'article', 'section', 'aside'] as const;
    const counts: Record<string, number> = {};
    for (const tag of tags) {
      counts[tag] = document.querySelectorAll(tag).length;
    }
    const doctype = document.doctype ? clip(`<!DOCTYPE ${document.doctype.name}>`).text : null;
    return {
      state: 'present',
      value: {
        doctype,
        counts,
        hasMain: (counts.main ?? 0) > 0,
        landmarkTotal: Object.values(counts).reduce((a, b) => a + b, 0),
      },
      selector: 'main,nav,header,footer,article,section,aside',
      count: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  });

  const jsonLd = safe('jsonLd', (): FieldState => {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json" i]'));
    if (scripts.length === 0) return { state: 'absent' };

    const limitedScripts = scripts.slice(0, caps.maxJsonLdScripts);
    const omittedScripts = Math.max(0, scripts.length - limitedScripts.length);
    let remaining = caps.maxJsonLdChars;
    const entries: JsonLdEntry[] = [];

    for (let i = 0; i < limitedScripts.length; i += 1) {
      const script = limitedScripts[i]!;
      const selector = `script[type="application/ld+json" i]:nth-of-type(${i + 1})`;
      const full = script.textContent ?? '';

      if (remaining <= 0) {
        entries.push({
          index: i,
          selector,
          raw: '',
          truncated: true,
          parseStatus: 'truncated',
          parseDetail: 'JSON-LD budget exhausted; script body was not captured or parsed',
        });
        continue;
      }

      const truncated = full.length > remaining;
      const raw = full.slice(0, remaining);
      remaining -= raw.length;

      // Incomplete captures must not be parsed — a sliced string can look like
      // invalid JSON and would falsely emit jsonld-malformed.
      if (truncated) {
        entries.push({
          index: i,
          selector,
          raw,
          truncated: true,
          parseStatus: 'truncated',
          parseDetail: 'JSON-LD exceeded capture budget; raw text is incomplete and was not parsed',
        });
        continue;
      }

      const trimmed = raw.trim();
      if (trimmed === '') {
        entries.push({
          index: i,
          selector,
          raw,
          truncated: false,
          parseStatus: 'empty',
        });
        continue;
      }

      try {
        JSON.parse(trimmed);
        entries.push({
          index: i,
          selector,
          raw,
          truncated: false,
          parseStatus: 'ok',
        });
      } catch (err) {
        const detail = clip(err instanceof Error ? err.message : String(err)).text;
        entries.push({
          index: i,
          selector,
          raw,
          truncated: false,
          parseStatus: 'invalid-json',
          parseDetail: detail,
        });
      }
    }

    const reasons: string[] = [];
    if (omittedScripts > 0) {
      reasons.push(`JSON-LD script list clipped to ${caps.maxJsonLdScripts} entries`);
    }
    if (entries.some((e) => e.truncated)) {
      reasons.push(`JSON-LD raw text clipped to ${caps.maxJsonLdChars} characters`);
    }

    return {
      state: 'present',
      value: entries,
      selector: 'script[type="application/ld+json" i]',
      count: scripts.length,
      limits:
        reasons.length > 0
          ? {
              truncated: true,
              reason: reasons.join('; '),
              omittedCount: omittedScripts > 0 ? omittedScripts : undefined,
            }
          : undefined,
    };
  });

  const asField = (value: FieldState | DomFacts[keyof DomFacts]): FieldState => {
    if (value && typeof value === 'object' && 'state' in value) {
      return value as FieldState;
    }
    return { state: 'inaccessible', detail: 'Unexpected collector result' };
  };

  return {
    documentUrl: document.URL,
    baseUri: document.baseURI,
    collectedAt,
    title: asField(title as FieldState),
    metaDescription: asField(metaDescription as FieldState),
    metaRobots: asField(metaRobots as FieldState),
    canonical: asField(canonical as FieldState),
    alternates: asField(alternates as FieldState),
    openGraph: asField(openGraph as FieldState),
    twitter: asField(twitter as FieldState),
    language: asField(language as FieldState),
    viewport: asField(viewport as FieldState),
    headings: asField(headings as FieldState),
    links: asField(links as FieldState),
    images: asField(images as FieldState),
    html5: asField(html5 as FieldState),
    jsonLd: asField(jsonLd as FieldState),
  };
}
