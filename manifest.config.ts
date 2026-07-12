import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';

/**
 * Placeholder MV3 manifest for the toolchain bootstrap (Ticket 100).
 * Ticket 101 replaces this with the real permission boundary and shell.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'SEO Audit Workbench',
  description:
    'Local-first technical SEO inspector for the active browser tab (placeholder shell).',
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
  permissions: ['sidePanel'],
});
