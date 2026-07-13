import { describe, expect, it } from 'vitest';
import { createNavigationCaptureController } from './navigation-capture';

describe('navigation capture controller', () => {
  it('ignores unrelated tab traffic', () => {
    const capture = createNavigationCaptureController();
    capture.watchTab(1);
    capture.onHeadersReceived({
      tabId: 99,
      requestId: 'r1',
      url: 'https://other.example/',
      statusCode: 200,
      type: 'main_frame',
      responseHeaders: [{ name: 'X-Robots-Tag', value: 'noindex' }],
    });
    capture.onCompleted({
      tabId: 99,
      requestId: 'r1',
      url: 'https://other.example/',
      statusCode: 200,
      type: 'main_frame',
    });
    expect(capture.getObservation(1)).toMatchObject({
      status: 'unavailable',
      code: 'navigation-completed-before-attach',
    });
  });

  it('records a simple 200 with allowlisted headers only', () => {
    const capture = createNavigationCaptureController();
    capture.watchTab(7);
    capture.onHeadersReceived({
      tabId: 7,
      requestId: 'a',
      url: 'https://example.com/',
      statusCode: 200,
      type: 'main_frame',
      responseHeaders: [
        { name: 'Content-Type', value: 'text/html' },
        { name: 'Set-Cookie', value: 'secret=1' },
        { name: 'X-Robots-Tag', value: 'noindex' },
      ],
    });
    capture.onCompleted({
      tabId: 7,
      requestId: 'a',
      url: 'https://example.com/',
      statusCode: 200,
      type: 'main_frame',
    });

    const result = capture.getObservation(7, 'https://example.com/');
    expect(result.status).toBe('observed');
    if (result.status === 'observed') {
      expect(result.source).toBe('browser-navigation');
      expect(result.statusCode).toBe(200);
      expect(result.headers['content-type']).toBe('text/html');
      expect(result.headers['x-robots-tag']).toBe('noindex');
      expect(JSON.stringify(result.headers)).not.toMatch(/secret|set-cookie/i);
    }
  });

  it('records 301→200 redirect hops', () => {
    const capture = createNavigationCaptureController();
    capture.watchTab(3);
    capture.onBeforeRedirect({
      tabId: 3,
      requestId: 'b',
      url: 'http://example.com/',
      redirectUrl: 'https://example.com/',
      statusCode: 301,
      type: 'main_frame',
    });
    capture.onHeadersReceived({
      tabId: 3,
      requestId: 'b',
      url: 'https://example.com/',
      statusCode: 200,
      type: 'main_frame',
      responseHeaders: [{ name: 'content-type', value: 'text/html' }],
    });
    capture.onCompleted({
      tabId: 3,
      requestId: 'b',
      url: 'https://example.com/',
      statusCode: 200,
      type: 'main_frame',
    });

    const result = capture.getObservation(3);
    expect(result.status).toBe('observed');
    if (result.status === 'observed') {
      expect(result.redirectHops).toEqual([
        {
          fromUrl: 'http://example.com/',
          toUrl: 'https://example.com/',
          status: 301,
        },
      ]);
      expect(result.statusCode).toBe(200);
    }
  });

  it('records 302→404 journeys', () => {
    const capture = createNavigationCaptureController();
    capture.watchTab(4);
    capture.onBeforeRedirect({
      tabId: 4,
      requestId: 'c',
      url: 'https://example.com/old',
      redirectUrl: 'https://example.com/missing',
      statusCode: 302,
      type: 'main_frame',
    });
    capture.onHeadersReceived({
      tabId: 4,
      requestId: 'c',
      url: 'https://example.com/missing',
      statusCode: 404,
      type: 'main_frame',
      responseHeaders: [{ name: 'content-type', value: 'text/html' }],
    });
    capture.onCompleted({
      tabId: 4,
      requestId: 'c',
      url: 'https://example.com/missing',
      statusCode: 404,
      type: 'main_frame',
    });

    const result = capture.getObservation(4);
    expect(result.status).toBe('observed');
    if (result.status === 'observed') {
      expect(result.statusCode).toBe(404);
      expect(result.redirectHops[0]?.status).toBe(302);
    }
  });

  it('joins duplicate X-Robots-Tag values', () => {
    const capture = createNavigationCaptureController();
    capture.watchTab(5);
    capture.onHeadersReceived({
      tabId: 5,
      requestId: 'd',
      url: 'https://example.com/',
      statusCode: 200,
      type: 'main_frame',
      responseHeaders: [
        { name: 'X-Robots-Tag', value: 'noindex' },
        { name: 'X-Robots-Tag', value: 'nofollow' },
      ],
    });
    capture.onCompleted({
      tabId: 5,
      requestId: 'd',
      url: 'https://example.com/',
      statusCode: 200,
      type: 'main_frame',
    });

    const result = capture.getObservation(5);
    expect(result.status).toBe('observed');
    if (result.status === 'observed') {
      expect(result.headers['x-robots-tag']).toBe('noindex, nofollow');
    }
  });

  it('does not record navigation when the tab was never watched', () => {
    const capture = createNavigationCaptureController();
    capture.onHeadersReceived({
      tabId: 2,
      requestId: 'e',
      url: 'https://example.com/',
      statusCode: 200,
      type: 'main_frame',
      responseHeaders: [{ name: 'X-Robots-Tag', value: 'noindex' }],
    });
    capture.onCompleted({
      tabId: 2,
      requestId: 'e',
      url: 'https://example.com/',
      statusCode: 200,
      type: 'main_frame',
    });
    expect(capture.getObservation(2)).toMatchObject({
      status: 'unavailable',
      code: 'listener-not-attached',
      recovery: 'reload-and-reobserve',
    });
  });
});
