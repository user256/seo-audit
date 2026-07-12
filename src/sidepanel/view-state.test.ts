import { describe, expect, it } from 'vitest';
import { viewFromSnapshot } from './view-state';

describe('viewFromSnapshot', () => {
  it('shows Allow for an eligible tab without access', () => {
    expect(
      viewFromSnapshot({
        status: 'ready',
        tabId: 1,
        url: 'https://example.com/',
        origin: 'https://example.com',
        pattern: 'https://example.com/*',
        granted: false,
      }),
    ).toMatchObject({
      showAllow: true,
      showPing: false,
      showCollect: false,
      accessLabel: 'Not granted',
    });
  });

  it('hides Allow and explains unsupported URLs', () => {
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
