const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(withNx(), (config) => {
  // Update the webpack config as needed here.
  // e.g. `config.plugins.push(new MyPlugin())`

  // Ensure proper handling of ES modules
  config.experiments = {
    ...config.experiments,
    outputModule: true,
  };

  config.output = {
    ...config.output,
    library: {
      ...config.output?.library,
      type: 'module'
    }
  };

  // Handle node modules
  config.target = 'electron-main';

  // External dependencies that should not be bundled
  config.externals = [
    'electron',
    'electron-log',
    'electron-store',
    'electron-updater',
    'custom-electron-titlebar'
  ];

  return config;
});
