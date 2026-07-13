import { describe, expect, it } from 'vitest';
import { createConcurrencyGate } from './concurrency';

describe('createConcurrencyGate', () => {
  it('limits concurrent acquisitions', async () => {
    const gate = createConcurrencyGate(2);
    const releaseA = await gate.acquire();
    const releaseB = await gate.acquire();
    expect(gate.activeCount()).toBe(2);

    let thirdResolved = false;
    const third = gate.acquire().then((release) => {
      thirdResolved = true;
      return release;
    });
    await Promise.resolve();
    expect(thirdResolved).toBe(false);

    releaseA();
    const releaseC = await third;
    expect(thirdResolved).toBe(true);
    expect(gate.activeCount()).toBe(2);
    releaseB();
    releaseC();
    expect(gate.activeCount()).toBe(0);
  });
});
