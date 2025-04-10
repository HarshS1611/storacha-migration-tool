/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config) => {
    // Provide browser-compatible implementations for Node.js modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: require.resolve('./src/utils/fs-browser.js'),
      path: require.resolve('./src/utils/path-browser.js'),
      os: false,
      crypto: false,
      stream: false,
      events: require.resolve('events/'),
    };
    
    // Add aliases for resolving Node.js-dependent modules
    config.resolve.alias = {
      ...config.resolve.alias,
      // Alias EventManager
      '../../managers/EventManager.js': path.resolve(__dirname, './src/managers/EventManager.js'), 
      '../managers/EventManager.js': path.resolve(__dirname, './src/managers/EventManager.js'),
      './managers/EventManager.js': path.resolve(__dirname, './src/managers/EventManager.js')
    };
    
    return config;
  },
};

module.exports = nextConfig; 