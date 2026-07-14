import { createNavigationCaptureController } from '../lib/network/navigation-capture';

/** Process-wide main-frame navigation capture (Ticket 201). */
export const navigationCapture = createNavigationCaptureController();

const FILTER = {
  urls: ['http://*/*', 'https://*/*'],
  types: ['main_frame' as const],
};

/**
 * Register chrome.webRequest observers. Safe to call once from the service worker.
 * Requires the `webRequest` permission and HTTP(S) host_permissions.
 */
export function registerNavigationWebRequestListeners(): void {
  if (!chrome.webRequest?.onHeadersReceived) return;

  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      navigationCapture.onHeadersReceived({
        tabId: details.tabId,
        requestId: details.requestId,
        url: details.url,
        statusCode: details.statusCode,
        type: details.type,
        responseHeaders: details.responseHeaders?.map((h) => ({
          name: h.name,
          value: h.value,
        })),
      });
      return undefined;
    },
    FILTER,
    ['responseHeaders', 'extraHeaders'],
  );

  chrome.webRequest.onBeforeRedirect.addListener((details) => {
    navigationCapture.onBeforeRedirect({
      tabId: details.tabId,
      requestId: details.requestId,
      url: details.url,
      redirectUrl: details.redirectUrl,
      statusCode: details.statusCode,
      type: details.type,
    });
  }, FILTER);

  chrome.webRequest.onCompleted.addListener((details) => {
    navigationCapture.onCompleted({
      tabId: details.tabId,
      requestId: details.requestId,
      url: details.url,
      statusCode: details.statusCode,
      type: details.type,
    });
  }, FILTER);

  chrome.webRequest.onErrorOccurred.addListener((details) => {
    navigationCapture.onErrorOccurred({
      tabId: details.tabId,
      requestId: details.requestId,
      url: details.url,
      error: details.error,
      type: details.type,
    });
  }, FILTER);
}

/**
 * Reload the tab once while watching so main-frame status/headers are observed.
 * Used on panel open and before audit when no prior observation exists.
 */
export async function reloadAndObserveNavigation(
  tabId: number,
  timeoutMs = 20_000,
): Promise<ReturnType<typeof navigationCapture.getObservation>> {
  navigationCapture.watchTab(tabId);
  const before = navigationCapture.getObservation(tabId);
  const beforeKey = before.status === 'observed' ? `${before.finalUrl}|${before.observedAt}` : null;

  await chrome.tabs.reload(tabId);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
    const observation = navigationCapture.getObservation(tabId);
    if (observation.status === 'observed') {
      const key = `${observation.finalUrl}|${observation.observedAt}`;
      if (key !== beforeKey) return observation;
    }
  }
  return navigationCapture.getObservation(tabId);
}
