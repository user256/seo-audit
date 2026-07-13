import {
  matchRobotsPathRules,
  selectRobotsGroup,
  type RobotsMatchedRule,
  type RobotsParseSuccess,
  type RobotsPathRule,
  type RobotsUserAgentGroup,
} from './parse-robots';

/** Crawler profiles evaluated by Ticket 202. */
export const ROBOTS_CRAWLER_PROFILES = ['Googlebot', '*'] as const;
export type RobotsCrawlerProfile = (typeof ROBOTS_CRAWLER_PROFILES)[number];

export type RobotsDecisionReason =
  | 'no-matching-group'
  | 'no-matching-rules'
  | 'allow-rule'
  | 'disallow-rule';

export type RobotsProfileEvaluation = {
  profile: RobotsCrawlerProfile;
  crawlable: boolean;
  reason: RobotsDecisionReason;
  matchedGroup: RobotsUserAgentGroup | null;
  matchedRule: RobotsMatchedRule | null;
};

export type RobotsPathEvaluation = {
  ok: true;
  path: string;
  profiles: Record<RobotsCrawlerProfile, RobotsProfileEvaluation>;
};

export type RobotsEvaluationUnavailable = {
  ok: false;
  status: 'unavailable';
  code: string;
  message: string;
  path: string;
};

export type RobotsEvaluationResult = RobotsPathEvaluation | RobotsEvaluationUnavailable;

function profileCrawlerName(profile: RobotsCrawlerProfile): string {
  return profile;
}

function evaluateProfile(
  parsed: RobotsParseSuccess,
  path: string,
  profile: RobotsCrawlerProfile,
): RobotsProfileEvaluation {
  const group = selectRobotsGroup(parsed.groups, profileCrawlerName(profile));
  if (!group) {
    return {
      profile,
      crawlable: true,
      reason: 'no-matching-group',
      matchedGroup: null,
      matchedRule: null,
    };
  }

  const matchedRule = matchRobotsPathRules(group.rules, path);
  if (!matchedRule) {
    return {
      profile,
      crawlable: true,
      reason: 'no-matching-rules',
      matchedGroup: group,
      matchedRule: null,
    };
  }

  if (matchedRule.kind === 'allow') {
    return {
      profile,
      crawlable: true,
      reason: 'allow-rule',
      matchedGroup: group,
      matchedRule,
    };
  }

  return {
    profile,
    crawlable: false,
    reason: 'disallow-rule',
    matchedGroup: group,
    matchedRule,
  };
}

/** Extract the URL pathname used for robots path matching. */
export function robotsPathFromUrl(url: string): string {
  return new URL(url).pathname;
}

/**
 * Evaluate Googlebot and generic `*` profiles for a path against parsed robots.txt.
 */
export function evaluateRobotsPath(parsed: RobotsParseSuccess, path: string): RobotsPathEvaluation {
  const profiles = {} as Record<RobotsCrawlerProfile, RobotsProfileEvaluation>;
  for (const profile of ROBOTS_CRAWLER_PROFILES) {
    profiles[profile] = evaluateProfile(parsed, path, profile);
  }
  return { ok: true, path, profiles };
}

/**
 * Evaluate robots crawl rules for a URL pathname.
 * Returns unavailable when parsed robots evidence is missing or failed.
 */
export function evaluateRobotsForUrl(
  parsed: RobotsParseSuccess | null | undefined,
  url: string,
  unavailable?: { code: string; message: string },
): RobotsEvaluationResult {
  let path: string;
  try {
    path = robotsPathFromUrl(url);
  } catch {
    return {
      ok: false,
      status: 'unavailable',
      code: 'robots-invalid-url',
      message: `URL is not absolute/parseable: ${url}`,
      path: url,
    };
  }

  if (!parsed?.ok) {
    return {
      ok: false,
      status: 'unavailable',
      code: unavailable?.code ?? 'robots-unavailable',
      message: unavailable?.message ?? 'robots.txt was not available for evaluation.',
      path,
    };
  }

  return evaluateRobotsPath(parsed, path);
}

/** Convenience helper for tests and callers that already hold a matched rule. */
export function isRobotsDisallowed(
  rules: RobotsPathRule[],
  path: string,
): { disallowed: boolean; matchedRule: RobotsMatchedRule | null } {
  const matchedRule = matchRobotsPathRules(rules, path);
  if (!matchedRule) return { disallowed: false, matchedRule: null };
  return { disallowed: matchedRule.kind === 'disallow', matchedRule };
}
