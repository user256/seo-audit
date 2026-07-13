const PROBE_SEGMENT = 'seo-audit-probe';
const SAFE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomSegment(length = 16): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)]!;
  }
  return out;
}

/** Opaque, URL-safe path segment that is unlikely to exist on the target site. */
export function generateOpaqueProbePath(): string {
  return `/${PROBE_SEGMENT}-${randomSegment()}`;
}

export type BuildProbeUrlResult =
  | { ok: true; origin: string; probeUrl: string; probePath: string }
  | { ok: false; code: 'invalid-url' | 'unsupported-scheme'; message: string };

/**
 * Build a default probe URL under the audited page origin.
 * Callers may let the user edit the returned URL before fetching.
 */
export function buildDefaultProbeUrl(
  auditedUrl: string,
  probePath: string = generateOpaqueProbePath(),
): BuildProbeUrlResult {
  let parsed: URL;
  try {
    parsed = new URL(auditedUrl);
  } catch {
    return {
      ok: false,
      code: 'invalid-url',
      message: `Audited URL is not absolute/parseable: ${auditedUrl}`,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      code: 'unsupported-scheme',
      message: `Only http(s) URLs may be probed (received ${parsed.protocol}).`,
    };
  }

  const normalizedPath = probePath.startsWith('/') ? probePath : `/${probePath}`;
  const probeUrl = new URL(normalizedPath, parsed.origin).href;

  return {
    ok: true,
    origin: parsed.origin,
    probeUrl,
    probePath: normalizedPath,
  };
}

export type ValidateProbeUrlResult =
  | { ok: true; origin: string; probeUrl: string; auditedOrigin: string }
  | { ok: false; code: 'invalid-url' | 'unsupported-scheme' | 'cross-origin'; message: string };

/** Validate a user-edited probe URL against the audited page origin. */
export function validateProbeUrl(auditedUrl: string, probeUrl: string): ValidateProbeUrlResult {
  let audited: URL;
  let probe: URL;
  try {
    audited = new URL(auditedUrl);
    probe = new URL(probeUrl);
  } catch {
    return {
      ok: false,
      code: 'invalid-url',
      message: 'Probe or audited URL is not absolute/parseable.',
    };
  }

  if (audited.protocol !== 'http:' && audited.protocol !== 'https:') {
    return {
      ok: false,
      code: 'unsupported-scheme',
      message: `Only http(s) audited URLs are supported (received ${audited.protocol}).`,
    };
  }
  if (probe.protocol !== 'http:' && probe.protocol !== 'https:') {
    return {
      ok: false,
      code: 'unsupported-scheme',
      message: `Only http(s) probe URLs may be fetched (received ${probe.protocol}).`,
    };
  }

  if (probe.origin !== audited.origin) {
    return {
      ok: false,
      code: 'cross-origin',
      message: `Probe URL must stay on the audited origin (${audited.origin}).`,
    };
  }

  return {
    ok: true,
    origin: probe.origin,
    probeUrl: probe.href,
    auditedOrigin: audited.origin,
  };
}
