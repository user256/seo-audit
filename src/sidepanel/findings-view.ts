import type { Evidence, Finding } from '../lib/schemas/audit';
import { groupFindingsByCategory } from './workspace-state';

export function renderFindingsPanel(
  container: HTMLElement,
  findings: Finding[],
  evidenceById: Map<string, Evidence>,
): void {
  container.replaceChildren();

  if (findings.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'lede';
    empty.textContent = 'No findings for this snapshot yet.';
    container.append(empty);
    return;
  }

  const grouped = groupFindingsByCategory(findings);
  for (const [category, items] of grouped) {
    const details = document.createElement('details');
    details.className = 'finding-category';
    details.open = true;

    const summary = document.createElement('summary');
    summary.textContent = `${category} (${items.length})`;
    details.append(summary);

    const list = document.createElement('ul');
    list.className = 'finding-list';

    for (const finding of items) {
      const li = document.createElement('li');
      li.className = 'finding-item';

      const header = document.createElement('div');
      header.className = 'finding-header';

      const severity = document.createElement('span');
      severity.className = `severity severity-${finding.severity}`;
      severity.textContent = finding.severity;
      severity.setAttribute('aria-label', `Severity ${finding.severity}`);

      const title = document.createElement('strong');
      title.textContent = finding.ruleId;

      header.append(severity, title);

      const description = document.createElement('p');
      description.textContent = finding.description;

      const recommendation = document.createElement('p');
      recommendation.className = 'finding-rec';
      recommendation.textContent = finding.recommendation;

      const evidenceDetails = document.createElement('details');
      evidenceDetails.className = 'finding-evidence';
      const evidenceSummary = document.createElement('summary');
      evidenceSummary.textContent = `Evidence (${finding.evidenceIds.length})`;
      evidenceDetails.append(evidenceSummary);

      const evidenceList = document.createElement('ul');
      for (const id of finding.evidenceIds) {
        const item = document.createElement('li');
        const evidence = evidenceById.get(id);
        item.textContent = evidence
          ? `${evidence.source}: ${summariseEvidence(evidence.value)}`
          : `Missing evidence id ${id}`;
        evidenceList.append(item);
      }
      evidenceDetails.append(evidenceList);

      const source = document.createElement('p');
      source.className = 'finding-source';
      const link = document.createElement('a');
      link.href = finding.sourceRef;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Source / best practice';
      source.append(link);

      li.append(header, description, recommendation, evidenceDetails, source);
      list.append(li);
    }

    details.append(list);
    container.append(details);
  }
}

function summariseEvidence(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    return text.length > 160 ? `${text.slice(0, 157)}…` : text;
  } catch {
    return String(value);
  }
}
