import type { ExtensionRequest, ExtensionResponse } from '../background/messages';
import type { Evidence } from '../lib/schemas/audit';
import { requestOriginAccess } from '../lib/tab-access';
import { renderFindingsPanel } from './findings-view';
import { mountReportEditor, type ReportEditorController } from './report-editor';
import { viewFromSnapshot } from './view-state';
import {
  initialWorkspace,
  withCollectFailure,
  withCollecting,
  withSavedAudit,
  withTab,
  type WorkspaceModel,
} from './workspace-state';

const tabUrlEl = document.querySelector('#tab-url')!;
const accessStateEl = document.querySelector('#access-state')!;
const statusEl = document.querySelector('#status-message')!;
const phaseEl = document.querySelector('#workspace-phase')!;
const collectSummaryEl = document.querySelector('#collect-summary') as HTMLElement;
const allowBtn = document.querySelector('#allow-site') as HTMLButtonElement;
const collectBtn = document.querySelector('#collect-dom') as HTMLButtonElement;
const refreshBtn = document.querySelector('#refresh') as HTMLButtonElement;
const pingBtn = document.querySelector('#ping') as HTMLButtonElement;
const openReportBtn = document.querySelector('#open-report') as HTMLButtonElement;
const backToFindingsBtn = document.querySelector('#back-to-findings') as HTMLButtonElement;
const findingsSection = document.querySelector('#findings-section') as HTMLElement;
const findingsSummaryEl = document.querySelector('#findings-summary')!;
const findingsPanel = document.querySelector('#findings-panel') as HTMLElement;
const reportSection = document.querySelector('#report-section') as HTMLElement;
const reportSessionLabel = document.querySelector('#report-session-label')!;

let workspace: WorkspaceModel = initialWorkspace();
let reportEditor: ReportEditorController | null = null;
let evidenceById = new Map<string, Evidence>();
let viewingReport = false;

const PHASE_LABEL: Record<WorkspaceModel['phase'], string> = {
  'unsupported-tab': 'Unsupported tab',
  'permission-required': 'Permission required',
  'ready-to-collect': 'Ready to audit',
  collecting: 'Collecting…',
  'collected-with-errors': 'Saved with capture issues',
  'empty-session': 'No session yet',
  'saved-audit': 'Saved audit',
};

function setStatus(text: string, kind: 'plain' | 'ok' | 'error' = 'plain'): void {
  statusEl.textContent = text;
  statusEl.classList.toggle('is-ok', kind === 'ok');
  statusEl.classList.toggle('is-error', kind === 'error');
}

function renderWorkspace(): void {
  phaseEl.textContent = `State: ${PHASE_LABEL[workspace.phase]}`;
  const tab = workspace.tab;
  if (tab) {
    const view = viewFromSnapshot(tab);
    tabUrlEl.textContent = view.urlLabel;
    accessStateEl.textContent = view.accessLabel;
    allowBtn.hidden = !view.showAllow;
    pingBtn.hidden = !view.showPing;
    collectBtn.hidden = !(view.showCollect && workspace.phase !== 'collecting');
  } else {
    tabUrlEl.textContent = '—';
    accessStateEl.textContent = 'Unavailable';
    allowBtn.hidden = true;
    pingBtn.hidden = true;
    collectBtn.hidden = true;
  }

  collectBtn.disabled = workspace.phase === 'collecting';
  setStatus(workspace.statusMessage, workspace.statusKind);

  const hasSession = Boolean(workspace.sessionId);
  findingsSection.hidden = !hasSession || viewingReport;
  reportSection.hidden = !hasSession || !viewingReport;
  openReportBtn.hidden = !hasSession || viewingReport;
  backToFindingsBtn.hidden = !hasSession || !viewingReport;

  if (hasSession && !viewingReport) {
    const summary = workspace.summary;
    findingsSummaryEl.textContent = summary
      ? `${summary.totalFindings} findings · indexability ${summary.indexability.status}. ${summary.indexability.reason}`
      : '';
    renderFindingsPanel(findingsPanel, workspace.findings, evidenceById);
  }
}

