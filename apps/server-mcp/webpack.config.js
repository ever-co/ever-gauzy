const { composePlugins, withNx } = require('@nx/webpack');
const path = require('path');

module.exports = composePlugins(withNx(), (config, { options }) => {
  // Check if we're building the preload script
  const isPreload = config.entry && config.entry.toString().includes('preload');
  
  if (isPreload) {
    // Configuration for preload script
    config.target = 'electron-preload';
    config.output = {
      ...config.output,
      filename: 'preload.js',
      library: {
        type: 'commonjs2'
      }
    };
    
    // External dependencies for preload
    config.externals = ['electron'];
    
    // Remove ES module configuration for preload
    delete config.experiments?.outputModule;
  } else {
    // Configuration for main process
    config.target = 'electron-main';
    
    // Use CommonJS for main process to avoid module compatibility issues
    config.output = {
      ...config.output,
      library: {
        type: 'commonjs2'
      }
    };
    
    // Remove ES module configuration for main process
    delete config.experiments?.outputModule;
    
    // External dependencies that should not be bundled for main process
    config.externals = [
      'electron',
      'electron-log',
      'electron-store',
      'electron-updater',
      'custom-electron-titlebar'
    ];
  }

  return config;
});
