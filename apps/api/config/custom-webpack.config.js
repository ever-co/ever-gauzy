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
		console.log('distPackagesDir: ' + distPackagesDir);

		// Target directory where packages are copied to
		const targetNodeModulesDir = path.resolve(
			__dirname,
			'../../../dist/apps/api/node_modules/@gauzy'
		);
		console.log('targetNodeModulesDir: ' + targetNodeModulesDir);

		// Ensure the targetNodeModulesDir exists
		if (!fs.existsSync(targetNodeModulesDir)) {
			fs.mkdirSync(targetNodeModulesDir, { recursive: true });
		}

		// Generate dynamic patterns by reading package.json of each package
		const packagePatterns = fs
			.readdirSync(distPackagesDir)
			.filter((name) => fs.statSync(path.join(distPackagesDir, name)).isDirectory())
			.map((packageDir) => {
				console.log('packageDir: ' + packageDir);
				const packageJsonPath = path.join(distPackagesDir, packageDir, 'package.json');
				console.log('packageJsonPath: ' + packageJsonPath);
				let packageName = packageDir; // Fallback to folder name

				if (fs.existsSync(packageJsonPath)) {
					const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
					console.log('packageJson: ' + JSON.stringify(packageJson));
					packageName = packageJson.name.split('/').pop(); // Extract name after the slash, if scoped
					console.log('packageName: ' + packageName);
				}

				return {
					from: path.join(distPackagesDir, packageDir), // Source package folder
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
		console.log('Copy Patterns:', packagePatterns);

		// Log final config for debugging
		// console.log('Final Webpack config:', JSON.stringify(config, null, 2));

		return config;
	}
);
