import { describe, expect, it } from 'vitest';
import {
  AUDIT_SCHEMA_VERSION,
  CaptureErrorSchema,
  EvidenceSchema,
  FindingSchema,
  parseAuditSession,
} from './audit';
import { createEmptySession } from '../storage/session-repository';

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
});
