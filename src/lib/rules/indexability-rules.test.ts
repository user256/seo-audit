import { describe, expect, it } from 'vitest';
import type { Evidence, PageSnapshot } from '../schemas/audit';
import { INDEXABILITY_SOURCES } from './indexability-evidence';
import { INDEXABILITY_RULES } from './indexability-rules';
import { buildRuleContext } from './types';

const FIXED_TIME = '2026-07-12T12:00:00.000Z';
const PAGE_URL = 'https://example.com/page';

type MatrixCase = {
  name: string;
  evidence: Evidence[];
  expectedRuleIds: string[];
  unexpectedRuleIds?: string[];
};

function metaRobotsEvidence(content: string, id = 'ev-meta'): Evidence {
  return {
    id,
    kind: 'dom',
    source: INDEXABILITY_SOURCES.META_ROBOTS,
    value: { state: 'present', value: { content }, selector: 'meta[name=robots]' },
    capturedAt: FIXED_TIME,
  };
}

function canonicalEvidence(absolute: string, id = 'ev-canonical'): Evidence {
  return {
    id,
    kind: 'dom',
    source: INDEXABILITY_SOURCES.CANONICAL,
    value: {
      state: 'present',
      value: { href: absolute, absolute },
      selector: 'link[rel=canonical]',
    },
    capturedAt: FIXED_TIME,
  };
}

function navigationEvidence(
  partial: {
    finalUrl?: string;
    headers?: Record<string, string>;
    redirectHops?: { fromUrl: string; toUrl: string; status: number }[];
  },
  id = 'ev-nav',
): Evidence {
  return {
    id,
    kind: 'network',
    source: INDEXABILITY_SOURCES.BROWSER_NAVIGATION,
    value: {
      statusCode: 200,
      requestedUrl: PAGE_URL,
      finalUrl: partial.finalUrl ?? PAGE_URL,
      redirectHops: partial.redirectHops ?? [],
      headers: partial.headers ?? { 'content-type': 'text/html' },
      observedAt: FIXED_TIME,
    },
    capturedAt: FIXED_TIME,
  };
}

function robotsEvaluationEvidence(
  crawlable: boolean,
  pattern = '/',
  id = 'ev-robots-eval',
): Evidence {
  return {
    id,
    kind: 'robots',
    source: INDEXABILITY_SOURCES.ROBOTS_EVALUATION,
    value: {
      url: PAGE_URL,
      path: '/page',
      evaluatedAt: FIXED_TIME,
      profiles: {
        Googlebot: {
          profile: 'Googlebot',
          crawlable,
          reason: crawlable ? 'no-matching-rules' : 'disallow-rule',
          matchedGroup: { userAgents: ['*'], rules: [] },
          matchedRule: crawlable
            ? null
            : { kind: 'disallow', pattern, line: 2, specificity: pattern.length },
        },
        '*': {
          profile: '*',
          crawlable,
          reason: crawlable ? 'no-matching-rules' : 'disallow-rule',
          matchedGroup: { userAgents: ['*'], rules: [] },
          matchedRule: crawlable
            ? null
            : { kind: 'disallow', pattern, line: 2, specificity: pattern.length },
        },
      },
    },
    capturedAt: FIXED_TIME,
  };
}

function sitemapMembershipEvidence(present: boolean, id = 'ev-sitemap'): Evidence {
  return {
    id,
    kind: 'sitemap',
    source: INDEXABILITY_SOURCES.SITEMAP_MEMBERSHIP,
    value: {
      sitemapUrl: 'https://example.com/sitemap.xml',
      auditedUrl: PAGE_URL,
      present,
      matchedLoc: present ? PAGE_URL : undefined,
      fetchedAt: FIXED_TIME,
    },
    capturedAt: FIXED_TIME,
  };
}

function snapshotFromEvidence(evidence: Evidence[]): PageSnapshot {
  return {
    id: 'snap-matrix',
    url: PAGE_URL,
    capturedAt: FIXED_TIME,
    evidence,
  };
}

function runIndexabilityRules(evidence: Evidence[]) {
  const ctx = buildRuleContext(snapshotFromEvidence(evidence));
  return INDEXABILITY_RULES.flatMap((rule) => rule.run(ctx));
}

