const { composePlugins, withNx } = require('@nx/webpack');
const path = require('path');

console.log('Using custom Webpack Config -> __dirname: ' + __dirname);
console.log('Using custom Webpack Config -> process.cwd: ' + process.cwd());
console.log('Using custom Webpack Config Core Path: ', path.resolve(__dirname, '../../../dist/packages/core'));

module.exports = composePlugins(
	withNx({
		target: 'node', // Target for Node.js
	}),
	(config) => {
		// Add externals configuration to exclude node_modules
		config.externals = [
			...(config.externals || [])
		];

		// Update watch options if necessary
		config.watchOptions = {
			ignored: ['**/node_modules/**', '**/dist/**', '**/public/**/*'], // Ignore node_modules and dist during watch
			aggregateTimeout: 300, // Delay rebuild slightly
			poll: false, // Disable polling
		};

		console.log('Final Webpack config:', JSON.stringify(config, null, 2));

		return config;
	}
);
