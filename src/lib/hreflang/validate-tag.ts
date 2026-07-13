import { TYPO_MAP, VALID_LANGS, VALID_REGIONS } from './codes';

export type HreflangTagValidation =
  | { valid: true }
  | { valid: false; reason: string; typo?: string };

/**
 * Validate a normalised (lowercase) hreflang attribute value.
 * Accepts `x-default`, language-only, and language-region tags per interim allowlists.
 */
export function validateHreflangTag(value: string): HreflangTagValidation {
  const normalised = value.toLowerCase().trim();
  if (normalised === 'x-default') return { valid: true };
  if (normalised === '') {
    return { valid: false, reason: 'hreflang value is empty' };
  }

  const typo = TYPO_MAP[normalised];
  if (typo) {
    return {
      valid: false,
      reason: `"${normalised}" looks like a typo — did you mean "${typo}"?`,
      typo,
    };
  }

  const parts = normalised.split('-');
  const lang = parts[0] ?? '';
  const region = parts.length > 1 ? parts.slice(1).join('-') : null;

  if (!VALID_LANGS.has(normalised) && !VALID_LANGS.has(lang)) {
    return { valid: false, reason: `"${lang}" is not a valid ISO 639-1 language code` };
  }

  if (region && region.length === 2 && !VALID_REGIONS.has(region.toUpperCase())) {
    return {
      valid: false,
      reason: `"${region.toUpperCase()}" is not a valid ISO 3166-1 region code`,
    };
  }

  return { valid: true };
}
