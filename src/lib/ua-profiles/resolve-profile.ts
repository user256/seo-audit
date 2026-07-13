import { UA_PROFILE_LIMITS } from './limits';
import { GOOGLEBOT_STYLE_USER_AGENT, GOOGLEBOT_STYLE_USER_AGENT_SOURCE_NOTE } from './profiles';
import type { UaProfileResult, UaProfileSelection } from './types';

/** Always true, regardless of profile — never claim the active tab or navigator.userAgent changed. */
const SCOPE_DISCLOSURE =
  'Changes the HTTP User-Agent header on extension-initiated fetches only (variant tests, ' +
  'soft-404 probe, hreflang cluster validation). Does not change the active browser tab or ' +
  'navigator.userAgent — this is never a browser navigation.';

/**
 * Chrome does not currently guarantee a `fetch()`-set `User-Agent` header
 * reaches the destination server unmodified for extension-initiated requests
 * without the `declarativeNetRequest` permission — which this extension does
 * not request, to preserve least privilege (see CLAUDE.md, `docs/ua-profiles.md`).
 * The safe-fetch response alone cannot confirm which User-Agent value the
 * server actually received.
 */
const HEADER_RELIABILITY_DISCLOSURE =
  'Best-effort only: Chrome may silently ignore a fetch()-set User-Agent header without the ' +
  'declarativeNetRequest permission, which this extension does not request to preserve least ' +
  'privilege. The response cannot confirm which User-Agent value the server actually received.';

const LOCAL_ONLY_DISCLOSURE =
  'Never applied to background browsing, other tabs, or automatically to future runs beyond this profile choice.';

function browserDefaultResult(extraLimitations: string[] = []): UaProfileResult {
  return {
    profileId: 'browser-default',
    label: 'Browser default',
    userAgent: null,
    method: 'none',
    limitations: [
      "Uses the extension fetch's own default User-Agent header (no override attempted).",
      SCOPE_DISCLOSURE,
      ...extraLimitations,
    ],
  };
}

function googlebotStyleResult(): UaProfileResult {
  return {
    profileId: 'googlebot-style',
    label: 'Googlebot-style (static)',
    userAgent: GOOGLEBOT_STYLE_USER_AGENT,
    method: 'extension-fetch-header',
    limitations: [
      SCOPE_DISCLOSURE,
      HEADER_RELIABILITY_DISCLOSURE,
      GOOGLEBOT_STYLE_USER_AGENT_SOURCE_NOTE,
      'Not a claim of Googlebot rendering or crawling parity — see docs/googlebot-style-experiment.md (Ticket 304, deferred).',
    ],
  };
}

// Deliberately matches control characters (incl. CR/LF) to reject header-injection-prone input.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/;

/**
 * Resolve a UA profile selection into a concrete, disclosed result.
 *
 * Never fails: an empty, over-length, or invalid custom string falls back to
 * the browser-default profile (no override) with a limitation explaining why,
 * so callers never need a separate error branch before running a probe.
 */
export function resolveUaProfile(selection: UaProfileSelection): UaProfileResult {
  if (selection.id === 'browser-default') return browserDefaultResult();
  if (selection.id === 'googlebot-style') return googlebotStyleResult();

  const raw = selection.customUserAgent;
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return browserDefaultResult([
      'Custom User-Agent was empty; used browser-default (no header override) instead.',
    ]);
  }
  if (trimmed.length > UA_PROFILE_LIMITS.maxCustomUaChars) {
    return browserDefaultResult([
      `Custom User-Agent exceeded ${UA_PROFILE_LIMITS.maxCustomUaChars} characters ` +
        `(${trimmed.length} provided); used browser-default (no header override) instead.`,
    ]);
  }
  if (CONTROL_CHARS_RE.test(trimmed)) {
    return browserDefaultResult([
      'Custom User-Agent contained control characters and was rejected; used browser-default ' +
        '(no header override) instead.',
    ]);
  }

  return {
    profileId: 'custom',
    label: 'Custom',
    userAgent: trimmed,
    method: 'extension-fetch-header',
    limitations: [SCOPE_DISCLOSURE, HEADER_RELIABILITY_DISCLOSURE, LOCAL_ONLY_DISCLOSURE],
  };
}
