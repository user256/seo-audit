import { handleExtensionRequest, type ExtensionRequest } from './messages';
import { registerNavigationWebRequestListeners } from './navigation-listeners';

registerNavigationWebRequestListeners();

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const request = message as ExtensionRequest;
  void handleExtensionRequest(request)
    .then((response) => sendResponse(response))
    .catch((err: unknown) => {
      const text = err instanceof Error ? err.message : String(err);
      sendResponse({ type: 'ERROR', message: text });
    });
  return true;
});
