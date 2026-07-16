import type {
  CssJsComparisonProgressMessage,
  ExtensionRequest,
  ExtensionResponse,
  HreflangClusterProgressMessage,
  Soft404ProbeProgressMessage,
  UrlVariantTestsProgressMessage,
} from '../background/messages';
import type { CssJsComparisonResult } from '../lib/css-js-compare';
import type { DomFacts } from '../content/dom-collector';
import {
  buildCrawlSignalsModel,
  buildSitemapCandidatesForOrigin,
  type CrawlSignalsModel,
  type CssJsComparisonRunState,
  type HreflangClusterValidateState,
  type Soft404ProbeRunState,
  type VariantTestsRunState,
} from '../lib/dashboard/crawl-signals-model';
import { comparisonEvidenceFromSession } from '../lib/dashboard/restore-comparison-evidence';
import {
  buildGlanceDashboard,
  buildGrantedShellDashboard,
  buildPreAccessDashboard,
  type SeoDashboardModel,
} from '../lib/dashboard/model';
import {
  hydrateCrawlSignals,
  targetsCurrentTab,
  type HydrateTabRef,
} from '../lib/dashboard/hydrate-crawl-signals';
import type { NavigationObservationStatus } from '../lib/network/types';
import type { RobotsFetchResult } from '../lib/robots/fetch-robots';
import type { AuditSession, Evidence } from '../lib/schemas/audit';
import type { SitemapCandidate } from '../lib/sitemap/discover';
import { reviveSitemapFetchResult, type SitemapFetchResult } from '../lib/sitemap/fetch-sitemap';
import {
  ALTERNATES_SOURCE,
  htmlAlternatesFromField,
  type HreflangClusterValidationResult,
} from '../lib/hreflang';
import { buildDefaultProbeUrl, type Soft404ProbeResult } from '../lib/soft-404';
import {
  loadUaProfilePreference,
  saveUaProfilePreference,
  type UaProfileId,
  type UaProfileSelection,
} from '../lib/ua-profiles';
import {
  DEFAULT_VARIANT_KIND_OPTIONS,
  type VariantKindOptions,
  type VariantTestRunResult,
} from '../lib/variants';
import { buildAuditReport } from '../lib/report/audit-report';
import { domFactsToPageSnapshot } from '../content/dom-facts-to-snapshot';
import { DEFAULT_DOM_COLLECT_LIMITS } from '../lib/schemas/dom-limits';
import { availabilityFromEvidence, defaultCheckIds } from '../lib/rules/check-selection';
import { buildPageSummary } from '../lib/rules/summary';
import {
  applyTheme,
  DEFAULT_THEME_TOKENS,
  loadResolvedTheme,
  queueClearCustomTheme,
  queueSaveCustomTheme,
  resetTheme,
  THEME_PRESETS,
  THEME_TOKEN_KEYS,
  type ThemeMode,
  type ThemeTokenKey,
  type ThemeTokens,
} from '../lib/theme';
import { renderCheckSelectionView } from './check-selection-view';
import { renderCrawlSignalsPanel } from './crawl-signals-view';
import { renderSeoDashboard } from './dashboard-view';
import { renderFindingsPanel } from './findings-view';
import { mountReportEditor, type ReportEditorController } from './report-editor';
import { renderThemeEditor } from './theme-editor-view';
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
const themeEditorBody = document.querySelector('#theme-editor-body') as HTMLElement;

