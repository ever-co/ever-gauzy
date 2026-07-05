const { composePlugins, withNx } = require('@nx/webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('node:path');
const { getCopyPatterns } = require('../../api/config/webpack-package-copy-patterns');

console.log('Using custom Webpack Config -> __dirname: ' + __dirname);
console.log('Using custom Webpack Config -> process.cwd: ' + process.cwd());

/**
 * Custom Webpack configuration for the Worker app
 * Handles:
 * - Copying built @gauzy/* packages to dist/apps/worker/node_modules
 * - Configuring watch options for development with core source files
 */

const distPackagesDir = path.resolve(__dirname, '../../../dist/packages');
const targetNodeModulesDir = path.resolve(__dirname, '../../../dist/apps/worker/node_modules/@gauzy');

module.exports = composePlugins(
	withNx({
		target: 'node' // Target for Node.js
	}),
	(config) => {
		// Configure watch options for development
		config.watchOptions = {
			ignored: [
				'**/node_modules/**',
				'**/dist/node_modules/**', // Ignore copied node_modules in dist
				'**/public/**/*',
				'**/*.spec.ts',
				'**/*.test.ts'
			],
			aggregateTimeout: 300, // Delay rebuild to batch multiple changes
			poll: false // Use native file system events for better performance
		};

		config.output = {
			...config.output,
			...(process.env.NODE_ENV !== 'production' && {
				clean: true,
				devtoolModuleFilenameTemplate: '[absolute-resource-path]'
			})
		};
		config.devtool = 'source-map';

		// ever-gauzy fix (worker CrashLoop): @nx/webpack's swc-loader (compiler-loaders.js)
		// configures `jsc` WITHOUT a `target`, so SWC falls back to its es3 default and
		// downlevels `class extends` to `_inherits`/`_call_super`. The worker's own
		// app-source `WorkerLifecycleProcessor` then invokes the prebuilt, NATIVE
		// `@gauzy/scheduler` `QueueWorkerHost` constructor as a plain function ->
		// "TypeError: Class constructor QueueWorkerHost cannot be invoked without 'new'"
		// on boot (background jobs down). Pin the swc target so the worker's app classes
		// stay native and match the prebuilt @gauzy/* packages (and @nestjs/bullmq's
		// WorkerHost), making the `super()` call a native class construction.
		const pinSwcTarget = (rules) => {
			for (const rule of rules || []) {
				if (!rule || typeof rule !== 'object') continue;
				if (String(rule.loader || '').includes('swc-loader')) {
					rule.options = rule.options || {};
					rule.options.jsc = rule.options.jsc || {};
					rule.options.jsc.target = 'es2021';
				}
				if (Array.isArray(rule.use)) {
					for (const u of rule.use) {
						if (u && typeof u === 'object' && String(u.loader || '').includes('swc-loader')) {
							u.options = u.options || {};
							u.options.jsc = u.options.jsc || {};
							u.options.jsc.target = 'es2021';
						}
					}
				}
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
