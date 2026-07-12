export const FIXTURE_DUPLICATE_CANONICAL = `<!doctype html>
<html lang="en">
  <head>
    <title>Duplicate canonical</title>
    <link rel="canonical" href="/a" />
    <link rel="canonical" href="/b" />
  </head>
  <body></body>
</html>`;

export const FIXTURE_MULTIPLE_ROBOTS = `<!doctype html>
<html lang="en">
  <head>
    <title>Robots</title>
    <meta name="robots" content="noindex" />
    <meta name="googlebot" content="nofollow" />
  </head>
  <body></body>
</html>`;

export const FIXTURE_MALFORMED_JSON_LD = `<!doctype html>
<html lang="en">
  <head>
    <title>JSON-LD</title>
    <script type="application/ld+json">{ not json </script>
    <script type="application/ld+json">{"@type":"WebPage","name":"Ok"}</script>
  </head>
  <body></body>
</html>`;

export const FIXTURE_RELATIVE_URLS = `<!doctype html>
<html lang="en">
  <head>
    <base href="https://example.com/shop/" />
    <title>Relative</title>
    <link rel="canonical" href="../product" />
    <link rel="alternate" hreflang="fr" href="fr/product" />
    <meta name="description" content="A product" />
  </head>
  <body>
    <a href="/about">About</a>
    <a href="https://other.test/x">External</a>
  </body>
</html>`;

export const FIXTURE_NO_HEAD = `<!doctype html>
<html>
  <body>
    <h1>No head</h1>
    <img src="/a.png" />
    <img src="/b.png" alt="" />
    <img src="/c.png" alt="Logo" />
  </body>
</html>`;

/** Oversized meta/OG/Twitter/hreflang payloads for Ticket 107 caps. */
export function fixtureOversizedMeta(opts: {
  ogCount: number;
  twitterCount: number;
  alternateCount: number;
  stringChars: number;
}): string {
  const long = 'x'.repeat(opts.stringChars);
  const og = Array.from(
    { length: opts.ogCount },
    (_, i) => `<meta property="og:tag${i}" content="${long}" />`,
  ).join('\n');
  const twitter = Array.from(
    { length: opts.twitterCount },
    (_, i) => `<meta name="twitter:tag${i}" content="${long}" />`,
  ).join('\n');
  const alternates = Array.from(
    { length: opts.alternateCount },
    (_, i) => `<link rel="alternate" hreflang="x-a${i}" href="https://example.com/l/${i}" />`,
  ).join('\n');
  return `<!doctype html>
<html lang="en">
  <head>
    <title>${long}</title>
    <meta name="description" content="${long}" />
    <link rel="canonical" href="https://example.com/page" />
    ${og}
    ${twitter}
    ${alternates}
  </head>
  <body></body>
</html>`;
}

/** Valid JSON-LD document larger than the capture budget (must not become invalid-json). */
export function fixtureBudgetTruncatedJsonLd(budgetChars: number): string {
  const payload = JSON.stringify({
    '@type': 'WebPage',
    name: 'Budget truncated',
    description: 'y'.repeat(Math.max(budgetChars, 10)),
  });
  return `<!doctype html>
<html lang="en">
  <head>
    <title>Budget JSON-LD page title</title>
    <meta name="description" content="Budget JSON-LD" />
    <link rel="canonical" href="https://example.com/jsonld" />
    <script type="application/ld+json">${payload}</script>
  </head>
  <body>
    <img src="/ok.png" alt="Diagram" />
  </body>
</html>`;
}

export const FIXTURE_EMPTY_VS_ABSENT_ALT = `<!doctype html>
<html lang="en">
  <head>
    <title>Alt attribute distinctions</title>
    <meta name="description" content="Empty versus absent alt." />
    <link rel="canonical" href="https://example.com/alt" />
  </head>
  <body>
    <img src="/missing.png" />
    <img src="/empty.png" alt="" />
    <img src="/ok.png" alt="Product photo" />
  </body>
</html>`;

export const FIXTURE_NON_HTTP_CANONICAL = `<!doctype html>
<html lang="en">
  <head>
    <title>Non-HTTP canonical page title</title>
    <meta name="description" content="Canonical is javascript." />
    <link rel="canonical" href="javascript:void(0)" />
    <link rel="alternate" hreflang="fr" href="mailto:fr@example.com" />
  </head>
  <body></body>
</html>`;

export const FIXTURE_ROBOTS_NONE = `<!doctype html>
<html lang="en">
  <head>
    <title>Robots none directive page</title>
    <meta name="description" content="Uses none token." />
    <meta name="robots" content="none" />
    <link rel="canonical" href="https://example.com/none" />
  </head>
  <body></body>
</html>`;

export const FIXTURE_ROBOTS_SUBSTRING_TRAP = `<!doctype html>
<html lang="en">
  <head>
    <title>Robots substring trap page</title>
    <meta name="description" content="Should not match noindex via substring." />
    <meta name="robots" content="max-snippet:10, index" />
    <link rel="canonical" href="https://example.com/trap" />
  </head>
  <body></body>
</html>`;
