import { describe, expect, it, vi } from 'vitest';
import {
  hydrateCrawlSignals,
  sameHydrateTab,
  targetsCurrentTab,
  type HydrateCrawlSignalsDeps,
  type HydrateTabRef,
} from './hydrate-crawl-signals';
import type { RobotsFetchResult } from '../robots/fetch-robots';
import type { SitemapFetchResult } from '../sitemap/fetch-sitemap';

const START: HydrateTabRef = { tabId: 7, origin: 'https://example.com' };
const ROBOTS = { ok: true } as unknown as RobotsFetchResult;
const SITEMAP = { ok: true } as unknown as SitemapFetchResult;

type Overrides = Partial<HydrateCrawlSignalsDeps>;

function harness(overrides: Overrides = {}) {
  const calls: string[] = [];
  let robotsBusy = false;
  let sitemapBusy = false;
  const deps: HydrateCrawlSignalsDeps = {
    currentTab: () => ({ ...START }),
    hasRobotsResult: () => false,
    robotsBusy: () => robotsBusy,
    setRobotsBusy: (busy) => {
      robotsBusy = busy;
      calls.push(`robots-busy:${busy}`);
    },
    fetchRobots: vi.fn(async (origin: string) => {
      calls.push(`fetch-robots:${origin}`);
      return ROBOTS;
    }),
    applyRobots: vi.fn(async () => {
      calls.push('apply-robots');
    }),
    hasSitemapResult: () => false,
    sitemapBusy: () => sitemapBusy,
    setSitemapBusy: (busy) => {
      sitemapBusy = busy;
      calls.push(`sitemap-busy:${busy}`);
    },
    sitemapCandidateUrls: () => ['https://example.com/sitemap.xml'],
    fetchSitemap: vi.fn(async (rootUrls: string[]) => {
      calls.push(`fetch-sitemap:${rootUrls.join(',')}`);
      return SITEMAP;
    }),
    applySitemap: vi.fn(async () => {
      calls.push('apply-sitemap');
    }),
    refresh: vi.fn(async () => {
      calls.push('refresh');
    }),
    ...overrides,
  };
  return { deps, calls, busy: { robots: () => robotsBusy, sitemap: () => sitemapBusy } };
}