let workspace: WorkspaceModel = initialWorkspace();
let reportEditor: ReportEditorController | null = null;
let evidenceById = new Map<string, Evidence>();
let viewingReport = false;
let dashboard: SeoDashboardModel | null = null;
let crawlSignals: CrawlSignalsModel | null = null;
let navigationObservation: NavigationObservationStatus | undefined;
/** Last successful glance facts — used to rebuild the dashboard when crawl data arrives. */
let lastGlanceFacts: DomFacts | null = null;
let lastGlanceTabUrl: string | null = null;
let robotsResult: RobotsFetchResult | null = null;
let sitemapResult: SitemapFetchResult | null = null;
let sitemapCandidates: SitemapCandidate[] = [];
let robotsFetchBusy = false;
let sitemapFetchBusy = false;
let hreflangValidateState: HreflangClusterValidateState = 'idle';
let hreflangProgress: CrawlSignalsModel['hreflangCluster']['progress'] = null;
let hreflangResult: HreflangClusterValidationResult | null = null;
let hreflangRequestId: string | null = null;
let uaProfileId: UaProfileId = 'browser-default';
let uaProfileCustomUserAgent = '';
let variantBaseUrl = '';
let variantKindOptions: VariantKindOptions = { ...DEFAULT_VARIANT_KIND_OPTIONS };
let variantRunState: VariantTestsRunState = 'idle';
let variantProgress: CrawlSignalsModel['variantTests']['progress'] = null;
let variantResult: VariantTestRunResult | null = null;
let variantRequestId: string | null = null;
let soft404ProbeUrl = '';
let soft404RunState: Soft404ProbeRunState = 'idle';
let soft404Progress: CrawlSignalsModel['soft404Probe']['progress'] = null;
let soft404Result: Soft404ProbeResult | null = null;
let soft404RequestId: string | null = null;
let cssJsRunState: CssJsComparisonRunState = 'idle';
let cssJsProgress: CrawlSignalsModel['cssJsComparison']['progress'] = null;
let cssJsResult: CssJsComparisonResult | null = null;
let cssJsRequestId: string | null = null;
let wizardEvidence: Evidence[] = [];
let wizardOpen = false;
let selectedWizardCheckIds = defaultCheckIds();
let themeTokens: ThemeTokens = structuredClone(DEFAULT_THEME_TOKENS);

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

function tokenSetsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  return THEME_TOKEN_KEYS.every((key) => a[key].toLowerCase() === b[key].toLowerCase());
}

function themesEqual(a: ThemeTokens, b: ThemeTokens): boolean {
  return tokenSetsEqual(a.light, b.light) && tokenSetsEqual(a.dark, b.dark);
}

function matchingPresetId(tokens: ThemeTokens): string | null {
  return THEME_PRESETS.find((preset) => themesEqual(preset.tokens, tokens))?.id ?? null;
}

function renderThemeEditorPanel(): void {
  renderThemeEditor(
    themeEditorBody,
    { tokens: themeTokens, activePresetId: matchingPresetId(themeTokens) },
    {
      onTokenChange: (mode: ThemeMode, key: ThemeTokenKey, value: string) => {
        themeTokens = { ...themeTokens, [mode]: { ...themeTokens[mode], [key]: value } };
        applyTheme(themeTokens);
        void queueSaveCustomTheme(themeTokens);
        renderThemeEditorPanel();
      },
      onPresetSelect: (presetId: string) => {
        const preset = THEME_PRESETS.find((candidate) => candidate.id === presetId);
        if (!preset) return;
        themeTokens = structuredClone(preset.tokens);
        applyTheme(themeTokens);
        void queueSaveCustomTheme(themeTokens);
        renderThemeEditorPanel();
      },
      onReset: () => {
        themeTokens = structuredClone(DEFAULT_THEME_TOKENS);
        resetTheme();
        void queueClearCustomTheme();
        renderThemeEditorPanel();
        setStatus('Theme reset to the shipped default.', 'ok');
      },
    },
  );
}

function hreflangAlternatesFromEvidence(
  evidence: readonly Evidence[],
): { hreflang: string; href: string }[] {
  const altEvidence = evidence.find((item) => item.source === ALTERNATES_SOURCE);
  const captured = htmlAlternatesFromField(altEvidence?.value);
  if (!captured || captured.length === 0) return [];
  return captured.map((alt) => ({
    hreflang: alt.hreflang,
    href: alt.absolute ?? alt.href,
  }));
}

