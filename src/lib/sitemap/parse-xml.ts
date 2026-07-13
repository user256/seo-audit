import { SITEMAP_LIMITS, type SitemapLimits } from './limits';

function mergeLimits(overrides?: Partial<SitemapLimits>): SitemapLimits {
  return { ...SITEMAP_LIMITS, ...overrides };
}

/** Known safe XML entities — no DTD / external entity expansion. */
const SAFE_XML_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

export type SitemapAlternate = {
  hreflang: string;
  href: string;
  rel?: string;
  /** Raw attribute evidence from the source tag. */
  rawAttributes: Record<string, string>;
};

export type SitemapUrlEntry = {
  /** Trimmed loc value used as the map key. */
  loc: string;
  /** Original loc text from the XML (before trimming). */
  locRaw: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  alternates: SitemapAlternate[];
};

export type SitemapChildRef = {
  loc: string;
  locRaw: string;
  lastmod?: string;
};

export type SitemapParseSuccess = {
  ok: true;
  kind: 'urlset' | 'sitemapindex';
  isIndex: boolean;
  entries: Map<string, SitemapUrlEntry>;
  childSitemaps: SitemapChildRef[];
  truncated: boolean;
  diagnostics: string[];
};

export type SitemapParseFailure = {
  ok: false;
  error: string;
  diagnostics: string[];
};

export type SitemapParseResult = SitemapParseSuccess | SitemapParseFailure;

