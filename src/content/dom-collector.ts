/**
 * Page-world DOM collector (Ticket 103).
 *
 * `collectDomFactsInPage` is intentionally self-contained (no imports) so it can
 * be passed to chrome.scripting.executeScript. Helpers used only in the
 * extension process live in dom-facts-to-snapshot.ts.
 */

export const DEFAULT_MAX_JSON_LD_CHARS = 50_000;

export type FieldState =
  | { state: 'absent' }
  | { state: 'empty'; raw: string; selector: string }
  | {
      state: 'present';
      value: unknown;
      raw?: string;
      selector: string;
      count?: number;
    }
  | {
      state: 'duplicate';
      values: unknown[];
      selectors: string[];
      count: number;
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
  jsonLd: FieldState;
};

/**
 * Collect normalised SEO DOM facts from the current page document.
 * Safe to inject via chrome.scripting.executeScript({ func: collectDomFactsInPage }).
 */
export function collectDomFactsInPage(
  maxJsonLdChars: number = DEFAULT_MAX_JSON_LD_CHARS,
): DomFacts {
  const collectedAt = new Date().toISOString();

  const safe = <T>(label: string, fn: () => T): T | FieldState => {
    try {
      return fn();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { state: 'inaccessible', detail: `${label}: ${detail}` };
    }
  };

  const metaContent = (selector: string): FieldState => {
    const nodes = Array.from(document.querySelectorAll(selector));
    if (nodes.length === 0) return { state: 'absent' };
    const values = nodes.map((n) => {
      const raw = (n.getAttribute('content') ?? '').trim();
      return { raw, selector };
    });
    if (values.length > 1) {
      return {
        state: 'duplicate',
        values: values.map((v) => v.raw),
        selectors: values.map((v) => v.selector),
        count: values.length,
      };
    }
    const only = values[0]!;
    if (only.raw === '') return { state: 'empty', raw: '', selector };
    return { state: 'present', value: only.raw, raw: only.raw, selector, count: 1 };
  };

  const title = safe('title', (): FieldState => {
    const nodes = Array.from(document.querySelectorAll('title'));
    if (nodes.length === 0) return { state: 'absent' };
    const values = nodes.map((n, i) => ({
      raw: (n.textContent ?? '').trim(),
      selector: `title:nth-of-type(${i + 1})`,
    }));
    if (values.length > 1) {
      return {
        state: 'duplicate',
        values: values.map((v) => v.raw),
        selectors: values.map((v) => v.selector),
        count: values.length,
      };
    }
    const only = values[0]!;
    if (only.raw === '') return { state: 'empty', raw: '', selector: 'title' };
    return { state: 'present', value: only.raw, raw: only.raw, selector: 'title', count: 1 };
  });

  const metaDescription = safe('metaDescription', () => metaContent('meta[name="description" i]'));

  const metaRobots = safe('metaRobots', (): FieldState => {
    const nodes = Array.from(
      document.querySelectorAll('meta[name="robots" i], meta[name="googlebot" i]'),
    );
    if (nodes.length === 0) return { state: 'absent' };
    const values = nodes.map((n, i) => {
      const name = (n.getAttribute('name') ?? 'robots').toLowerCase();
      const content = (n.getAttribute('content') ?? '').trim();
      return {
        name,
        content,
        selector: `meta[name="${name}" i]:nth-of-type(${i + 1})`,
      };
    });
    if (values.length > 1) {
      return {
        state: 'duplicate',
        values,
        selectors: values.map((v) => v.selector),
        count: values.length,
      };
    }
    const only = values[0]!;
    if (only.content === '') {
      return { state: 'empty', raw: '', selector: only.selector };
    }
    return {
      state: 'present',
      value: only,
      raw: only.content,
      selector: only.selector,
      count: 1,
    };
  });

  const resolveUrl = (href: string): { href: string; absolute: string | null; detail?: string } => {
    try {
      return { href, absolute: new URL(href, document.baseURI).toString() };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { href, absolute: null, detail };
    }
  };

  const canonical = safe('canonical', (): FieldState => {
    const nodes = Array.from(document.querySelectorAll('link[rel="canonical" i]'));
    if (nodes.length === 0) return { state: 'absent' };
    const values = nodes.map((n, i) => {
      const href = n.getAttribute('href') ?? '';
      const resolved = resolveUrl(href);
      return {
        href,
        absolute: resolved.absolute,
        selector: `link[rel="canonical" i]:nth-of-type(${i + 1})`,
        detail: resolved.detail,
      };
    });
    if (values.length > 1) {
      return {
        state: 'duplicate',
        values,
        selectors: values.map((v) => v.selector),
        count: values.length,
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
    };
  });

  const alternates = safe('alternates', (): FieldState => {
    const nodes = Array.from(document.querySelectorAll('link[rel="alternate" i][hreflang]'));
    if (nodes.length === 0) return { state: 'absent' };
    const values = nodes.map((n, i) => {
      const href = n.getAttribute('href') ?? '';
      const hreflang = n.getAttribute('hreflang') ?? '';
      const resolved = resolveUrl(href);
      return {
        href,
        hreflang,
        absolute: resolved.absolute,
        selector: `link[rel="alternate" i][hreflang]:nth-of-type(${i + 1})`,
        detail: resolved.detail,
      };
    });
    return {
      state: 'present',
      value: values,
      selector: 'link[rel="alternate" i][hreflang]',
      count: values.length,
    };
  });

  const namedMetaGroup = (prefix: string, attr: 'property' | 'name'): FieldState => {
    const selector = `meta[${attr}^="${prefix}" i]`;
    const nodes = Array.from(document.querySelectorAll(selector));
    if (nodes.length === 0) return { state: 'absent' };
    const values = nodes.map((n) => ({
      key: n.getAttribute(attr) ?? '',
      content: (n.getAttribute('content') ?? '').trim(),
    }));
    return {
      state: 'present',
      value: values,
      selector,
      count: values.length,
    };
  };

  const openGraph = safe('openGraph', () => namedMetaGroup('og:', 'property'));
  const twitter = safe('twitter', () => namedMetaGroup('twitter:', 'name'));

  const language = safe('language', (): FieldState => {
    const html = document.documentElement;
    if (!html) return { state: 'absent' };
    const raw = (html.getAttribute('lang') ?? '').trim();
    if (raw === '') return { state: 'empty', raw: '', selector: 'html[lang]' };
    return { state: 'present', value: raw, raw, selector: 'html[lang]', count: 1 };
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
    for (const level of Object.keys(levels)) {
      const nodes = Array.from(document.querySelectorAll(level));
      levels[level] = nodes.length;
      for (const n of nodes.slice(0, 5)) {
        samples.push({
          level,
          text: (n.textContent ?? '').trim().slice(0, 120),
        });
      }
    }
    return {
      state: 'present',
      value: { levels, samples },
      selector: 'h1–h6',
      count: Object.values(levels).reduce((a, b) => a + b, 0),
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
    for (const a of anchors) {
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
        other += 1;
        continue;
      }
      try {
        const abs = new URL(href, document.baseURI);
        if (pageOrigin && abs.origin === pageOrigin) internal += 1;
        else if (abs.protocol === 'http:' || abs.protocol === 'https:') external += 1;
        else other += 1;
      } catch {
        other += 1;
      }
    }
    return {
      state: 'present',
      value: { total: anchors.length, internal, external, other },
      selector: 'a[href]',
      count: anchors.length,
    };
  });

  const images = safe('images', (): FieldState => {
    const imgs = Array.from(document.querySelectorAll('img'));
    let withAlt = 0;
    let emptyAlt = 0;
    let missingAlt = 0;
    for (const img of imgs) {
      if (!img.hasAttribute('alt')) missingAlt += 1;
      else if ((img.getAttribute('alt') ?? '').trim() === '') emptyAlt += 1;
      else withAlt += 1;
    }
    return {
      state: 'present',
      value: { total: imgs.length, withAlt, emptyAlt, missingAlt },
      selector: 'img',
      count: imgs.length,
    };
  });

  const jsonLd = safe('jsonLd', (): FieldState => {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json" i]'));
    if (scripts.length === 0) return { state: 'absent' };

    let remaining = maxJsonLdChars;
    const entries: JsonLdEntry[] = [];
    for (let i = 0; i < scripts.length; i += 1) {
      const script = scripts[i]!;
      const selector = `script[type="application/ld+json" i]:nth-of-type(${i + 1})`;
      const full = script.textContent ?? '';
      if (remaining <= 0) {
        entries.push({
          index: i,
          selector,
          raw: '',
          truncated: true,
          parseStatus: 'truncated',
          parseDetail: 'JSON-LD budget exhausted',
        });
        continue;
      }
      const truncated = full.length > remaining;
      const raw = full.slice(0, remaining);
      remaining -= raw.length;
      const trimmed = raw.trim();
      if (trimmed === '') {
        entries.push({
          index: i,
          selector,
          raw,
          truncated,
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
          truncated,
          parseStatus: 'ok',
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        entries.push({
          index: i,
          selector,
          raw,
          truncated,
          parseStatus: 'invalid-json',
          parseDetail: detail,
        });
      }
    }
    return {
      state: 'present',
      value: entries,
      selector: 'script[type="application/ld+json" i]',
      count: entries.length,
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
    jsonLd: asField(jsonLd as FieldState),
  };
}
