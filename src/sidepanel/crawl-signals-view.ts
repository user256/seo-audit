import type { CrawlSignalsModel } from '../lib/dashboard/crawl-signals-model';
import { HREFLANG_CLUSTER_DISPLAY_LIMITS } from '../lib/hreflang/cluster-limits';
import { SOFT_404_DISPLAY_LIMITS } from '../lib/soft-404';
import { VARIANT_TEST_DISPLAY_LIMITS } from '../lib/variants';
import type { VariantKindOptions } from '../lib/variants';

export type CrawlSignalsViewHandlers = {
  onFetchRobots: () => void;
  onFetchSitemap: () => void;
  onValidateHreflangCluster: () => void;
  onCancelHreflangCluster: () => void;
  onRunVariantTests: () => void;
  onCancelVariantTests: () => void;
  onVariantBaseUrlChange: (baseUrl: string) => void;
  onVariantKindChange: (kind: keyof VariantKindOptions, enabled: boolean) => void;
  onRunSoft404Probe: () => void;
  onCancelSoft404Probe: () => void;
  onSoft404ProbeUrlChange: (probeUrl: string) => void;
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

function buildHreflangClusterPanel(
  model: CrawlSignalsModel['hreflangCluster'],
  handlers: CrawlSignalsViewHandlers,
): HTMLDetailsElement {
  const body = el('div', 'crawl-panel-body');
  body.append(el('p', 'lede', model.detail));

  const disclosure = el('p', 'crawl-disclosure');
  disclosure.textContent =
    'This will fetch up to the capped alternate URLs via extension-initiated HTTP(S) requests (no cookies/credentials). It checks return hreflang tags among successfully fetched members only — not Googlebot or crawler parity. You can cancel while it runs.';
  body.append(disclosure);

  const rows: HTMLElement[] = [
    row('Seed URL', model.seedUrl ?? '—'),
    row(
      'Declared alternates',
      model.declaredTotal > 0 ? String(model.declaredTotal) : '—',
      model.declaredTotal === 0 ? 'muted' : undefined,
    ),
    row(
      'Fetch caps',
      `≤ ${model.limits.maxAlternates} alternates · ≤ ${model.limits.maxWallTimeMs / 1000}s wall time`,
      'muted',
    ),
  ];

  if (model.progress && model.validateState === 'busy') {
    rows.push(
      row(
        'Progress',
        `${model.progress.completed} / ${model.progress.total}${model.progress.currentUrl ? ` — ${model.progress.currentUrl}` : ''}`,
      ),
    );
  }

  if (model.result) {
    rows.push(
      row(
        'Fetched members',
        String(model.result.members.filter((member) => member.fetched).length),
      ),
      row('Findings', String(model.result.findings.length)),
      row(
        'Capture errors',
        String(model.result.errors.length),
        model.result.errors.length ? 'error' : undefined,
      ),
    );
    if (model.result.truncation.alternateCapHit) {
      rows.push(row('Truncated', 'Alternate list exceeded fetch cap', 'warn'));
    }
    if (model.result.truncation.wallTimeExceeded) {
      rows.push(row('Wall time', 'Budget exceeded before all targets were fetched', 'warn'));
    }
  }

  appendDl(body, rows);

  if (model.declaredAlternates.length > 0) {
    const list = el('ul', 'dash-list');
    for (const alt of model.declaredAlternates) {
      list.append(el('li', undefined, `${alt.hreflang} → ${alt.href}`));
    }
    body.append(el('p', undefined, 'Captured alternates (fetch targets)'));
    body.append(list);
    appendTruncationNote(body, model.declaredAlternates.length, model.declaredTotal);
  }

  if (model.result?.members.length) {
    const membersDetails = el('details', 'crawl-subpanel');
    membersDetails.append(el('summary', undefined, 'Fetched member results'));
    const memberDl = el('dl', 'dash-dl');
    const shown = model.result.members.slice(0, HREFLANG_CLUSTER_DISPLAY_LIMITS.maxMemberRows);
    for (const member of shown) {
      const summary = member.fetched
        ? `HTTP ${member.status ?? '—'} · ${member.alternates?.length ?? 0} return tag(s)`
        : member.fetchError
          ? `${member.fetchError.code}`
          : 'not fetched';
      memberDl.append(
        row(
          `${member.hreflang} · ${member.requestedUrl}`,
          summary,
          member.fetchError ? 'error' : member.fetched ? undefined : 'muted',
        ),
      );
      if (member.finalUrl && member.finalUrl !== member.requestedUrl) {
        memberDl.append(row('Final URL', member.finalUrl, 'muted'));
      }
    }
    membersDetails.append(memberDl);
    appendTruncationNote(membersDetails, shown.length, model.result.members.length);
    body.append(membersDetails);
  }

  if (model.result?.findings.length) {
    const findingsDetails = el('details', 'crawl-subpanel');
    findingsDetails.append(el('summary', undefined, 'Cluster findings'));
    const list = el('ul', 'dash-list');
    const shown = model.result.findings.slice(0, HREFLANG_CLUSTER_DISPLAY_LIMITS.maxFindings);
    for (const finding of shown) {
      list.append(el('li', undefined, `${finding.severity}: ${finding.description}`));
    }
    findingsDetails.append(list);
    appendTruncationNote(findingsDetails, shown.length, model.result.findings.length);
    body.append(findingsDetails);
  }

  if (model.result?.errors.length) {
    const errList = el('ul', 'dash-list crawl-errors');
    const shown = model.result.errors.slice(0, HREFLANG_CLUSTER_DISPLAY_LIMITS.maxErrors);
    for (const err of shown) {
      errList.append(el('li', undefined, `${err.code}: ${err.message} (${err.url})`));
    }
    body.append(el('p', undefined, 'Fetch capture errors'));
    body.append(errList);
    appendTruncationNote(body, shown.length, model.result.errors.length);
  }

  const actions = el('div', 'crawl-panel-actions');
  const validateBtn = el('button', 'secondary', 'Validate hreflang cluster') as HTMLButtonElement;
  validateBtn.type = 'button';
  validateBtn.id = 'validate-hreflang-cluster';
  validateBtn.disabled =
    model.validateState === 'busy' || model.availability !== 'present' || model.declaredTotal === 0;
  validateBtn.setAttribute('aria-busy', model.validateState === 'busy' ? 'true' : 'false');
  validateBtn.addEventListener('click', handlers.onValidateHreflangCluster);
  actions.append(validateBtn);

  if (model.validateState === 'busy') {
    const cancelBtn = el('button', 'secondary', 'Cancel validation') as HTMLButtonElement;
    cancelBtn.type = 'button';
    cancelBtn.id = 'cancel-hreflang-cluster';
    cancelBtn.addEventListener('click', handlers.onCancelHreflangCluster);
    actions.append(cancelBtn);
  }

  return panel(
    'crawl-panel-hreflang-cluster',
    'Hreflang cluster',
    model.availability,
    body,
    actions,
  );
}

function buildVariantTestsPanel(
  model: CrawlSignalsModel['variantTests'],
  handlers: CrawlSignalsViewHandlers,
): HTMLDetailsElement {
  const body = el('div', 'crawl-panel-body');
  body.append(el('p', 'lede', model.detail));

  const disclosure = el('p', 'crawl-disclosure');
  disclosure.textContent =
    'Extension-initiated HEAD/GET requests (no cookies/credentials) for user-selected URL variants. Results compare final destinations and Link canonical headers where present — observations only, no preferred host.';
  body.append(disclosure);

  const baseField = el('div', 'crawl-field');
  const baseLabel = el('label', undefined, 'Base URL') as HTMLLabelElement;
  baseLabel.htmlFor = 'variant-base-url';
  const baseInput = el('input', undefined) as HTMLInputElement;
  baseInput.type = 'url';
  baseInput.id = 'variant-base-url';
  baseInput.name = 'variant-base-url';
  baseInput.value = model.baseUrl;
  baseInput.disabled = model.runState === 'busy' || model.availability !== 'present';
  baseInput.autocomplete = 'off';
  baseInput.spellcheck = false;
  baseInput.addEventListener('change', () => handlers.onVariantBaseUrlChange(baseInput.value));
  baseField.append(baseLabel, baseInput);
  body.append(baseField);

  const kindsFieldset = el('fieldset', 'crawl-fieldset');
  kindsFieldset.disabled = model.runState === 'busy' || model.availability !== 'present';
  kindsFieldset.append(el('legend', undefined, 'Variant kinds'));
  const kindLabels: Record<keyof VariantKindOptions, string> = {
    scheme: 'HTTP / HTTPS scheme',
    www: 'WWW / non-WWW host',
    trailingSlash: 'Trailing slash',
    case: 'Uppercase host/path',
    indexFilenames: 'Index filenames (index.html, index.php, …)',
  };
  for (const [kind, label] of Object.entries(kindLabels) as [keyof VariantKindOptions, string][]) {
    const wrap = el('label', 'crawl-checkbox');
    const checkbox = el('input') as HTMLInputElement;
    checkbox.type = 'checkbox';
    checkbox.name = `variant-kind-${kind}`;
    checkbox.checked = model.kindOptions[kind];
    checkbox.addEventListener('change', () => handlers.onVariantKindChange(kind, checkbox.checked));
    wrap.append(checkbox, document.createTextNode(` ${label}`));
    kindsFieldset.append(wrap);
  }
  body.append(kindsFieldset);

  const rows: HTMLElement[] = [
    row(
      'Fetch caps',
      `≤ ${model.limits.maxVariants} variants · ≤ ${model.limits.maxWallTimeMs / 1000}s wall time`,
      'muted',
    ),
  ];

  if (model.progress && model.runState === 'busy') {
    rows.push(
      row(
        'Progress',
        `${model.progress.completed} / ${model.progress.total}${model.progress.currentUrl ? ` — ${model.progress.currentUrl}` : ''}`,
      ),
    );
  }

  if (model.result) {
    rows.push(
      row('Variant requests', String(model.result.results.length)),
      row('Final URL groups', String(model.result.finalGroups.length)),
      row(
        'Observations',
        String(model.result.observations.length),
        model.result.observations.length ? 'warn' : undefined,
      ),
    );
  }

  appendDl(body, rows);

  if (model.result?.results.length) {
    const tableWrap = el('div', 'crawl-table-wrap');
    const table = el('table', 'crawl-table');
    table.setAttribute('aria-label', 'URL variant test results');
    const thead = el('thead');
    const headRow = el('tr');
    for (const heading of ['Request URL', 'Final URL', 'Status', 'Hops', 'ms', 'Content-Type']) {
      headRow.append(el('th', undefined, heading));
    }
    thead.append(headRow);
    table.append(thead);

    const tbody = el('tbody');
    const shown = model.result.results.slice(0, VARIANT_TEST_DISPLAY_LIMITS.maxResultRows);
    for (const result of shown) {
      const tr = el('tr');
      if (result.error) tr.classList.add('is-error');
      tr.append(
        el('td', undefined, result.requestUrl),
        el('td', undefined, result.finalUrl ?? '—'),
        el(
          'td',
          undefined,
          result.status != null ? String(result.status) : (result.error?.code ?? '—'),
        ),
        el('td', undefined, String(result.redirectHops.length)),
        el('td', undefined, String(result.elapsedMs)),
        el('td', undefined, result.contentType ?? '—'),
      );
      tbody.append(tr);
    }
    table.append(tbody);
    tableWrap.append(table);
    appendTruncationNote(tableWrap, shown.length, model.result.results.length);
    body.append(tableWrap);
  }

  if (model.result?.observations.length) {
    const obsDetails = el('details', 'crawl-subpanel');
    obsDetails.open = true;
    obsDetails.append(el('summary', undefined, 'Observations'));
    const list = el('ul', 'dash-list');
    const shown = model.result.observations.slice(0, VARIANT_TEST_DISPLAY_LIMITS.maxObservations);
    for (const observation of shown) {
      list.append(el('li', undefined, `${observation.summary} — ${observation.detail}`));
    }
    obsDetails.append(list);
    appendTruncationNote(obsDetails, shown.length, model.result.observations.length);
    body.append(obsDetails);
  }

  const actions = el('div', 'crawl-panel-actions');
  const runBtn = el('button', 'secondary', 'Run variant tests') as HTMLButtonElement;
  runBtn.type = 'button';
  runBtn.id = 'run-variant-tests';
  runBtn.disabled = model.runState === 'busy' || model.availability !== 'present';
  runBtn.setAttribute('aria-busy', model.runState === 'busy' ? 'true' : 'false');
  runBtn.addEventListener('click', handlers.onRunVariantTests);
  actions.append(runBtn);

  if (model.runState === 'busy') {
    const cancelBtn = el('button', 'secondary', 'Cancel tests') as HTMLButtonElement;
    cancelBtn.type = 'button';
    cancelBtn.id = 'cancel-variant-tests';
    cancelBtn.addEventListener('click', handlers.onCancelVariantTests);
    actions.append(cancelBtn);
  }

  return panel('crawl-panel-variant-tests', 'URL variant tests', model.availability, body, actions);
}

function buildSoft404ProbePanel(
  model: CrawlSignalsModel['soft404Probe'],
  handlers: CrawlSignalsViewHandlers,
): HTMLDetailsElement {
  const body = el('div', 'crawl-panel-body');
  body.append(el('p', 'lede', model.detail));

  const disclosure = el('p', 'crawl-disclosure');
  disclosure.textContent =
    'Fetches one user-confirmed nonexistent URL on this origin (no cookies/credentials) and compares it to the audited page. Possible soft-404 observations are heuristic only — not a definitive Google classification. Edit the probe URL before running; you can cancel while it runs.';
  body.append(disclosure);

  const probeField = el('div', 'crawl-field');
  const probeLabel = el('label', undefined, 'Probe URL') as HTMLLabelElement;
  probeLabel.htmlFor = 'soft-404-probe-url';
  const probeInput = el('input', undefined) as HTMLInputElement;
  probeInput.type = 'url';
  probeInput.id = 'soft-404-probe-url';
  probeInput.name = 'soft-404-probe-url';
  probeInput.value = model.probeUrl;
  probeInput.disabled = model.runState === 'busy' || model.availability !== 'present';
  probeInput.autocomplete = 'off';
  probeInput.spellcheck = false;
  probeInput.addEventListener('change', () => handlers.onSoft404ProbeUrlChange(probeInput.value));
  probeField.append(probeLabel, probeInput);
  body.append(probeField);

  const rows: HTMLElement[] = [
    row('Audited URL', model.auditedUrl),
    row(
      'Fetch caps',
      `1 probe + 1 audited page · ≤ ${model.limits.maxWallTimeMs / 1000}s wall time`,
      'muted',
    ),
  ];

  if (model.progress) {
    rows.push(
      row(
        'Progress',
        `${model.progress.phase.replace(/-/g, ' ')}${model.progress.currentUrl ? ` — ${model.progress.currentUrl}` : ''}`,
      ),
    );
  }

  if (model.result) {
    rows.push(
      row(
        'Probe status',
        model.result.probe.status != null ? String(model.result.probe.status) : '—',
      ),
      row('Probe final URL', model.result.probe.finalUrl ?? '—'),
      row('Probe title', model.result.probe.title ?? '—'),
      row('Probe body bytes', String(model.result.probe.bodyByteLength)),
      row('Audited body bytes', String(model.result.audited.bodyByteLength)),
      row(
        'Observations',
        String(model.result.observations.length),
        model.result.observations.length > 0 ? 'warn' : undefined,
      ),
    );
  }

  appendDl(body, rows);

  if (model.result?.observations.length) {
    const list = el('ul', 'crawl-observations');
    list.setAttribute('aria-label', 'Soft-404 probe observations');
    for (const observation of model.result.observations.slice(
      0,
      SOFT_404_DISPLAY_LIMITS.maxObservations,
    )) {
      const item = el('li');
      item.append(
        el('strong', undefined, observation.summary),
        el('p', 'muted', observation.detail),
      );
      list.append(item);
    }
    body.append(list);
  }

  const actions = el('div', 'crawl-panel-actions');
  const runBtn = el('button', 'secondary', 'Run soft-404 probe') as HTMLButtonElement;
  runBtn.type = 'button';
  runBtn.id = 'run-soft-404-probe';
  runBtn.disabled = model.runState === 'busy' || model.availability !== 'present';
  runBtn.setAttribute('aria-busy', model.runState === 'busy' ? 'true' : 'false');
  runBtn.addEventListener('click', handlers.onRunSoft404Probe);
  actions.append(runBtn);

  if (model.runState === 'busy') {
    const cancelBtn = el('button', 'secondary', 'Cancel probe') as HTMLButtonElement;
    cancelBtn.type = 'button';
    cancelBtn.id = 'cancel-soft-404-probe';
    cancelBtn.addEventListener('click', handlers.onCancelSoft404Probe);
    actions.append(cancelBtn);
  }

  return panel('crawl-panel-soft-404', 'Soft-404 probe', model.availability, body, actions);
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
    buildHreflangClusterPanel(model.hreflangCluster, handlers),
    buildVariantTestsPanel(model.variantTests, handlers),
    buildSoft404ProbePanel(model.soft404Probe, handlers),
  );
  container.append(stack);
}
