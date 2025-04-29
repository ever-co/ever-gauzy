/**
 * This script finds native modules (either using binding.gyp or .node binary files) inside node_modules.
 *
 * Usage:
 * ```
 * yarn node .scripts/find-native-deps.js
 * ```
 */

const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.resolve('node_modules');
const nativeModules = [];

// Check if a directory contains native bindings
function checkNativeBindings(dir) {
	const bindingGypPath = path.join(dir, 'binding.gyp');
	const binaryFiles = fs.readdirSync(dir).filter((file) => file.endsWith('.node'));

	if (fs.existsSync(bindingGypPath)) {
		nativeModules.push({ package: path.basename(dir), directory: dir, type: 'gyp' });
	}

	if (binaryFiles.length > 0) {
		nativeModules.push({ package: path.basename(dir), directory: dir, type: 'binary' });
	}
}

// Traverse node_modules for native modules
function findNativeModules() {
	if (!fs.existsSync(nodeModulesPath)) {
		console.error('node_modules directory not found. Please run yarn install first.');
		return;
	}

	fs.readdirSync(nodeModulesPath).forEach((subDir) => {
		const packagePath = path.join(nodeModulesPath, subDir);

		// Skip non-directories
		if (!fs.statSync(packagePath).isDirectory()) {
			return;
		}

		if (subDir.startsWith('@')) {
			// Scoped packages
			fs.readdirSync(packagePath).forEach((scopedPackage) => {
				const scopedPackagePath = path.join(packagePath, scopedPackage);
				if (fs.statSync(scopedPackagePath).isDirectory()) {
					checkNativeBindings(scopedPackagePath);
				}
			});
		} else {
			checkNativeBindings(packagePath);
		}
	});
}

// Main execution
findNativeModules();

if (nativeModules.length > 0) {
	console.log(`Found ${nativeModules.length} native dependencies:`);
	nativeModules.forEach(({ package: pkg, directory, type }) => {
		console.log(`- ${pkg} [${type}] (${directory})`);
	});
} else {
	console.log('No native dependencies found.');
}
