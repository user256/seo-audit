import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    // Ticket 116. The default 5s timeout was too tight for the session-saving
    // cases in `collect-dom.test.ts`, which failed in ~40% of full-suite runs
    // while passing 11/11 in isolation.
    //
    // Measured rather than guessed: the slowest such test takes ~374ms alone,
    // and its setup (document.write 14ms + collectDomFactsInPage 25ms +
    // fake-indexeddb open 8ms = ~47ms) is a small fraction of that — the rest
    // is the check catalogue, schema validation, and IDB writes actually under
    // test. There is no meaningful per-test work to hoist away, so the cost is
    // real and the timeout is what has to move.
    //
    // Every test file runs in its own jsdom environment, so a full run
    // oversubscribes the CPU (load ~19 on 12 cores) and stretches those
    // hundreds of milliseconds past 5s. Capping workers was tried and did not
    // help. 15s leaves ~40x headroom over the worst measured case while still
    // failing fast on a genuinely hung test.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        'src/sidepanel/sidepanel.ts',
        'src/background/service-worker.ts',
      ],
    },
  },
});
