import { describe, expect, it } from 'vitest';
import { buildAuditReport, renderAuditReportMarkdown } from './audit-report';
import { createEmptySession } from '../storage/session-repository';
import type { AuditSession, Evidence } from '../schemas/audit';

const capturedAt = '2026-07-12T12:00:00.000Z';

function evidence(id: string, source: string, value: unknown): Evidence {
  return { id, kind: 'dom', source, value, capturedAt };
}

function session(): AuditSession {
  const result = createEmptySession({
    id: 'session-1',
    tabUrl: 'https://example.test/start',
    finalUrl: 'https://example.test/final',
    extensionVersion: '0.1.0',
    featureAvailability: { domCollector: true, headerCapture: 'unavailable' },
    captureTime: capturedAt,
  });
  result.snapshots = [
    {
      id: 'snapshot-1',
      url: result.finalUrl,
      capturedAt,
      evidence: [
        evidence('title', 'title', { state: 'present', value: 'Example title', selector: 'title' }),
        evidence('canonical', 'link[rel=canonical]', {
          state: 'present',
          value: { href: '/final', absolute: 'https://example.test/final' },
          selector: 'link[rel=canonical]',
        }),
        evidence('links', 'a[href]', {
          state: 'present',
          value: { total: 3, internal: 2, external: 1, other: 0 },
          selector: 'a[href]',
        }),
      ],
    },
  ];
  return result;
}

describe('buildAuditReport', () => {
  it('composes a deterministic clean-session report with explicit missing facts', () => {
    const report = buildAuditReport(session());
    expect(report.checks).toEqual([
      {
        label: 'Dom Collector',
        status: 'ran',
        reason: 'Captured evidence is included in this report.',
      },
      {
        label: 'Header Capture',
        status: 'skipped',
        reason: 'Not captured for this audit; no conclusion was inferred.',
      },
    ]);
    expect(report.pageFacts.find((fact) => fact.label === 'Title')?.value).toBe('Example title');
    expect(report.pageFacts.find((fact) => fact.label === 'Images')?.value).toBe(
      'Not captured for this audit.',
    );
    expect(renderAuditReportMarkdown(report)).toContain('No findings were produced');
  });

  it('sorts mixed-severity findings and includes their bounded captured evidence', () => {
    const input = session();
    input.findings = [
      {
        id: 'warning',
        ruleId: 'z-warning',
        severity: 'warning',
        category: 'Meta',
        affectedUrl: input.finalUrl,
        description: 'Warning description',
        evidenceIds: ['title'],
        recommendation: 'Improve it',
        sourceRef: 'https://example.test/ref',
        capturedAt,
      },
      {
        id: 'critical',
        ruleId: 'a-critical',
        severity: 'critical',
        category: 'Links',
        affectedUrl: input.finalUrl,
        description: 'Critical description',
        evidenceIds: ['missing'],
        recommendation: 'Fix it',
        sourceRef: 'https://example.test/ref',
        capturedAt,
      },
    ];
    const report = buildAuditReport(input);
    expect(report.findings.map((finding) => finding.ruleId)).toEqual(['a-critical', 'z-warning']);
    expect(report.severityCounts).toMatchObject({ critical: 1, warning: 1, error: 0, info: 0 });
    expect(report.findings[0].evidence[0].summary).toMatch(/Not captured/);
  });

  it('renders partial capture and truncation truthfully alongside analyst notes', () => {
    const input = session();
    input.reportMarkdown = 'Investigate after the next crawl.';
    input.snapshots[0].evidence.push(
      evidence('robots', 'meta[name=robots|googlebot]', {
        state: 'inaccessible',
        detail: 'Frame access was denied',
      }),
      evidence('limits', 'capture.limits', {
        truncated: true,
        fields: [{ source: 'a[href]', reason: 'Link inventory cap reached' }],
      }),
    );
    input.captureErrors.push({
      id: 'capture-error',
      code: 'snapshot-budget',
      source: 'domCollector',
      message: 'Snapshot was clipped.',
      capturedAt,
    });
    const markdown = renderAuditReportMarkdown(buildAuditReport(input));
    expect(markdown).toContain('Not captured — Frame access was denied');
    expect(markdown).toContain('snapshot-budget: Snapshot was clipped.');
    expect(markdown).toContain('Investigate after the next crawl.');
  });
});
