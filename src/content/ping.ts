/**
 * Canonical ping payload for the no-op content-script injection (Ticket 101).
 * The service worker injects an equivalent inline function via
 * chrome.scripting.executeScript after origin access is granted.
 * Real DOM collection lands in Ticket 103.
 */
export function collectPing(href: string): { pong: true; href: string } {
  return { pong: true, href };
}
