import { describe, expect, it } from 'vitest';
import {
  matchRobotsPathRules,
  parseRobotsText,
  robotsPathMatches,
  robotsUserAgentMatches,
  selectRobotsGroup,
} from './parse-robots';

describe('parseRobotsText', () => {
  it('parses user-agent groups with allow and disallow rules', () => {
    const parsed = parseRobotsText(`
      # site rules
      User-agent: Googlebot
      Disallow: /private/

      User-agent: *
      Disallow: /admin/
      Allow: /admin/public/
    `);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.groups).toEqual([
      {
        userAgents: ['Googlebot'],
        rules: [{ kind: 'disallow', pattern: '/private/', lineNumber: 4 }],
      },
      {
        userAgents: ['*'],
        rules: [
          { kind: 'disallow', pattern: '/admin/', lineNumber: 7 },
          { kind: 'allow', pattern: '/admin/public/', lineNumber: 8 },
        ],
      },
    ]);
    expect(parsed.sitemaps).toEqual([]);
    expect(parsed.diagnostics).toEqual([]);
  });

  it('records global sitemap directives and ignores comments / blank lines', () => {
    const parsed = parseRobotsText(`
      User-agent: *

      # block nothing
      Disallow:

      Sitemap: https://example.com/sitemap.xml
      Sitemap: https://cdn.example.com/sitemap-index.xml
    `);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.sitemaps).toEqual([
      'https://example.com/sitemap.xml',
      'https://cdn.example.com/sitemap-index.xml',
    ]);
    expect(parsed.groups[0]?.rules[0]).toMatchObject({ kind: 'disallow', pattern: '' });
  });

  it('preserves unknown directives as diagnostics', () => {
    const parsed = parseRobotsText(`
      User-agent: *
      Host: example.com
      Crawl-delay: 10
      Disallow: /
    `);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.diagnostics).toEqual([
      {
        line: 3,
        directive: 'Host',
        message: 'Unknown directive "Host" was ignored.',
      },
      {
        line: 4,
        directive: 'Crawl-delay',
        message: 'Unknown directive "Crawl-delay" was ignored.',
      },
    ]);
    expect(parsed.groups[0]?.rules).toHaveLength(1);
  });

  it('combines consecutive user-agent lines into one group', () => {
    const parsed = parseRobotsText(`
      User-agent: Googlebot
      User-agent: Googlebot-Image
      Disallow: /photos/
    `);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0]?.userAgents).toEqual(['Googlebot', 'Googlebot-Image']);
  });
});

describe('robotsPathMatches', () => {
  it('matches wildcard segments and end anchors', () => {
    expect(robotsPathMatches('/fish', '/fish')).toBe(true);
    expect(robotsPathMatches('/fish*', '/fish.html')).toBe(true);
    expect(robotsPathMatches('/fish*', '/fish/salmon.html')).toBe(true);
    expect(robotsPathMatches('/*.php', '/filename.php')).toBe(true);
    expect(robotsPathMatches('/*.php$', '/filename.php')).toBe(true);
    expect(robotsPathMatches('/*.php$', '/filename.php?params')).toBe(false);
    expect(robotsPathMatches('/fish/', '/fish')).toBe(false);
  });
});

describe('matchRobotsPathRules', () => {
  it('uses longest matching pattern and prefers allow on ties', () => {
    const rules = [
      { kind: 'disallow' as const, pattern: '/folder/', lineNumber: 1 },
      { kind: 'allow' as const, pattern: '/folder/special/', lineNumber: 2 },
      { kind: 'disallow' as const, pattern: '/folder/special/file.html', lineNumber: 3 },
    ];

    const longestDisallow = matchRobotsPathRules(rules, '/folder/special/file.html');
    expect(longestDisallow?.kind).toBe('disallow');
    expect(longestDisallow?.pattern).toBe('/folder/special/file.html');

    const tieAllow = matchRobotsPathRules(
      [
        { kind: 'disallow', pattern: '/page', lineNumber: 1 },
        { kind: 'allow', pattern: '/page', lineNumber: 2 },
      ],
      '/page',
    );
    expect(tieAllow?.kind).toBe('allow');
  });
});

describe('selectRobotsGroup', () => {
  it('prefers the most specific matching user-agent token', () => {
    const groups = parseRobotsText(`
      User-agent: *
      Disallow: /

      User-agent: Googlebot
      Disallow: /secret/
    `);
    expect(groups.ok).toBe(true);
    if (!groups.ok) return;

    const googlebotGroup = selectRobotsGroup(groups.groups, 'Googlebot');
    expect(googlebotGroup?.userAgents).toEqual(['Googlebot']);

    const genericGroup = selectRobotsGroup(groups.groups, '*');
    expect(genericGroup?.userAgents).toEqual(['*']);
  });
});

describe('robotsUserAgentMatches', () => {
  it('matches crawler names case-insensitively by prefix', () => {
    expect(robotsUserAgentMatches('Googlebot', 'Googlebot/2.1')).toBe(true);
    expect(robotsUserAgentMatches('googlebot', 'Googlebot-News')).toBe(true);
    expect(robotsUserAgentMatches('*', 'Bingbot')).toBe(true);
    expect(robotsUserAgentMatches('Bingbot', 'Googlebot')).toBe(false);
  });
});
