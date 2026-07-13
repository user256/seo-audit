import { describe, expect, it } from 'vitest';
import { inventoryJsonLdEntries, inventoryJsonLdEntry, STRUCTURED_DATA_LIMITS } from './inventory';

describe('inventoryJsonLdEntry', () => {
  it('inventories an object payload and its nested nodes without vocabulary validation', () => {
    const inventory = inventoryJsonLdEntry({
      index: 0,
      parseStatus: 'ok',
      raw: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': ['Product', 'Thing'],
        '@id': 'https://example.test/products/1',
        offers: { '@type': 'Offer', '@id': '#offer' },
      }),
    });

    expect(inventory).toMatchObject({
      status: 'complete',
      topLevel: 'object',
      graphs: [
        {
          context: 'valid',
          nodeCount: 2,
          nodes: [
            {
              types: ['Product', 'Thing'],
              id: 'https://example.test/products/1',
              graphNode: true,
            },
            { types: ['Offer'], id: '#offer', graphNode: false },
          ],
        },
      ],
    });
  });

  it('treats an array payload as one captured graph and finds duplicate ids', () => {
    const inventory = inventoryJsonLdEntry({
      index: 1,
      parseStatus: 'ok',
      raw: JSON.stringify([
        { '@context': 'https://schema.org', '@type': 'Organization', '@id': '#publisher' },
        { '@context': 'https://schema.org', '@type': 'WebSite', '@id': '#publisher' },
      ]),
    });

    expect(inventory.graphs).toHaveLength(1);
    expect(inventory.graphs[0]).toMatchObject({
      context: 'valid',
      nodeCount: 2,
      duplicateIds: ['#publisher'],
    });
  });

  it('does not treat JSON-LD @id references as duplicate definitions', () => {
    const inventory = inventoryJsonLdEntry({
      index: 10,
      parseStatus: 'ok',
      raw: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': 'https://example.test/#organization',
            name: 'Example',
          },
          {
            '@type': 'WebSite',
            '@id': 'https://example.test/#website',
            publisher: { '@id': 'https://example.test/#organization' },
          },
        ],
      }),
    });

    expect(inventory.graphs[0]?.duplicateIds).toEqual([]);
    expect(inventory.graphs[0]?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'https://example.test/#organization',
          types: ['Organization'],
          graphNode: true,
        }),
        expect.objectContaining({
          id: 'https://example.test/#organization',
          types: [],
          graphNode: false,
        }),
      ]),
    );
  });

  it('uses the @graph members as graph nodes and accepts mixed @type strings', () => {
    const inventory = inventoryJsonLdEntry({
      index: 2,
      parseStatus: 'ok',
      raw: JSON.stringify({
        '@context': { '@vocab': 'https://schema.org/' },
        '@graph': [{ '@type': ['WebPage', 'Thing'], '@id': '#page' }, { '@id': '#missing-type' }],
      }),
    });

    expect(inventory.graphs[0]?.nodes).toMatchObject([
      { types: ['WebPage', 'Thing'], id: '#page', graphNode: true },
      { types: [], id: '#missing-type', graphNode: true },
    ]);
  });

  it('records non-object array members and bounds deeply nested payloads', () => {
    let deep: Record<string, unknown> = { '@type': 'Thing' };
    for (let i = 0; i < STRUCTURED_DATA_LIMITS.maxDepth + 3; i += 1) {
      deep = { child: deep };
    }
    const inventory = inventoryJsonLdEntry({
      index: 3,
      parseStatus: 'ok',
      raw: JSON.stringify(['not-a-node', { '@context': 'https://schema.org', ...deep }]),
    });

    expect(inventory.nonObjectTopLevelCount).toBe(1);
    expect(inventory.status).toBe('limited');
    expect(inventory.limits.depthLimitReached).toBe(true);
  });

  it('keeps incomplete and non-parseable captures explicitly unevaluated', () => {
    const [truncated, malformed] = inventoryJsonLdEntries([
      { index: 4, parseStatus: 'truncated', raw: '{"@context":' },
      { index: 5, parseStatus: 'invalid-json', raw: '{not json' },
    ]);

    expect(truncated).toMatchObject({
      status: 'unevaluated',
      parseStatus: 'truncated',
      graphs: [],
    });
    expect(malformed).toMatchObject({
      status: 'unevaluated',
      parseStatus: 'invalid-json',
      graphs: [],
    });
  });
});
