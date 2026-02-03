const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

console.log('Using custom Webpack config...');

/**
 * Checks if the build is running in CircleCI environment
 *
 * @returns {boolean} True if the build is running in CircleCI environment
 */
function isCircleCI() {
	return process.env.CI === 'true' && process.env.CIRCLECI === 'true';
}

/**
 * Checks if the build is running in development mode
 *
 * @returns {boolean} True if the build is running in development mode
 */
function isDevelopment() {
	return process.env.NODE_ENV === 'development';
}

const isCircleEnv = isCircleCI();
const isDev = isDevelopment();

if (isCircleEnv) {
	console.log('Building in CircleCI environment');
}

if (isDev) {
	console.log('Building in development mode - optimizations disabled for faster builds');
}

module.exports = {
	resolve: {
		mainFields: ['es2016', 'browser', 'module', 'main'],
		// Force all rxjs imports to resolve to the root node_modules version
		// This fixes the DedupeModuleResolvePlugin error in Docker/CI builds
		// where @angular/core brings its own nested rxjs due to nohoist config
		alias: {
			rxjs: path.resolve(__dirname, '../../../node_modules/rxjs')
		}
	},
	// Enable persistent caching for faster rebuilds in development
	// Note: Angular's build system may handle caching differently, so this may not have full effect
	cache: isDev
		? {
				type: 'filesystem',
				buildDependencies: {
					config: [__filename]
				}
		  }
		: false,
	optimization: {
		// Disable module concatenation in development - it's slow and not needed
		concatenateModules: !isDev,
		// Only minimize in production builds
		minimize: !isCircleEnv && !isDev,
		// Only use Terser in production builds
		minimizer: isDev
			? []
			: [
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
