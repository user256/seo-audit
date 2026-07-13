export {
  compareDomFacts,
  type CompareDomFactsInput,
  type CompareDomFactsResult,
  type CssJsComparisonDiff,
  type CssJsComparisonDiffField,
  type CssJsComparisonObservation,
  type CssJsComparisonObservationKind,
} from './compare-dom-facts';
export { defaultCssJsCompareChromeOps } from './chrome-ops';
export {
  CSS_JS_COMPARISON_DISPLAY_LIMITS,
  CSS_JS_COMPARISON_LIMITS,
  type CssJsComparisonLimits,
} from './limits';
export {
  activeCssJsComparisonCount,
  cancelCssJsComparison,
  isCssJsComparisonCancelled,
  JAVASCRIPT_OFF_OMITTED,
  resetCssJsComparisonState,
  runCssJsComparison,
  type RunCssJsComparisonInput,
} from './run-css-js-comparison';
export type {
  CssJsCaptureOutcome,
  CssJsCompareChromeOps,
  CssJsComparisonPhase,
  CssJsComparisonProgress,
  CssJsComparisonResult,
  JavaScriptOffAvailability,
} from './types';
