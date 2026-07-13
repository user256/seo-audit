import type { RedirectHop } from '../network/types';
import type { Soft404ProbeLimits } from './limits';

export const SOFT_404_PROBE_FETCH_SOURCE = 'extension-fetch' as const;
export const SOFT_404_PROBE_EVIDENCE_SOURCE = 'soft-404-probe' as const;

export type Soft404HeuristicKind =
  | 'similar-content'
  | 'identical-body-hash'
  | 'spa-fallback'
  | 'redirect-to-home'
  | 'error-template-title';

export type Soft404TextFingerprint = {
  normalizedText: string;
  tokens: string[];
  truncated: boolean;
};

export type Soft404PageCapture = {
  role: 'probe' | 'audited';
  requestedUrl: string;
  finalUrl: string | null;
  status: number | null;
  contentType: string | null;
  title: string | null;
  bodyByteLength: number;
  bodyHash: string | null;
  fingerprint: Soft404TextFingerprint | null;
  redirectHops: RedirectHop[];
  elapsedMs: number;
  fetchError: { code: string; message: string } | null;
  skipped: boolean;
};

export type Soft404Observation = {
  id: string;
  ruleId: 'soft-404-possible';
  kind: Soft404HeuristicKind;
  summary: string;
  detail: string;
};

export type Soft404ProbeProgress = {
  requestId: string;
  phase: 'fetching-probe' | 'fetching-audited' | 'evaluating' | 'done' | 'cancelled';
  currentUrl?: string;
};

export type Soft404ProbeResult = {
  requestId: string;
  auditedUrl: string;
  probeUrl: string;
  origin: string;
  startedAt: string;
  endedAt: string;
  cancelled: boolean;
  limits: Soft404ProbeLimits;
  probe: Soft404PageCapture;
  audited: Soft404PageCapture;
  observations: Soft404Observation[];
  limitations: string[];
};
