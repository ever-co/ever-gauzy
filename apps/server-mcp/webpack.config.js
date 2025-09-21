const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(withNx(), (config, { options }) => {
   // Check if we're building the preload script
  const isPreload = config.entry && (
    (typeof config.entry === 'string' && config.entry.includes('preload')) ||
    (typeof config.entry === 'object' && Object.keys(config.entry).some(key => key.includes('preload')))
  );

  if (isPreload) {
    // Configuration for preload script
    config.target = 'electron-preload';
    config.output = {
      ...config.output,
      // Preserve entry name so Nx keeps folder structure like 'preload/preload.js'
      filename: '[name].js',
      library: {
        type: 'commonjs2'
      }
    };

    // External dependencies for preload
    const preloadExternals = ['electron'];
    if (Array.isArray(config.externals)) {
      config.externals = [...config.externals, ...preloadExternals];
    } else if (config.externals) {
      config.externals = [config.externals, ...preloadExternals];
    } else {
      config.externals = preloadExternals;
    }

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
    const mainExternals = [
      'electron',
      'electron-log',
      'electron-store',
      'electron-updater',
      'custom-electron-titlebar'
    ];
    if (Array.isArray(config.externals)) {
      config.externals = [...config.externals, ...mainExternals];
    } else if (config.externals) {
      config.externals = [config.externals, ...mainExternals];
    } else {
      config.externals = mainExternals;
    }
  }

  return config;
});
