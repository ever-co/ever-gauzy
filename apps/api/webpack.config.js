const { composePlugins, withNx } = require('@nx/webpack');

// Nx plugins for webpack.
module.exports = composePlugins(
	withNx({
		target: 'node'
	}),
	(config) => {
		// Add externals configuration
		config.externals = [
			...(config.externals || [])
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
