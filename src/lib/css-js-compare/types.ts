import type { CssDisableInjectionResult } from '../../content/css-disable-injection';
import type { DomFacts } from '../../content/dom-collector';
import type { VisibleTextFingerprint } from '../../content/visible-text-fingerprint';
import type { CssJsComparisonDiff, CssJsComparisonObservation } from './compare-dom-facts';
import type { CssJsComparisonLimits } from './limits';

export type CssJsCaptureOutcome =
  | { ok: true; facts: DomFacts; visibleText: VisibleTextFingerprint | null }
  | { ok: false; code: string; message: string };

export type CssJsComparisonPhase =
  | 'capturing-baseline'
  | 'opening-tab'
  | 'waiting-for-load'
  | 'disabling-css'
  | 'capturing-experiment'
  | 'comparing'
  | 'done'
  | 'cancelled';

export type CssJsComparisonProgress = {
  requestId: string;
  phase: CssJsComparisonPhase;
  detail?: string;
};

/** Documents why a JavaScript-disabled comparison is not offered by this ticket. */
export type JavaScriptOffAvailability = {
  supported: false;
  reason: string;
};

export type CssJsComparisonResult = {
  requestId: string;
  auditedUrl: string;
  origin: string;
  methodVersion: string;
  startedAt: string;
  endedAt: string;
  cancelled: boolean;
  limits: CssJsComparisonLimits;
  baseline: CssJsCaptureOutcome;
  experiment: CssJsCaptureOutcome;
  cssDisable: CssDisableInjectionResult | null;
  /** True once the experiment tab has been closed (finally-block restore ran). */
  experimentTabRestored: boolean;
  diffs: CssJsComparisonDiff[];
  observations: CssJsComparisonObservation[];
  limitations: string[];
  javascriptOff: JavaScriptOffAvailability;
};

/**
 * Tab/scripting operations the runner needs. Defaults call the real
 * chrome.tabs / chrome.scripting APIs; tests inject fakes here instead of
 * mocking the global `chrome` object.
 */
export type CssJsCompareChromeOps = {
  captureDomFacts: (tabId: number) => Promise<DomFacts | null>;
  captureVisibleText: (tabId: number, maxChars: number) => Promise<VisibleTextFingerprint | null>;
  createTab: (url: string) => Promise<number>;
  waitForTabLoad: (tabId: number, timeoutMs: number) => Promise<boolean>;
  disableCss: (tabId: number) => Promise<CssDisableInjectionResult | null>;
  closeTab: (tabId: number) => Promise<void>;
};
