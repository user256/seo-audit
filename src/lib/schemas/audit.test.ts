import { describe, expect, it } from 'vitest';
import {
  AUDIT_SCHEMA_VERSION,
  CaptureErrorSchema,
  EvidenceSchema,
  FindingSchema,
  parseAuditSession,
} from './audit';
import { sampleSoft404ProbeResult, sampleVariantTestRunResult } from './comparison-evidence';
import { createEmptySession } from '../storage/session-repository';
import { DOM_LIMITS } from './dom-limits';
import {
  DOM_EVIDENCE_SCHEMA_VERSION,
  HISTORICAL_DOM_EVIDENCE_SCHEMA_VERSION,
} from './dom-evidence';

describe('audit schemas', () => {
  it('parses a valid empty session', () => {
    const session = createEmptySession({
      id: 'sess-1',
      tabUrl: 'https://example.com/a',
      finalUrl: 'https://example.com/a',
      extensionVersion: '0.1.0',
    });
    const result = parseAuditSession(session);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.schemaVersion).toBe(AUDIT_SCHEMA_VERSION);
      expect(result.value.featureAvailability.headerCapture).toBe('unavailable');
    }
  });

  it('requires finding fields from the product contract', () => {
    const finding = FindingSchema.parse({
      id: 'f1',
      ruleId: 'title-missing',
      severity: 'error',
      category: 'metadata',
      affectedUrl: 'https://example.com/',
      description: 'Document is missing a <title>.',
      evidenceIds: ['e1'],
      recommendation: 'Add a unique, descriptive title element.',
      sourceRef: 'https://developers.google.com/search/docs/appearance/title-link',
      capturedAt: '2026-07-12T12:00:00.000Z',
    });
    expect(finding.ruleId).toBe('title-missing');
  });

  it('keeps CaptureError distinct from Finding', () => {
    const error = CaptureErrorSchema.parse({
      id: 'ce1',
      code: 'permission-denied',
      source: 'domCollector',
      message: 'Origin access was not granted.',
      url: 'https://example.com/',
      capturedAt: '2026-07-12T12:00:00.000Z',
    });
    expect(error.code).toBe('permission-denied');
  });

  it('accepts compact evidence values without HTML bodies', () => {
    const evidence = EvidenceSchema.parse({
      id: 'e1',
      kind: 'dom',
      source: 'document.title',
      value: { text: '', length: 0 },
      capturedAt: '2026-07-12T12:00:00.000Z',
    });
    expect(evidence.kind).toBe('dom');
  });

  it('rejects schema-version mismatches with readable issues', () => {
    const session = createEmptySession({
      id: 'sess-bad',
      tabUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      extensionVersion: '0.1.0',
    });
    const result = parseAuditSession({ ...session, schemaVersion: 999 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.join(' ')).toMatch(/schemaVersion/i);
    }
  });

  it('rejects malformed source-specific DOM evidence at the save boundary', () => {
    const session = createEmptySession({
      id: 'sess-invalid-dom',
      tabUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      extensionVersion: '0.1.0',
    });
    session.snapshots.push({
      id: 'snap-invalid-dom',
      url: 'https://example.com/',
      capturedAt: session.captureTime,
      evidence: [
        {
          id: 'title-0',
          kind: 'dom',
          source: 'title',
          value: { state: 'present', value: ['not', 'a', 'title'], selector: 'title' },
          capturedAt: session.captureTime,
        },
      ],
      captureLimits: {
        schemaVersion: 1,
        applied: {
          maxStringChars: DOM_LIMITS.maxStringChars,
          maxUrlChars: DOM_LIMITS.maxUrlChars,
          maxMetaItems: DOM_LIMITS.maxMetaItems,
          maxAlternateItems: DOM_LIMITS.maxAlternateItems,
          maxJsonLdChars: DOM_LIMITS.maxJsonLdChars,
          maxJsonLdScripts: DOM_LIMITS.maxJsonLdScripts,
          maxHeadingSamplesPerLevel: DOM_LIMITS.maxHeadingSamplesPerLevel,
          maxLinkInventory: DOM_LIMITS.maxLinkInventory,
          maxImageInventory: DOM_LIMITS.maxImageInventory,
        },
        maxSnapshotChars: DOM_LIMITS.maxSnapshotChars,
        maxSessionChars: DOM_LIMITS.maxSessionChars,
        domEvidenceSchemaVersion: DOM_EVIDENCE_SCHEMA_VERSION,
      },
    });

    const result = parseAuditSession(session);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues?.join(' ')).toMatch(/title\.value/);
  });

  it('migrates representative schemaVersion-1 sessions to the current contract', () => {
    const v1 = {
      schemaVersion: 1,
      id: 'sess-v1',
      createdAt: '2026-07-12T12:00:00.000Z',
      updatedAt: '2026-07-12T12:00:00.000Z',
      tabUrl: 'https://example.com/a',
      finalUrl: 'https://example.com/a',
      captureTime: '2026-07-12T12:00:00.000Z',
      extensionVersion: '0.1.0',
      featureAvailability: { domCollector: true, headerCapture: 'unavailable' },
      snapshots: [
        {
          id: 'snap-1',
          url: 'https://example.com/a',
          capturedAt: '2026-07-12T12:00:00.000Z',
          evidence: [
            {
              id: 'e1',
              kind: 'dom',
              source: 'title',
              value: { state: 'present', value: 'Hello', selector: 'title', count: 1 },
              capturedAt: '2026-07-12T12:00:00.000Z',
            },
          ],
        },
      ],
      findings: [],
      captureErrors: [],
      reportMarkdown: 'notes',
    };
    const result = parseAuditSession(v1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.schemaVersion).toBe(AUDIT_SCHEMA_VERSION);
      expect(result.value.snapshots[0]?.captureLimits?.applied.maxStringChars).toBeGreaterThan(0);
      expect(result.value.snapshots[0]?.captureLimits?.domEvidenceSchemaVersion).toBe(
        HISTORICAL_DOM_EVIDENCE_SCHEMA_VERSION,
      );
      expect(result.value.reportMarkdown).toBe('notes');
      expect(result.value.checkSelection.recordingNote).toMatch(/historical/i);
    }
  });

  it('backfills missing checkSelection on an otherwise current-schema session', () => {
    const session = createEmptySession({
      id: 'sess-no-selection',
      tabUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      extensionVersion: '0.1.0',
    });
    const raw = { ...session } as Record<string, unknown>;
    delete raw.checkSelection;

    const result = parseAuditSession(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.checkSelection.selectedCheckIds).toEqual([]);
      expect(result.value.checkSelection.skippedChecks).toEqual([]);
      expect(result.value.checkSelection.recordingNote).toMatch(/not recorded/i);
    }
  });

  it('parses bounded comparison runs on the current session contract', () => {
    const session = createEmptySession({
      id: 'sess-comparison',
      tabUrl: 'https://example.com/page',
      finalUrl: 'https://example.com/page',
      extensionVersion: '0.1.0',
    });
    session.variantTestRun = sampleVariantTestRunResult();
    session.soft404ProbeRun = sampleSoft404ProbeResult({ cancelled: true });

    const result = parseAuditSession(session);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.variantTestRun?.requestId).toBe('vt-sample');
      expect(result.value.soft404ProbeRun?.cancelled).toBe(true);
    }
  });

  it('migrates schemaVersion-3 sessions to the current contract', () => {
    const session = createEmptySession({
      id: 'sess-v3',
      tabUrl: 'https://example.com/v3',
      finalUrl: 'https://example.com/v3',
      extensionVersion: '0.1.0',
    });
    const raw = { ...session, schemaVersion: 3 } as Record<string, unknown>;

    const result = parseAuditSession(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.schemaVersion).toBe(AUDIT_SCHEMA_VERSION);
      expect(result.value.variantTestRun).toBeUndefined();
    }
  });
});
