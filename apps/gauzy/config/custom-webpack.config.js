const TerserPlugin = require('terser-webpack-plugin');

console.log('Using custom Webpack config...');

function isCircleCI() {
	return process.env.CI === 'true' && process.env.CIRCLECI === 'true';
}

const isCircleEnv = isCircleCI();

if (isCircleEnv) {
	console.log('Building in CircleCI environment');
}

module.exports = {
	resolve: {
		mainFields: ['es2016', 'browser', 'module', 'main']
	},
	optimization: {
		concatenateModules: true, // Enable module concatenation for better performance
		// for now let's disable minimize in CircleCI
		minimize: !isCircleCI,
		minimizer: [
			new TerserPlugin({
				parallel: isCircleEnv ? 2 : true, // Use all available CPUs
				terserOptions: {
					sourceMap: !isCircleEnv,
					compress: {
						passes: 2 // Multiple passes for better minification
					}
				},
				extractComments: !isCircleEnv
			})
		]
	}
};
