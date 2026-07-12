import type { FieldState } from '../../content/dom-collector';
import type { AuditSession, Evidence, Finding, Severity } from '../schemas/audit';

export type AuditReportRow = {
  label: string;
  value: string;
  source: string;
};

export type AuditReportCheck = {
  label: string;
  status: 'ran' | 'skipped';
  reason: string;
};

export type AuditReportFinding = Finding & {
  evidence: { source: string; summary: string }[];
};

/**
 * The ephemeral, composed report contract. Ticket 402 serialises this model
 * rather than rebuilding a separate export-only representation.
 */
export type AuditReport = {
  header: AuditReportRow[];
  checks: AuditReportCheck[];
  severityCounts: Record<Severity, number>;
  categoryCounts: { category: string; count: number }[];
  pageFacts: AuditReportRow[];
  captureIssues: { source: string; message: string }[];
  findings: AuditReportFinding[];
  analystNotes: string;
};

const SEVERITIES: Severity[] = ['critical', 'error', 'warning', 'info'];
const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
};

const PAGE_FACTS: { source: string; label: string }[] = [
  { source: 'title', label: 'Title' },
  { source: 'meta[name=description]', label: 'Meta description' },
  { source: 'link[rel=canonical]', label: 'Canonical' },
  { source: 'meta[name=robots|googlebot]', label: 'Meta robots' },
  { source: 'h1-h6', label: 'Headings' },
  { source: 'a[href]', label: 'Links' },
  { source: 'img', label: 'Images' },
  { source: 'capture.limits', label: 'Capture limits' },
];

function latestEvidence(session: AuditSession): Evidence[] {
  return (
    [...session.snapshots].sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0]
      ?.evidence ?? []
  );
}

function compact(value: unknown, limit = 480): string {
  let text: string;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean || '(empty)';
}

function fieldValue(value: unknown): string {
  if (!value || typeof value !== 'object') return compact(value);
  const record = value as Record<string, unknown>;
  if (typeof record.absolute === 'string') return record.absolute;
  if (typeof record.href === 'string') return record.href;
  if (typeof record.content === 'string') return record.content;
  if (typeof record.total === 'number') {
    if ('internal' in record) {
      return `total ${record.total}; internal ${record.internal}; external ${record.external}; other ${record.other}`;
    }
    if ('withAlt' in record) {
      return `total ${record.total}; alt present ${record.withAlt}; empty ${record.emptyAlt}; missing ${record.missingAlt}`;
    }
  }
  if ('levels' in record) {
    const levels = record.levels;
    if (levels && typeof levels === 'object') {
      return (
        Object.entries(levels as Record<string, unknown>)
          .filter(([, count]) => typeof count === 'number' && count > 0)
          .map(([level, count]) => `${level.toUpperCase()}: ${count}`)
          .join(' · ') || 'No headings'
      );
    }
  }
  return compact(value);
}

function fieldSummary(value: unknown): string {
  if (!value || typeof value !== 'object' || !('state' in value)) return compact(value);
  const field = value as FieldState;
  switch (field.state) {
    case 'absent':
      return '(absent)';
    case 'empty':
      return '(empty)';
    case 'inaccessible':
      return `Not captured — ${field.detail}`;
    case 'malformed':
      return `Not captured — malformed: ${field.detail}`;
    case 'duplicate': {
      const suffix = field.limits ? `; truncated: ${field.limits.reason}` : '';
      return `${field.count} captured values${suffix}`;
    }
    case 'present': {
      const suffix = field.limits ? ` (truncated: ${field.limits.reason})` : '';
      return `${fieldValue(field.value)}${suffix}`;
    }
  }
}

function checkLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase());
}

function checksFrom(session: AuditSession): AuditReportCheck[] {
  return Object.entries(session.featureAvailability)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([feature, availability]) => ({
      label: checkLabel(feature),
      status: availability === true ? 'ran' : 'skipped',
      reason:
        availability === true
          ? 'Captured evidence is included in this report.'
          : 'Not captured for this audit; no conclusion was inferred.',
    }));
}

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((left, right) => {
    const severity = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
    if (severity !== 0) return severity;
    const category = left.category.localeCompare(right.category);
    return category !== 0 ? category : left.ruleId.localeCompare(right.ruleId);
  });
}

