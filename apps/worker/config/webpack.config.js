const { composePlugins, withNx } = require('@nx/webpack');

// Nx plugins for webpack.
module.exports = composePlugins(
	withNx({
		target: 'node'
	}),
	(config) => {
		config.output = {
			...config.output,
			...(process.env.NODE_ENV !== 'production' && {
				clean: true,
				devtoolModuleFilenameTemplate: '[absolute-resource-path]'
			})
		};
		config.devtool = 'source-map';
		// Update the webpack config as needed here.
		// e.g. `config.plugins.push(new MyPlugin())`
		return config;
	}
);