async function send<T extends ExtensionResponse>(message: ExtensionRequest): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function ensureReportEditor(sessionId: string, initialMarkdown: string): void {
  reportSessionLabel.textContent = `Session ${sessionId} — Markdown is saved locally; preview HTML is not stored.`;
  if (reportEditor) {
    reportEditor.setMarkdown(initialMarkdown);
    return;
  }
  reportEditor = mountReportEditor(
    {
      textarea: document.querySelector('#report-markdown') as HTMLTextAreaElement,
      preview: document.querySelector('#report-preview') as HTMLElement,
      wordCount: document.querySelector('#report-word-count') as HTMLElement,
      sourcePanel: document.querySelector('#report-source-panel') as HTMLElement,
      previewPanel: document.querySelector('#report-preview-panel') as HTMLElement,
      modeSourceBtn: document.querySelector('#report-mode-source') as HTMLButtonElement,
      modePreviewBtn: document.querySelector('#report-mode-preview') as HTMLButtonElement,
      toolbar: document.querySelector('#report-toolbar') as HTMLElement,
      status: document.querySelector('#report-status') as HTMLElement,
    },
    {
      initialMarkdown,
      onAutosave: async (markdown) => {
        if (!workspace.sessionId) return;
        const response = await send<ExtensionResponse>({
          type: 'SAVE_REPORT_MARKDOWN',
          sessionId: workspace.sessionId,
          markdown,
        });
        if (response.type === 'ERROR') {
          throw new Error(response.message);
        }
      },
    },
  );
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
  workspace = withTab(workspace, response.snapshot);
  renderWorkspace();
}

async function allowSite(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready') return;
  allowBtn.disabled = true;
  setStatus(`Requesting access to ${tab.origin}…`);
  try {
    const granted = await requestOriginAccess(tab.pattern);
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
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready' || !tab.granted) return;
  pingBtn.disabled = true;
  setStatus('Injecting test content script…');
  try {
    const response = await send<ExtensionResponse>({
      type: 'PING_ACTIVE_TAB',
      tabId: tab.tabId,
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

async function collectDom(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready' || !tab.granted) return;
  workspace = withCollecting(workspace);
  renderWorkspace();
  collectSummaryEl.hidden = true;
  try {
    const response = await send<ExtensionResponse>({ type: 'COLLECT_DOM_SNAPSHOT' });
    if (response.type === 'ERROR') {
      workspace = withCollectFailure(workspace, response.message);
      renderWorkspace();
      return;
    }
    if (response.type !== 'COLLECT_DOM_RESULT') {
      workspace = withCollectFailure(workspace, 'Unexpected collect response.');
      renderWorkspace();
      return;
    }
    if (!response.result.ok) {
      workspace = withCollectFailure(
        workspace,
        response.result.error,
        response.result.captureError,
      );
      renderWorkspace();
      return;
    }

    evidenceById = new Map(
      response.result.snapshot.evidence.map((item) => [item.id, item] as const),
    );
    workspace = withSavedAudit(workspace, {
      sessionId: response.result.sessionId,
      findings: response.result.findings,
      summary: response.result.summary,
    });
    viewingReport = false;
    collectSummaryEl.hidden = false;
    collectSummaryEl.textContent = `Snapshot URL: ${response.result.snapshot.url}`;

    const loaded = await send<ExtensionResponse>({
      type: 'LOAD_SESSION',
      sessionId: response.result.sessionId,
    });
    if (loaded.type === 'SESSION_LOADED' && loaded.result.status === 'ok') {
      ensureReportEditor(loaded.result.session.id, loaded.result.session.reportMarkdown ?? '');
    }
    renderWorkspace();
  } finally {
    collectBtn.disabled = false;
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
collectBtn.addEventListener('click', () => {
  void collectDom();
});
openReportBtn.addEventListener('click', () => {
  viewingReport = true;
  renderWorkspace();
  (document.querySelector('#report-markdown') as HTMLTextAreaElement | null)?.focus();
});
backToFindingsBtn.addEventListener('click', () => {
  viewingReport = false;
  renderWorkspace();
  findingsHeadingFocus();
});

function findingsHeadingFocus(): void {
  const heading = document.querySelector('#findings-heading') as HTMLElement | null;
  heading?.setAttribute('tabindex', '-1');
  heading?.focus();
}

void refresh();
