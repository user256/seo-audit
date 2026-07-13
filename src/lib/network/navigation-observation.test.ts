import { describe, expect, it } from 'vitest';
import {
  attachNavigationObserver,
  createNavigationObserverState,
  detachNavigationObserver,
  getNavigationObservation,
  recordBrowserNavigation,
} from './navigation-observation';

describe('navigation observation contract', () => {
  it('returns unavailable when listeners were never attached (late audit start)', () => {
    const state = createNavigationObserverState();
    const result = getNavigationObservation(state, {
      tabId: 9,
      requestedUrl: 'https://example.com/',
    });
    expect(result).toMatchObject({
      status: 'unavailable',
      source: 'unavailable',
      code: 'listener-not-attached',
      recovery: 'reload-and-reobserve',
    });
  });

  it('refuses to record browser-navigation evidence without a prior attach', () => {
    const state = createNavigationObserverState();
    expect(() =>
      recordBrowserNavigation(state, {
        status: 'observed',
        source: 'browser-navigation',
        tabId: 3,
        requestedUrl: 'https://example.com/',
        finalUrl: 'https://example.com/',
        statusCode: 200,
        redirectHops: [],
        headers: { 'content-type': 'text/html' },
        observedAt: '2026-07-13T12:00:00.000Z',
      }),
    ).toThrow(/prior listener attach/i);
  });

  it('returns observed navigation only after attach + record', () => {
    const state = createNavigationObserverState();
    attachNavigationObserver(state, 3);
    recordBrowserNavigation(state, {
      status: 'observed',
      source: 'browser-navigation',
      tabId: 3,
      requestedUrl: 'http://example.com/',
      finalUrl: 'https://example.com/',
      statusCode: 200,
      redirectHops: [
        {
          fromUrl: 'http://example.com/',
          toUrl: 'https://example.com/',
          status: 301,
        },
      ],
      headers: { 'x-robots-tag': 'noindex' },
      observedAt: '2026-07-13T12:00:00.000Z',
    });

    const result = getNavigationObservation(state, {
      tabId: 3,
      requestedUrl: 'https://example.com/',
    });
    expect(result.status).toBe('observed');
    if (result.status === 'observed') {
      expect(result.source).toBe('browser-navigation');
      expect(result.redirectHops).toHaveLength(1);
      expect(result.headers['x-robots-tag']).toBe('noindex');
    }
  });

  it('clears observations on detach so a later lookup stays unavailable', () => {
    const state = createNavigationObserverState();
    attachNavigationObserver(state, 5);
    recordBrowserNavigation(state, {
      status: 'observed',
      source: 'browser-navigation',
      tabId: 5,
      requestedUrl: 'https://example.com/a',
      finalUrl: 'https://example.com/a',
      statusCode: 200,
      redirectHops: [],
      headers: {},
      observedAt: '2026-07-13T12:00:00.000Z',
    });
    detachNavigationObserver(state, 5);

    expect(getNavigationObservation(state, { tabId: 5 })).toMatchObject({
      status: 'unavailable',
      code: 'listener-not-attached',
    });
  });

  it('does not treat attached-but-empty as observed navigation', () => {
    const state = createNavigationObserverState();
    attachNavigationObserver(state, 8);
    expect(
      getNavigationObservation(state, { tabId: 8, requestedUrl: 'https://x.test/' }),
    ).toMatchObject({
      status: 'unavailable',
      code: 'navigation-completed-before-attach',
      recovery: 'reload-and-reobserve',
    });
  });
});
