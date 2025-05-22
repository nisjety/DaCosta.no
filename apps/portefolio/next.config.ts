import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    // Custom webpack configurations
    // Necessary for handling WebSocket connections
    if (isServer) {
      config.externals = [...config.externals, 'ws', 'bufferutil', 'utf-8-validate'];
    }
    
    return config;
  },
  
  // Adjust timeout for WebSocket connections
  experimental: {
    serverComponentsExternalPackages: ['ws'],
  }
};

export default nextConfig;
