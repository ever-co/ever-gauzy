const { composePlugins, withNx } = require('@nx/webpack');

console.log('Using custom Webpack Config -> __dirname: ' + __dirname);
console.log('Using custom Webpack Config -> process.cwd: ' + process.cwd());

module.exports = composePlugins(
	withNx({
		target: 'node', // Target for Node.js
	}),
	(config) => {
		// Watch options
		config.watchOptions = {
			ignored: ['**/node_modules/**', '**/dist/**', '**/public/**/*'], // Ignore unnecessary folders
			aggregateTimeout: 300, // Delay rebuild slightly
			poll: false, // Disable polling
		};

		// console.log('Final Webpack config:', JSON.stringify(config, null, 2));

		return config;
	}
);
