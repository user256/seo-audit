import type { GooglebotSpikeDecision } from './types';

/**
 * Recorded outcome of Ticket 304 (Googlebot-Style Render Experiment Spike).
 *
 * Full comparison of chrome.debugger/CDP vs. ordinary tabs/scripting APIs,
 * permissions, banner/UX cost, testability, maintenance risk, and recovery
 * matrix lives in docs/googlebot-style-experiment.md. This constant exists so
 * the decision cannot silently drift from that report: a future change to
 * the recommendation (e.g. product accepting the `debugger` permission cost)
 * requires an explicit code change here, which `decision.test.ts` pins.
 *
 * Because the recommendation is "defer" (not "ship-as-experimental"), Ticket
 * 304's acceptance criteria for a prototype do not apply: no `debugger`
 * permission (required or optional_permissions) has been added to
 * manifest.config.ts, and no product UI/messages ship from this module.
 */
export const GOOGLEBOT_SPIKE_DECISION: GooglebotSpikeDecision = {
  ticket: '304',
  recommendation: 'defer',
  decidedAt: '2026-07-13',
  reportPath: 'docs/googlebot-style-experiment.md',
  summary:
    'A genuinely honest "Googlebot-style" experiment (JS-visible user-agent override, ' +
    'device-metrics viewport emulation, and a scripted wait) needs chrome.debugger/CDP. ' +
    "That permission's per-run debugging banner, Chrome Web Store review bar, enterprise-policy " +
    'exposure, and CDP-version maintenance risk are disproportionate to the incremental signal ' +
    'over the already-shipped CSS/JS comparison (Ticket 303). Ordinary tabs/scripting APIs cannot ' +
    'override navigator.userAgent or emulate device metrics for a single tab, so they cannot ' +
    'honestly claim the "Googlebot-style" label either. Deferred pending an explicit product/' +
    'permission decision, not rejected outright.',
  optionsConsidered: [
    {
      id: 'chrome-debugger-cdp',
      label:
        'chrome.debugger / CDP (Network.setUserAgentOverride, Emulation.setDeviceMetricsOverride, Page.navigate)',
      verdict:
        'Technically capable of a JS-visible UA override, device-metrics emulation, and a scripted ' +
        'wait, but requires the highest-risk extension permission, an unsuppressible per-run ' +
        'debugging banner, and ongoing CDP-version maintenance. Disproportionate for now.',
    },
    {
      id: 'ordinary-tabs-scripting',
      label: 'Ordinary chrome.tabs / chrome.scripting (the pattern reused from Ticket 303)',
      verdict:
        'No new permission needed, but cannot override navigator.userAgent (only the outgoing HTTP ' +
        'header, via a declarativeNetRequest permission this extension does not declare) and cannot ' +
        "emulate device metrics/viewport for a single tab. At best reproduces Ticket 303's existing " +
        'wait-then-capture shape without the CSS-disable step — not materially "Googlebot-style."',
    },
    {
      id: 'unsupported',
      label: 'Unsupported conclusion (neither path adopted)',
      verdict:
        'Neither option clears the bar of "meaningfully more truthful than Ticket 303" weighed ' +
        'against acceptable permission/UX/maintenance cost. This spike defers rather than ships ' +
        'either option.',
    },
  ],
  revisitTriggers: [
    "Product explicitly accepts the debugger permission's review, enterprise-policy, and per-run " +
      'banner cost for this specific feature as an intentional, informed decision.',
    'Chrome ships a public, non-debugger API for JS-visible user-agent override and/or ' +
      'single-tab device-metrics emulation.',
    'Real usage of the shipped CSS/JS comparison (Ticket 303) shows it is insufficient for a ' +
      'common, real diagnosis need that only a genuine UA/viewport experiment would resolve.',
  ],
  prototypeShipped: false,
};
