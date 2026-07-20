import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Ticket 116. The session-saving cases in `collect-dom.test.ts` take hundreds
 * of milliseconds each and stretch past the default 5s timeout when a full run
 * oversubscribes the CPU. Reverting to the default would bring back a ~40%
 * red rate that passes on retry — the worst kind of failure, because it trains
 * people to ignore the suite. Assert the explicit timeout is still configured.
 */
describe('vitest config', () => {
  const source = readFileSync(resolve(__dirname, '../../vitest.config.ts'), 'utf8');

  it('sets an explicit test timeout well above the slowest measured test', () => {
    const match = /testTimeout:\s*([\d_]+)/.exec(source);
    expect(match, 'testTimeout must be set explicitly, not left to the 5s default').not.toBeNull();

    const timeout = Number(match![1].replace(/_/g, ''));
    // Slowest measured case is ~374ms in isolation; keep a wide margin for
    // contended runs without letting a hung test sit for a minute.
    expect(timeout).toBeGreaterThanOrEqual(10_000);
    expect(timeout).toBeLessThanOrEqual(60_000);
  });

  it('gives setup hooks the same headroom as tests', () => {
    const match = /hookTimeout:\s*([\d_]+)/.exec(source);
    expect(match, 'hookTimeout must be set explicitly').not.toBeNull();
    expect(Number(match![1].replace(/_/g, ''))).toBeGreaterThanOrEqual(10_000);
  });
});
