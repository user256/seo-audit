/**
 * Process-wide concurrency gate for safeFetch (Ticket 206).
 */
export function createConcurrencyGate(max: number): {
  acquire: () => Promise<() => void>;
  activeCount: () => number;
} {
  let active = 0;
  const waiters: Array<() => void> = [];

  const pump = (): void => {
    while (active < max && waiters.length > 0) {
      active += 1;
      waiters.shift()?.();
    }
  };

  return {
    activeCount: () => active,
    acquire: () =>
      new Promise<() => void>((resolve) => {
        const grant = (): void => {
          let released = false;
          resolve(() => {
            if (released) return;
            released = true;
            active -= 1;
            pump();
          });
        };
        if (active < max) {
          active += 1;
          grant();
        } else {
          waiters.push(grant);
        }
      }),
  };
}