function nextHreflangRequestId(): string {
  return `hc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextVariantRequestId(): string {
  return `vt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextSoft404RequestId(): string {
  return `sf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextCssJsRequestId(): string {
  return `cj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function resetComparisonEvidenceState(): void {
  variantBaseUrl = '';
  variantKindOptions = { ...DEFAULT_VARIANT_KIND_OPTIONS };
  variantRunState = 'idle';
  variantProgress = null;
  variantResult = null;
  variantRequestId = null;
  soft404ProbeUrl = '';
  soft404RunState = 'idle';
  soft404Progress = null;
  soft404Result = null;
  soft404RequestId = null;
  cssJsRunState = 'idle';
  cssJsProgress = null;
  cssJsResult = null;
  cssJsRequestId = null;
}

function restoreComparisonEvidenceFromSession(session: AuditSession, auditedUrl: string): void {
  const restored = comparisonEvidenceFromSession(session, auditedUrl);
  variantBaseUrl = restored.variantBaseUrl;
  variantKindOptions = restored.variantKindOptions;
  variantRunState = restored.variantRunState;
  variantProgress = null;
  variantResult = restored.variantResult;
  soft404ProbeUrl = restored.soft404ProbeUrl;
  soft404RunState = restored.soft404RunState;
  soft404Progress = null;
  soft404Result = restored.soft404Result;
}

async function persistVariantTestRun(result: VariantTestRunResult): Promise<void> {
  const sessionId = workspace.sessionId;
  if (!sessionId) return;
  const response = await send<ExtensionResponse>({
    type: 'SAVE_VARIANT_TEST_RUN',
    sessionId,
    result,
  });
  if (response.type === 'ERROR') {
    setStatus(`Variant test results were not saved: ${response.message}`, 'error');
  }
}

async function persistSoft404ProbeRun(result: Soft404ProbeResult): Promise<void> {
  const sessionId = workspace.sessionId;
  if (!sessionId) return;
  const response = await send<ExtensionResponse>({
    type: 'SAVE_SOFT_404_PROBE_RUN',
    sessionId,
    result,
  });
  if (response.type === 'ERROR') {
    setStatus(`Soft-404 probe results were not saved: ${response.message}`, 'error');
  }
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
      onUaProfileSelectionChange: (profileId) => {
        uaProfileId = profileId;
        void saveUaProfilePreference({ profileId, customUserAgent: uaProfileCustomUserAgent });
        void refreshUaProfilePanel();
      },
      onUaProfileCustomUaChange: (customUserAgent) => {
        uaProfileCustomUserAgent = customUserAgent;
        void saveUaProfilePreference({ profileId: uaProfileId, customUserAgent });
        void refreshUaProfilePanel();
      },
      onValidateHreflangCluster: () => {
        void validateHreflangClusterForTab();
      },
      onCancelHreflangCluster: () => {
        void cancelHreflangClusterValidation();
      },
      onRunVariantTests: () => {
        void runVariantTestsForTab();
      },
      onCancelVariantTests: () => {
        void cancelVariantTestsRun();
      },
      onVariantBaseUrlChange: (baseUrl) => {
        variantBaseUrl = baseUrl;
      },
      onVariantKindChange: (kind, enabled) => {
        variantKindOptions = { ...variantKindOptions, [kind]: enabled };
      },
      onRunSoft404Probe: () => {
        void runSoft404ProbeForTab();
      },
      onCancelSoft404Probe: () => {
        void cancelSoft404ProbeRun();
      },
      onSoft404ProbeUrlChange: (probeUrl) => {
        soft404ProbeUrl = probeUrl;
      },
      onRunCssJsComparison: () => {
        void runCssJsComparisonForTab();
      },
      onCancelCssJsComparison: () => {
        void cancelCssJsComparisonRun();
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
  const auditedUrl = dashboard?.documentUrl ?? (tab.status === 'ready' ? tab.url : '—');
  if (!variantBaseUrl) {
    variantBaseUrl = auditedUrl;
  }
  if (!soft404ProbeUrl) {
    const built = buildDefaultProbeUrl(auditedUrl);
    soft404ProbeUrl = built.ok ? built.probeUrl : auditedUrl;
  }
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
    uaProfileSelection: uaProfileId,
    uaProfileCustomUserAgent,
    hreflangAlternates: hreflangAlternatesFromEvidence(wizardEvidence),
    hreflangValidateState,
    hreflangProgress,
    hreflangResult,
    variantBaseUrl,
    variantKindOptions,
    variantRunState,
    variantProgress,
    variantResult,
    soft404ProbeUrl,
    soft404RunState,
    soft404Progress,
    soft404Result,
    cssJsRunState,
    cssJsProgress,
    cssJsResult,
  });
}

function currentUaProfileSelection(): UaProfileSelection {
  return uaProfileId === 'custom'
    ? { id: 'custom', customUserAgent: uaProfileCustomUserAgent }
    : { id: uaProfileId };
}

async function refreshUaProfilePanel(): Promise<void> {
  const tab = workspace.tab;
  if (tab) await rebuildCrawlSignals(tab);
  renderWorkspace();
}

async function loadGlanceDashboard(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready') {
    dashboard = null;
    crawlSignals = null;
    navigationObservation = undefined;
    lastGlanceFacts = null;
    lastGlanceTabUrl = null;
    return;
  }
  if (!tab.granted) {
    wizardEvidence = [];
    robotsResult = null;
    sitemapResult = null;
    navigationObservation = undefined;
    lastGlanceFacts = null;
    lastGlanceTabUrl = null;
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
    robots: robotsResult,
  });
  lastGlanceFacts = response.result.facts;
  lastGlanceTabUrl = response.result.tabUrl;
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

  // Background crawl fills (robots → sitemap) update the sidebar when they land —
  // no page reload.
  void hydrateCrawlSignalsInBackground(tab);
}

