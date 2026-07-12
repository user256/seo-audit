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

  it('recovers after a rejected save so later edits still flush', async () => {
    vi.useFakeTimers();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce(undefined);
    const saver = createDebouncedSaver(save, 50);

    saver.schedule('fail-me');
    await vi.advanceTimersByTimeAsync(50);
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);

    saver.schedule('retry-me');
    await vi.advanceTimersByTimeAsync(50);
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('retry-me');
  });
});

describe('renderSafeMarkdownPreview', () => {
  it('returns empty HTML for empty markdown', () => {
    expect(renderSafeMarkdownPreview('')).toBe('');
    expect(renderSafeMarkdownPreview('   ')).toBe('');
  });

  it('renders headings, tables, code, and forces safe link attributes', () => {
    const html = renderSafeMarkdownPreview(
      '# Hello\n\n[x](https://example.com)\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n`code`\n\n```\nblock\n```',
    );
    expect(html).toContain('<h1');
    expect(html).toContain('<table');
    expect(html).toContain('<code');
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

  it('removes Markdown images, raw HTML, and data-URL loads', () => {
    const html = renderSafeMarkdownPreview(
      `![remote](https://evil.example/x.png)\n\n<img src="https://evil.example/y.png">\n\n[data](data:text/html,hi)\n\n<div onclick="alert(1)">raw</div>`,
    );
    const lower = html.toLowerCase();
    expect(lower).not.toContain('<img');
    expect(lower).not.toContain('evil.example');
    expect(lower).not.toContain('data:');
    expect(lower).not.toContain('onclick');
    expect(lower).not.toContain('<div');
  });
});
