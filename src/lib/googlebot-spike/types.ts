/**
 * Ticket 304 spike types. See docs/googlebot-style-experiment.md for the full
 * feasibility comparison; this module only locks the resulting decision in
 * code so product UI/permissions cannot drift from the report silently.
 */

/**
 * Only a "ship-as-experimental" recommendation authorises adding the
 * `debugger` optional permission and building the prototype described in
 * Ticket 304's acceptance criteria. "defer" and "reject" both mean: no new
 * permission, no prototype UI.
 */
export type GooglebotSpikeRecommendation = 'ship-as-experimental' | 'defer' | 'reject';

export type GooglebotSpikeOption = {
  /** Short identifier matching a "###" heading in the report. */
  id: 'chrome-debugger-cdp' | 'ordinary-tabs-scripting' | 'unsupported';
  label: string;
  /** One-line verdict, mirrors the comparison table in the report. */
  verdict: string;
};

export type GooglebotSpikeDecision = {
  ticket: '304';
  recommendation: GooglebotSpikeRecommendation;
  decidedAt: string;
  /** Path to the full feasibility report, relative to the repo root. */
  reportPath: string;
  /** Short human-readable summary of why, safe to surface in UI/logs if ever needed. */
  summary: string;
  optionsConsidered: GooglebotSpikeOption[];
  /** Conditions that would justify reopening this spike (see report's "What would change this decision"). */
  revisitTriggers: string[];
  /** True only when a debugger-backed prototype exists behind optional_permissions. Always false while deferred/rejected. */
  prototypeShipped: boolean;
};
