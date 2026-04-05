#!/usr/bin/env node
/**
 * Merges monorepo root `.env` / `.env.local` into `process.env`, then spawns `next …`.
 * Required so `NEXT_PUBLIC_*` and server secrets exist before Next's own env loader runs
 * (Next only auto-reads `apps/frontend/.env*` and its internal loader can drop root-only vars).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..', '..');

const dotenv = await import('dotenv');

const envFile = path.join(repoRoot, '.env');
const localFile = path.join(repoRoot, '.env.local');
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}
if (fs.existsSync(localFile)) {
  dotenv.config({ path: localFile, override: true });
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    'Usage: node scripts/run-with-root-env.mjs <next-args…>\nExample: node scripts/run-with-root-env.mjs dev --webpack',
  );
  process.exit(1);
}

const r = spawnSync('npx', ['next', ...args], {
  stdio: 'inherit',
  cwd: frontendRoot,
  env: process.env,
});
process.exit(r.status === null ? 1 : r.status);
