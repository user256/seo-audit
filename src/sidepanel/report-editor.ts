import { applyMarkdownFormat, countWords, type FormatAction } from '../lib/report/format';
import { createDebouncedSaver } from '../lib/report/autosave';
import { renderSafeMarkdownPreview } from '../lib/report/preview';

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
  setMarkdown: (markdown: string) => void;
  getMarkdown: () => string;
  isDirty: () => boolean;
  setDirty: (dirty: boolean) => void;
  destroy: () => void;
};

/**
 * Wire the Markdown report editor UI. Markdown is source-of-truth; preview HTML
 * is regenerated on demand and never treated as persisted state.
 */
export function mountReportEditor(
  host: ReportEditorHost,
  options: {
    initialMarkdown?: string;
    onAutosave: (markdown: string) => void | Promise<void>;
    debounceMs?: number;
  },
): ReportEditorController {
  let dirty = false;
  const saver = createDebouncedSaver(async (markdown) => {
    await options.onAutosave(markdown);
    dirty = false;
    host.status.textContent = 'Report saved';
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
    host.preview.innerHTML = renderSafeMarkdownPreview(host.textarea.value);
    host.sourcePanel.hidden = true;
    host.previewPanel.hidden = false;
    host.modeSourceBtn.setAttribute('aria-pressed', 'false');
    host.modePreviewBtn.setAttribute('aria-pressed', 'true');
  };

  const onInput = (): void => {
    dirty = true;
    host.status.textContent = 'Unsaved changes…';
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

  host.textarea.addEventListener('input', onInput);
  host.textarea.addEventListener('keydown', onKeydown);
  host.toolbar.addEventListener('click', onToolbarClick);
  host.modeSourceBtn.addEventListener('click', showSource);
  host.modePreviewBtn.addEventListener('click', showPreview);

  return {
    setMarkdown(markdown: string) {
      host.textarea.value = markdown;
      refreshWordCount();
      dirty = false;
      host.status.textContent = '';
      if (!host.previewPanel.hidden) {
        host.preview.innerHTML = renderSafeMarkdownPreview(markdown);
      }
    },
    getMarkdown: () => host.textarea.value,
    isDirty: () => dirty,
    setDirty: (value: boolean) => {
      dirty = value;
    },
    destroy() {
      saver.cancel();
      host.textarea.removeEventListener('input', onInput);
      host.textarea.removeEventListener('keydown', onKeydown);
      host.toolbar.removeEventListener('click', onToolbarClick);
      host.modeSourceBtn.removeEventListener('click', showSource);
      host.modePreviewBtn.removeEventListener('click', showPreview);
    },
  };
}