/** The panel's current tab as a hydrate reference, or null when not ready. */
function readyTabRef(): HydrateTabRef | null {
  const current = workspace.tab;
  return current && current.status === 'ready'
    ? { tabId: current.tabId, origin: current.origin }
    : null;
}

/** Rebuild the crawl-signals model and re-render if the tab is still ready. */
async function refreshCrawlSignalsView(): Promise<void> {
  const live = workspace.tab;
  if (live?.status === 'ready') {
    await rebuildCrawlSignals(live);
    renderWorkspace();
  }
}

/**
 * Quietly fill robots + sitemap after glance (Ticket 214). Re-renders as each
 * result arrives. Never reloads the page. Sequencing and guards live in
 * `hydrateCrawlSignals`; this wires the panel's state and messaging into it.
 */
async function hydrateCrawlSignalsInBackground(
  tab: Extract<NonNullable<WorkspaceModel['tab']>, { status: 'ready' }>,
): Promise<void> {
  if (!tab.granted) return;
  await hydrateCrawlSignals(
    {
      currentTab: readyTabRef,
      hasRobotsResult: () => robotsResult !== null,
      robotsBusy: () => robotsFetchBusy,
      setRobotsBusy: (busy) => {
        robotsFetchBusy = busy;
      },
      fetchRobots: async (origin) => {
        const response = await send<ExtensionResponse>({
          type: 'FETCH_ROBOTS_FOR_ORIGIN',
          origin,
        });
        return response.type === 'ROBOTS_FETCH_RESULT' ? response.result : null;
      },
      applyRobots: async (result) => {
        robotsResult = result;
        sitemapCandidates = buildSitemapCandidatesForOrigin(tab.origin, robotsResult);
        rebuildDashboardFromCache();
        await refreshCrawlSignalsView();
        openCrawlPanelAfterCapture(robotsResult, null);
      },
      hasSitemapResult: () => sitemapResult !== null,
      sitemapBusy: () => sitemapFetchBusy,
      setSitemapBusy: (busy) => {
        sitemapFetchBusy = busy;
      },
      sitemapCandidateUrls: () => {
        sitemapCandidates = buildSitemapCandidatesForOrigin(tab.origin, robotsResult);
        return sitemapCandidates.map((c) => c.url);
      },
      fetchSitemap: async (rootUrls) => {
        const response = await send<ExtensionResponse>({
          type: 'FETCH_SITEMAP',
          rootUrls,
        });
        return response.type === 'SITEMAP_FETCH_RESULT'
          ? reviveSitemapFetchResult(response.result)
          : null;
      },
      applySitemap: async (result) => {
        sitemapResult = result;
        await refreshCrawlSignalsView();
        openCrawlPanelAfterCapture(robotsResult, sitemapResult);
      },
      refresh: refreshCrawlSignalsView,
    },
    { tabId: tab.tabId, origin: tab.origin },
  );
}

function rebuildDashboardFromCache(): void {
  if (!lastGlanceFacts || !lastGlanceTabUrl) return;
  dashboard = buildGlanceDashboard({
    tabUrl: lastGlanceTabUrl,
    facts: lastGlanceFacts,
    navigation: navigationObservation,
    robots: robotsResult,
  });
}

