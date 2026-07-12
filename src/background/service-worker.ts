/**
 * Placeholder service worker. Ticket 101 wires the real side-panel open action
 * and permission request flow.
 */
chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
