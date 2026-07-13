import type { CaptureError, Finding } from '../lib/schemas/audit';
import type { PageSummary } from '../lib/rules/engine';
import type { ActiveTabSnapshot } from '../lib/tab-access';

export type WorkspacePhase =
  | 'unsupported-tab'
  | 'permission-required'
  | 'ready-to-collect'
  | 'collecting'
  | 'collected-with-errors'
  | 'empty-session'
  | 'saved-audit';

export type WorkspaceModel = {
  phase: WorkspacePhase;
  tab: ActiveTabSnapshot | null;
  sessionId: string | null;
  findings: Finding[];
  summary: PageSummary | null;
  captureErrors: CaptureError[];
  statusMessage: string;
  statusKind: 'plain' | 'ok' | 'error';
};

export function phaseFromTab(tab: ActiveTabSnapshot): WorkspacePhase {
  if (tab.status === 'unsupported' || tab.status === 'missing') {
    return 'unsupported-tab';
  }
  // Ready HTTP(S) tabs are always collectable under required host_permissions.
  return 'ready-to-collect';
}

export function initialWorkspace(): WorkspaceModel {
  return {
    phase: 'empty-session',
    tab: null,
    sessionId: null,
    findings: [],
    summary: null,
    captureErrors: [],
    statusMessage: 'Loading active tab…',
    statusKind: 'plain',
  };
}

export function withTab(model: WorkspaceModel, tab: ActiveTabSnapshot): WorkspaceModel {
  const phase = phaseFromTab(tab);
  const viewMessage =
    tab.status === 'ready'
      ? 'HTTP(S) host access is available. Start an audit when ready.'
      : tab.reason;

  const sameUrl =
    model.tab?.status === 'ready' && tab.status === 'ready' && model.tab.url === tab.url;
  const keepSession = Boolean(model.sessionId) && sameUrl && phase === 'ready-to-collect';

  return {
    ...model,
    tab,
    phase: keepSession ? 'saved-audit' : phase,
    ...(keepSession
      ? {}
      : {
          sessionId: null,
          findings: [],
          summary: null,
          captureErrors: [],
        }),
    statusMessage: viewMessage,
    statusKind: tab.status === 'ready' ? 'ok' : 'error',
  };
}

export function withCollecting(model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    phase: 'collecting',
    statusMessage: 'Collecting DOM snapshot and evaluating findings…',
    statusKind: 'plain',
  };
}

export function withSavedAudit(
  model: WorkspaceModel,
  input: {
    sessionId: string;
    findings: Finding[];
    summary: PageSummary;
    captureErrors?: CaptureError[];
  },
): WorkspaceModel {
  const errors = input.captureErrors ?? [];
  const phase = errors.length > 0 ? 'collected-with-errors' : 'saved-audit';
  return {
    ...model,
    phase,
    sessionId: input.sessionId,
    findings: sortFindings(input.findings),
    summary: input.summary,
    captureErrors: errors,
    statusMessage:
      errors.length > 0
        ? `Audit saved with ${errors.length} capture issue(s) and ${input.findings.length} finding(s).`
        : `Audit saved: ${input.findings.length} finding(s).`,
    statusKind: errors.length > 0 ? 'error' : 'ok',
  };
}

export function withCollectFailure(
  model: WorkspaceModel,
  message: string,
  captureError?: CaptureError,
): WorkspaceModel {
  return {
    ...model,
    phase: model.sessionId ? 'saved-audit' : 'ready-to-collect',
    captureErrors: captureError ? [...model.captureErrors, captureError] : model.captureErrors,
    statusMessage: message,
    statusKind: 'error',
  };
}

const SEVERITY_ORDER = { critical: 0, error: 1, warning: 2, info: 3 } as const;

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    const cat = a.category.localeCompare(b.category);
    if (cat !== 0) return cat;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

export function groupFindingsByCategory(findings: Finding[]): Map<string, Finding[]> {
  const map = new Map<string, Finding[]>();
  for (const finding of sortFindings(findings)) {
    const list = map.get(finding.category) ?? [];
    list.push(finding);
    map.set(finding.category, list);
  }
  return map;
}
