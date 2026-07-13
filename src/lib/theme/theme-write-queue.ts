/**
 * Serialises theme persistence so the latest user action wins (Ticket 406).
 *
 * Colour inputs fire many overlapping `input` events; without ordering, an
 * earlier save can finish after a later preset/Reset and clobber it on disk.
 */
import {
  clearCustomTheme as clearCustomThemeRaw,
  saveCustomTheme as saveCustomThemeRaw,
  type StoredCustomTheme,
} from './theme-storage';

let generation = 0;
let chain: Promise<void> = Promise.resolve();

/** Test hook — resets the in-memory write queue between cases. */
export function resetThemeWriteQueue(): void {
  generation = 0;
  chain = Promise.resolve();
}

/** Exposed for tests — current generation assigned to the most recent enqueue. */
export function currentThemeWriteGeneration(): number {
  return generation;
}

function enqueue(op: (writeId: number) => Promise<void>): Promise<void> {
  const writeId = (generation += 1);
  const run = chain.then(async () => {
    if (writeId !== generation) return;
    await op(writeId);
  });
  // Keep the chain alive even when an op throws; callers still observe failure.
  chain = run.catch(() => undefined);
  return run;
}

/** Queue a save; superseded saves never touch storage. */
export function queueSaveCustomTheme(theme: StoredCustomTheme): Promise<void> {
  const snapshot: StoredCustomTheme = {
    ...(theme.light ? { light: { ...theme.light } } : {}),
    ...(theme.dark ? { dark: { ...theme.dark } } : {}),
  };
  return enqueue(async (writeId) => {
    if (writeId !== generation) return;
    await saveCustomThemeRaw(snapshot);
  });
}

/** Queue a clear/Reset; always bumps generation so in-flight saves are dropped. */
export function queueClearCustomTheme(): Promise<void> {
  return enqueue(async (writeId) => {
    if (writeId !== generation) return;
    await clearCustomThemeRaw();
  });
}

/** Await the current write chain (for tests). */
export function flushThemeWriteQueue(): Promise<void> {
  return chain;
}
