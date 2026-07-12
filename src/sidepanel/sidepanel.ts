import type { ExtensionRequest, ExtensionResponse } from '../background/messages';
import { requestOriginAccess, type ActiveTabSnapshot } from '../lib/tab-access';
import { viewFromSnapshot } from './view-state';

const tabUrlEl = document.querySelector('#tab-url')!;
const accessStateEl = document.querySelector('#access-state')!;
const statusEl = document.querySelector('#status-message')!;
const allowBtn = document.querySelector('#allow-site') as HTMLButtonElement;
const refreshBtn = document.querySelector('#refresh') as HTMLButtonElement;
const pingBtn = document.querySelector('#ping') as HTMLButtonElement;

let snapshot: ActiveTabSnapshot | null = null;

function setStatus(text: string, kind: 'plain' | 'ok' | 'error' = 'plain'): void {
  statusEl.textContent = text;
  statusEl.classList.toggle('is-ok', kind === 'ok');
  statusEl.classList.toggle('is-error', kind === 'error');
}

function applyView(next: ActiveTabSnapshot): void {
  snapshot = next;
  const view = viewFromSnapshot(next);
  tabUrlEl.textContent = view.urlLabel;
  accessStateEl.textContent = view.accessLabel;
  allowBtn.hidden = !view.showAllow;
  pingBtn.hidden = !view.showPing;
  setStatus(view.status, view.statusKind);
}

async function send<T extends ExtensionResponse>(message: ExtensionRequest): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

async function refresh(): Promise<void> {
  setStatus('Refreshing…');
  const response = await send<ExtensionResponse>({ type: 'GET_ACTIVE_TAB_SNAPSHOT' });
  if (response.type === 'ERROR') {
    setStatus(response.message, 'error');
    return;
  }
  if (response.type !== 'ACTIVE_TAB_SNAPSHOT') {
    setStatus('Unexpected response from the extension service worker.', 'error');
    return;
  }
  applyView(response.snapshot);
}

async function allowSite(): Promise<void> {
  if (!snapshot || snapshot.status !== 'ready') {
    return;
  }
  allowBtn.disabled = true;
  setStatus(`Requesting access to ${snapshot.origin}…`);
  try {
    // Must run in the side-panel (user gesture), not the service worker.
    const granted = await requestOriginAccess(snapshot.pattern);
    if (!granted) {
      setStatus('Permission was not granted.', 'error');
      return;
    }
    await refresh();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus(message, 'error');
  } finally {
    allowBtn.disabled = false;
  }
}

async function ping(): Promise<void> {
  if (!snapshot || snapshot.status !== 'ready' || !snapshot.granted) {
    return;
  }
  pingBtn.disabled = true;
  setStatus('Injecting test content script…');
  try {
    const response = await send<ExtensionResponse>({
      type: 'PING_ACTIVE_TAB',
      tabId: snapshot.tabId,
    });
    if (response.type === 'ERROR') {
      setStatus(response.message, 'error');
      return;
    }
    if (response.type !== 'PING_RESULT') {
      setStatus('Unexpected ping response.', 'error');
      return;
    }
    if (!response.result.ok) {
      setStatus(response.result.error, 'error');
      return;
    }
    setStatus(`Page access ok — content script saw ${response.result.href}`, 'ok');
  } finally {
    pingBtn.disabled = false;
  }
}

allowBtn.addEventListener('click', () => {
  void allowSite();
});
refreshBtn.addEventListener('click', () => {
  void refresh();
});
pingBtn.addEventListener('click', () => {
  void ping();
});

void refresh();