function textContent(el: Element | null | undefined): string | undefined {
  if (!el) return undefined;
  const value = el.textContent ?? '';
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function elementsByLocalName(parent: Element | Document, localName: string): Element[] {
  const out: Element[] = [];
  const walk = (node: Element): void => {
    if (node.localName === localName) out.push(node);
    for (const child of node.children) walk(child);
  };
  if (parent instanceof Document) {
    if (parent.documentElement) walk(parent.documentElement);
  } else {
    walk(parent);
  }
  return out;
}

function childByLocalName(parent: Element, localName: string): Element | undefined {
  for (const child of parent.children) {
    if (child.localName === localName) return child;
  }
  return undefined;
}

function parseLinkAttributes(tag: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of tag.attributes) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

function extractAlternates(urlBlock: Element): SitemapAlternate[] {
  const alternates: SitemapAlternate[] = [];
  for (const child of urlBlock.children) {
    if (child.localName !== 'link') continue;
    const rawAttributes = parseLinkAttributes(child);
    const rel = (rawAttributes.rel ?? rawAttributes.Rel ?? '').toLowerCase();
    if (rel && rel !== 'alternate') continue;
    const hreflang = rawAttributes.hreflang ?? rawAttributes.Hreflang;
    const href = rawAttributes.href ?? rawAttributes.Href;
    if (!hreflang || !href) continue;
    alternates.push({
      hreflang: hreflang.toLowerCase(),
      href,
      rel: rel || 'alternate',
      rawAttributes,
    });
  }
  return alternates;
}

/**
 * Reject DOCTYPE and unsafe entity references before DOM parsing.
 */
export function sanitizeSitemapXml(xml: string): { ok: true; xml: string } | { ok: false; error: string } {
  const trimmed = xml.replace(/^\uFEFF/, '').trimStart();
  if (/<!DOCTYPE/i.test(trimmed)) {
    return { ok: false, error: 'DOCTYPE declarations are not allowed in sitemap XML.' };
  }

  const entityPattern = /&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;
  let match: RegExpExecArray | null;
  while ((match = entityPattern.exec(trimmed)) !== null) {
    const name = match[1];
    if (name.startsWith('#')) continue;
    if (!SAFE_XML_ENTITIES.has(name)) {
      return {
        ok: false,
        error: `Unsafe XML entity "&${name};" is not allowed (no DTD / entity expansion).`,
      };
    }
  }

  return { ok: true, xml: trimmed };
}

function parserErrorMessage(doc: Document): string | null {
  const root = doc.documentElement;
  if (!root) return 'XML document has no root element.';
  if (root.localName === 'parsererror' || root.tagName === 'parsererror') {
    return (root.textContent ?? 'XML parse error').trim();
  }
  const err = doc.querySelector('parsererror');
  if (err) return (err.textContent ?? 'XML parse error').trim();
  return null;
}

/**
 * Non-executing, namespace-aware parse of sitemap urlset / sitemapindex XML.
 */
export function parseSitemapXml(
  rawXml: string,
  options?: { limits?: Partial<SitemapLimits> },
): SitemapParseResult {
  const limits = mergeLimits(options?.limits);
  const diagnostics: string[] = [];

  if (rawXml.length > limits.maxBytes) {
    return {
      ok: false,
      error: `Sitemap XML exceeded ${limits.maxBytes} bytes.`,
      diagnostics: [`Input length ${rawXml.length} exceeds maxBytes.`],
    };
  }

  const sanitized = sanitizeSitemapXml(rawXml);
  if (!sanitized.ok) {
    return { ok: false, error: sanitized.error, diagnostics: [sanitized.error] };
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(sanitized.xml, 'application/xml');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `XML parser failed: ${message}`, diagnostics: [message] };
  }

  const parseErr = parserErrorMessage(doc);
  if (parseErr) {
    return { ok: false, error: `Malformed sitemap XML: ${parseErr}`, diagnostics: [parseErr] };
  }

  const root = doc.documentElement;
  if (!root) {
    return { ok: false, error: 'Sitemap XML has no root element.', diagnostics: [] };
  }

  const rootLocal = root.localName;
  if (rootLocal !== 'urlset' && rootLocal !== 'sitemapindex') {
    return {
      ok: false,
      error: `Unexpected root element <${root.tagName}>; expected urlset or sitemapindex.`,
      diagnostics: [`Root localName: ${rootLocal}`],
    };
  }

  const isIndex = rootLocal === 'sitemapindex';
  const entries = new Map<string, SitemapUrlEntry>();
  const childSitemaps: SitemapChildRef[] = [];
  let truncated = false;

  if (isIndex) {
    const blocks = elementsByLocalName(root, 'sitemap');
    for (const block of blocks) {
      const locEl = childByLocalName(block, 'loc');
      const locRaw = locEl?.textContent ?? '';
      const loc = locRaw.trim();
      if (!loc) {
        diagnostics.push('sitemapindex entry missing <loc>.');
        continue;
      }
      childSitemaps.push({
        loc,
        locRaw,
        lastmod: textContent(childByLocalName(block, 'lastmod')),
      });
    }
  } else {
    const blocks = elementsByLocalName(root, 'url');
    for (const block of blocks) {
      if (entries.size >= limits.maxEntries) {
        truncated = true;
        diagnostics.push(
          `Entry count exceeded ${limits.maxEntries}; remaining <url> elements ignored.`,
        );
        break;
      }
      const locEl = childByLocalName(block, 'loc');
      const locRaw = locEl?.textContent ?? '';
      const loc = locRaw.trim();
      if (!loc) {
        diagnostics.push('url entry missing <loc>.');
        continue;
      }
      const entry: SitemapUrlEntry = {
        loc,
        locRaw,
        lastmod: textContent(childByLocalName(block, 'lastmod')),
        changefreq: textContent(childByLocalName(block, 'changefreq')),
        priority: textContent(childByLocalName(block, 'priority')),
        alternates: extractAlternates(block),
      };
      if (!entries.has(loc)) {
        entries.set(loc, entry);
      } else {
        diagnostics.push(`Duplicate <loc> ${loc}; first entry retained.`);
      }
    }
  }

  return {
    ok: true,
    kind: isIndex ? 'sitemapindex' : 'urlset',
    isIndex,
    entries,
    childSitemaps,
    truncated,
    diagnostics,
  };
}
