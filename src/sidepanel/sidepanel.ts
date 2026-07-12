import type { ExtensionRequest, ExtensionResponse } from '../background/messages';
import {
  buildGlanceDashboard,
  buildGrantedShellDashboard,
  buildPreAccessDashboard,
  type SeoDashboardModel,
} from '../lib/dashboard/model';
import type { AuditSession, Evidence } from '../lib/schemas/audit';
import { buildAuditReport } from '../lib/report/audit-report';
import { domFactsToPageSnapshot } from '../content/dom-facts-to-snapshot';
import { DEFAULT_DOM_COLLECT_LIMITS } from '../lib/schemas/dom-limits';
import { availabilityFromEvidence, defaultCheckIds } from '../lib/rules/check-selection';
import { requestOriginAccess } from '../lib/tab-access';
import { renderCheckSelectionView } from './check-selection-view';
import { renderSeoDashboard } from './dashboard-view';
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
const chooseChecksBtn = document.querySelector('#choose-checks') as HTMLButtonElement;
const startSelectedChecksBtn = document.querySelector(
  '#start-selected-checks',
) as HTMLButtonElement;
const cancelCheckSelectionBtn = document.querySelector(
  '#cancel-check-selection',
) as HTMLButtonElement;
const refreshBtn = document.querySelector('#refresh') as HTMLButtonElement;
const pingBtn = document.querySelector('#ping') as HTMLButtonElement;
const openReportBtn = document.querySelector('#open-report') as HTMLButtonElement;
const backToFindingsBtn = document.querySelector('#back-to-findings') as HTMLButtonElement;
const dashboardSection = document.querySelector('#dashboard-section') as HTMLElement;
const findingsSection = document.querySelector('#findings-section') as HTMLElement;
const findingsSummaryEl = document.querySelector('#findings-summary')!;
const findingsPanel = document.querySelector('#findings-panel') as HTMLElement;
const reportSection = document.querySelector('#report-section') as HTMLElement;
const reportSessionLabel = document.querySelector('#report-session-label')!;
const checkSelectionSection = document.querySelector('#check-selection-section') as HTMLElement;
const checkSelectionList = document.querySelector('#check-selection-list') as HTMLElement;

let workspace: WorkspaceModel = initialWorkspace();
let reportEditor: ReportEditorController | null = null;
let evidenceById = new Map<string, Evidence>();
let viewingReport = false;
let dashboard: SeoDashboardModel | null = null;
let wizardEvidence: Evidence[] = [];
let wizardOpen = false;
let selectedWizardCheckIds = defaultCheckIds();

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
  let showCollect = false;
  if (tab) {
    const view = viewFromSnapshot(tab);
    showCollect = view.showCollect;
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
  chooseChecksBtn.hidden = !(showCollect && workspace.phase !== 'collecting');
  checkSelectionSection.hidden = !wizardOpen;
  if (wizardOpen) {
    renderCheckSelectionView(checkSelectionList, {
      availability: availabilityFromEvidence(
        Boolean(tab?.status === 'ready' && tab.granted),
        wizardEvidence,
      ),
      selectedCheckIds: selectedWizardCheckIds,
      onSelectionChange: (checkId, selected) => {
        if (selected) selectedWizardCheckIds.add(checkId);
        else selectedWizardCheckIds.delete(checkId);
      },
    });
  }
  setStatus(workspace.statusMessage, workspace.statusKind);

  const hasSession = Boolean(workspace.sessionId);
  const showDashboard = Boolean(dashboard) && !viewingReport;
  dashboardSection.hidden = !showDashboard;
  if (showDashboard && dashboard) {
    renderSeoDashboard(dashboardSection, dashboard);
  }

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

async function loadGlanceDashboard(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready') {
    dashboard = null;
    return;
  }
  if (!tab.granted) {
    wizardEvidence = [];
    dashboard = buildPreAccessDashboard(tab.url);
    return;
  }

  // Never show the pre-access “needs site access” shell once granted.
  dashboard = buildGrantedShellDashboard(tab.url, 'Loading DOM inventory…');

  const response = await send<ExtensionResponse>({ type: 'GLANCE_DOM_INVENTORY' });
  if (response.type === 'ERROR') {
    wizardEvidence = [];
    dashboard = buildGrantedShellDashboard(
      tab.url,
      `Glance failed: ${response.message}. Click Refresh to retry.`,
    );
    workspace = {
      ...workspace,
      statusMessage: response.message,
      statusKind: 'error',
    };
    return;
  }
  if (response.type !== 'GLANCE_DOM_RESULT') {
    wizardEvidence = [];
    dashboard = buildGrantedShellDashboard(
      tab.url,
      'Glance returned an unexpected response. Reload the extension, then Refresh.',
    );
    workspace = {
      ...workspace,
      statusMessage: 'Unexpected glance response from the service worker.',
      statusKind: 'error',
    };
    return;
  }
  if (!response.result.ok) {
    wizardEvidence = [];
    dashboard = buildGrantedShellDashboard(
      tab.url,
      `Glance failed (${response.result.code}): ${response.result.error}`,
    );
    workspace = {
      ...workspace,
      statusMessage: response.result.error,
      statusKind: 'error',
    };
    return;
  }
  dashboard = buildGlanceDashboard({
    tabUrl: response.result.tabUrl,
    facts: response.result.facts,
  });
  wizardEvidence = domFactsToPageSnapshot(
    response.result.facts,
    'wizard-glance',
    DEFAULT_DOM_COLLECT_LIMITS,
  ).evidence;
  workspace = {
    ...workspace,
    statusMessage: 'Page glance updated from the live tab.',
    statusKind: 'ok',
  };
}

