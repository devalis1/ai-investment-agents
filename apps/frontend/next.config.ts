import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Load env from monorepo root via `npm run dev` / `build` / `start` (scripts/run-with-root-env.mjs).

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: projectRoot,
  },
  // Next 16 streams metadata behind MetadataWrapper's hidden <div> for normal browsers.
  // React 19's client tree can disagree on hidden/style vs that HTML, which surfaces as a
  // hydration mismatch in dev. Treat all UAs like html-limited clients so metadata resolves
  // before send (same branch as bots in createMetadataComponents — no streaming wrapper).
  htmlLimitedBots: /.*/,
};

export default nextConfig;

