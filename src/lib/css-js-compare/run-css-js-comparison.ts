import { CSS_DISABLE_METHOD_VERSION } from '../../content/css-disable-injection';
import { compareDomFacts } from './compare-dom-facts';
import { defaultCssJsCompareChromeOps } from './chrome-ops';
import { CSS_JS_COMPARISON_LIMITS, type CssJsComparisonLimits } from './limits';
import type {
  CssJsCaptureOutcome,
  CssJsCompareChromeOps,
  CssJsComparisonPhase,
  CssJsComparisonProgress,
  CssJsComparisonResult,
  JavaScriptOffAvailability,
} from './types';

export const JAVASCRIPT_OFF_OMITTED: JavaScriptOffAvailability = {
  supported: false,
  reason:
    'JavaScript-disabled comparison is deliberately omitted (Ticket 303). It would require the contentSettings ' +
    'permission plus an origin-scoped reload that can affect every tab on that origin, not just the audited one. ' +
    'This is deferred until the product accepts that permission surface and a documented per-origin restore path.',
};

const BASE_LIMITATIONS = [
  'CSS/JS comparison opens a dedicated background tab and disables stylesheets via chrome.scripting — it does not use browser DevTools "Disable CSS" and is not Googlebot or crawler-rendering parity.',
  'Only CSS is disabled in this comparison. JavaScript-disabled comparison is deliberately omitted — see the "javascriptOff" field and docs/css-js-comparison.md.',
  'Disabling CSS cannot reach closed shadow roots, cross-origin iframes, or constructed/adopted stylesheets; those may still affect rendering in ways this capture does not detect.',
  'The comparison tab is opened inactive (not focused) and is closed automatically when the run finishes, is cancelled, or fails.',
];

export type RunCssJsComparisonInput = {
  requestId: string;
  /** Active tab id used for the baseline (unmodified) capture. */
  activeTabId: number;
  /** URL loaded in the dedicated experiment tab; also used to derive the origin shown in disclosure. */
  auditedUrl: string;
  limits?: Partial<CssJsComparisonLimits>;
  onProgress?: (progress: CssJsComparisonProgress) => void;
  /** Test hook — override tab/scripting operations without mocking global chrome. */
  chromeOps?: Partial<CssJsCompareChromeOps>;
};

const cancelledRequests = new Set<string>();
const activeRequests = new Set<string>();

function nowIso(): string {
  return new Date().toISOString();
}

function mergeLimits(overrides?: Partial<CssJsComparisonLimits>): CssJsComparisonLimits {
  return { ...CSS_JS_COMPARISON_LIMITS, ...overrides };
}

export function cancelCssJsComparison(requestId?: string): boolean {
  if (requestId) {
    cancelledRequests.add(requestId);
    return true;
  }
  for (const id of activeRequests) cancelledRequests.add(id);
  return activeRequests.size > 0;
}

export function isCssJsComparisonCancelled(requestId: string): boolean {
  return cancelledRequests.has(requestId);
}

export function activeCssJsComparisonCount(): number {
  return activeRequests.size;
}

function clearCancellationState(requestId: string): void {
  cancelledRequests.delete(requestId);
  activeRequests.delete(requestId);
}

async function captureOutcome(
  ops: CssJsCompareChromeOps,
  tabId: number,
  maxVisibleTextChars: number,
): Promise<CssJsCaptureOutcome> {
  const facts = await ops.captureDomFacts(tabId);
  if (!facts) {
    return {
      ok: false,
      code: 'collector-empty-result',
      message: 'DOM collector returned no result for this tab.',
    };
  }
  const visibleText = await ops.captureVisibleText(tabId, maxVisibleTextChars);
  return { ok: true, facts, visibleText };
}

/**
 * Run a user-approved CSS-off comparison: capture the active tab's DomFacts,
 * open a dedicated background tab to the same URL, disable its stylesheets,
 * capture DomFacts again, diff deterministically, then close the dedicated
 * tab. See docs/css-js-comparison.md for the full design and limitations.
 */
