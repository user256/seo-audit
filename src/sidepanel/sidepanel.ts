import type { ExtensionRequest, ExtensionResponse } from '../background/messages';
import {
  buildCrawlSignalsModel,
  buildSitemapCandidatesForOrigin,
  type CrawlSignalsModel,
} from '../lib/dashboard/crawl-signals-model';
import {
  buildGlanceDashboard,
  buildGrantedShellDashboard,
  buildPreAccessDashboard,
  type SeoDashboardModel,
} from '../lib/dashboard/model';
import type { NavigationObservationStatus } from '../lib/network/types';
import type { RobotsFetchResult } from '../lib/robots/fetch-robots';
import type { AuditSession, Evidence } from '../lib/schemas/audit';
import type { SitemapCandidate } from '../lib/sitemap/discover';
import type { SitemapFetchResult } from '../lib/sitemap/fetch-sitemap';
import { buildAuditReport } from '../lib/report/audit-report';
import { domFactsToPageSnapshot } from '../content/dom-facts-to-snapshot';
import { DEFAULT_DOM_COLLECT_LIMITS } from '../lib/schemas/dom-limits';
import { availabilityFromEvidence, defaultCheckIds } from '../lib/rules/check-selection';
import { renderCheckSelectionView } from './check-selection-view';
import { renderCrawlSignalsPanel } from './crawl-signals-view';
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
const collectBtn = document.querySelector('#collect-dom') as HTMLButtonElement;
const chooseChecksBtn = document.querySelector('#choose-checks') as HTMLButtonElement;
const startSelectedChecksBtn = document.querySelector(
  '#start-selected-checks',
) as HTMLButtonElement;
const cancelCheckSelectionBtn = document.querySelector(
  '#cancel-check-selection',
) as HTMLButtonElement;
const refreshBtn = document.querySelector('#refresh') as HTMLButtonElement;
const captureNavBtn = document.querySelector('#capture-navigation') as HTMLButtonElement;
const pingBtn = document.querySelector('#ping') as HTMLButtonElement;
const openReportBtn = document.querySelector('#open-report') as HTMLButtonElement;
const backToFindingsBtn = document.querySelector('#back-to-findings') as HTMLButtonElement;
const dashboardSection = document.querySelector('#dashboard-section') as HTMLElement;
const crawlSignalsSection = document.querySelector('#crawl-signals-section') as HTMLElement;
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
let crawlSignals: CrawlSignalsModel | null = null;
let navigationObservation: NavigationObservationStatus | undefined;
let robotsResult: RobotsFetchResult | null = null;
let sitemapResult: SitemapFetchResult | null = null;
let sitemapCandidates: SitemapCandidate[] = [];
let robotsFetchBusy = false;
let sitemapFetchBusy = false;
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
    pingBtn.hidden = !view.showPing;
    captureNavBtn.hidden = !view.showCollect;
    collectBtn.hidden = !(view.showCollect && workspace.phase !== 'collecting');
  } else {
    tabUrlEl.textContent = '—';
    accessStateEl.textContent = 'Unavailable';
    pingBtn.hidden = true;
    captureNavBtn.hidden = true;
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

  const showCrawlSignals = Boolean(crawlSignals) && !viewingReport;
  crawlSignalsSection.hidden = !showCrawlSignals;
  if (showCrawlSignals && crawlSignals) {
    renderCrawlSignalsPanel(crawlSignalsSection, crawlSignals, {
      onFetchRobots: () => {
        void fetchRobotsForTab();
      },
      onFetchSitemap: () => {
        void fetchSitemapForTab();
      },
    });
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

async function rebuildCrawlSignals(tab: NonNullable<WorkspaceModel['tab']>): Promise<void> {
  const origin = tab.status === 'ready' ? tab.origin : '';
  const accessGranted = tab.status === 'ready' && tab.granted;
  sitemapCandidates = buildSitemapCandidatesForOrigin(origin, robotsResult);
  crawlSignals = buildCrawlSignalsModel({
    tabUrl: tab.status === 'ready' ? tab.url : '—',
    documentUrl: dashboard?.documentUrl ?? null,
    origin,
    accessGranted,
    navigation: navigationObservation,
    robots: robotsResult,
    sitemap: sitemapResult,
    sitemapCandidates,
    robotsFetchBusy,
    sitemapFetchBusy,
  });
}

async function loadGlanceDashboard(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready') {
    dashboard = null;
    crawlSignals = null;
    navigationObservation = undefined;
    return;
  }
  if (!tab.granted) {
    wizardEvidence = [];
    robotsResult = null;
    sitemapResult = null;
    navigationObservation = undefined;
    dashboard = buildPreAccessDashboard(tab.url);
    await rebuildCrawlSignals(tab);
    return;
  }

  // Never show the pre-access “needs site access” shell once granted.
  dashboard = buildGrantedShellDashboard(tab.url, 'Loading DOM inventory…');
  await rebuildCrawlSignals(tab);

  await send<ExtensionResponse>({ type: 'WATCH_TAB_NAVIGATION', tabId: tab.tabId });
  const navResponse = await send<ExtensionResponse>({
    type: 'GET_NAVIGATION_OBSERVATION',
    tabId: tab.tabId,
    requestedUrl: tab.url,
  });
  navigationObservation =
    navResponse.type === 'NAVIGATION_OBSERVATION' ? navResponse.observation : undefined;
  await rebuildCrawlSignals(tab);

  const response = await send<ExtensionResponse>({ type: 'GLANCE_DOM_INVENTORY' });
  if (response.type === 'ERROR') {
    wizardEvidence = [];
    dashboard = buildGrantedShellDashboard(
      tab.url,
      `Glance failed: ${response.message}. Click Refresh to retry.`,
    );
    await rebuildCrawlSignals(tab);
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
    await rebuildCrawlSignals(tab);
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
    await rebuildCrawlSignals(tab);
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
    navigation: navigationObservation,
  });
  await rebuildCrawlSignals(tab);
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

async function fetchRobotsForTab(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready' || !tab.granted || robotsFetchBusy) return;
  robotsFetchBusy = true;
  await rebuildCrawlSignals(tab);
  renderWorkspace();
  setStatus('Fetching robots.txt…');
  try {
    const response = await send<ExtensionResponse>({
      type: 'FETCH_ROBOTS_FOR_ORIGIN',
      origin: tab.origin,
    });
    if (response.type === 'ERROR') {
      setStatus(response.message, 'error');
      return;
    }
    if (response.type !== 'ROBOTS_FETCH_RESULT') {
      setStatus('Unexpected robots fetch response.', 'error');
      return;
    }
    robotsResult = response.result;
    sitemapCandidates = buildSitemapCandidatesForOrigin(tab.origin, robotsResult);
    await rebuildCrawlSignals(tab);
    renderWorkspace();
    if (response.result.ok) {
      setStatus(`robots.txt fetched (HTTP ${response.result.status}).`, 'ok');
    } else {
      setStatus(`robots.txt capture issue: ${response.result.error.message}`, 'error');
    }
  } finally {
    robotsFetchBusy = false;
    if (tab) await rebuildCrawlSignals(tab);
    renderWorkspace();
  }
}

async function fetchSitemapForTab(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready' || !tab.granted || sitemapFetchBusy) return;
  sitemapFetchBusy = true;
  sitemapCandidates = buildSitemapCandidatesForOrigin(tab.origin, robotsResult);
  await rebuildCrawlSignals(tab);
  renderWorkspace();
  setStatus('Discovering and fetching sitemap candidates…');
  try {
    const rootUrls = sitemapCandidates.map((candidate) => candidate.url);
    if (rootUrls.length === 0) {
      setStatus('No sitemap candidates to fetch for this origin.', 'error');
      return;
    }
    const response = await send<ExtensionResponse>({
      type: 'FETCH_SITEMAP',
      rootUrls,
    });
    if (response.type === 'ERROR') {
      setStatus(response.message, 'error');
      return;
    }
    if (response.type !== 'SITEMAP_FETCH_RESULT') {
      setStatus('Unexpected sitemap fetch response.', 'error');
      return;
    }
    sitemapResult = response.result;
    await rebuildCrawlSignals(tab);
    renderWorkspace();
    if (response.result.ok) {
      const membership = crawlSignals?.sitemap.membership.state;
      setStatus(
        membership === 'present'
          ? `Sitemap fetched — audited URL is listed (${response.result.entries.size} entries parsed).`
          : `Sitemap fetched — audited URL not listed among ${response.result.entries.size} entries.`,
        membership === 'present' ? 'ok' : 'plain',
      );
    } else {
      setStatus(`Sitemap capture issue: ${response.result.error.message}`, 'error');
    }
  } finally {
    sitemapFetchBusy = false;
    if (tab) await rebuildCrawlSignals(tab);
    renderWorkspace();
  }
}

async function captureNavigation(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready' || !tab.granted) return;
  captureNavBtn.disabled = true;
  setStatus('Reloading tab to observe browser navigation…');
  try {
    const response = await send<ExtensionResponse>({
      type: 'RELOAD_AND_OBSERVE_NAVIGATION',
      tabId: tab.tabId,
    });
    if (response.type === 'ERROR') {
      setStatus(response.message, 'error');
      return;
    }
    await loadGlanceDashboard();
    renderWorkspace();
    if (response.type === 'NAVIGATION_OBSERVATION' && response.observation.status === 'observed') {
      setStatus(`Captured browser navigation — status ${response.observation.statusCode}.`, 'ok');
    } else {
      setStatus(
        'Reload finished but navigation headers were not observed. Try Refresh, then reload again.',
        'error',
      );
    }
  } finally {
    captureNavBtn.disabled = false;
  }
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

refreshBtn.addEventListener('click', () => {
  void refresh();
});
captureNavBtn.addEventListener('click', () => {
  void captureNavigation();
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
