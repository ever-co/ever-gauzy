/**
 * This script manually runs postinstall scripts for each installed node_modules that require it.
 * Can be used with `yarn install --ignore-scripts` where we skip running postinstall scripts
 * and instead manually run them one by one using this script.
 *
 * Usage:
 * ```
 * yarn node .scripts/postinstall.js
 * ```
 *
 * Note: if you want to get list of native packages that need to be added to `nativePackages` const,
 * please run:
 * ```
 * yarn node .scripts/find-native-deps.js
 * ```
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nodeModulesPath = path.resolve('node_modules');
const foundScripts = [];

// List of native packages to always handle
const nativePackages = ['@sentry/profiling-node', 'bcrypt', 'better-sqlite3', 'active-win'];

// Function to check for postinstall scripts in a package.json
function checkPackageScripts(dir) {
	const packageJsonPath = path.join(dir, 'package.json');
	if (fs.existsSync(packageJsonPath)) {
		try {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
			if (packageJson.scripts && packageJson.scripts.postinstall) {
				foundScripts.push({
					package: packageJson.name || dir,
					script: packageJson.scripts.postinstall,
					directory: dir
				});
			}
		} catch (error) {
			console.error(`Error parsing package.json at ${packageJsonPath}:`, error);
		}
	}
}

// Traverse node_modules and collect postinstall scripts
function findPostInstallScripts() {
	console.log(`Checking node_modules path: ${nodeModulesPath}`);
	if (!fs.existsSync(nodeModulesPath)) {
		console.error('node_modules directory not found. Please run yarn install first.');
		return;
	}

	fs.readdirSync(nodeModulesPath).forEach((subDir) => {
		const packagePath = path.join(nodeModulesPath, subDir);

		if (subDir.startsWith('@')) {
			// Scoped packages
			fs.readdirSync(packagePath).forEach((scopedPackage) => {
				checkPackageScripts(path.join(packagePath, scopedPackage));
			});
		} else {
			checkPackageScripts(packagePath);
		}
	});
}

// Execute found scripts sequentially in their respective directories
function runScriptsSequentially() {
	for (const { package: packageName, script, directory } of foundScripts) {
		console.log(`Running postinstall script for ${packageName}: ${script} in directory ${directory}`);
		try {
			execSync(`yarn run postinstall`, { stdio: 'inherit', cwd: directory });
		} catch (error) {
			console.error(`Failed to run postinstall script for ${packageName}:`, error);
		}
	}
}

// Rebuild or force install native packages
function handleNativePackages() {
	console.log('Handling native packages...');
	for (const packageName of nativePackages) {
		const packagePath = path.join(nodeModulesPath, packageName);

		console.log(`Checking path for ${packageName}: ${packagePath}`);

		if (fs.existsSync(packagePath)) {
			const packageJsonPath = path.join(packagePath, 'package.json');
			console.log(`Checking package.json for ${packageName}: ${packageJsonPath}`);

			if (fs.existsSync(packageJsonPath)) {
				console.log(`Rebuilding native package: ${packageName} in ${packagePath}`);
				try {
					execSync(`yarn add ${packageName} --force`, { stdio: 'inherit', cwd: packagePath });
				} catch (error) {
					console.error(`Failed to rebuild native package ${packageName}:`, error);
				}
			} else {
				console.warn(`Native package ${packageName} does not have a package.json at ${packageJsonPath}. Skipping.`);
			}
		} else {
			console.warn(`Native package ${packageName} is not installed in ${packagePath}. Skipping.`);
		}
	}
}

// Main execution
findPostInstallScripts();

if (foundScripts.length > 0) {
	console.log(`Found ${foundScripts.length} postinstall scripts. Executing them sequentially...`);
	runScriptsSequentially();
} else {
	console.log('No postinstall scripts found.');
}

// Always handle native packages after running postinstall scripts
handleNativePackages();
