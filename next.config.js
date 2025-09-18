/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  
  // Browser extension compatibility handled in layout
  
  webpack: (config) => {
    config.module.rules.push({
      test: /\.geojson$/,
      use: 'json-loader'
    });
    return config;
  },
  
  // Custom webpack config to handle browser extension issues
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
};

module.exports = nextConfig;