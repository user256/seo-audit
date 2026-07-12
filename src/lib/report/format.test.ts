import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedSaver } from './autosave';
import { applyMarkdownFormat, countWords } from './format';
import { renderSafeMarkdownPreview } from './preview';

describe('applyMarkdownFormat', () => {
  it('wraps a selection in bold while preserving the inner range', () => {
    const result = applyMarkdownFormat(
      { text: 'hello world', selectionStart: 6, selectionEnd: 11 },
      'bold',
    );
    expect(result.text).toBe('hello **world**');
    expect(result.selectionStart).toBe(8);
    expect(result.selectionEnd).toBe(13);
  });

  it('inserts a link and selects the URL', () => {
    const result = applyMarkdownFormat(
      { text: 'see here', selectionStart: 4, selectionEnd: 8 },
      'link',
    );
    expect(result.text).toBe('see [here](https://)');
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('https://');
  });
});

describe('countWords', () => {
  it('counts words and treats empty as zero', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  one two  three ')).toBe(3);
  });
});

describe('createDebouncedSaver', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces autosave calls', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => undefined);
    const saver = createDebouncedSaver(save, 400);
    saver.schedule('a');
    saver.schedule('b');
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('b');
  });
});

describe('renderSafeMarkdownPreview', () => {
  it('returns empty HTML for empty markdown', () => {
    expect(renderSafeMarkdownPreview('')).toBe('');
    expect(renderSafeMarkdownPreview('   ')).toBe('');
  });

  it('renders headings and forces safe link attributes', () => {
    const html = renderSafeMarkdownPreview('# Hello\n\n[x](https://example.com)');
    expect(html).toContain('<h1');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('strips hostile HTML/script payloads', () => {
    const html = renderSafeMarkdownPreview(
      `<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[bad](javascript:alert(1))\n\n<form action="/x"><input></form>\n\n<style>body{}</style>`,
    );
    expect(html.toLowerCase()).not.toContain('<script');
    expect(html.toLowerCase()).not.toContain('onerror');
    expect(html.toLowerCase()).not.toContain('<form');
    expect(html.toLowerCase()).not.toContain('<style');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });
});
