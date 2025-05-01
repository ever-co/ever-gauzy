const fs = require('fs');
const path = require('path');

/**
 * Recursively collects all package directories with package.json files
 * and returns CopyWebpackPlugin-compatible patterns.
 *
 * @param {string} distPackagesDir - Source directory containing built packages.
 * @param {string} targetNodeModulesDir - Destination directory inside dist/apps/api.
 * @returns {Array} Array of copy patterns for CopyWebpackPlugin.
 */
function getCopyPatterns(distPackagesDir, targetNodeModulesDir) {
	// Ensure the target directory exists
	if (!fs.existsSync(targetNodeModulesDir)) {
		fs.mkdirSync(targetNodeModulesDir, { recursive: true });
	}

	// Helper: recursively find folders with package.json
	const getPackages = (baseDir) => {
		const results = [];
		const scanDir = (dir) => {
			fs.readdirSync(dir).forEach((item) => {
				const fullPath = path.join(dir, item);
				if (fs.statSync(fullPath).isDirectory()) {
					const packageJsonPath = path.join(fullPath, 'package.json');
					if (fs.existsSync(packageJsonPath)) {
						results.push(fullPath);
					} else {
						scanDir(fullPath);
					}
				}
			});
		};
		scanDir(baseDir);
		return results;
	};

	const allPackageDirs = getPackages(distPackagesDir);

	// Generate CopyWebpackPlugin patterns
	return allPackageDirs.map((packageDir) => {
		const packageJsonPath = path.join(packageDir, 'package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
		const packageName = (packageJson.name || '').split('/').pop() || '';

		return {
			from: packageDir,
			to: path.join(targetNodeModulesDir, packageName),
			globOptions: {
				ignore: ['**/node_modules/**']
			}
		};
	});
}

module.exports = { getCopyPatterns };
