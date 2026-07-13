import { describe, expect, it } from 'vitest';
import { UA_PROFILE_LIMITS } from './limits';
import { GOOGLEBOT_STYLE_USER_AGENT } from './profiles';
import { resolveUaProfile } from './resolve-profile';

describe('resolveUaProfile', () => {
  it('resolves browser-default with no header override', () => {
    const result = resolveUaProfile({ id: 'browser-default' });
    expect(result.profileId).toBe('browser-default');
    expect(result.userAgent).toBeNull();
    expect(result.method).toBe('none');
    expect(result.limitations.some((l) => l.includes('navigator.userAgent'))).toBe(true);
  });

  it('resolves googlebot-style to the exact documented static UA string', () => {
    const result = resolveUaProfile({ id: 'googlebot-style' });
    expect(result.profileId).toBe('googlebot-style');
    expect(result.userAgent).toBe(GOOGLEBOT_STYLE_USER_AGENT);
    expect(result.method).toBe('extension-fetch-header');
    expect(result.limitations.some((l) => l.includes('declarativeNetRequest'))).toBe(true);
    expect(result.limitations.some((l) => l.includes('Ticket 304'))).toBe(true);
  });

  it('resolves a valid custom UA within the length cap', () => {
    const customUserAgent = 'MySeoBot/1.0 (+https://example.com/bot)';
    const result = resolveUaProfile({ id: 'custom', customUserAgent });
    expect(result.profileId).toBe('custom');
    expect(result.userAgent).toBe(customUserAgent);
    expect(result.method).toBe('extension-fetch-header');
  });

  it('trims whitespace from a custom UA', () => {
    const result = resolveUaProfile({ id: 'custom', customUserAgent: '  Trimmed/1.0  ' });
    expect(result.userAgent).toBe('Trimmed/1.0');
  });

  it('accepts a custom UA exactly at the length cap', () => {
    const exact = 'a'.repeat(UA_PROFILE_LIMITS.maxCustomUaChars);
    const result = resolveUaProfile({ id: 'custom', customUserAgent: exact });
    expect(result.profileId).toBe('custom');
    expect(result.userAgent).toBe(exact);
    expect(result.method).toBe('extension-fetch-header');
  });

  it('falls back to browser-default when the custom UA is empty', () => {
    const result = resolveUaProfile({ id: 'custom', customUserAgent: '   ' });
    expect(result.profileId).toBe('browser-default');
    expect(result.userAgent).toBeNull();
    expect(result.method).toBe('none');
    expect(result.limitations.some((l) => l.includes('empty'))).toBe(true);
  });

  it('falls back to browser-default when the custom UA exceeds the length cap', () => {
    const tooLong = 'a'.repeat(UA_PROFILE_LIMITS.maxCustomUaChars + 1);
    const result = resolveUaProfile({ id: 'custom', customUserAgent: tooLong });
    expect(result.profileId).toBe('browser-default');
    expect(result.userAgent).toBeNull();
    expect(
      result.limitations.some((l) => l.includes(String(UA_PROFILE_LIMITS.maxCustomUaChars))),
    ).toBe(true);
  });

  it('falls back to browser-default when the custom UA contains control characters', () => {
    const result = resolveUaProfile({ id: 'custom', customUserAgent: 'Bot/1.0\r\nX-Injected: 1' });
    expect(result.profileId).toBe('browser-default');
    expect(result.userAgent).toBeNull();
    expect(result.limitations.some((l) => l.includes('control characters'))).toBe(true);
  });
});
