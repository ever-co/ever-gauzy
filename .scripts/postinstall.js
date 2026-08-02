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

/**
 * Packages that MUST end up with a loadable `.node` binary, or the build is wrong.
 *
 * Deliberately narrower than `nativePackages`, because "we rebuild it" and "it owns a
 * binary" are not the same thing:
 *
 * - `better-sqlite3` — the API image sets `ENV DB_TYPE=better-sqlite3`, so without this
 *   binary the container cannot open its database at all.
 * - `bcrypt` — password hashing; every login path needs it.
 *
 * Not required, and why:
 * - `@sentry/profiling-node` — from v10 it has no `install` script and ships no binary
 *   of its own; the native part moved to `@sentry-internal/node-cpu-profiler`, which
 *   carries prebuilt binaries. Demanding a binary here would fail every build.
 * - `active-win` — desktop-only, and pruned by `--production` in the API image.
 */
const packagesRequiringBinary = new Set(['better-sqlite3', 'bcrypt']);

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
/**
 * Whether a native package has produced a loadable binary.
 *
 * `prebuild-install` drops it in a `prebuilds` folder, `node-gyp` in `build/Release`, and a
 * few packages keep it elsewhere — so this looks for any `.node` anywhere under the
 * package rather than assuming one layout.
 *
 * @param {string} packagePath - Absolute path of the installed package.
 * @returns {string|null} Path of the first binary found, or `null`.
 */
function findNativeBinary(packagePath) {
	const stack = [packagePath];
	while (stack.length) {
		const dir = stack.pop();
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			// Nested node_modules would report a DEPENDENCY's binary as ours.
			if (entry.isDirectory() && entry.name !== 'node_modules') {
				stack.push(path.join(dir, entry.name));
			} else if (entry.isFile() && entry.name.endsWith('.node')) {
				return path.join(dir, entry.name);
			}
		}
	}
	return null;
}

/**
 * Builds the native packages that `--ignore-scripts` skipped, and FAILS if one of
 * them ends up without a binary.
 *
 * Why this is not `yarn add <pkg> --force` any more: that ran with `cwd` set to the
 * package's own directory, so yarn treated `node_modules/better-sqlite3` as a project
 * root and tried to add the package as a dependency of itself. It never invoked
 * node-gyp, and every failure was caught and logged, so the build went green either
 * way. The result was images that shipped without `better_sqlite3.node` — and since
 * the API image sets `ENV DB_TYPE=better-sqlite3`, such an image cannot open its
 * database at all unless the deployment overrides `DB_TYPE`.
 *
 * `npm rebuild` from the workspace root is the supported way: it runs each package's
 * own `install`/`rebuild` lifecycle. That matters because these packages hang their
 * build off `install`, not `postinstall` — better-sqlite3's is
 * `prebuild-install || node-gyp rebuild --release` — which is why the
 * postinstall-only scan above never sees them.
 */
function handleNativePackages() {
	console.log('Handling native packages...');

	const installed = [];
	for (const packageName of nativePackages) {
		const packagePath = path.join(nodeModulesPath, packageName);
		if (!fs.existsSync(path.join(packagePath, 'package.json'))) {
			// Legitimately absent: `--production` prunes some of these.
			console.warn(`Native package ${packageName} is not installed. Skipping.`);
			continue;
		}
		installed.push({ packageName, packagePath });
	}

	if (!installed.length) {
		console.log('No native packages present.');
		return;
	}

	const names = installed.map((p) => p.packageName);
	console.log(`Rebuilding native packages: ${names.join(', ')}`);
	try {
		// Root cwd, not the package's own directory.
		execSync(`npm rebuild ${names.join(' ')}`, { stdio: 'inherit' });
	} catch (error) {
		// Not fatal on its own — the verification below decides. A package that
		// already carries a valid prebuilt binary can fail `npm rebuild` (no
		// toolchain present) and still be perfectly usable.
		console.error('npm rebuild reported a failure; verifying binaries anyway:', error.message);
	}

	const missing = [];
	for (const { packageName, packagePath } of installed) {
		const binary = findNativeBinary(packagePath);
		const required = packagesRequiringBinary.has(packageName);
		if (binary) {
			console.log(`  ✔ ${packageName} → ${path.relative(nodeModulesPath, binary)}`);
		} else if (required) {
			console.error(`  ✖ ${packageName} produced NO native binary`);
			missing.push(packageName);
		} else {
			// Expected for packages whose native half lives in a sibling package.
			console.log(`  – ${packageName} has no binary of its own (not required)`);
		}
	}

	if (missing.length) {
		// Fail loudly. This used to be swallowed, which is precisely how a broken
		// image reached an environment: the build was green and the fault only
		// surfaced later as a runtime failure to open the database.
		throw new Error(
			`Native package(s) built no binary: ${missing.join(', ')}. ` +
				`The image would start without them and fail at runtime, so the build is stopped here.`
		);
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
