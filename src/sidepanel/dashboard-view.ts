import {
  formatImagesForClipboard,
  formatLinksForClipboard,
  type SeoDashboardModel,
} from '../lib/dashboard/model';

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

function row(label: string, value: string, tone?: 'muted' | 'warn'): HTMLElement {
  const wrap = el('div', 'dash-row');
  wrap.append(el('dt', undefined, label), el('dd', tone === 'warn' ? 'is-warn' : tone, value));
  return wrap;
}

function availabilityLabel(availability: SeoDashboardModel['status']['availability']): string {
  if (availability === 'needs-access') return 'Needs site access';
  if (availability === 'unavailable') return 'Not captured yet';
  return 'Captured';
}

export function renderSeoDashboard(container: HTMLElement, model: SeoDashboardModel): void {
  container.replaceChildren();
  container.hidden = false;

  const heading = el('h2', undefined, 'Page glance');
  heading.id = 'dashboard-heading';
  container.setAttribute('aria-labelledby', 'dashboard-heading');
  container.append(heading);

  const lede = el(
    'p',
    'lede',
    model.inventoryLoaded
      ? 'Inventory from the live tab. Start audit runs rule tests and saves a session.'
      : model.accessGranted
        ? 'Site access is granted — loading page inventory (or Refresh if this looks stuck).'
        : 'Allow this site to load status, redirects, and page inventory.',
  );
  container.append(lede);

  const grid = el('div', 'dash-grid');

  const network = el('section', 'dash-card');
  network.append(el('h3', undefined, 'HTTP & journey'));
  const netDl = el('dl', 'dash-dl');
  netDl.append(
    row(
      'Status code',
      model.status.code != null
        ? String(model.status.code)
        : availabilityLabel(model.status.availability),
      model.status.availability === 'present' ? undefined : 'warn',
    ),
  );
  netDl.append(row('Status detail', model.status.detail, 'muted'));
  if (model.journey.hops.length > 0) {
    netDl.append(
      row(
        'Journey',
        model.journey.hops
          .map((h) => (h.status != null ? `${h.status} → ${h.url}` : h.url))
          .join(' → '),
      ),
    );
  } else {
    netDl.append(row('Journey', availabilityLabel(model.journey.availability), 'warn'));
  }
  netDl.append(row('Journey detail', model.journey.detail, 'muted'));
  network.append(netDl);
  grid.append(network);

  const index = el('section', 'dash-card');
  index.append(el('h3', undefined, 'Indexability'));
  index.append(el('p', 'dash-badge', model.indexability.status));
  index.append(el('p', 'lede', model.indexability.summary));
  const idxDl = el('dl', 'dash-dl');
  for (const item of model.indexability.rows) {
    idxDl.append(row(`${item.label} (${item.source})`, item.value));
  }
  index.append(idxDl);
  grid.append(index);

  const meta = el('section', 'dash-card');
  meta.append(el('h3', undefined, 'Title & description'));
  const metaDl = el('dl', 'dash-dl');
  metaDl.append(row('Title', model.title));
  metaDl.append(row('Meta description', model.description));
  meta.append(metaDl);
  grid.append(meta);

  const structure = el('section', 'dash-card');
  structure.append(el('h3', undefined, 'Structure'));
  if (model.headings) {
    const levels = Object.entries(model.headings.levels)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k.toUpperCase()}: ${n}`)
      .join(' · ');
    structure.append(el('p', undefined, levels || 'No headings'));
    if (model.headings.samples.length > 0) {
      const list = el('ul', 'dash-list');
      for (const sample of model.headings.samples.slice(0, 12)) {
        list.append(
          el('li', undefined, `${sample.level.toUpperCase()} — ${sample.text || '(empty)'}`),
        );
      }
      structure.append(list);
    }
  } else {
    structure.append(el('p', 'lede', 'Heading hierarchy unavailable until inventory loads.'));
  }
  if (model.html5) {
    const tags = Object.entries(model.html5.counts)
      .map(([k, n]) => `${k}: ${n}`)
      .join(' · ');
    structure.append(
      el(
        'p',
        undefined,
        `HTML5 landmarks — ${tags || 'none'}${model.html5.hasMain ? '' : ' (no <main>)'}`,
      ),
    );
    if (model.html5.doctype) {
      structure.append(el('p', 'lede', `Doctype: ${model.html5.doctype}`));
    }
  }
  grid.append(structure);

  const assets = el('section', 'dash-card');
  assets.append(el('h3', undefined, 'Links & images'));
  if (model.links) {
    assets.append(
      el(
        'p',
        undefined,
        `Links: ${model.links.total} (internal ${model.links.internal}, external ${model.links.external}, other ${model.links.other})`,
      ),
    );
    const copyLinks = el('button', 'secondary', 'Copy all links') as HTMLButtonElement;
    copyLinks.type = 'button';
    copyLinks.addEventListener('click', () => {
      void navigator.clipboard.writeText(formatLinksForClipboard(model.links!)).then(
        () => {
          copyLinks.textContent = 'Copied links';
          setTimeout(() => {
            copyLinks.textContent = 'Copy all links';
          }, 1500);
        },
        () => {
          copyLinks.textContent = 'Copy failed';
        },
      );
    });
    assets.append(copyLinks);
  } else {
    assets.append(el('p', 'lede', 'Link inventory unavailable until site access.'));
  }
  if (model.images) {
    assets.append(
      el(
        'p',
        undefined,
        `Images: ${model.images.total} (alt present ${model.images.withAlt}, empty ${model.images.emptyAlt}, missing ${model.images.missingAlt})`,
      ),
    );
    const copyImages = el('button', 'secondary', 'Copy images + alt') as HTMLButtonElement;
    copyImages.type = 'button';
    copyImages.addEventListener('click', () => {
      void navigator.clipboard.writeText(formatImagesForClipboard(model.images!)).then(
        () => {
          copyImages.textContent = 'Copied images';
          setTimeout(() => {
            copyImages.textContent = 'Copy images + alt';
          }, 1500);
        },
        () => {
          copyImages.textContent = 'Copy failed';
        },
      );
    });
    assets.append(copyImages);
  } else {
    assets.append(el('p', 'lede', 'Image inventory unavailable until site access.'));
  }
  grid.append(assets);

  container.append(grid);
}
