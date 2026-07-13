import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME_TOKENS, THEME_PRESETS } from '../lib/theme';
import { renderThemeEditor } from './theme-editor-view';

describe('theme editor view', () => {
  it('renders a colour input for every token in both light and dark fieldsets', () => {
    const host = document.createElement('div');
    renderThemeEditor(
      host,
      { tokens: DEFAULT_THEME_TOKENS, activePresetId: 'canonicals-default' },
      { onTokenChange: () => undefined, onPresetSelect: () => undefined, onReset: () => undefined },
    );

    const lightFgInput = host.querySelector<HTMLInputElement>('#theme-light-fg');
    const darkFgInput = host.querySelector<HTMLInputElement>('#theme-dark-fg');
    expect(lightFgInput?.type).toBe('color');
    expect(lightFgInput?.value.toLowerCase()).toBe(DEFAULT_THEME_TOKENS.light.fg);
    expect(darkFgInput?.value.toLowerCase()).toBe(DEFAULT_THEME_TOKENS.dark.fg);
  });

  it('marks the matching preset button as pressed', () => {
    const host = document.createElement('div');
    renderThemeEditor(
      host,
      { tokens: DEFAULT_THEME_TOKENS, activePresetId: 'canonicals-default' },
      { onTokenChange: () => undefined, onPresetSelect: () => undefined, onReset: () => undefined },
    );

    expect(
      host.querySelector('#theme-preset-canonicals-default')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(host.querySelector('#theme-preset-high-contrast')?.getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('calls onTokenChange with the mode, key, and new value when a colour input changes', () => {
    const host = document.createElement('div');
    const onTokenChange = vi.fn();
    renderThemeEditor(
      host,
      { tokens: DEFAULT_THEME_TOKENS, activePresetId: 'canonicals-default' },
      { onTokenChange, onPresetSelect: () => undefined, onReset: () => undefined },
    );

    const input = host.querySelector<HTMLInputElement>('#theme-light-accent')!;
    input.value = '#00ff00';
    input.dispatchEvent(new Event('input'));

    expect(onTokenChange).toHaveBeenCalledWith('light', 'accent', '#00ff00');
  });

  it('calls onPresetSelect / onReset from their buttons', () => {
    const host = document.createElement('div');
    const onPresetSelect = vi.fn();
    const onReset = vi.fn();
    renderThemeEditor(
      host,
      { tokens: DEFAULT_THEME_TOKENS, activePresetId: null },
      { onTokenChange: () => undefined, onPresetSelect, onReset },
    );

    host.querySelector<HTMLButtonElement>('#theme-preset-high-contrast')!.click();
    expect(onPresetSelect).toHaveBeenCalledWith('high-contrast');

    host.querySelector<HTMLButtonElement>('#theme-reset')!.click();
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('shows an AA warning for a failing pair and no warning when everything passes', () => {
    const host = document.createElement('div');
    renderThemeEditor(
      host,
      {
        tokens: {
          light: { ...DEFAULT_THEME_TOKENS.light, fg: '#f5f0e9' },
          dark: DEFAULT_THEME_TOKENS.dark,
        },
        activePresetId: null,
      },
      { onTokenChange: () => undefined, onPresetSelect: () => undefined, onReset: () => undefined },
    );

    expect(host.textContent).toMatch(/pair\(s\) fail AA/);
    expect(host.textContent).toContain('All checked pairs pass AA.');
  });

  it('renders every declared preset as a button', () => {
    const host = document.createElement('div');
    renderThemeEditor(
      host,
      { tokens: DEFAULT_THEME_TOKENS, activePresetId: null },
      { onTokenChange: () => undefined, onPresetSelect: () => undefined, onReset: () => undefined },
    );
    for (const preset of THEME_PRESETS) {
      expect(host.querySelector(`#theme-preset-${preset.id}`)).not.toBeNull();
    }
  });
});
