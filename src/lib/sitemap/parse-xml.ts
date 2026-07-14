import { SITEMAP_LIMITS, type SitemapLimits } from './limits';
import {
  parseSimpleXml,
  simpleChildByLocalName,
  simpleElementRawText,
  simpleElementText,
  simpleElementsByLocalName,
  type SimpleElement,
} from './simple-xml';

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

function parseLinkAttributes(tag: SimpleElement): Record<string, string> {
  return { ...tag.attributes };
}

function extractAlternates(urlBlock: SimpleElement): SitemapAlternate[] {
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
export function sanitizeSitemapXml(
  xml: string,
): { ok: true; xml: string } | { ok: false; error: string } {
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

function parseXmlDocument(
  xml: string,
): { ok: true; root: SimpleElement } | { ok: false; error: string } {
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const domErr = domParserErrorMessage(doc);
      if (domErr) return { ok: false, error: domErr };
      const root = doc.documentElement;
      if (!root) return { ok: false, error: 'XML document has no root element.' };
      return { ok: true, root: domElementToSimple(root) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  const parsed = parseSimpleXml(xml);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const root = parsed.doc.documentElement;
  if (!root) return { ok: false, error: 'XML document has no root element.' };
  return { ok: true, root };
}

function domParserErrorMessage(doc: Document): string | null {
  const root = doc.documentElement;
  if (!root) return 'XML document has no root element.';
  if (root.localName === 'parsererror' || root.tagName === 'parsererror') {
    return (root.textContent ?? 'XML parse error').trim();
  }
  const err = doc.querySelector('parsererror');
  if (err) return (err.textContent ?? 'XML parse error').trim();
  return null;
}

function domElementToSimple(el: Element): SimpleElement {
  const attributes: Record<string, string> = {};
  for (const attr of el.attributes) {
    attributes[attr.name] = attr.value;
  }
  const children: SimpleElement[] = [];
  for (const child of el.children) {
    children.push(domElementToSimple(child));
  }
  let directText = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
      directText += node.textContent ?? '';
    }
  }
  return {
    tagName: el.tagName,
    localName: el.localName,
    attributes,
    children,
    directText,
  };
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

  const parsed = parseXmlDocument(sanitized.xml);
  if (!parsed.ok) {
    const message = parsed.error;
    return {
      ok: false,
      error: `Malformed sitemap XML: ${message}`,
      diagnostics: [message],
    };
  }

  const root = parsed.root;
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
    const blocks = simpleElementsByLocalName(root, 'sitemap');
    for (const block of blocks) {
      const locEl = simpleChildByLocalName(block, 'loc');
      const locRaw = simpleElementRawText(locEl);
      const loc = locRaw.trim();
      if (!loc) {
        diagnostics.push('sitemapindex entry missing <loc>.');
        continue;
      }
      childSitemaps.push({
        loc,
        locRaw,
        lastmod: simpleElementText(simpleChildByLocalName(block, 'lastmod')),
      });
    }
  } else {
    const blocks = simpleElementsByLocalName(root, 'url');
    for (const block of blocks) {
      if (entries.size >= limits.maxEntries) {
        truncated = true;
        diagnostics.push(
          `Entry count exceeded ${limits.maxEntries}; remaining <url> elements ignored.`,
        );
        break;
      }
      const locEl = simpleChildByLocalName(block, 'loc');
      const locRaw = simpleElementRawText(locEl);
      const loc = locRaw.trim();
      if (!loc) {
        diagnostics.push('url entry missing <loc>.');
        continue;
      }
      const entry: SitemapUrlEntry = {
        loc,
        locRaw,
        lastmod: simpleElementText(simpleChildByLocalName(block, 'lastmod')),
        changefreq: simpleElementText(simpleChildByLocalName(block, 'changefreq')),
        priority: simpleElementText(simpleChildByLocalName(block, 'priority')),
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
