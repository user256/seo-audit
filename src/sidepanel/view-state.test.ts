import { describe, expect, it } from 'vitest';
import { viewFromSnapshot } from './view-state';

describe('viewFromSnapshot', () => {
  it('shows collect controls for a ready HTTP(S) tab', () => {
    expect(
      viewFromSnapshot({
        status: 'ready',
        tabId: 1,
        url: 'https://example.com/',
        origin: 'https://example.com',
        pattern: 'https://example.com/*',
        granted: true,
      }),
    ).toMatchObject({
      showAllow: false,
      showPing: true,
      showCollect: true,
      statusKind: 'ok',
    });
  });

  it('hides collect controls and explains unsupported URLs', () => {
    expect(
      viewFromSnapshot({
        status: 'unsupported',
        url: 'chrome://extensions',
        reason: 'chrome:// URLs cannot be audited.',
      }),
    ).toMatchObject({
      showAllow: false,
      showPing: false,
      showCollect: false,
      statusKind: 'error',
    });
  });
});