export async function runCssJsComparison(
  input: RunCssJsComparisonInput,
): Promise<CssJsComparisonResult> {
  const limits = mergeLimits(input.limits);
  const ops: CssJsCompareChromeOps = { ...defaultCssJsCompareChromeOps, ...input.chromeOps };
  const startedAt = nowIso();
  const startedMs = Date.now();

  let origin = '';
  try {
    origin = new URL(input.auditedUrl).origin;
  } catch {
    origin = '';
  }

  activeRequests.add(input.requestId);

  const emitProgress = (phase: CssJsComparisonPhase, detail?: string): void => {
    input.onProgress?.({ requestId: input.requestId, phase, detail });
  };

  let wallTimeExceeded = false;
  const shouldContinue = (): boolean => {
    if (isCssJsComparisonCancelled(input.requestId)) return false;
    if (Date.now() - startedMs > limits.maxWallTimeMs) {
      wallTimeExceeded = true;
      return false;
    }
    return true;
  };

  const limitations = [...BASE_LIMITATIONS];
  let experimentTabId: number | null = null;
  let experimentTabRestored = true;
  let cssDisable: Awaited<ReturnType<CssJsCompareChromeOps['disableCss']>> = null;
  let baseline: CssJsCaptureOutcome = {
    ok: false,
    code: 'not-run',
    message: 'Baseline capture was not attempted.',
  };
  let experiment: CssJsCaptureOutcome = {
    ok: false,
    code: 'not-run',
    message: 'Experiment capture was not attempted.',
  };

  try {
    emitProgress('capturing-baseline');
    if (shouldContinue()) {
      baseline = await captureOutcome(ops, input.activeTabId, limits.maxVisibleTextChars);
    }

    if (shouldContinue()) {
      emitProgress('opening-tab', input.auditedUrl);
      try {
        experimentTabId = await ops.createTab(input.auditedUrl);
        experimentTabRestored = false;
      } catch (err) {
        limitations.push(
          `Could not open the comparison tab: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (experimentTabId != null && shouldContinue()) {
      emitProgress('waiting-for-load', input.auditedUrl);
      const loaded = await ops.waitForTabLoad(experimentTabId, limits.tabLoadTimeoutMs);
      if (!loaded) {
        limitations.push(
          `Comparison tab did not report a "complete" load within ${limits.tabLoadTimeoutMs}ms; capture proceeded anyway.`,
        );
      }
    }

    if (experimentTabId != null && shouldContinue()) {
      emitProgress('disabling-css');
      cssDisable = await ops.disableCss(experimentTabId);
      if (!cssDisable) {
        limitations.push(
          'CSS-disable injection did not return a result; the experiment capture may still reflect author CSS.',
        );
      }
    }

    if (experimentTabId != null && shouldContinue()) {
      emitProgress('capturing-experiment');
      experiment = await captureOutcome(ops, experimentTabId, limits.maxVisibleTextChars);
    }
  } finally {
    if (experimentTabId != null) {
      await ops.closeTab(experimentTabId);
      experimentTabRestored = true;
    }
  }

  const cancelled = isCssJsComparisonCancelled(input.requestId);
  wallTimeExceeded = wallTimeExceeded || Date.now() - startedMs > limits.maxWallTimeMs;

  emitProgress(cancelled ? 'cancelled' : 'comparing');

  const { diffs, observations } =
    !cancelled && baseline.ok && experiment.ok
      ? compareDomFacts({
          requestId: input.requestId,
          baseline: baseline.facts,
          experiment: experiment.facts,
          baselineVisibleText: baseline.visibleText,
          experimentVisibleText: experiment.visibleText,
        })
      : { diffs: [], observations: [] };

  emitProgress(cancelled ? 'cancelled' : 'done');
  clearCancellationState(input.requestId);

  if (wallTimeExceeded) {
    limitations.push(`Run stopped after the ${limits.maxWallTimeMs}ms wall-time budget.`);
  }
  if (cancelled) {
    limitations.push('CSS/JS comparison was cancelled before both captures completed.');
  }
  if (!baseline.ok) {
    limitations.push(`Baseline capture failed: ${baseline.message}`);
  }
  if (!experiment.ok) {
    limitations.push(`Experiment capture failed: ${experiment.message}`);
  }

  return {
    requestId: input.requestId,
    auditedUrl: input.auditedUrl,
    origin,
    methodVersion: CSS_DISABLE_METHOD_VERSION,
    startedAt,
    endedAt: nowIso(),
    cancelled,
    limits,
    baseline,
    experiment,
    cssDisable,
    experimentTabRestored,
    diffs,
    observations,
    limitations,
    javascriptOff: JAVASCRIPT_OFF_OMITTED,
  };
}

/** Reset cancellation/active tracking — test helper only. */
export function resetCssJsComparisonState(): void {
  cancelledRequests.clear();
  activeRequests.clear();
}
