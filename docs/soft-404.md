# Soft-404 probe (Ticket 302)

Conservative, user-started comparison that fetches one nonexistent URL on the
audited origin and compares the response to the audited page. Results are
**observations only** — never a definitive Google or server soft-404 verdict.

## Flow

1. Generate an opaque `/seo-audit-probe-{random}` path on the audited origin.
2. Show the probe URL to the user; allow edit or cancel before any fetch.
3. Fetch probe and audited URLs via `safeFetch` (`credentials: 'omit`, redirect
   cap 10, body cap 512 KB).
4. Record status, final URL, content type, title, body length/hash, and a
   bounded text fingerprint for both responses.
5. Emit `soft-404-possible` observations when documented heuristics fire.

## Documented thresholds

Defined in `src/lib/soft-404/limits.ts` (`SOFT_404_HEURISTICS`):

| Signal                                                   | Threshold                          | Observation kind       |
| -------------------------------------------------------- | ---------------------------------- | ---------------------- |
| Token Jaccard similarity (probe vs audited fingerprints) | ≥ 0.85                             | `similar-content`      |
| Identical bounded body hash with HTTP 2xx probe          | exact match                        | `identical-body-hash`  |
| Near-equal body size + moderate overlap (SPA shell)      | ratio 0.8–1.2 and similarity ≥ 0.6 | `spa-fallback`         |
| Deep-path probe redirects to site root                   | final pathname `/`                 | `redirect-to-home`     |
| HTTP 2xx with error-style title (`404`, `not found`, …)  | regex match                        | `error-template-title` |

A probe returning **404** or **410** produces **no** soft-404 observation — that
is correct HTTP semantics. Only success/redirect-final-success responses are
evaluated.

## IDs

| Kind                 | Value               |
| -------------------- | ------------------- |
| Observation `ruleId` | `soft-404-possible` |
| Evidence source key  | `soft-404-probe`    |
| Fetch source label   | `extension-fetch`   |

## Limits

- One probe URL per user action.
- Wall-time budget: 60 s (`SOFT_404_PROBE_LIMITS.maxWallTimeMs`).
- Fingerprint text cap: 2 000 chars (`maxFingerprintChars`).
- Non-HTTP(S) URLs and cross-origin probes are rejected before fetch.

## Out of scope

Search-engine soft-404 classification parity, automated monitoring, and
cookie/credential replay.