async function send<T extends ExtensionResponse>(message: ExtensionRequest): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

async function ensureReportEditor(session: AuditSession): Promise<void> {
  const { id: sessionId, reportMarkdown } = session;
  reportSessionLabel.textContent = `Session ${sessionId} — Preview composes the saved audit; only analyst notes are editable and saved locally.`;

  if (reportEditor && reportEditor.sessionId === sessionId) {
    reportEditor.setMarkdown(reportMarkdown ?? '');
    return;
  }

  if (reportEditor) {
    // Flush the previous session's pending Markdown to its bound ID, then detach.
    // Never let a delayed write land on the newly collected audit.
    try {
      await reportEditor.flush();
    } catch {
      // Save failure already surfaced in the editor status; still switch sessions.
    }
    reportEditor.destroy();
    reportEditor = null;
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
      sessionId,
      initialMarkdown: reportMarkdown ?? '',
      report: buildAuditReport(session),
      onAutosave: async (boundSessionId, markdown) => {
        const response = await send<ExtensionResponse>({
          type: 'SAVE_REPORT_MARKDOWN',
          sessionId: boundSessionId,
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
  await loadGlanceDashboard();
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
    await loadGlanceDashboard();
    renderWorkspace();
    if (dashboard?.inventoryLoaded) {
      setStatus(`Page access ok — glance loaded for ${response.result.href}`, 'ok');
    }
  } finally {
    pingBtn.disabled = false;
  }
}

async function collectDom(selectedCheckIds?: ReadonlySet<string>): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready' || !tab.granted) return;
  workspace = withCollecting(workspace);
  renderWorkspace();
  collectSummaryEl.hidden = true;
  try {
    const response = await send<ExtensionResponse>({
      type: 'COLLECT_DOM_SNAPSHOT',
      ...(selectedCheckIds ? { selectedCheckIds: [...selectedCheckIds] } : {}),
    });
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
    const loadedSelection = await send<ExtensionResponse>({
      type: 'LOAD_SESSION',
      sessionId: response.result.sessionId,
    });
    const selectionSummary =
      loadedSelection.type === 'SESSION_LOADED' && loadedSelection.result.status === 'ok'
        ? ` · ${loadedSelection.result.session.checkSelection.selectedCheckIds.length} checks run, ${loadedSelection.result.session.checkSelection.skippedChecks.length} skipped`
        : '';
    collectSummaryEl.textContent = `Audit saved for ${response.result.snapshot.url}${selectionSummary}`;

    // Refresh glance from the same capture so the dashboard stays in sync.
    await loadGlanceDashboard();

    if (loadedSelection.type === 'SESSION_LOADED' && loadedSelection.result.status === 'ok') {
      await ensureReportEditor(loadedSelection.result.session);
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
chooseChecksBtn.addEventListener('click', () => {
  selectedWizardCheckIds = defaultCheckIds();
  wizardOpen = true;
  renderWorkspace();
  (document.querySelector('#check-selection-heading') as HTMLElement | null)?.focus();
});
startSelectedChecksBtn.addEventListener('click', () => {
  wizardOpen = false;
  void collectDom(selectedWizardCheckIds);
});
cancelCheckSelectionBtn.addEventListener('click', () => {
  wizardOpen = false;
  renderWorkspace();
  chooseChecksBtn.focus();
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
