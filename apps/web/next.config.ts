import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits a self-contained server bundle for the Docker image: it inlines this
  // config (so production needs no typescript to re-read it) and traces only
  // the files actually imported.
  output: 'standalone',
  // Tracing must start at the workspace root, or the pnpm-symlinked
  // @seo-guardian/* deps resolve outside the app and get dropped.
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
};

export default nextConfig;
