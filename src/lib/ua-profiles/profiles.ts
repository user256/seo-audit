import type { UaProfileDefinition, UaProfileId } from './types';

/**
 * Static, documented Googlebot Desktop User-Agent string.
 *
 * Source: Google Search Central, "Googlebot" and "Google's common crawlers"
 * (https://developers.google.com/search/docs/crawling-indexing/googlebot,
 * https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers).
 * Google documents Googlebot Desktop as most commonly sending an "evergreen"
 * string with a live Chrome version placeholder
 * (`Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1;
 * +http://www.google.com/bot.html) Chrome/W.X.Y.Z Safari/537.36`), which drifts
 * every time Googlebot's underlying Chrome build updates and would go stale in
 * this codebase without an update pipeline. Google's own docs also list a
 * second, static string that Googlebot Desktop "rarely" sends but that never
 * changes — that stable string is used here deliberately, so the constant
 * cannot silently go stale between releases. See `docs/ua-profiles.md` for the
 * full disclosure.
 */
export const GOOGLEBOT_STYLE_USER_AGENT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

export const GOOGLEBOT_STYLE_USER_AGENT_SOURCE_NOTE =
  'Static, documented Googlebot Desktop User-Agent string (Google Search Central). ' +
  'Real Googlebot traffic most often sends the evergreen `Chrome/W.X.Y.Z` variant instead; ' +
  'this stable string was chosen so the constant does not go stale between releases. ' +
  'See docs/ua-profiles.md.';

export const UA_PROFILE_DEFINITIONS: Record<UaProfileId, UaProfileDefinition> = {
  'browser-default': {
    id: 'browser-default',
    label: 'Browser default',
    shortDescription: "No User-Agent override — uses the extension fetch's own default header.",
  },
  'googlebot-style': {
    id: 'googlebot-style',
    label: 'Googlebot-style (static)',
    shortDescription:
      'Attempts a static, documented Googlebot Desktop User-Agent header on extension fetches only.',
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    shortDescription:
      'Attempts a user-provided User-Agent header on extension fetches only. Local-only, length-capped.',
  },
};
