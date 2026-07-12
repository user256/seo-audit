import { describe, expect, it } from 'vitest';
import { collectPing } from './ping';

describe('collectPing', () => {
  it('returns a pong payload with the page href', () => {
    expect(collectPing('https://example.com/a')).toEqual({
      pong: true,
      href: 'https://example.com/a',
    });
  });
});
