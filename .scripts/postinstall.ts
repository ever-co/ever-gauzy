/* This script manually run postinstall scripts for each installed node_modules that require it
Can be used with `yarn install --ignore-scripts` where we skip running postinstall scripts
and instead manually run them one by one using this script.
You can run this script from root of mono-repo with command below:
```
yarn ts-node .scripts/postinstall.ts
```
*/

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface PackageScript {
	package: string;
	script: string;
	directory: string;
}

const nodeModulesPath = path.resolve('node_modules');
const foundScripts: PackageScript[] = [];

// Function to check for postinstall scripts in a package.json
function checkPackageScripts(dir: string): void {
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
function findPostInstallScripts(): void {
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
function runScriptsSequentially(): void {
	for (const { package: packageName, script, directory } of foundScripts) {
		console.log(`Running postinstall script for ${packageName}: ${script} in directory ${directory}`);
		try {
			execSync(`yarn run postinstall`, { stdio: 'inherit', cwd: directory });
		} catch (error) {
			console.error(`Failed to run postinstall script for ${packageName}:`, error);
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
