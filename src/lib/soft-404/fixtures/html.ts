/** HTML fixtures for soft-404 probe scenarios (Ticket 302). */

export function pageShell(title: string, body: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`;
}

export const AUDITED_PRODUCT = pageShell(
  'Blue Widget',
  '<main><h1>Blue Widget</h1><p>Premium widget for your shop.</p><p>SKU 12345</p></main>',
);

export const PROBE_TRUE_404 = null;

export const PROBE_TRUE_410 = null;

export const PROBE_ERROR_TEMPLATE = pageShell(
  '404 Not Found',
  '<main><h1>404 Not Found</h1><p>Sorry, that page does not exist.</p></main>',
);

export const PROBE_IDENTICAL_TEMPLATE = AUDITED_PRODUCT;

export const PROBE_DISTINCT_VALID = pageShell(
  'Promotions',
  '<main><h1>Spring Sale</h1><p>Save 20% on selected widgets this week only.</p></main>',
);

export const PROBE_SPA_SHELL = pageShell(
  'Blue Widget',
  '<div id="root"><h1>Blue Widget</h1><p>Premium widget for your shop.</p></div>',
);
