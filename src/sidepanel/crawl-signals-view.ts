import type { CrawlSignalsModel } from '../lib/dashboard/crawl-signals-model';

export type CrawlSignalsViewHandlers = {
  onFetchRobots: () => void;
  onFetchSitemap: () => void;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function row(label: string, value: string, tone?: 'muted' | 'warn' | 'error'): HTMLElement {
  const wrap = el('div', 'dash-row');
  const ddClass =
    tone === 'warn' ? 'is-warn' : tone === 'error' ? 'is-error' : tone === 'muted' ? 'muted' : '';
  wrap.append(el('dt', undefined, label), el('dd', ddClass || undefined, value));
  return wrap;
}

function availabilityBadge(availability: string, detail?: string): HTMLElement {
  const badge = el('span', `crawl-availability crawl-availability-${availability}`);
  badge.setAttribute('role', 'status');
  const label = availability.replace(/-/g, ' ');
  badge.setAttribute('aria-label', `Signal availability: ${label}`);
  badge.textContent = label;
  if (detail) badge.title = detail;
  return badge;
}

function formatIso(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function appendDl(parent: HTMLElement, rows: HTMLElement[]): void {
  const dl = el('dl', 'dash-dl');
  for (const r of rows) dl.append(r);
  parent.append(dl);
}

function appendTruncationNote(parent: HTMLElement, shown: number, total: number): void {
  if (total <= shown) return;
  parent.append(el('p', 'crawl-truncation', `Showing ${shown} of ${total}.`));
}

function panel(
  id: string,
  title: string,
  availability: string,
  body: HTMLElement,
  actions?: HTMLElement,
): HTMLDetailsElement {
  const details = el('details', 'crawl-panel') as HTMLDetailsElement;
  details.id = id;
  details.open = id === 'crawl-panel-navigation';

  const summary = el('summary', 'crawl-panel-summary');
  summary.append(el('span', 'crawl-panel-title', title), availabilityBadge(availability));
  details.append(summary, body);
  if (actions) details.append(actions);
  return details;
}

function buildNavigationPanel(model: CrawlSignalsModel['navigation']): HTMLElement {
  const body = el('div', 'crawl-panel-body');
  body.append(el('p', 'lede', model.detail));

  const rows: HTMLElement[] = [
    row('Source URL', model.sourceUrl ?? '—'),
    row('Captured at', formatIso(model.capturedAt)),
    row(
      'Status code',
      model.statusCode != null ? String(model.statusCode) : 'Not captured yet',
      model.availability === 'present' ? undefined : 'warn',
    ),
    row(
      'X-Robots-Tag',
      model.xRobotsTag.value,
      model.xRobotsTag.state === 'unavailable'
        ? 'warn'
        : model.xRobotsTag.state === 'absent'
          ? 'muted'
          : undefined,
    ),
  ];

  if (model.redirectHops.length > 0) {
    const journey = model.redirectHops
      .map((hop) => (hop.status != null ? `${hop.status} → ${hop.url}` : hop.url))
      .join(' → ');
    rows.push(row('Redirect journey', journey));
    appendTruncationNote(body, model.redirectHops.length, model.redirectTotal);
  }

  appendDl(body, rows);

  if (model.headerEntries.length > 0) {
    const headersDetails = el('details', 'crawl-subpanel');
    headersDetails.append(el('summary', undefined, 'Response headers'));
    const headerDl = el('dl', 'dash-dl');
    for (const entry of model.headerEntries) {
      headerDl.append(row(entry.name, entry.value));
    }
    headersDetails.append(headerDl);
    appendTruncationNote(headersDetails, model.headerEntries.length, model.headerTotal);
    body.append(headersDetails);
  }

  return panel('crawl-panel-navigation', 'Navigation & headers', model.availability, body);
}

function profileRow(label: string, profile: CrawlSignalsModel['robots']['googlebot']): HTMLElement {
  if (!profile) return row(label, '—');
  const decision = profile.crawlable ? 'crawlable' : 'blocked';
  const value = `${decision} (${profile.reason})${profile.matchedRule ? ` — ${profile.matchedRule}` : ''}`;
  return row(label, value, profile.crawlable ? undefined : 'warn');
}

function buildRobotsPanel(
  model: CrawlSignalsModel['robots'],
  handlers: CrawlSignalsViewHandlers,
): HTMLDetailsElement {
  const body = el('div', 'crawl-panel-body');
  body.append(el('p', 'lede', model.detail));

  const rows: HTMLElement[] = [
    row('Requested URL', model.requestedUrl ?? '—'),
    row('Final URL', model.finalUrl ?? '—'),
    row('HTTP status', model.status != null ? String(model.status) : '—'),
    row('Fetched at', formatIso(model.fetchedAt)),
  ];
  rows.push(profileRow('Googlebot', model.googlebot));
  rows.push(profileRow('User-agent: *', model.wildcard));

  if (model.error) {
    rows.push(row('Capture error', `${model.error.code}: ${model.error.message}`, 'error'));
  }

  appendDl(body, rows);

  if (model.redirectHops.length > 0) {
    const hopDetails = el('details', 'crawl-subpanel');
    hopDetails.append(el('summary', undefined, 'Redirect hops'));
    const hopDl = el('dl', 'dash-dl');
    for (const hop of model.redirectHops) {
      hopDl.append(row(`${hop.status}`, `${hop.fromUrl} → ${hop.toUrl}`));
    }
    hopDetails.append(hopDl);
    appendTruncationNote(hopDetails, model.redirectHops.length, model.redirectTotal);
    body.append(hopDetails);
  }

  if (model.sitemapDirectives.length > 0) {
    const list = el('ul', 'dash-list');
    for (const url of model.sitemapDirectives) {
      list.append(el('li', undefined, url));
    }
    body.append(el('p', undefined, 'Sitemap directives in robots.txt'));
    body.append(list);
    appendTruncationNote(body, model.sitemapDirectives.length, model.sitemapDirectivesTotal);
  }

  const actions = el('div', 'crawl-panel-actions');
  const fetchBtn = el('button', 'secondary', 'Fetch robots') as HTMLButtonElement;
  fetchBtn.type = 'button';
  fetchBtn.id = 'fetch-robots';
  fetchBtn.disabled = model.fetchState === 'busy' || model.availability === 'needs-access';
  fetchBtn.setAttribute('aria-busy', model.fetchState === 'busy' ? 'true' : 'false');
  fetchBtn.addEventListener('click', handlers.onFetchRobots);
  actions.append(fetchBtn);

  return panel('crawl-panel-robots', 'robots.txt', model.availability, body, actions);
}

function buildSitemapPanel(
  model: CrawlSignalsModel['sitemap'],
  handlers: CrawlSignalsViewHandlers,
): HTMLDetailsElement {
  const body = el('div', 'crawl-panel-body');
  body.append(el('p', 'lede', model.detail));

  const rows: HTMLElement[] = [
    row(
      'Audited URL membership',
      model.membership.detail,
      model.membership.state === 'absent'
        ? 'warn'
        : model.membership.state === 'unavailable'
          ? 'muted'
          : undefined,
    ),
  ];
  if (model.membership.matchedLoc) {
    rows.push(row('Matched loc', model.membership.matchedLoc));
  }
  if (model.membership.lastmod) {
    rows.push(row('lastmod', model.membership.lastmod));
  }
  rows.push(
    row('Parsed entries', model.entryCount > 0 ? String(model.entryCount) : '—'),
    row(
      'Parse limits',
      `≤ ${model.limits.maxFiles} files · ≤ ${model.limits.maxEntries} entries · ≤ ${model.limits.maxBytes} bytes per file`,
      'muted',
    ),
  );
  if (model.parseTruncated) {
    rows.push(row('Truncated', 'Yes — walk or entry limits were hit', 'warn'));
  }
  if (model.error) {
    rows.push(row('Capture error', `${model.error.code}: ${model.error.message}`, 'error'));
  }

  appendDl(body, rows);

  if (model.candidates.length > 0) {
    const candDetails = el('details', 'crawl-subpanel');
    candDetails.append(el('summary', undefined, 'Sitemap candidates'));
    const list = el('ul', 'dash-list');
    for (const candidate of model.candidates) {
      list.append(el('li', undefined, `${candidate.url} (${candidate.source})`));
    }
    candDetails.append(list);
    appendTruncationNote(candDetails, model.candidates.length, model.candidatesTotal);
    body.append(candDetails);
  }

  if (model.fetchedFiles.length > 0) {
    const filesDetails = el('details', 'crawl-subpanel');
    filesDetails.append(el('summary', undefined, 'Fetched sitemap files'));
    const fileDl = el('dl', 'dash-dl');
    for (const file of model.fetchedFiles) {
      const summary = `${file.kind} · ${file.entryCount} entries`;
      fileDl.append(
        row(
          file.url,
          file.error ? `${summary} — ${file.error.code}` : summary,
          file.error ? 'error' : undefined,
        ),
      );
      if (file.finalUrl !== file.url) {
        fileDl.append(row('Final URL', file.finalUrl, 'muted'));
      }
    }
    filesDetails.append(fileDl);
    appendTruncationNote(filesDetails, model.fetchedFiles.length, model.fetchedFilesTotal);
    body.append(filesDetails);
  }

  if (model.errors.length > 0) {
    const errList = el('ul', 'dash-list crawl-errors');
    for (const err of model.errors) {
      errList.append(el('li', undefined, `${err.code}: ${err.message}`));
    }
    body.append(el('p', undefined, 'Additional capture errors'));
    body.append(errList);
  }

  const actions = el('div', 'crawl-panel-actions');
  const fetchBtn = el('button', 'secondary', 'Discover & fetch sitemap') as HTMLButtonElement;
  fetchBtn.type = 'button';
  fetchBtn.id = 'fetch-sitemap';
  fetchBtn.disabled = model.fetchState === 'busy' || model.availability === 'needs-access';
  fetchBtn.setAttribute('aria-busy', model.fetchState === 'busy' ? 'true' : 'false');
  fetchBtn.addEventListener('click', handlers.onFetchSitemap);
  actions.append(fetchBtn);

  return panel('crawl-panel-sitemap', 'Sitemap', model.availability, body, actions);
}

export function renderCrawlSignalsPanel(
  container: HTMLElement,
  model: CrawlSignalsModel,
  handlers: CrawlSignalsViewHandlers,
): void {
  container.replaceChildren();
  container.hidden = false;

  const heading = el('h2', undefined, 'Crawl signals');
  heading.id = 'crawl-signals-heading';
  container.setAttribute('aria-labelledby', 'crawl-signals-heading');
  container.append(heading);

  container.append(
    el(
      'p',
      'lede',
      'Direct capture facts for navigation, robots.txt, and sitemap membership. Findings reconcile these signals below.',
    ),
  );

  const meta = el('dl', 'facts crawl-meta');
  meta.append(row('Audited URL', model.auditedUrl), row('Origin', model.origin));
  container.append(meta);

  const stack = el('div', 'crawl-panels');
  stack.append(
    buildNavigationPanel(model.navigation),
    buildRobotsPanel(model.robots, handlers),
    buildSitemapPanel(model.sitemap, handlers),
  );
  container.append(stack);
}
