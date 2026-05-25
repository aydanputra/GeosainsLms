import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  turbopack: {
    root: rootDir,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: /([/\\]public[/\\]uploads[/\\])|([/\\]storage[/\\])/,
      };
    }
    return config;
  },
  experimental: {
    serverActions: {
        bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
