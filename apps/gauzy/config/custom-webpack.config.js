const TerserPlugin = require('terser-webpack-plugin');

console.log('Using custom Webpack config...');

module.exports = {
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				parallel: false,
			}),
		],
	},
};
