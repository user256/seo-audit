import type { RedirectHop } from '../network/types';
import type { VariantTestLimits } from './limits';

export type VariantKind = 'base' | 'scheme' | 'www' | 'trailing-slash' | 'case' | 'index-filename';

export type VariantKindOptions = {
  scheme: boolean;
  www: boolean;
  trailingSlash: boolean;
  case: boolean;
  indexFilenames: boolean;
};

export const DEFAULT_VARIANT_KIND_OPTIONS: VariantKindOptions = {
  scheme: true,
  www: true,
  trailingSlash: true,
  case: false,
  indexFilenames: true,
};

export type GeneratedVariant = {
  url: string;
  kind: VariantKind;
  label: string;
};

export type GenerateVariantsResult =
  | {
      ok: true;
      baseUrl: string;
      variants: GeneratedVariant[];
      dedupedCount: number;
    }
  | {
      ok: false;
      code: 'invalid-url' | 'unsupported-scheme';
      message: string;
    };

export type VariantFetchError = {
  code: string;
  message: string;
};

export type VariantTestRow = {
  kind: VariantKind;
  label: string;
  requestUrl: string;
  finalUrl: string | null;
  status: number | null;
  redirectHops: RedirectHop[];
  elapsedMs: number;
  contentType: string | null;
  canonicalUrl: string | null;
  error: VariantFetchError | null;
  skipped: boolean;
};

export type VariantFinalGroup = {
  finalUrl: string;
  normalizedFinalUrl: string;
  members: { requestUrl: string; kind: VariantKind; status: number | null }[];
};

export type VariantObservation = {
  id: string;
  kind: 'inconsistent-finals' | 'mixed-status' | 'canonical-mismatch';
  summary: string;
  detail: string;
  relatedRequestUrls: string[];
};

export type VariantTestProgress = {
  requestId: string;
  phase: 'fetching' | 'comparing' | 'done' | 'cancelled';
  completed: number;
  total: number;
  currentUrl?: string;
};

export type VariantTestRunResult = {
  requestId: string;
  baseUrl: string;
  startedAt: string;
  endedAt: string;
  cancelled: boolean;
  limits: VariantTestLimits;
  kindOptions: VariantKindOptions;
  method: 'HEAD' | 'GET';
  results: VariantTestRow[];
  finalGroups: VariantFinalGroup[];
  observations: VariantObservation[];
  limitations: string[];
  truncation: {
    totalGenerated: number;
    fetchTargets: number;
    completedCount: number;
    variantCapHit: boolean;
    wallTimeExceeded: boolean;
  };
};
