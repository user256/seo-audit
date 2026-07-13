import type { NavigationObservationStatus } from './types';

/**
 * Capability decision (Ticket 206):
 *
 * A side-panel / service-worker `fetch` cannot recover the headers or redirect
 * chain of a navigation that already completed. Labelling a replay fetch as
 * “navigation headers” would be false.
 *
 * Chosen approach for current-page navigation evidence (Ticket 201 implements):
 * attach `webRequest` / `webNavigation` listeners for the audited tab and, when
 * the audit starts after navigation has finished, require an explicit
 * user-started reload/re-observe. Until that lands, callers get `unavailable`
 * with recovery `reload-and-reobserve`.
 *
 * Extension fetches use `safeFetch` and are always sourced as `extension-fetch`.
 */

export type NavigationObserverState = {
  /** Tab ids that had listeners attached before their next main-frame navigation. */
  attachedTabIds: Set<number>;
  /** Last observed main-frame result per tab (filled by Ticket 201 wiring). */
  observations: Map<number, Extract<NavigationObservationStatus, { status: 'observed' }>>;
};

export function createNavigationObserverState(): NavigationObserverState {
  return {
    attachedTabIds: new Set(),
    observations: new Map(),
  };
}

/** Mark that observation listeners are armed for a tab (before navigation). */
export function attachNavigationObserver(state: NavigationObserverState, tabId: number): void {
  state.attachedTabIds.add(tabId);
}

/** Clear listener arming (e.g. after detach or tab close). */
export function detachNavigationObserver(state: NavigationObserverState, tabId: number): void {
  state.attachedTabIds.delete(tabId);
  state.observations.delete(tabId);
}

/**
 * Record a main-frame navigation observation. Callers must only invoke this
 * when listeners were attached before the navigation started.
 */
export function recordBrowserNavigation(
  state: NavigationObserverState,
  observation: Extract<NavigationObservationStatus, { status: 'observed' }>,
): void {
  if (!state.attachedTabIds.has(observation.tabId)) {
    throw new Error(
      'Refusing to record browser-navigation evidence without a prior listener attach.',
    );
  }
  state.observations.set(observation.tabId, observation);
}

/**
 * Look up navigation evidence for a tab/URL. Returns unavailable when the
 * listener was attached too late or nothing was observed.
 */
export function getNavigationObservation(
  state: NavigationObserverState,
  input: { tabId: number; requestedUrl?: string },
): NavigationObservationStatus {
  const observed = state.observations.get(input.tabId);
  if (observed) {
    if (
      input.requestedUrl &&
      observed.requestedUrl !== input.requestedUrl &&
      observed.finalUrl !== input.requestedUrl
    ) {
      return {
        status: 'unavailable',
        source: 'unavailable',
        code: 'navigation-completed-before-attach',
        message: 'Stored navigation evidence does not match the requested audit URL.',
        requestedUrl: input.requestedUrl,
        recovery: 'reload-and-reobserve',
      };
    }
    return observed;
  }

  if (!state.attachedTabIds.has(input.tabId)) {
    return {
      status: 'unavailable',
      source: 'unavailable',
      code: 'listener-not-attached',
      message:
        'Navigation listeners were not attached before this page loaded. Extension fetch must not be labelled as browser navigation.',
      requestedUrl: input.requestedUrl,
      recovery: 'reload-and-reobserve',
    };
  }

  return {
    status: 'unavailable',
    source: 'unavailable',
    code: 'navigation-completed-before-attach',
    message:
      'Listeners were attached, but no main-frame navigation has been observed yet for this tab.',
    requestedUrl: input.requestedUrl,
    recovery: 'reload-and-reobserve',
  };
}