describe('hydrateCrawlSignals', () => {
  it('fetches robots for the start origin, applies it, then fetches the sitemap', async () => {
    const { deps, calls, busy } = harness();
    await hydrateCrawlSignals(deps, START);

    expect(calls).toEqual([
      'robots-busy:true',
      'refresh',
      'fetch-robots:https://example.com',
      'apply-robots',
      'robots-busy:false',
      'refresh',
      'sitemap-busy:true',
      'refresh',
      'fetch-sitemap:https://example.com/sitemap.xml',
      'apply-sitemap',
      'sitemap-busy:false',
      'refresh',
    ]);
    expect(busy.robots()).toBe(false);
    expect(busy.sitemap()).toBe(false);
  });

  it('skips the robots stage when a result already exists, but still hydrates the sitemap', async () => {
    const { deps } = harness({ hasRobotsResult: () => true });
    await hydrateCrawlSignals(deps, START);

    expect(deps.fetchRobots).not.toHaveBeenCalled();
    expect(deps.applyRobots).not.toHaveBeenCalled();
    expect(deps.fetchSitemap).toHaveBeenCalledWith(['https://example.com/sitemap.xml']);
    expect(deps.applySitemap).toHaveBeenCalled();
  });

  it('does not re-enter a robots fetch that is already in flight', async () => {
    const { deps } = harness({ robotsBusy: () => true });
    await hydrateCrawlSignals(deps, START);

    expect(deps.fetchRobots).not.toHaveBeenCalled();
    expect(deps.fetchSitemap).toHaveBeenCalled();
  });

  it('does not re-enter a sitemap fetch and skips when a sitemap result exists', async () => {
    const inFlight = harness({ hasRobotsResult: () => true, sitemapBusy: () => true });
    await hydrateCrawlSignals(inFlight.deps, START);
    expect(inFlight.deps.fetchSitemap).not.toHaveBeenCalled();

    const done = harness({ hasRobotsResult: () => true, hasSitemapResult: () => true });
    await hydrateCrawlSignals(done.deps, START);
    expect(done.deps.fetchSitemap).not.toHaveBeenCalled();
  });

  it('discards the robots result and stops when the tab changes during the fetch', async () => {
    let tab: HydrateTabRef | null = { ...START };
    const { deps, busy } = harness({
      currentTab: () => tab,
      fetchRobots: vi.fn(async () => {
        tab = { tabId: 9, origin: 'https://other.example' };
        return ROBOTS;
      }),
    });
    await hydrateCrawlSignals(deps, START);

    expect(deps.applyRobots).not.toHaveBeenCalled();
    expect(deps.fetchSitemap).not.toHaveBeenCalled();
    expect(busy.robots()).toBe(false);
  });

  it('treats a same-tab navigation to a new origin as a tab change', async () => {
    let origin = START.origin;
    const { deps } = harness({
      currentTab: () => ({ tabId: START.tabId, origin }),
      fetchRobots: vi.fn(async () => {
        origin = 'https://moved.example';
        return ROBOTS;
      }),
    });
    await hydrateCrawlSignals(deps, START);

    expect(deps.applyRobots).not.toHaveBeenCalled();
    expect(deps.fetchSitemap).not.toHaveBeenCalled();
  });

  it('discards the sitemap result when the tab changes during the sitemap fetch', async () => {
    let tab: HydrateTabRef | null = { ...START };
    const { deps, busy } = harness({
      hasRobotsResult: () => true,
      fetchSitemap: vi.fn(async () => {
        tab = null;
        return SITEMAP;
      }),
      currentTab: () => tab,
    });
    await hydrateCrawlSignals(deps, START);

    expect(deps.applySitemap).not.toHaveBeenCalled();
    expect(busy.sitemap()).toBe(false);
  });

  it('continues to the sitemap stage when the robots fetch reports an error', async () => {
    const { deps } = harness({ fetchRobots: vi.fn(async () => null) });
    await hydrateCrawlSignals(deps, START);

    expect(deps.applyRobots).not.toHaveBeenCalled();
    expect(deps.fetchSitemap).toHaveBeenCalled();
    expect(deps.applySitemap).toHaveBeenCalled();
  });

  it('skips the sitemap fetch when the origin yields no candidates', async () => {
    const { deps, calls } = harness({ sitemapCandidateUrls: () => [] });
    await hydrateCrawlSignals(deps, START);

    expect(deps.fetchSitemap).not.toHaveBeenCalled();
    expect(calls).not.toContain('sitemap-busy:true');
  });

  it('releases the busy flag when a fetch throws', async () => {
    const { deps, busy } = harness({
      fetchRobots: vi.fn(async () => {
        throw new Error('network down');
      }),
    });
    await expect(hydrateCrawlSignals(deps, START)).rejects.toThrow('network down');
    expect(busy.robots()).toBe(false);
  });
});

describe('sameHydrateTab / targetsCurrentTab', () => {
  it('matches only the same tabId and origin', () => {
    expect(sameHydrateTab({ ...START }, START)).toBe(true);
    expect(sameHydrateTab({ tabId: 7, origin: 'https://other.example' }, START)).toBe(false);
    expect(sameHydrateTab({ tabId: 8, origin: START.origin }, START)).toBe(false);
    expect(sameHydrateTab(null, START)).toBe(false);
  });

  it('targets silent navigation updates at the current ready tab only', () => {
    expect(targetsCurrentTab({ ...START }, 7)).toBe(true);
    expect(targetsCurrentTab({ ...START }, 8)).toBe(false);
    expect(targetsCurrentTab(null, 7)).toBe(false);
  });
});
