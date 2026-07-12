import { applyMarkdownFormat, countWords, type FormatAction } from '../lib/report/format';
import { createDebouncedSaver } from '../lib/report/autosave';
import { renderSafeMarkdownPreview } from '../lib/report/preview';
import { renderAuditReportMarkdown, type AuditReport } from '../lib/report/audit-report';

export type ReportEditorHost = {
  textarea: HTMLTextAreaElement;
  preview: HTMLElement;
  wordCount: HTMLElement;
  sourcePanel: HTMLElement;
  previewPanel: HTMLElement;
  modeSourceBtn: HTMLButtonElement;
  modePreviewBtn: HTMLButtonElement;
  toolbar: HTMLElement;
  status: HTMLElement;
};

export type ReportEditorController = {
  /** Immutable session this controller is allowed to autosave. */
  readonly sessionId: string;
  setMarkdown: (markdown: string) => void;
  getMarkdown: () => string;
  isDirty: () => boolean;
  setDirty: (dirty: boolean) => void;
  showPreview: () => void;
  /** Persist any pending debounce immediately (rejects if save fails). */
  flush: () => Promise<void>;
  /**
   * Cancel pending debounce and detach listeners. Does not flush — call
   * `flush()` first when replacing sessions if unsaved work must be kept.
   */
  destroy: () => void;
};

/**
 * Wire the Markdown report editor UI. Markdown is source-of-truth; preview HTML
 * is regenerated on demand and never treated as persisted state.
 *
 * Each controller is bound to a single `sessionId`. Autosave callbacks receive
 * that ID so a delayed write cannot land on a newer audit after a session switch.
 */
export function mountReportEditor(
  host: ReportEditorHost,
  options: {
    sessionId: string;
    initialMarkdown?: string;
    report: AuditReport;
    onAutosave: (sessionId: string, markdown: string) => void | Promise<void>;
    debounceMs?: number;
  },
): ReportEditorController {
  const boundSessionId = options.sessionId;
  let dirty = false;
  let destroyed = false;

  const setStatus = (text: string, kind: 'plain' | 'ok' | 'error' = 'plain'): void => {
    host.status.textContent = text;
    host.status.classList.toggle('is-ok', kind === 'ok');
    host.status.classList.toggle('is-error', kind === 'error');
  };

  const saver = createDebouncedSaver(async (markdown) => {
    if (destroyed) return;
    try {
      await options.onAutosave(boundSessionId, markdown);
      if (destroyed) return;
      dirty = false;
      setStatus('Report saved', 'ok');
    } catch (err) {
      if (destroyed) return;
      dirty = true;
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Save failed: ${message}`, 'error');
      throw err;
    }
  }, options.debounceMs ?? 400);

  const refreshWordCount = (): void => {
    host.wordCount.textContent = `${countWords(host.textarea.value)} words`;
  };

  const showSource = (): void => {
    host.sourcePanel.hidden = false;
    host.previewPanel.hidden = true;
    host.modeSourceBtn.setAttribute('aria-pressed', 'true');
    host.modePreviewBtn.setAttribute('aria-pressed', 'false');
  };

  const showPreview = (): void => {
    host.preview.innerHTML = renderSafeMarkdownPreview(
      renderAuditReportMarkdown(options.report, host.textarea.value),
    );
    host.sourcePanel.hidden = true;
    host.previewPanel.hidden = false;
    host.modeSourceBtn.setAttribute('aria-pressed', 'false');
    host.modePreviewBtn.setAttribute('aria-pressed', 'true');
  };

  const onInput = (): void => {
    dirty = true;
    setStatus('Unsaved changes…', 'plain');
    refreshWordCount();
    saver.schedule(host.textarea.value);
  };

  const onToolbarClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const action = target?.closest('[data-format]')?.getAttribute('data-format') as
      | FormatAction
      | null
      | undefined;
    if (!action) return;
    event.preventDefault();
    const next = applyMarkdownFormat(
      {
        text: host.textarea.value,
        selectionStart: host.textarea.selectionStart,
        selectionEnd: host.textarea.selectionEnd,
      },
      action,
    );
    host.textarea.value = next.text;
    host.textarea.focus();
    host.textarea.setSelectionRange(next.selectionStart, next.selectionEnd);
    onInput();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) return;
    const key = event.key.toLowerCase();
    const map: Record<string, FormatAction> = {
      b: 'bold',
      i: 'italic',
      e: 'inlineCode',
      k: 'link',
    };
    const action = map[key];
    if (!action) return;
    event.preventDefault();
    const next = applyMarkdownFormat(
      {
        text: host.textarea.value,
        selectionStart: host.textarea.selectionStart,
        selectionEnd: host.textarea.selectionEnd,
      },
      action,
    );
    host.textarea.value = next.text;
    host.textarea.setSelectionRange(next.selectionStart, next.selectionEnd);
    onInput();
  };

  host.textarea.value = options.initialMarkdown ?? '';
  refreshWordCount();
  showSource();
  setStatus('', 'plain');

  host.textarea.addEventListener('input', onInput);
  host.textarea.addEventListener('keydown', onKeydown);
  host.toolbar.addEventListener('click', onToolbarClick);
  host.modeSourceBtn.addEventListener('click', showSource);
  host.modePreviewBtn.addEventListener('click', showPreview);

  return {
    sessionId: boundSessionId,
    setMarkdown(markdown: string) {
      host.textarea.value = markdown;
      refreshWordCount();
      dirty = false;
      setStatus('', 'plain');
      if (!host.previewPanel.hidden) {
        host.preview.innerHTML = renderSafeMarkdownPreview(
          renderAuditReportMarkdown(options.report, markdown),
        );
      }
    },
    getMarkdown: () => host.textarea.value,
    isDirty: () => dirty,
    setDirty: (value: boolean) => {
      dirty = value;
    },
    showPreview,
    async flush() {
      if (destroyed) return;
      await saver.flush();
    },
    destroy() {
      destroyed = true;
      saver.cancel();
      host.textarea.removeEventListener('input', onInput);
      host.textarea.removeEventListener('keydown', onKeydown);
      host.toolbar.removeEventListener('click', onToolbarClick);
      host.modeSourceBtn.removeEventListener('click', showSource);
      host.modePreviewBtn.removeEventListener('click', showPreview);
    },
  };
}
