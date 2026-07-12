#!/usr/bin/env node
/**
 * Stub for Ticket 404 release packaging checks.
 * Confirms dist/ exists and contains a Manifest V3 file. Full allow/deny list
 * and ZIP verification land in Ticket 404.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const manifestPath = resolve(distDir, 'manifest.json');

if (!existsSync(distDir)) {
  console.error('package:check failed: dist/ does not exist. Run npm run build first.');
  process.exit(1);
}

if (!existsSync(manifestPath)) {
  console.error('package:check failed: dist/manifest.json is missing.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.manifest_version !== 3) {
  console.error('package:check failed: expected manifest_version 3.');
  process.exit(1);
}

console.log('package:check ok (stub): dist/ contains an MV3 manifest.');
