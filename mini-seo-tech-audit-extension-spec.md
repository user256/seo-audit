# Chrome Extension Concept: Mini SEO Technical Audit Toolkit

## Overview

The goal is to build a Chrome extension that provides tools + an optional wizard to help a user performs a comprehensive technical SEO audit as you browse a website. Rather than being a
crawler, it acts as an intelligent inspection tool that continuously
evaluates the current site and records findings in a structured way.

## Core Features
### 0. essentials
-   user-agent switcher
-   css/js toggles
-   xml sitemap parser (+hreflang)
-   txt file parser
-   redirect analysis


### 1. Robots.txt Analysis

-   Automatically fetch the site's `robots.txt` when a domain is first
    visited.
-   Determine whether the current page is crawlable according to the
    rules.
-   Cache the `robots.txt` for the session and evaluate every subsequent
    page against it.
-   Highlight any crawl restrictions or unexpected directives.

### 2. HTTP Header Inspection

Inspect response headers for SEO-relevant signals, including:

-   HTTP status code
-   Redirect chains
-   X-Robots-Tag
-   Content-Type
-   Cache headers
-   Other SEO-relevant response headers

Flag unexpected or conflicting configurations.

### 3. HTML SEO Audit

Analyse the page source for:

-   Meta robots (`noindex`, `nofollow`, etc.)
-   Canonical tags
-   Hreflang
-   Title
-   Meta description
-   Open Graph / Twitter tags (optional)
-   Structured data
-   Other important technical SEO signals

Identify missing, conflicting or invalid implementations.

### 4. Sitemap Audit

Provide tools to:

-   Discover sitemap locations
-   Parse sitemap indexes
-   Validate sitemap contents
-   Compare sitemap URLs against robots.txt restrictions
-   Highlight broken or unusual sitemap configurations.

------------------------------------------------------------------------

## Rendering & JavaScript Audits

### JavaScript Difference Test

Allow JavaScript to be disabled for the current page and compare:

-   Raw HTML
-   Rendered HTML
-   DOM differences
-   Missing content
-   Missing links
-   Missing metadata

This helps identify heavy client-side rendering issues.

### Googlebot Rendering Simulation

Simulate a simplified Googlebot rendering process by:

-   Visiting the page with a Googlebot-style user agent
-   Using a large desktop viewport
-   Not scrolling
-   Not interacting with the page
-   Waiting exactly five seconds
-   Stopping JavaScript execution after exactly 5 seconds 
-   Capturing the rendered DOM

Compare this output against the normal browser render to identify:

-   Hidden content
-   Hydration failures
-   Delayed rendering
-   JavaScript-dependent SEO problems
-   Cloaking or content inconsistencies

------------------------------------------------------------------------

## Site-Level Testing

### Soft 404 Detection

Automatically determine whether nonexistent URLs correctly return:

-   `404`
-   `410`

instead of incorrectly returning:

-   `200 OK`
-   Redirects
-   Soft 404 pages

### URL Variant Testing

Allow users to define one or more URLs for automated testing.

For each URL, evaluate variations such as:

-   HTTP vs HTTPS
-   www vs non-www
-   Trailing slash vs no trailing slash
-   Uppercase vs lowercase (where relevant)
-   Index file variations
-   Redirect behaviour
-   Canonical destination

Record redirect chains and identify inconsistencies.

------------------------------------------------------------------------

## Issue Detection Engine

Every audit should produce structured findings rather than just raw
data.

Each issue should include:

-   Severity
-   Category
-   Description
-   Evidence
-   Affected URL
-   Recommended fix
-   Relevant specification or SEO best practice

Example issues:

-   Page blocked by robots.txt
-   Canonical points elsewhere
-   Conflicting noindex and canonical
-   Missing canonical
-   Sitemap contains blocked URLs
-   Soft 404 detected
-   JavaScript rendering mismatch
-   Googlebot render differs from user render
-   Incorrect redirect chain

------------------------------------------------------------------------

## Data Storage

Persist audit results in a local database (with optional future cloud
sync), allowing:

-   Multiple audit sessions
-   Historical comparisons
-   Site-level issue aggregation
-   Exporting previous audits

------------------------------------------------------------------------

## Outputs

Support exporting findings in multiple formats:

-   Markdown reports
-   JSON
-   API responses
-   Potential future integrations with external SEO tools

------------------------------------------------------------------------

## Vision

The extension is intended to function as an **interactive technical SEO
inspection and auditing platform** rather than a traditional crawler. As
you browse a website, it continuously evaluates crawlability, indexing
signals, rendering behaviour, HTTP responses, URL consistency, and other
technical SEO factors, storing structured findings that can be exported
as reports or consumed programmatically via an API.

The emphasis is on surfacing actionable issues through intelligent
analysis of both page-level and site-level behaviour, making it a
lightweight but powerful companion for technical SEO investigations.
