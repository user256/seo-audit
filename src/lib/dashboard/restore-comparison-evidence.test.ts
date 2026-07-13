import { describe, expect, it } from 'vitest';
import { buildCrawlSignalsModel } from './crawl-signals-model';
import { comparisonEvidenceFromSession } from './restore-comparison-evidence';
import {
  sampleSoft404ProbeResult,
  sampleVariantTestRunResult,
} from '../schemas/comparison-evidence';
import { createEmptySession } from '../storage/session-repository';

describe('comparisonEvidenceFromSession', () => {
  const auditedUrl = 'https://example.com/product';

  it('restores completed and cancelled runs into panel state', () => {
    const session = createEmptySession({
      id: 'sess-restore',
      tabUrl: auditedUrl,
      finalUrl: auditedUrl,
      extensionVersion: '0.1.0',
    });
    session.variantTestRun = sampleVariantTestRunResult({ cancelled: false });
    session.soft404ProbeRun = sampleSoft404ProbeResult({ cancelled: true });

    const restored = comparisonEvidenceFromSession(session, auditedUrl);
    expect(restored.variantRunState).toBe('done');
    expect(restored.variantResult?.requestId).toBe('vt-sample');
    expect(restored.soft404RunState).toBe('cancelled');
    expect(restored.soft404Result?.cancelled).toBe(true);
    expect(restored.soft404ProbeUrl).toBe('https://example.com/missing-probe');
  });

  it('feeds restored runs into the crawl-signals model', () => {
    const session = createEmptySession({
      id: 'sess-model',
      tabUrl: auditedUrl,
      finalUrl: auditedUrl,
      extensionVersion: '0.1.0',
    });
    session.variantTestRun = sampleVariantTestRunResult();
    session.soft404ProbeRun = sampleSoft404ProbeResult();

    const panel = comparisonEvidenceFromSession(session, auditedUrl);
    const model = buildCrawlSignalsModel({
      tabUrl: auditedUrl,
      documentUrl: auditedUrl,
      origin: 'https://example.com',
      accessGranted: true,
      variantBaseUrl: panel.variantBaseUrl,
      variantKindOptions: panel.variantKindOptions,
      variantRunState: panel.variantRunState,
      variantResult: panel.variantResult,
      soft404ProbeUrl: panel.soft404ProbeUrl,
      soft404RunState: panel.soft404RunState,
      soft404Result: panel.soft404Result,
    });

    expect(model.variantTests.runState).toBe('done');
    expect(model.variantTests.result?.finalGroups).toHaveLength(1);
    expect(model.soft404Probe.runState).toBe('done');
    expect(model.soft404Probe.result?.observations).toEqual([]);
  });

  it('defaults to idle panel state when no runs were persisted', () => {
    const session = createEmptySession({
      id: 'sess-empty',
      tabUrl: auditedUrl,
      finalUrl: auditedUrl,
      extensionVersion: '0.1.0',
    });

    const restored = comparisonEvidenceFromSession(session, auditedUrl);
    expect(restored.variantRunState).toBe('idle');
    expect(restored.variantResult).toBeNull();
    expect(restored.soft404RunState).toBe('idle');
    expect(restored.soft404Result).toBeNull();
  });
});
