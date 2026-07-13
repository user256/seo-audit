import {
  checkThemeContrast,
  THEME_PRESETS,
  THEME_TOKEN_KEYS,
  THEME_TOKEN_LABEL,
  type ThemeMode,
  type ThemeTokenKey,
  type ThemeTokens,
} from '../lib/theme';

export type ThemeEditorState = {
  tokens: ThemeTokens;
  /** Id of the preset that exactly matches `tokens`, or null once the user has edited a value. */
  activePresetId: string | null;
};

export type ThemeEditorHandlers = {
  onTokenChange: (mode: ThemeMode, key: ThemeTokenKey, value: string) => void;
  onPresetSelect: (presetId: string) => void;
  onReset: () => void;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildModeFieldset(
  mode: ThemeMode,
  tokens: ThemeTokens,
  handlers: ThemeEditorHandlers,
): HTMLFieldSetElement {
  const fieldset = el('fieldset', 'crawl-fieldset theme-fieldset');
  fieldset.append(el('legend', undefined, mode === 'light' ? 'Light theme' : 'Dark theme'));

  const grid = el('div', 'theme-token-grid');
  for (const key of THEME_TOKEN_KEYS) {
    const field = el('div', 'theme-token-field');
    const inputId = `theme-${mode}-${key}`;

    const label = el('label', undefined, THEME_TOKEN_LABEL[key]) as HTMLLabelElement;
    label.htmlFor = inputId;

    const input = el('input') as HTMLInputElement;
    input.type = 'color';
    input.id = inputId;
    input.name = inputId;
    input.value = tokens[mode][key];
    input.setAttribute('aria-describedby', `${inputId}-value`);
    input.addEventListener('input', () => {
      handlers.onTokenChange(mode, key, input.value);
    });

    const valueText = el('span', 'theme-token-value', tokens[mode][key]);
    valueText.id = `${inputId}-value`;

    field.append(label, input, valueText);
    grid.append(field);
  }
  fieldset.append(grid);
  return fieldset;
}

function buildContrastReport(tokens: ThemeTokens): HTMLElement {
  const wrap = el('div', 'theme-contrast-report');
  wrap.append(el('h3', undefined, 'Contrast check (WCAG AA, 4.5:1 for normal text)'));

  for (const mode of ['light', 'dark'] as const) {
    const results = checkThemeContrast(tokens[mode]);
    const failing = results.filter((result) => !result.passesAA);

    const modeWrap = el('div', 'theme-contrast-mode');
    modeWrap.append(el('h4', undefined, mode === 'light' ? 'Light' : 'Dark'));

    if (failing.length === 0) {
      modeWrap.append(el('p', 'theme-contrast-ok', 'All checked pairs pass AA.'));
    } else {
      modeWrap.append(
        el(
          'p',
          'theme-contrast-warn',
          `${failing.length} pair(s) fail AA — saving is still allowed, but text may be hard to read.`,
        ),
      );
      const list = el('ul', 'dash-list theme-contrast-warnings');
      list.setAttribute('role', 'status');
      for (const result of failing) {
        list.append(
          el(
            'li',
            undefined,
            `${result.label}: ${result.ratio.toFixed(2)}:1 (needs \u2265 4.5:1) \u2014 ${result.fgValue} on ${result.bgValue}`,
          ),
        );
      }
      modeWrap.append(list);
    }
    wrap.append(modeWrap);
  }
  return wrap;
}

export function renderThemeEditor(
  host: HTMLElement,
  state: ThemeEditorState,
  handlers: ThemeEditorHandlers,
): void {
  host.replaceChildren();

  host.append(
    el(
      'p',
      'lede',
      'Custom colours preview immediately in this panel and persist locally only ' +
        '(chrome.storage.local) \u2014 never synced, never sent anywhere.',
    ),
  );

  const presetRow = el('div', 'theme-presets actions');
  for (const preset of THEME_PRESETS) {
    const btn = el('button', 'secondary', preset.label) as HTMLButtonElement;
    btn.type = 'button';
    btn.id = `theme-preset-${preset.id}`;
    btn.title = preset.description;
    btn.setAttribute('aria-pressed', String(state.activePresetId === preset.id));
    btn.addEventListener('click', () => handlers.onPresetSelect(preset.id));
    presetRow.append(btn);
  }
  const resetBtn = el('button', 'secondary', 'Reset to default') as HTMLButtonElement;
  resetBtn.type = 'button';
  resetBtn.id = 'theme-reset';
  resetBtn.addEventListener('click', () => handlers.onReset());
  presetRow.append(resetBtn);
  host.append(presetRow);

  host.append(buildModeFieldset('light', state.tokens, handlers));
  host.append(buildModeFieldset('dark', state.tokens, handlers));
  host.append(buildContrastReport(state.tokens));
}
