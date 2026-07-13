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
