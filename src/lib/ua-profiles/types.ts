/**
 * User-agent profiles for extension-initiated network probes (Ticket 305).
 *
 * Ticket 304 decided **defer** for a debugger-backed rendered-tab experiment
 * (`src/lib/googlebot-spike/decision.ts`), so this module only ever affects
 * the outgoing `User-Agent` header of `safeFetch` calls made by the variant
 * tests, soft-404 probe, and hreflang cluster validation features. It never
 * changes the active browser tab, `navigator.userAgent`, or any browser
 * navigation.
 */

export type UaProfileId = 'browser-default' | 'googlebot-style' | 'custom';

/**
 * How the profile was (attempted to be) applied.
 * - `extension-fetch-header`: a `User-Agent` header override was attempted on
 *   an extension-initiated `fetch()` call. Chrome does not guarantee this
 *   header reaches the destination server unmodified (see limitations).
 * - `none`: no override was attempted; the request used whatever User-Agent
 *   the extension's own fetch default sends.
 */
export type UaProfileMethod = 'extension-fetch-header' | 'none';

export type UaProfileDefinition = {
  id: UaProfileId;
  label: string;
  shortDescription: string;
};

export type UaProfileSelection =
  | { id: 'browser-default' }
  | { id: 'googlebot-style' }
  | { id: 'custom'; customUserAgent: string };

/**
 * Recorded outcome of resolving a `UaProfileSelection`. Every affected
 * network-probe result carries one of these so the report shows exactly
 * which profile, UA string, and method produced it.
 */
export type UaProfileResult = {
  profileId: UaProfileId;
  label: string;
  /** Exact UA string used on the fetch header, or null when no override was attempted. */
  userAgent: string | null;
  method: UaProfileMethod;
  limitations: string[];
};
