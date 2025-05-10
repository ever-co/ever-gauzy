const { composePlugins, withNx } = require('@nx/webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const { getCopyPatterns } = require('./get-copy-patterns');

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

		// Source directory where packages are built
		const distPackagesDir = path.resolve(__dirname, '../../../dist/packages');
		const targetNodeModulesDir = path.resolve(__dirname, '../../../dist/apps/api/node_modules/@gauzy');

		// Get copy patterns from utility function
		console.time('✔️ Copying all built package folders to dist node_modules');
		const packagePatterns = getCopyPatterns(distPackagesDir, targetNodeModulesDir);
		console.timeEnd('✔️ Copying all built package folders to dist node_modules');

		// Add CopyWebpackPlugin with the generated patterns
		config.plugins.push(
			new CopyWebpackPlugin({ patterns: packagePatterns })
		);

		return config;
	}
);
