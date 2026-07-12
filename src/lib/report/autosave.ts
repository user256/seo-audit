/**
 * Debounced callback helper for report autosave (Tickets 105 + 108).
 * The serial chain recovers after a rejected save so later edits still flush.
 */
export function createDebouncedSaver(
  save: (markdown: string) => void | Promise<void>,
  delayMs = 400,
): {
  schedule: (markdown: string) => void;
  flush: () => Promise<void>;
  cancel: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | undefined;
  /** Settles even when a save fails so the next schedule/flush can run. */
  let gate: Promise<void> = Promise.resolve();

  const run = (markdown: string): Promise<void> => {
    const task = gate.then(() => Promise.resolve(save(markdown)));
    gate = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };

  return {
    schedule(markdown: string) {
      pending = markdown;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        const value = pending;
        pending = undefined;
        if (value !== undefined) {
          void run(value).catch(() => undefined);
        }
      }, delayMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (pending !== undefined) {
        const value = pending;
        pending = undefined;
        await run(value);
      } else {
        await gate;
      }
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
    },
  };
}
