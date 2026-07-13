import { beforeEach, describe, expect, it } from 'vitest';
import { CSS_DISABLE_METHOD_VERSION, disableCssInPage } from './css-disable-injection';

describe('disableCssInPage', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  it('disables every document stylesheet', () => {
    const styleA = document.createElement('style');
    styleA.textContent = 'p { color: red; }';
    const styleB = document.createElement('style');
    styleB.textContent = 'div { display: none; }';
    document.head.append(styleA, styleB);

    expect(document.styleSheets.length).toBe(2);

    const result = disableCssInPage();

    expect(result.methodVersion).toBe(CSS_DISABLE_METHOD_VERSION);
    expect(result.totalStylesheetCount).toBe(2);
    expect(result.disabledStylesheetCount).toBe(2);
    expect(result.inaccessibleStylesheetCount).toBe(0);
    expect(styleA.sheet?.disabled).toBe(true);
    expect(styleB.sheet?.disabled).toBe(true);
  });

  it('removes inline style attributes so they cannot keep hiding content', () => {
    document.body.innerHTML = `
      <div id="a" style="display:none">Hidden</div>
      <p id="b" style="color:red">Text</p>
    `;

    const result = disableCssInPage();

    expect(result.removedInlineStyleAttrCount).toBe(2);
    expect(document.getElementById('a')?.hasAttribute('style')).toBe(false);
    expect(document.getElementById('b')?.hasAttribute('style')).toBe(false);
  });

  it('appends a detectable marker element without throwing when there is nothing to disable', () => {
    const result = disableCssInPage();

    expect(result.totalStylesheetCount).toBe(0);
    expect(result.disabledStylesheetCount).toBe(0);
    expect(result.removedInlineStyleAttrCount).toBe(0);

    const marker = document.querySelector(
      `style[data-seo-audit-css-kill="${CSS_DISABLE_METHOD_VERSION}"]`,
    );
    expect(marker).not.toBeNull();
  });

  it('is idempotent when called twice on the same page', () => {
    const style = document.createElement('style');
    style.textContent = 'body { margin: 0; }';
    document.head.append(style);

    disableCssInPage();
    const second = disableCssInPage();

    // The original sheet is already disabled; the marker style added by the
    // first run is itself disabled on creation, so nothing new gets flipped.
    expect(second.disabledStylesheetCount).toBeGreaterThanOrEqual(1);
  });
});
