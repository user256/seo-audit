import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountReportEditor } from './report-editor';
import { buildAuditReport } from '../lib/report/audit-report';
import { createEmptySession } from '../lib/storage/session-repository';
import {
  initialWorkspace,
  withCollectFailure,
  withCollecting,
  withSavedAudit,
  withTab,
  type WorkspaceModel,
} from './workspace-state';
import type { Finding } from '../lib/schemas/audit';
import type { PageSummary } from '../lib/rules/engine';

function editorHost() {
  document.body.innerHTML = `
    <div id="report-toolbar"></div>
    <div id="report-source-panel"><textarea id="report-markdown"></textarea></div>
    <div id="report-preview-panel" hidden><div id="report-preview"></div></div>
    <button type="button" id="report-mode-source" aria-pressed="true">Source</button>
    <button type="button" id="report-mode-preview" aria-pressed="false">Preview</button>
    <span id="report-word-count"></span>
    <p id="report-status"></p>
  `;
  return {
    textarea: document.querySelector('#report-markdown') as HTMLTextAreaElement,
    preview: document.querySelector('#report-preview') as HTMLElement,
    wordCount: document.querySelector('#report-word-count') as HTMLElement,
    sourcePanel: document.querySelector('#report-source-panel') as HTMLElement,
    previewPanel: document.querySelector('#report-preview-panel') as HTMLElement,
    modeSourceBtn: document.querySelector('#report-mode-source') as HTMLButtonElement,
    modePreviewBtn: document.querySelector('#report-mode-preview') as HTMLButtonElement,
    toolbar: document.querySelector('#report-toolbar') as HTMLElement,
    status: document.querySelector('#report-status') as HTMLElement,
  };
}

const summary: PageSummary = {
  totalFindings: 1,
  bySeverity: { info: 0, warning: 0, error: 1, critical: 0 },
  byCategory: { metadata: 1 },
  indexability: { status: 'unknown', reason: 'Headers unavailable' },
  captureNotes: [],
};

const finding: Finding = {
  id: 'f1',
  ruleId: 'title-missing',
  severity: 'error',
  category: 'metadata',
  affectedUrl: 'https://example.com/',
  description: 'Missing title',
  evidenceIds: [],
  recommendation: 'Add a title',
  sourceRef: 'https://example.com/ref',
  capturedAt: '2026-07-12T12:00:00.000Z',
};

const report = buildAuditReport(
  createEmptySession({
    id: 'report-session',
    tabUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    captureTime: '2026-07-12T12:00:00.000Z',
    extensionVersion: '0.1.0',
    featureAvailability: { domCollector: true },
  }),
);

describe('side-panel workspace + report editor integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('walks ready → collect → saved-audit and binds the report to that session', async () => {
    let model: WorkspaceModel = initialWorkspace();
    expect(model.phase).toBe('empty-session');

    model = withTab(model, {
      status: 'ready',
      tabId: 1,
      url: 'https://example.com/page',
      origin: 'https://example.com',
      pattern: 'https://example.com/*',
      granted: true,
    });
    expect(model.phase).toBe('ready-to-collect');

    model = withCollecting(model);
    expect(model.phase).toBe('collecting');

    model = withSavedAudit(model, {
      sessionId: 'sess-1',
      findings: [finding],
      summary,
    });
    expect(model.phase).toBe('saved-audit');
    expect(model.sessionId).toBe('sess-1');

    const saves: { sessionId: string; markdown: string }[] = [];
    const host = editorHost();
    const editor = mountReportEditor(host, {
      sessionId: model.sessionId!,
      initialMarkdown: 'Initial notes',
      report,
      debounceMs: 50,
      onAutosave: async (sessionId, markdown) => {
        saves.push({ sessionId, markdown });
      },
    });

    expect(editor.sessionId).toBe('sess-1');
    expect(editor.getMarkdown()).toBe('Initial notes');
    host.textarea.value = 'Updated notes';
    host.textarea.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(50);
    await editor.flush();
    expect(saves).toEqual([{ sessionId: 'sess-1', markdown: 'Updated notes' }]);
    editor.destroy();
  });

  it('keeps prior session on collect failure and does not clear the bound report', () => {
    let model = withSavedAudit(initialWorkspace(), {
      sessionId: 'sess-existing',
      findings: [finding],
      summary,
    });
    const host = editorHost();
    const editor = mountReportEditor(host, {
      sessionId: 'sess-existing',
      initialMarkdown: 'Keep me',
      report,
      debounceMs: 40,
      onAutosave: async () => undefined,
    });

    model = withCollectFailure(model, 'Collector failed');
    expect(model.sessionId).toBe('sess-existing');
    expect(model.phase).toBe('saved-audit');
    expect(editor.getMarkdown()).toBe('Keep me');
    editor.destroy();
  });
});
