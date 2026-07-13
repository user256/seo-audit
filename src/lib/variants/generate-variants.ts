import { DEFAULT_INDEX_FILENAMES } from './limits';
import type {
  GeneratedVariant,
  GenerateVariantsResult,
  VariantKind,
  VariantKindOptions,
} from './types';

function variantKey(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

function isHttpUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function isIpOrLocalhost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  if (hostname.includes(':')) return true;
  return false;
}

function addVariant(
  bucket: Map<string, GeneratedVariant>,
  url: string,
  kind: VariantKind,
  label: string,
): void {
  if (!isHttpUrl(url)) return;
  const key = variantKey(url);
  if (bucket.has(key)) return;
  bucket.set(key, { url: key, kind, label });
}

function schemeVariants(parsed: URL, bucket: Map<string, GeneratedVariant>): void {
  const flipped = parsed.protocol === 'https:' ? 'http:' : 'https:';
  const next = new URL(parsed.href);
  next.protocol = flipped;
  addVariant(bucket, next.href, 'scheme', flipped === 'https:' ? 'HTTPS scheme' : 'HTTP scheme');
}

function wwwVariants(parsed: URL, bucket: Map<string, GeneratedVariant>): void {
  if (isIpOrLocalhost(parsed.hostname)) return;
  const host = parsed.hostname.toLowerCase();
  const next = new URL(parsed.href);
  if (host.startsWith('www.')) {
    next.hostname = host.slice(4);
    addVariant(bucket, next.href, 'www', 'Non-www host');
  } else {
    next.hostname = `www.${host}`;
    addVariant(bucket, next.href, 'www', 'WWW host');
  }
}

function trailingSlashVariants(parsed: URL, bucket: Map<string, GeneratedVariant>): void {
  const next = new URL(parsed.href);
  if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
    next.pathname = parsed.pathname.slice(0, -1);
    addVariant(bucket, next.href, 'trailing-slash', 'Without trailing slash');
    return;
  }
  if (!parsed.pathname.endsWith('/')) {
    next.pathname = `${parsed.pathname}/`;
    addVariant(bucket, next.href, 'trailing-slash', 'With trailing slash');
  }
}

function caseVariants(parsed: URL, bucket: Map<string, GeneratedVariant>): void {
  const next = new URL(parsed.href);
  if (!isIpOrLocalhost(parsed.hostname)) {
    next.hostname = parsed.hostname
      .split('.')
      .map((label) => label.toUpperCase())
      .join('.');
  }
  if (parsed.pathname && parsed.pathname !== '/') {
    next.pathname = parsed.pathname
      .split('/')
      .map((segment) => segment.toUpperCase())
      .join('/');
  }
  addVariant(bucket, next.href, 'case', 'Uppercase host/path');
}

function endsWithIndexFilename(pathname: string, filenames: readonly string[]): boolean {
  const lower = pathname.toLowerCase();
  return filenames.some((name) => lower.endsWith(`/${name}`) || lower === `/${name}`);
}

function indexFilenameVariants(
  parsed: URL,
  bucket: Map<string, GeneratedVariant>,
  filenames: readonly string[],
): void {
  if (endsWithIndexFilename(parsed.pathname, filenames)) return;

  for (const filename of filenames) {
    const next = new URL(parsed.href);
    if (parsed.pathname.endsWith('/')) {
      next.pathname = `${parsed.pathname}${filename}`;
    } else {
      next.pathname = `${parsed.pathname}/${filename}`;
    }
    addVariant(bucket, next.href, 'index-filename', `Index file ${filename}`);
  }
}

/**
 * Generate bounded URL variants from a user-selected base URL.
 * Always includes the base URL; optional kinds add alternates. Output is deduped.
 */
export function generateVariants(
  baseUrl: string,
  kindOptions: VariantKindOptions,
  indexFilenames: readonly string[] = DEFAULT_INDEX_FILENAMES,
): GenerateVariantsResult {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl.trim());
  } catch {
    return {
      ok: false,
      code: 'invalid-url',
      message: `URL is not absolute/parseable: ${baseUrl}`,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      code: 'unsupported-scheme',
      message: `Only http(s) URLs may be tested (received ${parsed.protocol}).`,
    };
  }

  const bucket = new Map<string, GeneratedVariant>();
  const normalizedBase = parsed.href;
  addVariant(bucket, normalizedBase, 'base', 'Base URL');

  if (kindOptions.scheme) schemeVariants(parsed, bucket);
  if (kindOptions.www) wwwVariants(parsed, bucket);
  if (kindOptions.trailingSlash) trailingSlashVariants(parsed, bucket);
  if (kindOptions.case) caseVariants(parsed, bucket);
  if (kindOptions.indexFilenames) indexFilenameVariants(parsed, bucket, indexFilenames);

  const variants = [...bucket.values()].sort((a, b) => a.url.localeCompare(b.url));
  return {
    ok: true,
    baseUrl: normalizedBase,
    variants,
    dedupedCount: variants.length,
  };
}
