/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  
  // Transpile ONNX runtime modules
  transpilePackages: ['onnxruntime-web'],
  
  // Experimental features for better module handling
  experimental: {
    esmExternals: 'loose',
  },
  
  // Browser extension compatibility handled in layout
  
  webpack: (config, { isServer }) => {
    // Handle GeoJSON files
    config.module.rules.push({
      test: /\.geojson$/,
      use: 'json-loader'
    });

    // Handle ONNX.js modules properly
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });

    // Handle ONNX files properly for production deployment
    config.module.rules.push({
      test: /\.onnx$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/models/[name][ext]',
      },
    });

    // Handle WASM files from ONNX runtime
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/wasm/[name][ext]',
      },
    });

    // Fix for onnxruntime-web in client-side builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Prevent Terser from processing certain ONNX files
    if (config.optimization && config.optimization.minimizer) {
      config.optimization.minimizer.forEach((minimizer) => {
        if (minimizer.constructor.name === 'TerserPlugin') {
          minimizer.options.exclude = /ort\..*\.mjs$/;
        }
      });
    }

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