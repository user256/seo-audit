import { beforeEach, describe, expect, it } from 'vitest';
import { collectVisibleTextFingerprintInPage } from './visible-text-fingerprint';

describe('collectVisibleTextFingerprintInPage', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  it('excludes text hidden via display:none or visibility:hidden', () => {
    document.body.innerHTML = `
      <p>Visible paragraph text.</p>
      <div style="display:none"><p>Hidden by display none.</p></div>
      <div style="visibility:hidden"><p>Hidden by visibility.</p></div>
    `;

    const fingerprint = collectVisibleTextFingerprintInPage();

    expect(fingerprint.sampleText).toContain('Visible paragraph text');
    expect(fingerprint.sampleText).not.toContain('Hidden by display none');
    expect(fingerprint.sampleText).not.toContain('Hidden by visibility');
  });

  it('includes previously hidden text once the ancestor style is removed', () => {
    document.body.innerHTML = `
      <p>Visible paragraph text.</p>
      <div style="display:none"><p>Now revealed content.</p></div>
    `;
    const before = collectVisibleTextFingerprintInPage();

    // Simulate CSS-off: strip the inline style that hid the second paragraph.
    document.querySelector('div')?.removeAttribute('style');
    const after = collectVisibleTextFingerprintInPage();

    expect(before.sampleText).not.toContain('Now revealed content');
    expect(after.sampleText).toContain('Now revealed content');
    expect(after.charCount).toBeGreaterThan(before.charCount);
    expect(after.hash).not.toBe(before.hash);
  });

  it('produces a stable hash for identical visible text', () => {
    document.body.innerHTML = '<p>Same content every time.</p>';
    const first = collectVisibleTextFingerprintInPage();
    const second = collectVisibleTextFingerprintInPage();
    expect(first.hash).toBe(second.hash);
    expect(first.truncated).toBe(false);
  });

  it('truncates and reports truncated:true when text exceeds the char budget', () => {
    document.body.innerHTML = `<p>${'word '.repeat(100)}</p>`;
    const fingerprint = collectVisibleTextFingerprintInPage(20);
    expect(fingerprint.truncated).toBe(true);
    expect(fingerprint.charCount).toBeLessThanOrEqual(20);
  });

  it('returns an empty, non-throwing fingerprint for a page with no text', () => {
    document.body.innerHTML = '';
    const fingerprint = collectVisibleTextFingerprintInPage();
    expect(fingerprint.charCount).toBe(0);
    expect(fingerprint.truncated).toBe(false);
    expect(fingerprint.hash).toHaveLength(8);
  });
});
