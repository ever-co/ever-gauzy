/**
 * Cases for the desktop apps' electron-builder `asarUnpack` lists: a native module whose shared libraries
 * electron-builder's smart unpack misses must be unpacked explicitly by every app that packages it.
 *
 * electron-builder takes a package out of app.asar on its own only when one of its files ends in .dll, .exe, .dylib,
 * .so or .node (`isLibOrExe` in app-builder-lib/out/asar/unpackDetector.js). sharp's Linux libvips carries its version
 * after `.so` (`@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.42`), so it stayed inside app.asar while sharp's `.node`
 * addon was unpacked, and the addon could not load it: Ever Gauzy Desktop stopped on Linux with `Could not load the
 * "sharp" module using the linux-x64 runtime` (ERR_DLOPEN_FAILED, #9167). macOS (.dylib) and Windows (.dll) were
 * unpacked already. sharp's installation docs ask Electron apps to unpack both directories, with these patterns.
 *
 * An app needs the rule when its packaged dependencies reach the module, directly or through a workspace package
 * (`@gauzy/core` and `@gauzy/plugin-docs` depend on sharp). A new rule is one more entry in NATIVE_UNPACK_RULES.
 *
 * Nothing here needs node_modules: the static checks job runs without an install.
 *
 * Run: `node --test tools/electron/asar-unpack.test.js`
 *
 * cspell:words libvips
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

/** Native modules the smart unpack misses on some platform, with the `asarUnpack` patterns each one needs. */
const NATIVE_UNPACK_RULES = [
	{
		dependency: 'sharp',
		patterns: ['**/node_modules/sharp/**/*', '**/node_modules/@img/**/*'],
		why: "libvips' versioned .so on Linux (#9167)"
	}
];

/** The apps known to package sharp through @gauzy/core: if the scan below stops finding them, it is broken. */
const KNOWN_SHARP_APPS = ['desktop', 'server', 'server-api'];

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** The `package.json` files directly under each directory of `dir` (relative to the repository root). */
function packageJsonsUnder(dir) {
	const absolute = path.join(ROOT, dir);
	return fs
		.readdirSync(absolute, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(absolute, entry.name, 'package.json'))
		.filter((file) => fs.existsSync(file));
}

/** The workspace packages by name, with the names of their runtime dependencies. */
function workspacePackages() {
	const packages = new Map();
	for (const file of [...packageJsonsUnder('packages'), ...packageJsonsUnder(path.join('packages', 'plugins'))]) {
		const pkg = readJson(file);
		if (pkg.name) packages.set(pkg.name, runtimeDependencies(pkg));
	}
	return packages;
}

/** The names a package installs at runtime (an electron-builder app installs these into its app.asar). */
function runtimeDependencies(pkg) {
	return Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies });
}

/** Whether `dependencies` reach `target` directly or through the workspace packages among them. */
function reaches(dependencies, target, workspace, seen = new Set()) {
	return dependencies.some((name) => {
		if (name === target) return true;
		if (!workspace.has(name) || seen.has(name)) return false;
		seen.add(name);
		return reaches(workspace.get(name), target, workspace, seen);
	});
}

/** The electron-builder apps: every `apps/<app>/src/package.json` with a `build` section. */
function electronApps() {
	return fs
		.readdirSync(path.join(ROOT, 'apps'), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => ({ name: entry.name, file: path.join(ROOT, 'apps', entry.name, 'src', 'package.json') }))
		.filter(({ file }) => fs.existsSync(file))
		.map(({ name, file }) => ({ name, pkg: readJson(file) }))
		.filter(({ pkg }) => pkg.build);
}

const workspace = workspacePackages();
const apps = electronApps();

/** The apps whose packaged dependencies reach `dependency`. */
const appsPackaging = (dependency) =>
	apps.filter(({ pkg }) => reaches(runtimeDependencies(pkg), dependency, workspace)).map(({ name }) => name);

test('the scan finds the apps that package sharp through @gauzy/core', () => {
	const found = appsPackaging('sharp');

	for (const app of KNOWN_SHARP_APPS) {
		assert.ok(
			found.includes(app),
			`apps/${app} packages @gauzy/core (and so sharp) but the scan missed it: ${found}`
		);
	}
});

for (const rule of NATIVE_UNPACK_RULES) {
	for (const app of appsPackaging(rule.dependency)) {
		test(`apps/${app} unpacks ${rule.dependency} from app.asar (${rule.why})`, () => {
			const { pkg } = apps.find((entry) => entry.name === app);
			// The top-level list applies on every platform; electron-builder adds a platform's own list (mac's
			// `**/*.node`) to it rather than replacing it.
			const asarUnpack = [].concat(pkg.build.asarUnpack || []);
			const missing = rule.patterns.filter((pattern) => !asarUnpack.includes(pattern));

			assert.deepEqual(
				missing,
				[],
				`apps/${app}/src/package.json packages ${rule.dependency} but its build.asarUnpack lacks ` +
					`${missing.join(', ')}: the module fails to load from app.asar (${rule.why}).`
			);
		});
	}
}
