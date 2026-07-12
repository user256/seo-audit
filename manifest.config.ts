import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';

/**
 * MV3 shell + permission boundary (Ticket 101).
 * Host access is optional and requested per active origin at user action —
 * never declared as a required blanket host permission.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'SEO Audit Workbench',
  description:
    'Local-first technical SEO inspector for the active browser tab. Access is requested per origin.',
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
  // optional_host_permissions reserved for documentation; runtime requests use
  // chrome.permissions.request with an exact https://host/* or http://host/* pattern.
  optional_host_permissions: ['http://*/*', 'https://*/*'],
});
