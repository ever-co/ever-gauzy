const { composePlugins, withNx } = require('@nx/webpack');
const nodeExternals = require('webpack-node-externals');

// Nx plugins for webpack.
module.exports = composePlugins(
	withNx({
		target: 'node'
	}),
	(config) => {
		// Add externals configuration
		config.externals = [
			...(config.externals || []),
			nodeExternals({
				allowlist: [/^@gauzy\/core$/], // Include @gauzy/core explicitly
			}),
		];

		// Disable watch for the 'public' folder
		config.watchOptions = {
			ignored: ['**/public/**/*'], // Ignore changes in the 'public' folder
			aggregateTimeout: 300, // Delay rebuild after the first change (optional)
			poll: false, // Use polling or not
		};

		// Update the webpack config as needed here.
		// e.g. `config.plugins.push(new MyPlugin())`
		return config;
	}
);