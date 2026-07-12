/**
 * Debounced callback helper for report autosave (Ticket 105).
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
  let chain: Promise<void> = Promise.resolve();

  const run = (markdown: string): Promise<void> => {
    chain = chain.then(() => Promise.resolve(save(markdown)));
    return chain;
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
          void run(value);
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
        await chain;
      }
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
    },
  };
}
