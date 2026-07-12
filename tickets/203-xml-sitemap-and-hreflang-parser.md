# Ticket 203: XML Sitemap and Hreflang Parser

**Sprint:** 2 — Crawl and Index Signals  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** L

## Context

Sitemap discovery helps connect page observations to a site’s declared URL set.
XML needs defensive parsing because sitemap indexes can be malformed, large, or
point at ungranted origins.

## Goal

Discover and safely inspect sitemap URLs, sitemap indexes, URL entries, and
sitemap hreflang annotations relevant to the current audit.

## Acceptance criteria

- [ ] Discover candidate sitemaps from parsed robots directives and common
  same-origin locations; present candidates for the user to select.
- [ ] Parse `urlset` and `sitemapindex` XML with a non-executing parser, hard
  response-size/depth/entry limits, namespace-aware fields, and explicit errors.
- [ ] Record `loc`, `lastmod`, `changefreq`, `priority`, and `xhtml:link`
  alternate annotations; normalise URLs without discarding original evidence.
- [ ] A selected sitemap reports whether the audited final URL appears, and its
  URL entries can be compared against Robots evaluation without fetching every
  entry.
- [ ] Tests cover URL sets, indexes, namespaces, malformed XML, external
  sitemap URLs, recursion/limit handling, and hreflang alternates.

## Out of scope

- Crawling every child sitemap or checking every listed URL live.
- Sitemap submission/search-console integration.
- XML entity expansion or DTD processing.

## Dependencies

- **Blocks:** 204, 205
- **Blocked by:** 102, 202
- **External:** permission request for a user-selected external sitemap origin

