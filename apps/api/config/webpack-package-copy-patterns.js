const fs = require('node:fs');
const path = require('node:path');

// Directories to skip during scanning
const SKIP_DIRS = new Set([
	'node_modules',
	'.git',
	'.next',
	'dist',
	'build',
	'.nuxt',
	'.cache',
	'coverage',
	'tmp',
	'temp'
]);

// Package patterns to skip (UI packages not needed for API)
// Only exact UI packages from /packages and /packages/plugins directories
const SKIP_PACKAGES = new Set([
	// Core UI packages
	'desktop-ui-lib',
	'ui-auth',
	'ui-core',
	'ui-config',

	// Plugin UI packages
	'videos-ui',
	'public-layout-ui',
	'posthog-ui',
	'onboarding-ui',
	'maintenance-ui',
	'legal-ui',
	'job-search-ui',
	'job-proposal-ui',
	'job-employee-ui',
	'job-matching-ui',
	'integration-zapier-ui',
	'integration-upwork-ui',
	'integration-make-com-ui',
	'integration-hubstaff-ui',
	'integration-github-ui',
	'integration-ai-ui',
	'integration-activepieces-ui'
]);

/**
 * Safely read and parse a package.json file
 * @param {string} filePath - Path to package.json
 * @returns {Object|null} Parsed package.json or null if read/parse fails
 */
function readPackageJson(filePath) {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		return JSON.parse(content);
	} catch {
		return null;
	}
}

/**
 * Check if package should be skipped (UI packages, etc.)
 * @param {string} packageName - Package name
 * @returns {boolean} True if package should be skipped
 */
function shouldSkipPackage(packageName) {
	return SKIP_PACKAGES.has(packageName.toLowerCase());
}

/**
 * Check if a directory entry should be skipped during scanning
 * @param {fs.Dirent} entry - Directory entry
 * @returns {boolean} True if entry should be skipped
 */
function shouldSkipEntry(entry) {
	return (
		entry.name.startsWith('.') ||
		SKIP_DIRS.has(entry.name) ||
		entry.isSymbolicLink?.() ||
		!entry.isDirectory()
	);
}

/**
 * Get directory entries safely, returning empty array on error
 * @param {string} dir - Directory path
 * @returns {fs.Dirent[]} Array of directory entries
 */
function getDirectoryEntries(dir) {
	try {
		return fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}
}

/**
 * Process a package directory and add it to patterns if valid
 * @param {string} fullPath - Full path to package directory
 * @param {string} packageJsonPath - Path to package.json
 * @param {string} targetNodeModulesDir - Target node_modules directory
 * @param {Array} patterns - Array to add patterns to
 * @returns {number} 1 if package was skipped, 0 otherwise
 */
function processPackageDirectory(fullPath, packageJsonPath, targetNodeModulesDir, patterns) {
	const packageJson = readPackageJson(packageJsonPath);
	if (!packageJson?.name) {
		return 0;
	}

	const packageName = (packageJson.name || '').split('/').pop() || '';
	if (!packageName) {
		return 0;
	}

	if (shouldSkipPackage(packageName)) {
		return 1;
	}

	patterns.push({
		from: fullPath,
		to: path.join(targetNodeModulesDir, packageName),
		globOptions: {
			ignore: ['**/node_modules/**']
		}
	});

	return 0;
}

/**
 * Recursively collects all package directories with package.json files
 * and returns CopyWebpackPlugin-compatible patterns.
 * Optimized for speed with early exits, minimal file system calls, and UI package filtering.
 *
 * @param {string} distPackagesDir - Source directory containing built packages.
 * @param {string} targetNodeModulesDir - Destination directory inside dist/apps/api.
 * @returns {Array} Array of copy patterns for CopyWebpackPlugin.
 */
function getCopyPatterns(distPackagesDir, targetNodeModulesDir) {
	// Early exit if source doesn't exist
	if (!fs.existsSync(distPackagesDir)) {
		return [];
	}

	// Ensure the target directory exists
	if (!fs.existsSync(targetNodeModulesDir)) {
		fs.mkdirSync(targetNodeModulesDir, { recursive: true });
	}

	const patterns = [];
	let skippedCount = 0;

	const scanDir = (dir, depth = 0) => {
		// Limit recursion depth to prevent scanning deeply nested non-package directories
		if (depth > 5) {
			return;
		}

		const entries = getDirectoryEntries(dir);
		if (entries.length === 0) {
			return;
		}

		for (const entry of entries) {
			if (shouldSkipEntry(entry)) {
				continue;
			}

			const fullPath = path.join(dir, entry.name);
			const packageJsonPath = path.join(fullPath, 'package.json');

			// Check if this directory is a package
			if (fs.existsSync(packageJsonPath)) {
				skippedCount += processPackageDirectory(
					fullPath,
					packageJsonPath,
					targetNodeModulesDir,
					patterns
				);
				// Don't recurse into package directories
				continue;
			}

			// Recurse into subdirectories only if not a package
			scanDir(fullPath, depth + 1);
		}
	};

	scanDir(distPackagesDir);

	// Log skipped UI packages info
	if (skippedCount > 0) {
		console.log(`   Skipped ${skippedCount} UI package(s)`);
	}

	return patterns;
}

module.exports = { getCopyPatterns };
