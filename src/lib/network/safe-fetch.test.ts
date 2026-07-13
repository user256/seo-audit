import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAFE_FETCH_LIMITS } from './limits';
import { safeFetch } from './safe-fetch';

function headerInit(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('safeFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('labels successes as extension-fetch and omits credentials', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.credentials).toBe('omit');
      expect(init?.referrerPolicy).toBe('no-referrer');
      expect(init?.cache).toBe('no-store');
      expect(init?.redirect).toBe('manual');
      return new Response('hello', {
        status: 200,
        headers: headerInit({ 'content-type': 'text/html; charset=utf-8' }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetch({
      url: 'https://example.com/page',
      requestId: 'req-1',
      includeBody: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe('extension-fetch');
      expect(result.status).toBe(200);
      expect(result.bodyText).toBe('hello');
      expect(result.limitations.join(' ')).toMatch(/not the original browser navigation/i);
      expect(result.headers['content-type']).toMatch(/text\/html/);
    }
  });

  it('records cross-origin redirect hops under the hop cap', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://a.example/start') {
        return new Response(null, {
          status: 302,
          headers: headerInit({ location: 'https://b.example/next' }),
        });
      }
      if (url === 'https://b.example/next') {
        return new Response('ok', {
          status: 200,
          headers: headerInit({ 'content-type': 'text/plain', 'x-robots-tag': 'noindex' }),
        });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetch({ url: 'https://a.example/start', includeBody: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectHops).toEqual([
        {
          fromUrl: 'https://a.example/start',
          toUrl: 'https://b.example/next',
          status: 302,
        },
      ]);
      expect(result.finalUrl).toBe('https://b.example/next');
      expect(result.headers['x-robots-tag']).toBe('noindex');
    }
  });

  it('fails closed on redirect loops past the hop cap', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        return new Response(null, {
          status: 301,
          headers: headerInit({ location: `${url}?n=1` }),
        });
      }),
    );

    const result = await safeFetch({
      url: 'https://loop.example/',
      limits: { maxRedirects: 2 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('redirect-limit');
      expect(result.redirectHops.length).toBe(2);
    }
  });

  it('treats opaque redirects as capture failures, not navigation evidence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return {
          type: 'opaqueredirect',
          status: 0,
          headers: new Headers(),
          url: '',
          body: null,
        } as unknown as Response;
      }),
    );

    const result = await safeFetch({ url: 'https://opaque.example/' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('redirect-opaque');
      expect(result.source).toBe('extension-fetch');
    }
  });

  it('times out slow hops', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }),
    );

    const pending = safeFetch({
      url: 'https://slow.example/',
      limits: { timeoutMs: 50 },
    });
    await vi.advanceTimersByTimeAsync(60);
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('timeout');
    }
  });

  it('honours caller cancellation', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }),
    );

    const pending = safeFetch({
      url: 'https://cancel.example/',
      signal: controller.signal,
      limits: { timeoutMs: 60_000 },
    });
    // Abort on the next microtask so fetch has registered its listener.
    queueMicrotask(() => controller.abort());
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('aborted');
    }
  });

  it('truncates oversized bodies when includeBody is set', async () => {
    const big = 'x'.repeat(SAFE_FETCH_LIMITS.maxBodyBytes + 40);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(big, { status: 200, headers: headerInit({ 'content-type': 'text/plain' }) }),
      ),
    );

    const result = await safeFetch({
      url: 'https://big.example/',
      includeBody: true,
      limits: { maxBodyBytes: 64 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.truncated).toBe(true);
      expect(result.bodyText?.length).toBe(64);
      expect(result.bodyByteLength).toBe(64);
    }
  });

  it('rejects non-http(s) schemes and invalid URLs', async () => {
    const chrome = await safeFetch({ url: 'chrome://extensions' });
    expect(chrome.ok).toBe(false);
    if (!chrome.ok) expect(chrome.code).toBe('unsupported-scheme');

    const bad = await safeFetch({ url: 'not a url' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe('invalid-url');
  });

  it('fails on MIME mismatch when expectMime is set', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html></html>', {
            status: 200,
            headers: headerInit({ 'content-type': 'text/html' }),
          }),
      ),
    );

    const result = await safeFetch({
      url: 'https://example.com/sitemap.xml',
      expectMime: 'application/xml',
      includeBody: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('mime-mismatch');
  });

  it('does not persist body text by default', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('secret-body', { status: 200 })),
    );
    const result = await safeFetch({ url: 'https://example.com/' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bodyText).toBeUndefined();
    }
  });
});