const MATRIX: MatrixCase[] = [
  {
    name: 'meta noindex only',
    evidence: [metaRobotsEvidence('noindex, nofollow')],
    expectedRuleIds: ['indexability-noindex-signal'],
  },
  {
    name: 'header noindex only',
    evidence: [navigationEvidence({ headers: { 'x-robots-tag': 'noindex' } })],
    expectedRuleIds: ['indexability-noindex-signal'],
  },
  {
    name: 'meta and header both noindex',
    evidence: [
      metaRobotsEvidence('noindex'),
      navigationEvidence({ headers: { 'x-robots-tag': 'noindex' } }),
    ],
    expectedRuleIds: ['indexability-noindex-signal'],
    unexpectedRuleIds: ['indexability-robots-conflict'],
  },
  {
    name: 'conflicting meta noindex vs header index',
    evidence: [
      metaRobotsEvidence('noindex'),
      navigationEvidence({ headers: { 'x-robots-tag': 'index, follow' } }),
    ],
    expectedRuleIds: ['indexability-noindex-signal', 'indexability-robots-conflict'],
  },
  {
    name: 'robots.txt blocks audited path',
    evidence: [robotsEvaluationEvidence(false)],
    expectedRuleIds: ['indexability-robots-blocked'],
  },
  {
    name: 'canonical differs from final URL',
    evidence: [
      canonicalEvidence('https://example.com/preferred'),
      navigationEvidence({ finalUrl: 'https://example.com/page' }),
    ],
    expectedRuleIds: ['indexability-canonical-mismatch'],
  },
  {
    name: 'redirect loop observed',
    evidence: [
      navigationEvidence({
        finalUrl: 'https://example.com/a',
        redirectHops: [
          { fromUrl: 'https://example.com/a', toUrl: 'https://example.com/b', status: 302 },
          { fromUrl: 'https://example.com/b', toUrl: 'https://example.com/a', status: 302 },
        ],
      }),
    ],
    expectedRuleIds: ['indexability-redirect-loop'],
  },
  {
    name: 'excessive redirect hops',
    evidence: [
      navigationEvidence({
        redirectHops: Array.from({ length: 6 }, (_, index) => ({
          fromUrl: `https://example.com/r${index}`,
          toUrl: `https://example.com/r${index + 1}`,
          status: 301,
        })),
        finalUrl: 'https://example.com/r6',
      }),
    ],
    expectedRuleIds: ['indexability-redirect-excessive'],
  },
  {
    name: 'non-HTML content type',
    evidence: [navigationEvidence({ headers: { 'content-type': 'application/pdf' } })],
    expectedRuleIds: ['indexability-non-html-content'],
  },
  {
    name: 'sitemap lists URL blocked by robots',
    evidence: [sitemapMembershipEvidence(true), robotsEvaluationEvidence(false)],
    expectedRuleIds: ['indexability-robots-blocked', 'indexability-sitemap-robots-blocked'],
  },
  {
    name: 'clean HTML navigation signals',
    evidence: [
      metaRobotsEvidence('index, follow'),
      canonicalEvidence('https://example.com/page'),
      navigationEvidence({
        finalUrl: 'https://example.com/page',
        headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'all' },
      }),
      robotsEvaluationEvidence(true),
    ],
    expectedRuleIds: [],
  },
  {
    name: 'missing required sources produce no invented findings',
    evidence: [metaRobotsEvidence('index, follow')],
    expectedRuleIds: [],
    unexpectedRuleIds: [
      'indexability-robots-blocked',
      'indexability-canonical-mismatch',
      'indexability-sitemap-robots-blocked',
    ],
  },
];

describe('indexability reconciliation matrix', () => {
  it.each(MATRIX)('$name', ({ evidence, expectedRuleIds, unexpectedRuleIds = [] }) => {
    const findings = runIndexabilityRules(evidence);
    const ruleIds = findings.map((finding) => finding.ruleId);
    for (const expected of expectedRuleIds) {
      expect(ruleIds).toContain(expected);
    }
    for (const unexpected of unexpectedRuleIds) {
      expect(ruleIds).not.toContain(unexpected);
    }
  });

  it('preserves stable rule IDs and severities for representative rows', () => {
    const conflict = runIndexabilityRules([
      metaRobotsEvidence('noindex'),
      navigationEvidence({ headers: { 'x-robots-tag': 'index, follow' } }),
    ]);
    expect(conflict.find((f) => f.ruleId === 'indexability-robots-conflict')?.severity).toBe(
      'error',
    );
    expect(conflict.find((f) => f.ruleId === 'indexability-noindex-signal')?.severity).toBe(
      'warning',
    );

    const loop = runIndexabilityRules([
      navigationEvidence({
        finalUrl: 'https://example.com/loop',
        redirectHops: [
          { fromUrl: 'https://example.com/loop', toUrl: 'https://example.com/loop', status: 302 },
        ],
      }),
    ]);
    expect(loop.find((f) => f.ruleId === 'indexability-redirect-loop')?.severity).toBe('error');
  });
});
