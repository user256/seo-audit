import { describe, expect, it } from 'vitest';
import { evaluateRobotsForUrl, evaluateRobotsPath, robotsPathFromUrl } from './evaluate-robots';
import { parseRobotsText } from './parse-robots';

function parseFixture(body: string) {
  const parsed = parseRobotsText(body);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed;
}

describe('evaluateRobotsPath', () => {
  it('applies user-agent specificity between Googlebot and generic profiles', () => {
    const parsed = parseFixture(`
      User-agent: Googlebot
      Disallow: /nogoogle/

      User-agent: *
      Disallow: /
    `);

    const googlePath = evaluateRobotsPath(parsed, '/public/page');
    expect(googlePath.profiles.Googlebot).toMatchObject({
      crawlable: true,
      reason: 'no-matching-rules',
      matchedGroup: { userAgents: ['Googlebot'] },
    });
    expect(googlePath.profiles['*']).toMatchObject({
      crawlable: false,
      reason: 'disallow-rule',
      matchedRule: { kind: 'disallow', pattern: '/' },
    });

    const blockedForGoogle = evaluateRobotsPath(parsed, '/nogoogle/file');
    expect(blockedForGoogle.profiles.Googlebot.crawlable).toBe(false);
    expect(blockedForGoogle.profiles['*'].crawlable).toBe(false);
  });

  it('allows paths when no user-agent group matches the profile', () => {
    const parsed = parseFixture(`
      User-agent: Bingbot
      Disallow: /
    `);

    const result = evaluateRobotsPath(parsed, '/any/path');
    expect(result.profiles.Googlebot).toMatchObject({
      crawlable: true,
      reason: 'no-matching-group',
      matchedGroup: null,
    });
    expect(result.profiles['*']).toMatchObject({
      crawlable: true,
      reason: 'no-matching-group',
      matchedGroup: null,
    });
  });

  it('honours allow rules that beat shorter disallow patterns', () => {
    const parsed = parseFixture(`
      User-agent: *
      Disallow: /folder/
      Allow: /folder/public/
    `);

    const allowed = evaluateRobotsPath(parsed, '/folder/public/page.html');
    expect(allowed.profiles['*']).toMatchObject({
      crawlable: true,
      reason: 'allow-rule',
      matchedRule: { kind: 'allow', pattern: '/folder/public/' },
    });

    const blocked = evaluateRobotsPath(parsed, '/folder/private/page.html');
    expect(blocked.profiles['*']).toMatchObject({
      crawlable: false,
      reason: 'disallow-rule',
      matchedRule: { kind: 'disallow', pattern: '/folder/' },
    });
  });

  it('evaluates percent-encoded path segments literally', () => {
    const parsed = parseFixture(`
      User-agent: *
      Disallow: /caf%C3%A9/
      Allow: /caf%C3%A9/open/
    `);

    const encodedPath = robotsPathFromUrl('https://example.com/caf%C3%A9/closed/');
    const result = evaluateRobotsPath(parsed, encodedPath);
    expect(encodedPath).toBe('/caf%C3%A9/closed/');
    expect(result.profiles['*'].crawlable).toBe(false);

    const allowedPath = robotsPathFromUrl('https://example.com/caf%C3%A9/open/menu');
    const allowed = evaluateRobotsPath(parsed, allowedPath);
    expect(allowed.profiles['*'].crawlable).toBe(true);
  });
});

describe('evaluateRobotsForUrl', () => {
  it('returns unavailable when parsed robots evidence is missing', () => {
    const result = evaluateRobotsForUrl(null, 'https://example.com/page');
    expect(result).toEqual({
      ok: false,
      status: 'unavailable',
      code: 'robots-unavailable',
      message: 'robots.txt was not available for evaluation.',
      path: '/page',
    });
  });

  it('returns unavailable with caller-provided fetch failure context', () => {
    const result = evaluateRobotsForUrl(undefined, 'https://example.com/page', {
      code: 'robots-fetch-non-200',
      message: 'robots.txt returned HTTP 404.',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('robots-fetch-non-200');
    expect(result.path).toBe('/page');
  });
});
