import type { SafeFetchHeaderName, SafeFetchLimits } from './limits';

/**
 * Evidence provenance for network facts. Never label an extension fetch as
 * the original browser navigation (Ticket 206 / 201).
 */
export type NetworkEvidenceSource = 'browser-navigation' | 'extension-fetch' | 'unavailable';

export type SafeFetchMethod = 'GET' | 'HEAD';

export type SafeFetchRequest = {
  url: string;
  method?: SafeFetchMethod;
  /** Correlation id for logs/evidence; generated when omitted. */
  requestId?: string;
  /** Optional MIME subtype/type prefix expectation, e.g. `text/html` or `application/xml`. */
  expectMime?: string;
  /** When true, retain a truncated body string; default false (bodies not persisted). */
  includeBody?: boolean;
  /** Override selected caps for tests or specialised callers. */
  limits?: Partial<SafeFetchLimits>;
  /** Optional AbortSignal from the caller (combined with the per-hop timeout). */
  signal?: AbortSignal;
};

export type RedirectHop = {
  fromUrl: string;
  toUrl: string;
  status: number;
};

export type SafeFetchTiming = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type SafeFetchOk = {
  ok: true;
  source: 'extension-fetch';
  requestId: string;
  method: SafeFetchMethod;
  requestedUrl: string;
  finalUrl: string;
  status: number;
  redirectHops: RedirectHop[];
  headers: Partial<Record<SafeFetchHeaderName, string>>;
  timing: SafeFetchTiming;
  truncated: boolean;
  /** Present only when includeBody was requested. */
  bodyText?: string;
  bodyByteLength: number;
  mimeMatched: boolean | null;
  limitations: string[];
};

export type SafeFetchFailureCode =
  | 'invalid-url'
  | 'unsupported-scheme'
  | 'timeout'
  | 'aborted'
  | 'redirect-limit'
  | 'redirect-opaque'
  | 'network-error'
  | 'oversized-body'
  | 'mime-mismatch';

export type SafeFetchErr = {
  ok: false;
  source: 'extension-fetch';
  requestId: string;
  method: SafeFetchMethod;
  requestedUrl: string;
  finalUrl?: string;
  status?: number;
  redirectHops: RedirectHop[];
  timing: SafeFetchTiming;
  code: SafeFetchFailureCode;
  message: string;
  truncated: boolean;
  limitations: string[];
};

export type SafeFetchResult = SafeFetchOk | SafeFetchErr;

export type NavigationObservationStatus =
  | {
      status: 'observed';
      source: 'browser-navigation';
      tabId: number;
      requestedUrl: string;
      finalUrl: string;
      statusCode: number;
      redirectHops: RedirectHop[];
      headers: Partial<Record<SafeFetchHeaderName, string>>;
      observedAt: string;
    }
  | {
      status: 'unavailable';
      source: 'unavailable';
      code:
        | 'listener-not-attached'
        | 'navigation-completed-before-attach'
        | 'unsupported-scheme'
        | 'tab-missing';
      message: string;
      requestedUrl?: string;
      /** How a caller may obtain navigation evidence later (Ticket 201). */
      recovery: 'reload-and-reobserve' | 'none';
    };
