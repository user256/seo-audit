import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';

/**
 * MV3 shell + permission boundary (Ticket 212).
 * Required HTTP(S) host access so multi-host Sprint 2 fetches work without a
 * per-origin Allow NUX. Unsupported schemes stay blocked in evaluateUrl.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'SEO Audit Workbench',
  description:
    'Local-first technical SEO inspector for the active browser tab. Reads HTTP(S) pages you open to capture page and related crawl signals locally.',
  version: packageJson.version,
  action: {
    default_title: 'SEO Audit Workbench',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  permissions: ['storage', 'activeTab', 'sidePanel', 'scripting', 'tabs'],
  host_permissions: ['http://*/*', 'https://*/*'],
});
