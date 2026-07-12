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
