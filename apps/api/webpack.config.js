const { composePlugins, withNx } = require('@nx/webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = composePlugins(
	withNx({
		target: 'node',
	}),
	(config) => {
		config.externals = [
			...(config.externals || []),
			nodeExternals({
				allowlist: [/^@gauzy\/core$/], // Include @gauzy/core explicitly
			}),
		];
		return config;
	}
);
