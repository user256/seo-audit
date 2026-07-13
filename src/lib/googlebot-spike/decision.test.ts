import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GOOGLEBOT_SPIKE_DECISION } from './decision';

// Read manifest.config.ts as text rather than importing it: importing it
// pulls in @crxjs/vite-plugin, which vite-node transforms with esbuild at
// runtime and is incompatible with this project's jsdom test environment.
// A plain-text check is sufficient to lock "no debugger permission" here.
const MANIFEST_CONFIG_SOURCE = readFileSync(
  path.resolve(__dirname, '../../../manifest.config.ts'),
  'utf-8',
);

describe('GOOGLEBOT_SPIKE_DECISION (Ticket 304)', () => {
  it('locks the recommendation to "defer" — changing this requires a deliberate code change', () => {
    expect(GOOGLEBOT_SPIKE_DECISION.recommendation).toBe('defer');
  });

  it('points at the feasibility report that justifies the recommendation', () => {
    expect(GOOGLEBOT_SPIKE_DECISION.reportPath).toBe('docs/googlebot-style-experiment.md');
  });

  it('never reports a shipped prototype while the recommendation is not "ship-as-experimental"', () => {
    if (GOOGLEBOT_SPIKE_DECISION.recommendation !== 'ship-as-experimental') {
      expect(GOOGLEBOT_SPIKE_DECISION.prototypeShipped).toBe(false);
    }
  });

  it('records all three options the report compares', () => {
    const ids = GOOGLEBOT_SPIKE_DECISION.optionsConsidered.map((option) => option.id);
    expect(ids).toEqual(['chrome-debugger-cdp', 'ordinary-tabs-scripting', 'unsupported']);
  });

  it('records at least one condition that would justify reopening the spike', () => {
    expect(GOOGLEBOT_SPIKE_DECISION.revisitTriggers.length).toBeGreaterThan(0);
  });

  it('does not add the debugger permission to the manifest while deferred', () => {
    if (GOOGLEBOT_SPIKE_DECISION.recommendation === 'ship-as-experimental') {
      return;
    }
    expect(MANIFEST_CONFIG_SOURCE).not.toMatch(/optional_permissions/);
    expect(MANIFEST_CONFIG_SOURCE).not.toMatch(/['"]debugger['"]/);
  });
});