export function buildAuditReport(session: AuditSession): AuditReport {
  const evidence = latestEvidence(session);
  const evidenceById = new Map(evidence.map((item) => [item.id, item] as const));
  const evidenceBySource = new Map(evidence.map((item) => [item.source, item] as const));
  const severityCounts = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0])) as Record<
    Severity,
    number
  >;
  const categories = new Map<string, number>();
  const findings = sortFindings(session.findings).map((finding) => {
    severityCounts[finding.severity] += 1;
    categories.set(finding.category, (categories.get(finding.category) ?? 0) + 1);
    return {
      ...finding,
      evidence: finding.evidenceIds.map((id) => {
        const item = evidenceById.get(id);
        return item
          ? { source: item.source, summary: compact(item.value) }
          : {
              source: id,
              summary: 'Not captured — referenced evidence is missing from this session.',
            };
      }),
    };
  });

  return {
    header: [
      { label: 'Target URL', value: session.tabUrl, source: 'chrome.tabs' },
      { label: 'Final URL', value: session.finalUrl, source: 'captured document' },
      { label: 'Captured', value: session.captureTime, source: 'audit session' },
      { label: 'Extension version', value: session.extensionVersion, source: 'manifest' },
    ],
    checks: checksFrom(session),
    severityCounts,
    categoryCounts: [...categories.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => left.category.localeCompare(right.category)),
    pageFacts: PAGE_FACTS.map(({ source, label }) => ({
      label,
      value: evidenceBySource.has(source)
        ? fieldSummary(evidenceBySource.get(source)!.value)
        : 'Not captured for this audit.',
      source,
    })),
    captureIssues: session.captureErrors
      .map((error) => ({ source: error.source, message: `${error.code}: ${error.message}` }))
      .sort((left, right) =>
        `${left.source}${left.message}`.localeCompare(`${right.source}${right.message}`),
      ),
    findings,
    analystNotes: session.reportMarkdown,
  };
}

function tableCell(value: string): string {
  return value.replace(/[|\r\n]+/g, ' ').trim();
}

/** Deterministic Markdown projection for the panel preview and future export. */
export function renderAuditReportMarkdown(
  report: AuditReport,
  analystNotes = report.analystNotes,
): string {
  const lines = [
    '# SEO Audit Report',
    '',
    '## Audit details',
    '',
    '| Field | Value | Source |',
    '| --- | --- | --- |',
  ];
  for (const row of report.header) {
    lines.push(`| ${tableCell(row.label)} | ${tableCell(row.value)} | ${tableCell(row.source)} |`);
  }

  lines.push('', '## Checks run and skipped', '');
  for (const check of report.checks) {
    lines.push(`- **${check.label}: ${check.status}** — ${check.reason}`);
  }

  lines.push('', '## Findings summary', '');
  lines.push(...SEVERITIES.map((severity) => `- ${severity}: ${report.severityCounts[severity]}`));
  if (report.categoryCounts.length > 0) {
    lines.push('', '| Category | Findings |', '| --- | ---: |');
    for (const category of report.categoryCounts) {
      lines.push(`| ${tableCell(category.category)} | ${category.count} |`);
    }
  }

  lines.push('', '## Page facts', '', '| Fact | Value | Source |', '| --- | --- | --- |');
  for (const row of report.pageFacts) {
    lines.push(`| ${tableCell(row.label)} | ${tableCell(row.value)} | ${tableCell(row.source)} |`);
  }

  if (report.captureIssues.length > 0) {
    lines.push('', '## Capture issues', '');
    for (const issue of report.captureIssues) lines.push(`- **${issue.source}:** ${issue.message}`);
  }

  lines.push('', '## Findings', '');
  if (report.findings.length === 0) {
    lines.push('No findings were produced by the checks that ran.');
  }
  for (const finding of report.findings) {
    lines.push(
      `### ${finding.ruleId}`,
      '',
      `**Severity:** ${finding.severity}  `,
      `**Category:** ${finding.category}  `,
      `**Affected URL:** ${finding.affectedUrl}`,
      '',
      finding.description,
      '',
      '**Evidence**',
    );
    if (finding.evidence.length === 0)
      lines.push('- No captured evidence was attached to this finding.');
    for (const item of finding.evidence) lines.push(`- **${item.source}:** ${item.summary}`);
    lines.push(
      '',
      `**Recommendation:** ${finding.recommendation}`,
      '',
      `[Source / best practice](${finding.sourceRef})`,
      '',
    );
  }

  lines.push('## Analyst notes', '');
  lines.push(analystNotes.trim() || 'No analyst notes recorded.');
  return lines.join('\n');
}
