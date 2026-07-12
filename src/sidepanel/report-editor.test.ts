import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountReportEditor, type ReportEditorHost } from './report-editor';

function makeHost(): ReportEditorHost {
  document.body.innerHTML = `
    <div id="report-toolbar"><button type="button" data-format="bold">B</button></div>
    <div id="report-source-panel">
      <textarea id="report-markdown"></textarea>
    </div>
    <div id="report-preview-panel" hidden>
      <div id="report-preview"></div>
    </div>
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

describe('mountReportEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('retries successfully after a rejected autosave and keeps dirty truthful', async () => {
    const host = makeHost();
    const onAutosave = vi
      .fn()
      .mockRejectedValueOnce(new Error('quota'))
      .mockResolvedValueOnce(undefined);

    const editor = mountReportEditor(host, {
      sessionId: 'sess-a',
      initialMarkdown: '',
      debounceMs: 100,
      onAutosave,
    });

    host.textarea.value = 'first';
    host.textarea.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    expect(host.status.textContent).toMatch(/Save failed/);
    expect(editor.isDirty()).toBe(true);

    host.textarea.value = 'second';
    host.textarea.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(100);
    await editor.flush();
    expect(onAutosave).toHaveBeenCalledTimes(2);
    expect(onAutosave).toHaveBeenLastCalledWith('sess-a', 'second');
    expect(editor.isDirty()).toBe(false);
    expect(host.status.textContent).toBe('Report saved');
    editor.destroy();
  });

  it('never saves the previous session Markdown into a newer session', async () => {
    const host = makeHost();
    const saves: { sessionId: string; markdown: string }[] = [];

    const first = mountReportEditor(host, {
      sessionId: 'sess-old',
      initialMarkdown: '',
      debounceMs: 200,
      onAutosave: async (sessionId, markdown) => {
        saves.push({ sessionId, markdown });
      },
    });

    host.textarea.value = 'notes for old audit';
    host.textarea.dispatchEvent(new Event('input'));

    // Session switch during the debounce window: flush old, destroy, mount new.
    await first.flush();
    first.destroy();

    const second = mountReportEditor(host, {
      sessionId: 'sess-new',
      initialMarkdown: '',
      debounceMs: 200,
      onAutosave: async (sessionId, markdown) => {
        saves.push({ sessionId, markdown });
      },
    });

    await vi.advanceTimersByTimeAsync(500);
    await second.flush();

    expect(saves).toEqual([{ sessionId: 'sess-old', markdown: 'notes for old audit' }]);
    expect(saves.every((s) => s.sessionId !== 'sess-new' || s.markdown === '')).toBe(true);
    second.destroy();
  });

  it('cancels pending debounce on destroy so no write reaches a replacement session', async () => {
    const host = makeHost();
    const onAutosave = vi.fn(async () => undefined);
    const editor = mountReportEditor(host, {
      sessionId: 'sess-a',
      debounceMs: 300,
      onAutosave,
    });

    host.textarea.value = 'should not save';
    host.textarea.dispatchEvent(new Event('input'));
    editor.destroy();
    await vi.advanceTimersByTimeAsync(500);
    expect(onAutosave).not.toHaveBeenCalled();
  });

  it('still switches source/preview after a failed save', async () => {
    const host = makeHost();
    const editor = mountReportEditor(host, {
      sessionId: 'sess-a',
      debounceMs: 50,
      onAutosave: async () => {
        throw new Error('boom');
      },
    });

    host.textarea.value = '# Hello\n\n[link](https://example.com)';
    host.textarea.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(50);
    await Promise.resolve();
    expect(host.status.textContent).toMatch(/Save failed/);

    host.modePreviewBtn.click();
    expect(host.previewPanel.hidden).toBe(false);
    expect(host.preview.innerHTML).toContain('<h1');
    expect(host.preview.innerHTML).toContain('noopener noreferrer');

    host.modeSourceBtn.click();
    expect(host.sourcePanel.hidden).toBe(false);
    editor.destroy();
  });

  it('preview strips images and raw HTML while keeping safe links', () => {
    const host = makeHost();
    const editor = mountReportEditor(host, {
      sessionId: 'sess-a',
      initialMarkdown: '![x](https://evil/x.png)\n\n<div>raw</div>\n\n[ok](https://example.com)',
      onAutosave: async () => undefined,
    });
    host.modePreviewBtn.click();
    const html = host.preview.innerHTML.toLowerCase();
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<div');
    expect(html).toContain('href="https://example.com"');
    editor.destroy();
  });
});
