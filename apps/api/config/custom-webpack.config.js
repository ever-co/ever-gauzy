const { composePlugins, withNx } = require('@nx/webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const fs = require('fs');

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

		// Ensure the targetNodeModulesDir exists
		if (!fs.existsSync(targetNodeModulesDir)) {
			fs.mkdirSync(targetNodeModulesDir, { recursive: true });
		}

		// Helper function to read nested package.json files
		const getPackages = (baseDir) => {
			const results = [];
			// Recursively scan the directory for package.json files
			const scanDir = (dir) => {
				fs.readdirSync(dir).forEach((item) => {
					const fullPath = path.join(dir, item);
					if (fs.statSync(fullPath).isDirectory()) {
						const packageJsonPath = path.join(fullPath, 'package.json');
						if (fs.existsSync(packageJsonPath)) {
							results.push(fullPath);
						} else {
							scanDir(fullPath); // Recurse further into subdirectories
						}
					}
				});
			};
			// Start scanning the directory
			scanDir(baseDir);
			return results;
		};

		// Collect all packages (top-level and nested)
		const allPackageDirs = getPackages(distPackagesDir);

		// Generate dynamic patterns
		const packagePatterns = allPackageDirs.map((packageDir) => {
			const packageJsonPath = path.join(packageDir, 'package.json');
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
			const packageName = packageJson.name.split('/').pop(); // Extract name after slash

			return {
				from: packageDir, // Source package folder
				to: path.join(targetNodeModulesDir, packageName), // Destination folder
				globOptions: {
					ignore: ['**/node_modules/**'], // Ignore unnecessary files
				},
			};
		});

		// Add CopyWebpackPlugin with the generated patterns
		config.plugins.push(
			new CopyWebpackPlugin({
				patterns: packagePatterns,
			})
		);

		// Log for debugging
		// console.log('Copy Patterns:', packagePatterns);

		// Log final config for debugging
		// console.log('Final Webpack config:', JSON.stringify(config, null, 2));

		return config;
	}
);
