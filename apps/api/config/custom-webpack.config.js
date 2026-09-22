const { composePlugins, withNx } = require('@nx/webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('node:path');
const { getCopyPatterns } = require('./webpack-package-copy-patterns');

console.log('Using custom Webpack Config -> __dirname: ' + __dirname);
console.log('Using custom Webpack Config -> process.cwd: ' + process.cwd());

/**
 * Custom Webpack configuration for the API app
 * Handles:
 * - Copying built @gauzy/* packages to dist/apps/api/node_modules
 * - Configuring watch options for development with core source files
 */

const distPackagesDir = path.resolve(__dirname, '../../../dist/packages');
const targetNodeModulesDir = path.resolve(__dirname, '../../../dist/apps/api/node_modules/@gauzy');

module.exports = composePlugins(
	withNx({
		target: 'node' // Target for Node.js
	}),
	(config) => {
		// Configure watch options for development
		// Watches core source files for automatic restart via tsconfig-paths resolution
		config.watchOptions = {
			ignored: [
				'**/node_modules/**',
				'**/dist/node_modules/**', // Ignore copied node_modules in dist
				'**/public/**/*',
				'**/*.spec.ts',
				'**/*.test.ts'
				// Note: packages/core/src/**/*.ts is NOT ignored
				// webpack watches it automatically because @gauzy/core resolves to source via tsconfig-paths
			],
			aggregateTimeout: 300, // Delay rebuild to batch multiple changes
			poll: false // Use native file system events for better performance
		};

		// ever-gauzy fix (same as apps/worker/config/webpack.config.js): @nx/webpack's swc-loader
		// configures `jsc` WITHOUT a `target`, so SWC falls back to its es3 default and lowers
		// `class extends` to `_inherits`/`_call_super`. Any app-source class that extends a
		// prebuilt, NATIVE `@gauzy/*` class then dies on boot with "Class constructor X cannot be
		// invoked without 'new'". It bites the API whenever a workspace package is bundled instead
		// of externalized — e.g. a new plugin whose `node_modules/@gauzy/<pkg>` link is missing
		// (`AiProviderGroqPlugin extends BaseAiProviderPlugin`, 2026-08). Pin the target so the
		// API's own classes stay native and match the prebuilt packages.
		const setSwcTargetOnEntry = (entry) => {
			if (entry && typeof entry === 'object' && String(entry.loader || '').includes('swc-loader')) {
				entry.options = entry.options || {};
				entry.options.jsc = entry.options.jsc || {};
				entry.options.jsc.target = 'es2021';
			}
		};
		const pinSwcTarget = (rules) => {
			for (const rule of rules || []) {
				if (!rule || typeof rule !== 'object') continue;
				setSwcTargetOnEntry(rule); // rule with a top-level `loader`
				// `use` can be a single loader object or an array of them
				if (Array.isArray(rule.use)) rule.use.forEach(setSwcTargetOnEntry);
				else setSwcTargetOnEntry(rule.use);
				if (Array.isArray(rule.oneOf)) pinSwcTarget(rule.oneOf);
				if (Array.isArray(rule.rules)) pinSwcTarget(rule.rules);
			}
		};
		pinSwcTarget(config.module && config.module.rules);

		// Generate copy patterns for built packages
		// Logs timing to track performance
		console.time('✔️ Copying all built package folders to dist node_modules');
		const packagePatterns = getCopyPatterns(distPackagesDir, targetNodeModulesDir);
		console.timeEnd('✔️ Copying all built package folders to dist node_modules');

		// Log number of packages being copied
		if (packagePatterns.length > 0) {
			console.log(`   Found and copying ${packagePatterns.length} package(s)`);
		}

		// Add CopyWebpackPlugin with the generated patterns
		config.plugins.push(new CopyWebpackPlugin({ patterns: packagePatterns }));

		return config;
	}
);
