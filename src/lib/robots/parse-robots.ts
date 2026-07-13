/**
 * Defensive robots.txt parser (Ticket 202).
 * Implements user-agent groups, Allow/Disallow/Sitemap, wildcards, and
 * longest-match precedence for evaluation — not a full crawler.
 */

export const ROBOTS_PARSE_LIMITS = {
  /** Hard cap on robots.txt bytes accepted for parsing. */
  maxBodyBytes: 512_000,
  /** Max lines scanned (including blanks and comments). */
  maxLines: 10_000,
} as const;

export type RobotsDirectiveKind = 'allow' | 'disallow';

export type RobotsPathRule = {
  kind: RobotsDirectiveKind;
  pattern: string;
  lineNumber: number;
};

export type RobotsUserAgentGroup = {
  userAgents: string[];
  rules: RobotsPathRule[];
};

export type RobotsDiagnostic = {
  line: number;
  directive: string;
  message: string;
};

export type RobotsParseSuccess = {
  ok: true;
  groups: RobotsUserAgentGroup[];
  sitemaps: string[];
  diagnostics: RobotsDiagnostic[];
  truncated: boolean;
};

export type RobotsParseFailure = {
  ok: false;
  error: string;
  diagnostics: RobotsDiagnostic[];
  truncated: boolean;
};

export type RobotsParseResult = RobotsParseSuccess | RobotsParseFailure;

const KNOWN_DIRECTIVES = new Set(['user-agent', 'allow', 'disallow', 'sitemap']);

function stripComment(line: string): string {
  const hash = line.indexOf('#');
  return hash === -1 ? line : line.slice(0, hash);
}

function splitDirective(line: string): { name: string; value: string } | null {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const name = line.slice(0, colon).trim();
  const value = line.slice(colon + 1).trim();
  if (!name) return null;
  return { name, value };
}

function finalizeGroup(groups: RobotsUserAgentGroup[], group: RobotsUserAgentGroup | null): void {
  if (!group || group.userAgents.length === 0) return;
  groups.push({
    userAgents: [...group.userAgents],
    rules: [...group.rules],
  });
}

/**
 * Parse robots.txt text into user-agent groups and global sitemap directives.
 * Unknown directives are preserved as diagnostics; parsing continues.
 */
export function parseRobotsText(raw: string): RobotsParseResult {
  const diagnostics: RobotsDiagnostic[] = [];
  const sitemaps: string[] = [];
  const groups: RobotsUserAgentGroup[] = [];
  let current: RobotsUserAgentGroup | null = null;
  let truncated = false;

  const lines = raw.split(/\r?\n/);
  if (lines.length > ROBOTS_PARSE_LIMITS.maxLines) {
    truncated = true;
    diagnostics.push({
      line: ROBOTS_PARSE_LIMITS.maxLines + 1,
      directive: '(file)',
      message: `robots.txt exceeded ${ROBOTS_PARSE_LIMITS.maxLines} lines; remainder ignored.`,
    });
  }

  const scanLines = lines.slice(0, ROBOTS_PARSE_LIMITS.maxLines);

  scanLines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = stripComment(rawLine).trim();
    if (!trimmed) return;

    const directive = splitDirective(trimmed);
    if (!directive) {
      diagnostics.push({
        line: lineNumber,
        directive: trimmed,
        message: 'Line is not a valid directive (expected "name: value").',
      });
      return;
    }

    const name = directive.name.toLowerCase();

    if (!KNOWN_DIRECTIVES.has(name)) {
      diagnostics.push({
        line: lineNumber,
        directive: directive.name,
        message: `Unknown directive "${directive.name}" was ignored.`,
      });
      return;
    }

    if (name === 'sitemap') {
      if (!directive.value) {
        diagnostics.push({
          line: lineNumber,
          directive: 'Sitemap',
          message: 'Sitemap directive has no URL value.',
        });
        return;
      }
      sitemaps.push(directive.value);
      return;
    }

    if (name === 'user-agent') {
      if (!directive.value) {
        diagnostics.push({
          line: lineNumber,
          directive: 'User-agent',
          message: 'User-agent directive has no value.',
        });
        return;
      }

      if (current && current.rules.length > 0) {
        finalizeGroup(groups, current);
        current = { userAgents: [directive.value], rules: [] };
      } else if (current) {
        current.userAgents.push(directive.value);
      } else {
        current = { userAgents: [directive.value], rules: [] };
      }
      return;
    }

    // Allow / Disallow require an active group.
    if (!current) {
      current = { userAgents: ['*'], rules: [] };
      diagnostics.push({
        line: lineNumber,
        directive: directive.name,
        message: 'Path rule appeared before any User-agent; applied to User-agent: *.',
      });
    }

    const kind: RobotsDirectiveKind = name === 'allow' ? 'allow' : 'disallow';
    current.rules.push({
      kind,
      pattern: directive.value,
      lineNumber,
    });
  });

  finalizeGroup(groups, current);

  if (groups.length === 0 && sitemaps.length === 0 && diagnostics.length === 0) {
    return {
      ok: true,
      groups: [],
      sitemaps: [],
      diagnostics: [],
      truncated,
    };
  }

  return {
    ok: true,
    groups,
    sitemaps,
    diagnostics,
    truncated,
  };
}

function escapeRegexChar(char: string): string {
  return char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

/**
 * Match a robots path pattern against a URL path using `*` and end-anchor `$`.
 */
export function robotsPathMatches(pattern: string, path: string): boolean {
  let regex = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      regex += '.*';
      continue;
    }
    if (char === '$' && i === pattern.length - 1) {
      regex += '$';
      continue;
    }
    regex += escapeRegexChar(char);
  }
  return new RegExp(regex).test(path);
}

/**
 * Whether a declared robots user-agent token matches a crawler profile name.
 * Case-insensitive prefix match; `*` matches all profiles.
 */
export function robotsUserAgentMatches(declared: string, crawler: string): boolean {
  if (declared === '*') return true;
  const declaredLower = declared.toLowerCase();
  const crawlerLower = crawler.toLowerCase();
  return crawlerLower.startsWith(declaredLower);
}

/**
 * Pick the user-agent group with the most specific matching declared token.
 */
export function selectRobotsGroup(
  groups: RobotsUserAgentGroup[],
  crawler: string,
): RobotsUserAgentGroup | null {
  let best: RobotsUserAgentGroup | null = null;
  let bestSpecificity = -1;

  for (const group of groups) {
    for (const declared of group.userAgents) {
      if (!robotsUserAgentMatches(declared, crawler)) continue;
      const specificity = declared === '*' ? 0 : declared.length;
      if (specificity > bestSpecificity) {
        best = group;
        bestSpecificity = specificity;
      }
    }
  }

  return best;
}

export type RobotsMatchedRule = RobotsPathRule & {
  patternLength: number;
};

/**
 * Longest-match precedence among Allow/Disallow rules in a group.
 * Ties favour Allow over Disallow (Google REP behaviour).
 */
export function matchRobotsPathRules(
  rules: RobotsPathRule[],
  path: string,
): RobotsMatchedRule | null {
  let best: RobotsMatchedRule | null = null;

  for (const rule of rules) {
    if (!robotsPathMatches(rule.pattern, path)) continue;
    const patternLength = rule.pattern.length;
    if (!best) {
      best = { ...rule, patternLength };
      continue;
    }
    if (patternLength > best.patternLength) {
      best = { ...rule, patternLength };
      continue;
    }
    if (patternLength === best.patternLength && rule.kind === 'allow' && best.kind === 'disallow') {
      best = { ...rule, patternLength };
    }
  }

  return best;
}
