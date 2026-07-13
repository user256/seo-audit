# Ticket 203: XML Sitemap and Hreflang Parser

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Done  
**Owner:** unassigned  
**Estimate:** L

## Context

Sitemap discovery helps connect page observations to a site’s declared URL set.
XML needs defensive parsing because sitemap indexes can be malformed, large, or
point at other hosts. Broad HTTP(S) host access (Ticket 212) removes per-origin
grant friction; this ticket still caps recursion and entry counts.

## Goal

Discover and safely inspect sitemap URLs, sitemap indexes, URL entries, and
sitemap hreflang annotations relevant to the current audit.

## Acceptance criteria

- [x] Discover candidate sitemaps from parsed robots directives and common
  same-origin locations; present candidates for the user to select (including
  pasted URLs).
- [x] Parse `urlset` and `sitemapindex` XML with a non-executing parser, hard
  response-size/depth/entry limits, namespace-aware fields, and explicit errors.
- [x] Record `loc`, `lastmod`, `changefreq`, `priority`, and `xhtml:link`
  alternate annotations; normalise URLs without discarding original evidence.
- [x] A selected sitemap reports whether the audited final URL appears, and its
  URL entries can be compared against Robots evaluation without fetching every
  entry.
- [x] Tests cover URL sets, indexes, namespaces, malformed XML, cross-host
  sitemap URLs, recursion/limit handling, and hreflang alternates.

## Out of scope

- Unbounded crawl of every child sitemap or live check of every listed URL.
- Sitemap submission/search-console integration.
- XML entity expansion or DTD processing.
- Live page-cluster hreflang fetch (Ticket 213).

## Dependencies

- **Blocks:** 204, 205, 207
- **Blocked by:** 102, 202, 206, 212
- **External:** none (host access via 212)

## Approach

### Duplicate from `hreflang-pro` (behaviour / shapes — rewrite in TypeScript)

Source: `/home/user256/GitRepos/Chrome-extensions/hreflang-pro/hreflang-pro/`.
Do **not** copy regex-as-final-parser or UI. Port these as pure, fixture-tested
modules behind Ticket 206’s safe fetch (host access from Ticket 212):

| Source | Port into |
|---|---|
| `parseSitemapXml` result shape: `isIndex`, `childSitemaps[]`, `entries: Map<loc, xhtmlLinks[]>` | `src/lib/sitemap/parse-xml.ts` |
| `(xhtml:)?link` alternate extraction → `{ hreflang, href }` | same; also keep raw attribute evidence |
| `fetchSitemapRecursive` visited-set + hard file cap (25) + timeout + `truncated` flag | `src/lib/sitemap/limits.ts` + fetch wrapper on 206 |
| Direct sitemap URL vs `origin + /sitemap.xml` discovery modes | discovery candidate list (user selects) |
| Manual pasted sitemap URL list | candidate input in crawl-signals UI (205) |
| Multi-origin probe from `<loc>` / alternate href origins (capped) | allowed under 212; still record each fetched host in evidence |

Also **add** fields Hreflang Pro drops: `lastmod`, `changefreq`, `priority`.
Use a non-executing, namespace-aware XML parser (no DTD / entity expansion) —
regex is only a behaviour reference, not the shipped parser.

### Explicitly do **not** duplicate

- Unbounded recursive crawl of every child sitemap or live check of every `loc`.
- Twemoji / score / matrix UI.

## Notes / decisions log

- 2026-07-13 — Plunder pass against Hreflang Pro Slight Return: marked the table
  above for duplication; fetch stays behind 206; host access via 212 (broad
  HTTP(S), not per-origin Allow).
- 2026-07-13 — Implemented src/lib/sitemap parse/discover/fetch with caps; tests green.