async function applySilentNavigationUpdate(
  tabId: number,
  observation: NavigationObservationStatus,
): Promise<void> {
  if (!targetsCurrentTab(readyTabRef(), tabId)) return;
  navigationObservation = observation;
  rebuildDashboardFromCache();
  await refreshCrawlSignalsView();
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
    openCrawlPanelAfterCapture(robotsResult, null);
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
    sitemapResult = reviveSitemapFetchResult(response.result);
    await rebuildCrawlSignals(tab);
    renderWorkspace();
    openCrawlPanelAfterCapture(robotsResult, sitemapResult);
    if (response.result.ok) {
      const membership = crawlSignals?.sitemap.membership.state;
      setStatus(
        membership === 'present'
          ? `Sitemap fetched — audited URL is listed (${response.result.entries instanceof Map ? response.result.entries.size : Object.keys(response.result.entries as object).length} entries parsed).`
          : `Sitemap fetched — audited URL not listed among ${response.result.entries instanceof Map ? response.result.entries.size : Object.keys(response.result.entries as object).length} entries.`,
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

async function validateHreflangClusterForTab(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready' || !tab.granted || hreflangValidateState === 'busy') return;

  const alternates = hreflangAlternatesFromEvidence(wizardEvidence);
  if (alternates.length === 0) {
    setStatus('No captured hreflang alternates to validate.', 'error');
    return;
  }

  const seedUrl = dashboard?.documentUrl ?? tab.url;
  hreflangRequestId = nextHreflangRequestId();
  hreflangValidateState = 'busy';
  hreflangProgress = { completed: 0, total: alternates.length };
  hreflangResult = null;
  await rebuildCrawlSignals(tab);
  renderWorkspace();
  setStatus('Validating hreflang cluster (opt-in fetch)…');

  try {
    const response = await send<ExtensionResponse>({
      type: 'VALIDATE_HREFLANG_CLUSTER',
      requestId: hreflangRequestId,
      seedUrl,
      alternates,
      uaProfile: currentUaProfileSelection(),
    });
    if (response.type === 'ERROR') {
      hreflangValidateState = 'idle';
      hreflangProgress = null;
      setStatus(response.message, 'error');
      return;
    }
    if (response.type !== 'HREFLANG_CLUSTER_RESULT') {
      hreflangValidateState = 'idle';
      hreflangProgress = null;
      setStatus('Unexpected hreflang cluster response.', 'error');
      return;
    }
    hreflangResult = response.result;
    hreflangValidateState = response.result.cancelled ? 'cancelled' : 'done';
    hreflangProgress = null;
    await rebuildCrawlSignals(tab);
    renderWorkspace();
    const fetched = response.result.members.filter((member) => member.fetched).length;
    setStatus(
      response.result.cancelled
        ? `Hreflang cluster validation cancelled (${fetched} member(s) fetched).`
        : `Hreflang cluster validation complete — ${fetched} fetched, ${response.result.findings.length} finding(s), ${response.result.errors.length} error(s).`,
      response.result.errors.length > 0 ? 'error' : 'ok',
    );
  } finally {
    hreflangRequestId = null;
    if (tab) await rebuildCrawlSignals(tab);
    renderWorkspace();
  }
}

async function cancelHreflangClusterValidation(): Promise<void> {
  if (!hreflangRequestId) return;
  const response = await send<ExtensionResponse>({
    type: 'CANCEL_HREFLANG_CLUSTER',
    requestId: hreflangRequestId,
  });
  if (response.type === 'HREFLANG_CLUSTER_CANCELLED' && response.cancelled) {
    setStatus('Cancelling hreflang cluster validation…');
  }
}

async function runVariantTestsForTab(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready' || !tab.granted || variantRunState === 'busy') return;

  const baseUrl = variantBaseUrl.trim() || dashboard?.documentUrl || tab.url;
  variantRequestId = nextVariantRequestId();
  variantRunState = 'busy';
  variantProgress = { completed: 0, total: 0 };
  variantResult = null;
  await rebuildCrawlSignals(tab);
  renderWorkspace();
  setStatus('Running URL variant redirect tests (opt-in fetch)…');

  try {
    const response = await send<ExtensionResponse>({
      type: 'RUN_URL_VARIANT_TESTS',
      requestId: variantRequestId,
      baseUrl,
      kindOptions: variantKindOptions,
      method: 'HEAD',
      uaProfile: currentUaProfileSelection(),
    });
    if (response.type === 'ERROR') {
      variantRunState = 'idle';
      variantProgress = null;
      setStatus(response.message, 'error');
      return;
    }
    if (response.type !== 'URL_VARIANT_TESTS_RESULT') {
      variantRunState = 'idle';
      variantProgress = null;
      setStatus('Unexpected URL variant tests response.', 'error');
      return;
    }
    variantResult = response.result;
    variantRunState = response.result.cancelled ? 'cancelled' : 'done';
    variantProgress = null;
    variantBaseUrl = response.result.baseUrl;
    await persistVariantTestRun(response.result);
    await rebuildCrawlSignals(tab);
    renderWorkspace();
    setStatus(
      response.result.cancelled
        ? `URL variant tests cancelled (${response.result.results.filter((row) => !row.skipped).length} request(s)).`
        : `URL variant tests complete — ${response.result.finalGroups.length} final group(s), ${response.result.observations.length} observation(s).`,
      response.result.observations.length > 0 ? 'plain' : 'ok',
    );
  } finally {
    variantRequestId = null;
    if (tab) await rebuildCrawlSignals(tab);
    renderWorkspace();
  }
}

async function cancelVariantTestsRun(): Promise<void> {
  if (!variantRequestId) return;
  const response = await send<ExtensionResponse>({
    type: 'CANCEL_URL_VARIANT_TESTS',
    requestId: variantRequestId,
  });
  if (response.type === 'URL_VARIANT_TESTS_CANCELLED' && response.cancelled) {
    setStatus('Cancelling URL variant tests…');
  }
}

async function runSoft404ProbeForTab(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready' || !tab.granted || soft404RunState === 'busy') return;

  const auditedUrl = dashboard?.documentUrl ?? tab.url;
  const probeUrl = soft404ProbeUrl.trim();
  if (!probeUrl) {
    setStatus('Enter a probe URL on the audited origin before running.', 'error');
    return;
  }

  soft404RequestId = nextSoft404RequestId();
  soft404RunState = 'busy';
  soft404Progress = { phase: 'fetching-probe', currentUrl: probeUrl };
  soft404Result = null;
  await rebuildCrawlSignals(tab);
  renderWorkspace();
  setStatus('Running soft-404 probe (opt-in fetch)…');

  try {
    const response = await send<ExtensionResponse>({
      type: 'RUN_SOFT_404_PROBE',
      requestId: soft404RequestId,
      auditedUrl,
      probeUrl,
      uaProfile: currentUaProfileSelection(),
    });
    if (response.type === 'ERROR') {
      soft404RunState = 'idle';
      soft404Progress = null;
      setStatus(response.message, 'error');
      return;
    }
    if (response.type !== 'SOFT_404_PROBE_RESULT') {
      soft404RunState = 'idle';
      soft404Progress = null;
      setStatus('Unexpected soft-404 probe response.', 'error');
      return;
    }
    soft404Result = response.result;
    soft404RunState = response.result.cancelled ? 'cancelled' : 'done';
    soft404Progress = null;
    soft404ProbeUrl = response.result.probeUrl;
    await persistSoft404ProbeRun(response.result);
    await rebuildCrawlSignals(tab);
    renderWorkspace();
    setStatus(
      response.result.cancelled
        ? 'Soft-404 probe cancelled.'
        : `Soft-404 probe complete — ${response.result.observations.length} observation(s).`,
      response.result.observations.length > 0 ? 'plain' : 'ok',
    );
  } finally {
    soft404RequestId = null;
    if (tab) await rebuildCrawlSignals(tab);
    renderWorkspace();
  }
}

async function cancelSoft404ProbeRun(): Promise<void> {
  if (!soft404RequestId) return;
  const response = await send<ExtensionResponse>({
    type: 'CANCEL_SOFT_404_PROBE',
    requestId: soft404RequestId,
  });
  if (response.type === 'SOFT_404_PROBE_CANCELLED' && response.cancelled) {
    setStatus('Cancelling soft-404 probe…');
  }
}

async function runCssJsComparisonForTab(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready' || !tab.granted || cssJsRunState === 'busy') return;

  const auditedUrl = dashboard?.documentUrl ?? tab.url;
  cssJsRequestId = nextCssJsRequestId();
  cssJsRunState = 'busy';
  cssJsProgress = { phase: 'capturing-baseline' };
  cssJsResult = null;
  await rebuildCrawlSignals(tab);
  renderWorkspace();
  setStatus('Running CSS comparison (opens a new background tab)…');

  try {
    const response = await send<ExtensionResponse>({
      type: 'RUN_CSS_JS_COMPARISON',
      requestId: cssJsRequestId,
      activeTabId: tab.tabId,
      auditedUrl,
    });
    if (response.type === 'ERROR') {
      cssJsRunState = 'idle';
      cssJsProgress = null;
      setStatus(response.message, 'error');
      return;
    }
    if (response.type !== 'CSS_JS_COMPARISON_RESULT') {
      cssJsRunState = 'idle';
      cssJsProgress = null;
      setStatus('Unexpected CSS/JS comparison response.', 'error');
      return;
    }
    cssJsResult = response.result;
    cssJsRunState = response.result.cancelled ? 'cancelled' : 'done';
    cssJsProgress = null;
    await rebuildCrawlSignals(tab);
    renderWorkspace();
    const changed = response.result.diffs.filter((diff) => diff.changed).length;
    setStatus(
      response.result.cancelled
        ? 'CSS comparison cancelled; the comparison tab was closed.'
        : `CSS comparison complete — ${changed} field(s) changed.`,
      changed > 0 ? 'plain' : 'ok',
    );
  } finally {
    cssJsRequestId = null;
    if (tab) await rebuildCrawlSignals(tab);
    renderWorkspace();
  }
}

async function cancelCssJsComparisonRun(): Promise<void> {
  if (!cssJsRequestId) return;
  const response = await send<ExtensionResponse>({
    type: 'CANCEL_CSS_JS_COMPARISON',
    requestId: cssJsRequestId,
  });
  if (response.type === 'CSS_JS_COMPARISON_CANCELLED' && response.cancelled) {
    setStatus('Cancelling CSS comparison…');
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

async function applyRestoredSession(session: AuditSession): Promise<void> {
  const latestSnapshot = session.snapshots[session.snapshots.length - 1];
  evidenceById = new Map((latestSnapshot?.evidence ?? []).map((item) => [item.id, item] as const));
  workspace = withSavedAudit(workspace, {
    sessionId: session.id,
    findings: session.findings,
    summary: buildPageSummary({
      findings: session.findings,
      featureAvailability: session.featureAvailability,
      captureErrors: session.captureErrors,
    }),
    captureErrors: session.captureErrors,
  });
  viewingReport = false;
  const selection = session.checkSelection;
  const selectionSummary = selection
    ? ` · ${selection.selectedCheckIds.length} checks run, ${selection.skippedChecks.length} skipped`
    : '';
  collectSummaryEl.hidden = false;
  collectSummaryEl.textContent = `Restored saved audit for ${session.finalUrl || session.tabUrl}${selectionSummary}`;
  restoreComparisonEvidenceFromSession(session, session.finalUrl || session.tabUrl);
  await ensureReportEditor(session);
}

async function restoreSessionForActiveTab(): Promise<void> {
  const tab = workspace.tab;
  if (!tab || tab.status !== 'ready' || !tab.granted) {
    collectSummaryEl.hidden = true;
    collectSummaryEl.textContent = '';
    return;
  }
  if (workspace.sessionId) {
    return;
  }

  const response = await send<ExtensionResponse>({
    type: 'FIND_LATEST_SESSION_FOR_URL',
    url: tab.url,
  });
  if (response.type === 'ERROR' || response.type !== 'LATEST_SESSION_FOR_URL') {
    return;
  }
  if (response.result.status !== 'ok') {
    collectSummaryEl.hidden = true;
    collectSummaryEl.textContent = '';
    return;
  }
  await applyRestoredSession(response.result.session);
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
  if (!workspace.sessionId) {
    collectSummaryEl.hidden = true;
    collectSummaryEl.textContent = '';
  }
  await restoreSessionForActiveTab();
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

function openCrawlPanelAfterCapture(
  robots: RobotsFetchResult | null,
  sitemap: SitemapFetchResult | null,
): void {
  const openIds: string[] = ['crawl-panel-navigation'];
  if (robots) openIds.push('crawl-panel-robots');
  if (sitemap) openIds.push('crawl-panel-sitemap');
  for (const id of openIds) {
    const panel = document.getElementById(id) as HTMLDetailsElement | null;
    if (panel) panel.open = true;
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

    robotsResult = response.result.robotsResult;
    sitemapResult = response.result.sitemapResult
      ? reviveSitemapFetchResult(response.result.sitemapResult)
      : null;
    if (tab.status === 'ready') {
      sitemapCandidates = buildSitemapCandidatesForOrigin(tab.origin, robotsResult);
    }

    evidenceById = new Map(
      response.result.snapshot.evidence.map((item) => [item.id, item] as const),
    );
    wizardEvidence = response.result.snapshot.evidence;
    resetComparisonEvidenceState();
    workspace = withSavedAudit(workspace, {
      sessionId: response.result.sessionId,
      findings: response.result.findings,
      summary: response.result.summary,
    });
    viewingReport = false;
    collectSummaryEl.hidden = false;
    const selection = response.result.checkSelection;
    const selectionSummary = selection
      ? ` · ${selection.selectedCheckIds.length} checks run, ${selection.skippedChecks.length} skipped`
      : '';
    const robotsBit = robotsResult?.ok
      ? ' · robots.txt evaluated'
      : robotsResult
        ? ' · robots.txt fetch issue'
        : '';
    const sitemapBit = sitemapResult?.ok
      ? ` · sitemap ${sitemapResult.entries.size} entries`
      : sitemapResult
        ? ' · sitemap fetch issue'
        : '';
    collectSummaryEl.textContent = `Audit saved for ${response.result.snapshot.url}${selectionSummary}${robotsBit}${sitemapBit}`;

    // Refresh glance from the same capture so the dashboard stays in sync.
    await loadGlanceDashboard();

    const loadedSelection = await send<ExtensionResponse>({
      type: 'LOAD_SESSION',
      sessionId: response.result.sessionId,
    });
    if (loadedSelection.type === 'SESSION_LOADED' && loadedSelection.result.status === 'ok') {
      await ensureReportEditor(loadedSelection.result.session);
    }
    if (tab.status === 'ready') await rebuildCrawlSignals(tab);
    renderWorkspace();
    openCrawlPanelAfterCapture(robotsResult, sitemapResult);
    return;
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

chrome.runtime.onMessage.addListener((message) => {
  const progressMessage = message as
    | HreflangClusterProgressMessage
    | UrlVariantTestsProgressMessage
    | Soft404ProbeProgressMessage
    | CssJsComparisonProgressMessage
    | {
        type: 'NAVIGATION_OBSERVATION_UPDATED';
        tabId: number;
        observation: NavigationObservationStatus;
      };
  if (progressMessage.type === 'NAVIGATION_OBSERVATION_UPDATED') {
    void applySilentNavigationUpdate(progressMessage.tabId, progressMessage.observation);
    return;
  }
  if (progressMessage.type === 'HREFLANG_CLUSTER_PROGRESS') {
    if (!hreflangRequestId || progressMessage.progress.requestId !== hreflangRequestId) return;
    hreflangProgress = {
      completed: progressMessage.progress.completed,
      total: progressMessage.progress.total,
      currentUrl: progressMessage.progress.currentUrl,
    };
    if (progressMessage.progress.phase === 'cancelled') {
      hreflangValidateState = 'cancelled';
    }
    renderWorkspace();
    return;
  }
  if (progressMessage.type === 'URL_VARIANT_TESTS_PROGRESS') {
    if (!variantRequestId || progressMessage.progress.requestId !== variantRequestId) return;
    variantProgress = {
      completed: progressMessage.progress.completed,
      total: progressMessage.progress.total,
      currentUrl: progressMessage.progress.currentUrl,
    };
    if (progressMessage.progress.phase === 'cancelled') {
      variantRunState = 'cancelled';
    }
    renderWorkspace();
    return;
  }
  if (progressMessage.type === 'SOFT_404_PROBE_PROGRESS') {
    if (!soft404RequestId || progressMessage.progress.requestId !== soft404RequestId) return;
    soft404Progress = {
      phase: progressMessage.progress.phase,
      currentUrl: progressMessage.progress.currentUrl,
    };
    if (progressMessage.progress.phase === 'cancelled') {
      soft404RunState = 'cancelled';
    }
    renderWorkspace();
    return;
  }
  if (progressMessage.type === 'CSS_JS_COMPARISON_PROGRESS') {
    if (!cssJsRequestId || progressMessage.progress.requestId !== cssJsRequestId) return;
    cssJsProgress = {
      phase: progressMessage.progress.phase,
      detail: progressMessage.progress.detail,
    };
    if (progressMessage.progress.phase === 'cancelled') {
      cssJsRunState = 'cancelled';
    }
    renderWorkspace();
  }
});

async function bootstrap(): Promise<void> {
  const { resolved } = await loadResolvedTheme();
  themeTokens = resolved;
  applyTheme(themeTokens);
  renderThemeEditorPanel();

  const preference = await loadUaProfilePreference();
  uaProfileId = preference.profileId;
  uaProfileCustomUserAgent = preference.customUserAgent;
  await refresh();
}

void bootstrap();
