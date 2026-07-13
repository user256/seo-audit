import { DEFAULT_VISIBLE_TEXT_MAX_CHARS } from '../../content/visible-text-fingerprint';

/**
 * Hard caps for the opt-in CSS/JS comparison experiment (Ticket 303).
 * @see docs/css-js-comparison.md
 */
export type CssJsComparisonLimits = {
  /** Wall-clock budget for the whole comparison run (ms). */
  maxWallTimeMs: number;
  /** How long to wait for the experiment tab to report a "complete" load (ms). */
  tabLoadTimeoutMs: number;
  /** Max characters retained for the bounded visible-text fingerprint. */
  maxVisibleTextChars: number;
};

export const CSS_JS_COMPARISON_LIMITS: CssJsComparisonLimits = {
  maxWallTimeMs: 45_000,
  tabLoadTimeoutMs: 20_000,
  maxVisibleTextChars: DEFAULT_VISIBLE_TEXT_MAX_CHARS,
};

/** UI display caps for the CSS/JS comparison panel. */
export const CSS_JS_COMPARISON_DISPLAY_LIMITS = {
  maxDiffRows: 10,
  maxObservations: 8,
} as const;
