import { DOM_LIMITS } from '../schemas/dom-limits';

/**
 * Bounded, vocabulary-neutral JSON-LD inspection. This deliberately does not
 * resolve contexts or assert any rich-result eligibility.
 */
export const STRUCTURED_DATA_LIMITS = {
  maxNodes: 200,
  maxDepth: 20,
  maxStringChars: DOM_LIMITS.maxStringChars,
} as const;

export type JsonLdParseStatus = 'ok' | 'invalid-json' | 'empty' | 'truncated';

export type JsonLdCapturedEntry = {
  index: number;
  raw: string;
  parseStatus: JsonLdParseStatus;
};

export type JsonLdContextStatus = 'valid' | 'missing' | 'malformed';
export type JsonLdInventoryStatus = 'complete' | 'limited' | 'unevaluated';
export type JsonLdTopLevelKind = 'object' | 'array' | 'scalar' | 'unknown';

export type JsonLdNodeInventory = {
  path: string;
  types: string[];
  id?: string;
  /** A root or a direct member of an @graph; these require @type by policy. */
  graphNode: boolean;
};

export type JsonLdGraphInventory = {
  index: number;
  context: JsonLdContextStatus;
  nodeCount: number;
  nodes: JsonLdNodeInventory[];
  duplicateIds: string[];
};

export type JsonLdInventory = {
  entryIndex: number;
  parseStatus: JsonLdParseStatus;
  status: JsonLdInventoryStatus;
  topLevel: JsonLdTopLevelKind;
  nonObjectTopLevelCount: number;
  graphs: JsonLdGraphInventory[];
  limits: {
    nodeLimitReached: boolean;
    depthLimitReached: boolean;
    stringLimitReached: boolean;
  };
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function contextStatus(value: unknown): JsonLdContextStatus {
  if (value === undefined) return 'missing';
  if (typeof value === 'string' && value.trim() !== '') return 'valid';
  if (isRecord(value)) return 'valid';
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => (typeof item === 'string' && item.trim() !== '') || isRecord(item))
  ) {
    return 'valid';
  }
  return 'malformed';
}

function emptyInventory(entry: JsonLdCapturedEntry): JsonLdInventory {
  return {
    entryIndex: entry.index,
    parseStatus: entry.parseStatus,
    status: 'unevaluated',
    topLevel: 'unknown',
    nonObjectTopLevelCount: 0,
    graphs: [],
    limits: {
      nodeLimitReached: false,
      depthLimitReached: false,
      stringLimitReached: false,
    },
  };
}

function combinedContextStatus(values: unknown[]): JsonLdContextStatus {
  const statuses = values.filter(isRecord).map((value) => contextStatus(value['@context']));
  if (statuses.includes('malformed')) return 'malformed';
  if (statuses.length === 0 || statuses.includes('missing')) return 'missing';
  return 'valid';
}

/**
 * Inspect a complete JSON-LD script without fetching contexts or following
 * links. The node walk is intentionally capped so a valid but adversarial
 * payload cannot make rule evaluation unbounded.
 */
export function inventoryJsonLdEntry(entry: JsonLdCapturedEntry): JsonLdInventory {
  if (entry.parseStatus !== 'ok') return emptyInventory(entry);

  let parsed: unknown;
  try {
    parsed = JSON.parse(entry.raw) as unknown;
  } catch {
    // Stored parse status is authoritative, but preserve the safety boundary
    // for historical/synthetic evidence whose raw text no longer agrees.
    return emptyInventory(entry);
  }

  const limits = {
    nodeLimitReached: false,
    depthLimitReached: false,
    stringLimitReached: false,
  };
  const clip = (value: string): string => {
    if (value.length <= STRUCTURED_DATA_LIMITS.maxStringChars) return value;
    limits.stringLimitReached = true;
    return value.slice(0, STRUCTURED_DATA_LIMITS.maxStringChars);
  };
  const readTypes = (value: unknown): string[] => {
    const values = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
    return values.filter((item): item is string => typeof item === 'string').map(clip);
  };
  const readId = (value: unknown): string | undefined =>
    typeof value === 'string' ? clip(value) : undefined;

  const graphs: JsonLdGraphInventory[] = [];
  const inspectGraph = (roots: unknown[], context: JsonLdContextStatus): void => {
    const nodes: JsonLdNodeInventory[] = [];
    const ids = new Map<string, number>();
    const stack = roots
      .map((value, index) => ({ value, path: `$[${index}]`, depth: 0, graphNode: true }))
      .reverse();
    let nodeCount = 0;

    while (stack.length > 0) {
      const next = stack.pop()!;
      if (next.depth > STRUCTURED_DATA_LIMITS.maxDepth) {
        limits.depthLimitReached = true;
        continue;
      }
      if (Array.isArray(next.value)) {
        for (let i = next.value.length - 1; i >= 0; i -= 1) {
          stack.push({
            value: next.value[i],
            path: `${next.path}[${i}]`,
            depth: next.depth + 1,
            graphNode: false,
          });
        }
        continue;
      }
      if (!isRecord(next.value)) continue;
      if (nodeCount >= STRUCTURED_DATA_LIMITS.maxNodes) {
        limits.nodeLimitReached = true;
        continue;
      }

      nodeCount += 1;
      const id = readId(next.value['@id']);
      if (id !== undefined) ids.set(id, (ids.get(id) ?? 0) + 1);
      nodes.push({
        path: next.path,
        types: readTypes(next.value['@type']),
        ...(id === undefined ? {} : { id }),
        graphNode: next.graphNode,
      });

      const entries = Object.entries(next.value);
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const [key, value] = entries[i]!;
        if (key === '@context') continue;
        stack.push({
          value,
          path: `${next.path}.${key}`,
          depth: next.depth + 1,
          graphNode: false,
        });
      }
    }

    graphs.push({
      index: graphs.length,
      context,
      nodeCount,
      nodes,
      duplicateIds: [...ids]
        .filter(([, count]) => count > 1)
        .map(([id]) => id)
        .sort(),
    });
  };

  let topLevel: JsonLdTopLevelKind;
  let nonObjectTopLevelCount = 0;
  if (isRecord(parsed)) {
    topLevel = 'object';
    const graph = parsed['@graph'];
    inspectGraph(Array.isArray(graph) ? graph : [parsed], contextStatus(parsed['@context']));
  } else if (Array.isArray(parsed)) {
    topLevel = 'array';
    nonObjectTopLevelCount = parsed.filter((item) => !isRecord(item)).length;
    inspectGraph(parsed, combinedContextStatus(parsed));
  } else {
    topLevel = 'scalar';
    nonObjectTopLevelCount = 1;
  }

  return {
    entryIndex: entry.index,
    parseStatus: entry.parseStatus,
    status:
      limits.nodeLimitReached || limits.depthLimitReached || limits.stringLimitReached
        ? 'limited'
        : 'complete',
    topLevel,
    nonObjectTopLevelCount,
    graphs,
    limits,
  };
}

/** Create one bounded inventory per captured script, preserving unevaluated entries. */
export function inventoryJsonLdEntries(entries: JsonLdCapturedEntry[]): JsonLdInventory[] {
  return entries.map(inventoryJsonLdEntry);
}
