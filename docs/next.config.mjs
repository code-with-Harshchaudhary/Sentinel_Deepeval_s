import { createMDX } from 'fumadocs-mdx/next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Next can change the effective working directory while loading config on
// Windows. Keep Fumadocs paths anchored to this package instead of relying on
// process.cwd(), otherwise it may search the drive root for source.config.ts.
const docsRoot = path.dirname(fileURLToPath(import.meta.url));
const withMDX = createMDX({
  configPath: path.join(docsRoot, 'source.config.ts'),
  outDir: path.join(docsRoot, '.source'),
});

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  webpack(config) {
    // next-themes 0.4.6 renders its bootstrap <script> from a Client
    // Component. React 19.2/Next 16.2 rejects that pattern in development.
    // The local adapter keeps the same public API while the server layout
    // owns the one-time bootstrap script.
    config.resolve.alias['next-themes'] = path.join(
      docsRoot,
      'components/theme-provider.tsx',
    );
    return config;
  },
  async headers() {
    return [
      {
        // RFC 8288 Link headers on the homepage so agents can discover
        // the docs, the llms.txt index, and the API catalog without
        // parsing HTML. (`Vary: Accept` for the negotiated routes is set in
        // `proxy.ts`, which can append to Next's own `Vary` instead of
        // replacing it.)
        source: '/',
        headers: [
          {
            key: 'Link',
            value:
              '</.well-known/api-catalog>; rel="api-catalog", </docs>; rel="service-doc", </llms.txt>; rel="describedby"',
          },
        ],
      },
      {
        // Discovery manifests (ARD ai-catalog.json, agent-skills index)
        // are meant to be fetched cross-origin by agents and registries.
        source: '/.well-known/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.ctfassets.net',
      },
      // Blog post hero / inline imagery — authored MDX references
      // `https://deepeval-docs.s3.us-east-1.amazonaws.com/...` directly
      // (e.g. `![alt](https://deepeval-docs.s3…png)`) and Next's MDX
      // pipeline lowers those to `next/image`, which rejects unknown
      // hosts. Allow the bucket explicitly rather than reaching for
      // `unoptimized: true`, so images still get optimized.
      {
        protocol: 'https',
        hostname: 'deepeval-docs.s3.us-east-1.amazonaws.com',
      },
    ],
  },
};

export default withMDX(config);
