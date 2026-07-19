import type { RobotsFetchResult } from '../robots/fetch-robots';
import type { SitemapFetchResult } from '../sitemap/fetch-sitemap';

/** Identity of the tab a hydrate run started against (Ticket 214). */
export type HydrateTabRef = { tabId: number; origin: string };

/**
 * Effects the side panel supplies to the background hydrate sequence. Fetchers
 * resolve `null` on error or unexpected responses; apply/refresh callbacks own
 * state writes and re-rendering so this module stays free of DOM and
 * `chrome.*` access.
 */
export interface HydrateCrawlSignalsDeps {
  /** The panel's current ready tab, or null when unsupported or not ready. */
  currentTab(): HydrateTabRef | null;
  hasRobotsResult(): boolean;
  robotsBusy(): boolean;
  setRobotsBusy(busy: boolean): void;
  fetchRobots(origin: string): Promise<RobotsFetchResult | null>;
  /** Store the robots result and re-render; called only while the tab is unchanged. */
  applyRobots(result: RobotsFetchResult): Promise<void>;
  hasSitemapResult(): boolean;
  sitemapBusy(): boolean;
  setSitemapBusy(busy: boolean): void;
  /** Recompute sitemap candidates for the audited origin; return their root URLs. */
  sitemapCandidateUrls(): string[];
  fetchSitemap(rootUrls: string[]): Promise<SitemapFetchResult | null>;
  /** Store the sitemap result and re-render; called only while the tab is unchanged. */
  applySitemap(result: SitemapFetchResult): Promise<void>;
  /** Rebuild the crawl-signals model and re-render the current workspace. */
  refresh(): Promise<void>;
}

/** True when `current` is the same ready tab+origin the run started on. */
export function sameHydrateTab(current: HydrateTabRef | null, start: HydrateTabRef): boolean {
  return current !== null && current.tabId === start.tabId && current.origin === start.origin;
}

/** True when a silent navigation update for `tabId` targets the current ready tab. */
export function targetsCurrentTab(current: HydrateTabRef | null, tabId: number): boolean {
  return current !== null && current.tabId === tabId;
}

/**
 * Quietly fill robots → sitemap after a glance. Never reloads the page; each
 * stage bails out when the panel has moved to another tab or origin, skips
 * when a result already exists or a fetch is in flight, and always releases
 * its busy flag and re-renders on the way out.
 */
export async function hydrateCrawlSignals(
  deps: HydrateCrawlSignalsDeps,
  start: HydrateTabRef,
): Promise<void> {
  const stillSameTab = (): boolean => sameHydrateTab(deps.currentTab(), start);

  // Another hydrate run — or an explicit Fetch robots — already owns the robots
  // stage and no result has landed yet. Bail out entirely rather than falling
  // through: deriving sitemap candidates now would see only fallback URLs and
  // miss robots-declared sitemaps, contradicting the documented robots →
  // sitemap ordering. The in-flight run reaches the sitemap stage itself, so
  // nothing is dropped. Neither busy flag is touched (Ticket 215).
  if (!deps.hasRobotsResult() && deps.robotsBusy()) return;

  if (!deps.hasRobotsResult()) {
    deps.setRobotsBusy(true);
    try {
      await deps.refresh();
      const result = await deps.fetchRobots(start.origin);
      if (result && stillSameTab()) {
        await deps.applyRobots(result);
      }
    } finally {
      deps.setRobotsBusy(false);
      if (stillSameTab()) {
        await deps.refresh();
      }
    }
  }

  if (!stillSameTab() || deps.sitemapBusy() || deps.hasSitemapResult()) return;
  const rootUrls = deps.sitemapCandidateUrls();
  if (rootUrls.length === 0) return;

  deps.setSitemapBusy(true);
  try {
    await deps.refresh();
    const result = await deps.fetchSitemap(rootUrls);
    if (result && stillSameTab()) {
      await deps.applySitemap(result);
    }
  } finally {
    deps.setSitemapBusy(false);
    if (stillSameTab()) {
      await deps.refresh();
    }
  }
}
