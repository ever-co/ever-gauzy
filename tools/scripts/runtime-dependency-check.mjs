#!/usr/bin/env node
/**
 * Gate: every package the API and worker images load at runtime is one their production install provides.
 *
 * The deploy images assemble their runtime `node_modules` from `yarn install --production` over the root
 * `package.json` and the workspace manifests their `prod-dependencies` stage copies. A devDependency is not
 * installed there. A package that runtime code imports but that only a devDependency declares is present in every
 * development checkout, in every CI job that does a full install, in the unit suites and in a local boot — and is
 * missing in exactly one place, the deployed container. The feat branch's API image stopped 10 s after start with
 * `Error: Cannot find module 'rimraf'` (core's seed utilities import it; rimraf 6 was a devDependency of core and of
 * the root). develop had never failed only by accident: rimraf 3 reached its production tree through other packages
 * and the root's devDependency was rimraf 3 as well, so the one copy was hoisted to the root.
 *
 * For each image the check
 *
 *   1. reads the manifests its `prod-dependencies` stage copies (`COPY … <dir>/package.json …`) plus the root's —
 *      what the image INSTALLS;
 *   2. follows the `@gauzy/*` imports from the image's app (`apps/api`, `apps/worker`) through the workspaces' sources —
 *      what the image LOADS. The two differ: the worker's webpack build copies the commerce plugins it loads, but its
 *      Dockerfile installs none of their manifests;
 *   3. reads every value import of the non-test sources of each loaded workspace (`<dir>/src/**`): `import … from`,
 *      `import '…'`, `export … from`, `require('…')` and `import('…')`. `import type` / `export type` and imports
 *      whose specifiers are all `type` are erased by the compiler and skipped, as are comments;
 *   4. accepts an imported package only when the image is sure to hold it where the importer looks:
 *        - the importing workspace's manifest is installed and declares it in `dependencies` / `optionalDependencies`
 *          (the Dockerfile re-nests a workspace's own node_modules beside its build), or
 *        - the root declares it in `dependencies` / `optionalDependencies` (it is then the root copy), or
 *        - some installed manifest declares it in `dependencies` / `optionalDependencies` and every installed manifest
 *          that declares it — devDependencies included — resolves the same version, so the one copy is hoisted to the
 *          root, where every workspace finds it.
 *      A package that reaches the image only through another package's dependencies is refused: whether it lands at
 *      the root is up to the hoister, and a devDependency of another version claims the root first. That is the
 *      rimraf failure — rimraf 3 came in transitively, rimraf 6 (a root devDependency) took the root slot, and the
 *      production install, which leaves devDependencies out, left the slot empty.
 *
 * What it cannot see: a value import whose bindings are only ever used as types (the compiler drops it too). Write
 * such an import as `import type` — then the code says what the compiler does. A real runtime import of a package
 * the image does not install is fixed by declaring it in the importing workspace's `dependencies` (and, when that
 * workspace's manifest is not installed in the image, by installing it: the Dockerfile's three places).
 *
 * Reads the tree with `node:fs` alone — no install. Run from the repository root:
 * `node tools/scripts/runtime-dependency-check.mjs` (cases: `node --test tools/scripts/runtime-dependency-check.test.mjs`).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const IMAGES = [
	{ dockerfile: '.deploy/api/Dockerfile', app: 'apps/api' },
	{ dockerfile: '.deploy/worker/Dockerfile', app: 'apps/worker' }
];
const BUILTINS = new Set(builtinModules);

const RUNTIME_SECTIONS = ['dependencies', 'optionalDependencies'];
// What an install puts on disk. A peer range is a promise that someone else installs the package; it is not one.
const INSTALLED_SECTIONS = [...RUNTIME_SECTIONS, 'devDependencies'];

/** Files that are never part of a built image: specs, test helpers and fixtures, declarations, stories. */
const NOT_RUNTIME = [
	/\.(spec|test|e2e-spec|stories)\.[cm]?[jt]sx?$/,
	/\.d\.ts$/,
	/(^|\/)(test|tests|__tests__|__mocks__|testing|e2e|fixtures)\//,
	/(^|\/)(jest\.config|test-setup|jest\.setup)\.[cm]?[jt]s$/
];

/**
 * A yarn v1 lockfile as `name@range -> { version, dependencies: [[dependency, range], …] }`.
 *
 * An entry's header lists every range it satisfies (`"a@^1.0.0", "a@^1.1.0":`); its `version` line is two spaces in,
 * its `dependencies:` and `optionalDependencies:` blocks list one `name "range"` per line, four spaces in.
 *
 * @param {string} text The lockfile.
 * @returns {Map<string, {version: string | null, dependencies: string[][]}>}
 */
export function parseLockfile(text) {
	let entries = new Map();
	let current = null;
	let collecting = false;

	for (const line of text.split(/\r?\n/)) {
		if (!line || line.startsWith('#')) continue;

		if (!line.startsWith(' ')) {
			current = { version: null, dependencies: [] };
			collecting = false;
			for (const key of line.replace(/:$/, '').split(', '))
				entries.set(key.trim().replace(/^"|"$/g, ''), current);
			continue;
		}

		if (/^ {2}\S/.test(line)) {
			collecting = /^ {2}(dependencies|optionalDependencies):$/.test(line);
			const version = /^ {2}version "?([^"]+)"?$/.exec(line);
			if (version) current.version = version[1];
			continue;
		}

		if (collecting && /^ {4}\S/.test(line)) {
			const match = /^ {4}(?:"([^"]+)"|(\S+))\s+"?([^"]*)"?$/.exec(line);
			if (match) current.dependencies.push([match[1] ?? match[2], match[3]]);
		}
	}

	return entries;
}

/**
 * The workspace directories a Dockerfile's `prod-dependencies` stage copies a manifest of.
 *
 * @param {string} text The Dockerfile.
 * @returns {string[]} Directories relative to the repository root, e.g. `packages/core`.
 */
export function productionWorkspaces(text) {
	const stage = text.split(/^FROM\s/m).find((block) => /\sAS\s+prod-dependencies\b/i.test(block.split('\n')[0]));

	if (!stage) throw new Error('no "prod-dependencies" stage — the gate cannot tell what the image installs');

	return [...stage.matchAll(/^COPY\s+(?:--\S+\s+)*(\S+)\/package\.json\s/gm)].map((match) =>
		match[1].replace(/^\.\//, '')
	);
}

/** The source without comments; string and template contents are kept (the specifiers live there). */
export function stripComments(source) {
	let out = '';
	let quote = null;

	for (let i = 0; i < source.length; i++) {
		const char = source[i];

		if (quote) {
			out += char;
			if (char === '\\') out += source[++i] ?? '';
			else if (char === quote) quote = null;
			continue;
		}

		if (char === '/' && source[i + 1] === '/') {
			while (i < source.length && source[i] !== '\n') i++;
			out += '\n';
			continue;
		}

		if (char === '/' && source[i + 1] === '*') {
			const end = source.indexOf('*/', i + 2);
			const comment = source.slice(i, end === -1 ? source.length : end + 2);
			out += comment.replace(/[^\n]/g, ' ');
			i = end === -1 ? source.length : end + 1;
			continue;
		}

		if (char === "'" || char === '"' || char === '`') quote = char;
		out += char;
	}

	return out;
}

/** The package a bare specifier names (`@scope/name/deep` -> `@scope/name`), or null for a relative one. */
export function packageOf(specifier) {
	if (/^[./]/.test(specifier) || specifier.startsWith('node:')) return null;
	const parts = specifier.split('/');
	return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * The packages a source file loads at runtime: Node built-ins and relative specifiers excluded.
 *
 * @param {string} source The file's text.
 * @returns {string[]} Package names, each once.
 */
export function runtimeImports(source) {
	const code = stripComments(source);
	let found = new Set();

	// import … from '…' / export … from '…' — the clause decides whether the compiler keeps it.
	for (const match of code.matchAll(/(?:^|[;\n}])\s*(import|export)\s+([^;'"`]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
		const clause = match[2].trim();
		if (/^type\s/.test(clause)) continue;
		const braces = /^\{([^}]*)\}$/.exec(clause);
		if (braces) {
			const specifiers = braces[1]
				.split(',')
				.map((part) => part.trim())
				.filter(Boolean);
			if (specifiers.length && specifiers.every((part) => /^type\s/.test(part))) continue;
		}
		found.add(match[3]);
	}

	// import '…' (side effect), require('…'), import('…')
	for (const match of code.matchAll(/(?:^|[;\n}])\s*import\s*['"]([^'"]+)['"]/g)) found.add(match[1]);
	for (const match of code.matchAll(/(?<![\w$.])(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g))
		found.add(match[1]);

	return [...new Set([...found].map(packageOf))].filter((name) => name && !BUILTINS.has(name));
}

/**
 * Whether an image holds `name` where a file of the importing workspace looks for it (rules in the header).
 *
 * @param {string} name The imported package.
 * @param {object | null} importer The importing workspace's manifest when the image installs it, else null.
 * @param {object} rootManifest The root `package.json`.
 * @param {object[]} installed The workspace manifests the image installs.
 * @param {Map} lock The parsed lockfile.
 * @returns {string | null} null when the image holds it, else why it may not.
 */
export function whyMissing(name, importer, rootManifest, installed, lock) {
	if (importer && RUNTIME_SECTIONS.some((section) => importer[section]?.[name])) return null;
	if (RUNTIME_SECTIONS.some((section) => rootManifest[section]?.[name])) return null;

	let declarations = [];
	for (const manifest of [rootManifest, ...installed]) {
		for (const section of INSTALLED_SECTIONS) {
			const range = manifest[section]?.[name];
			if (range === undefined) continue;
			const version = lock.get(`${name}@${range}`)?.version ?? String(range);
			declarations.push({ manifest: manifest === rootManifest ? 'root' : manifest.name, section, version });
		}
	}

	const runtime = declarations.filter(({ section }) => RUNTIME_SECTIONS.includes(section));
	if (!runtime.length) {
		return declarations.length
			? `declared only as ${[...new Set(declarations.map(({ section }) => section))].join('/')} (${declarations
					.map(({ manifest, version }) => `${manifest} ${version}`)
					.join(', ')}) — a production install leaves it out`
			: 'declared by no manifest the image installs — present only if another package happens to bring it';
	}

	const versions = new Set(declarations.map(({ version }) => version));
	if (versions.size === 1) return null;

	return `declared at ${versions.size} versions (${declarations
		.map(({ manifest, section, version }) => `${manifest} ${section} ${version}`)
		.join(', ')}) — which one the root holds is the hoister's choice`;
}

const posix = (path) => relative(ROOT, path).split(sep).join('/');

/** Every workspace's manifest, keyed by its directory (`packages/core`). */
function workspaces(rootManifest) {
	const patterns = Array.isArray(rootManifest.workspaces)
		? rootManifest.workspaces
		: (rootManifest.workspaces?.packages ?? []);
	let found = new Map();

	for (const pattern of patterns) {
		const directories = pattern.endsWith('/*')
			? readdirSync(join(ROOT, pattern.slice(0, -2)))
					.map((name) => join(ROOT, pattern.slice(0, -2), name))
					.filter((path) => statSync(path).isDirectory())
			: [join(ROOT, pattern)];

		for (const directory of directories) {
			const manifest = join(directory, 'package.json');
			if (existsSync(manifest)) found.set(posix(directory), JSON.parse(readFileSync(manifest, 'utf8')));
		}
	}

	return found;
}

/** The runtime source files of a directory (recursive, tests and declarations excluded). */
function sourceFiles(directory) {
	let files = [];
	const walk = (path) => {
		for (const entry of readdirSync(path, { withFileTypes: true })) {
			const full = join(path, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== 'node_modules') walk(full);
			} else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
				const file = posix(full);
				if (!NOT_RUNTIME.some((pattern) => pattern.test(file))) files.push(file);
			}
		}
	};
	if (existsSync(join(ROOT, directory))) walk(join(ROOT, directory));
	return files;
}

function main() {
	const rootManifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
	const lock = parseLockfile(readFileSync(join(ROOT, 'yarn.lock'), 'utf8'));
	const all = workspaces(rootManifest);
	const directoryOf = new Map([...all].map(([directory, manifest]) => [manifest.name, directory]));
	let importsOf = new Map(); // workspace directory -> [{ file, names }]
	let problems = [];
	let scanned = 0;

	const imports = (directory) => {
		if (!importsOf.has(directory)) {
			importsOf.set(
				directory,
				sourceFiles(`${directory}/src`).map((file) => ({
					file,
					names: runtimeImports(readFileSync(join(ROOT, file), 'utf8'))
				}))
			);
			scanned += importsOf.get(directory).length;
		}
		return importsOf.get(directory);
	};

	for (const { dockerfile, app } of IMAGES) {
		const installedDirectories = new Set(
			productionWorkspaces(readFileSync(join(ROOT, dockerfile), 'utf8')).filter((directory) => all.has(directory))
		);
		const installed = [...installedDirectories].map((directory) => all.get(directory));

		// What the image loads: the app, then every workspace its sources import, transitively.
		let loaded = new Set([app]);
		let queue = [app];
		while (queue.length) {
			for (const { names } of imports(queue.pop())) {
				for (const name of names) {
					const directory = directoryOf.get(name);
					if (directory && !loaded.has(directory)) {
						loaded.add(directory);
						queue.push(directory);
					}
				}
			}
		}

		let offenders = new Map();
		for (const directory of loaded) {
			const importer = installedDirectories.has(directory) ? all.get(directory) : null;
			for (const { file, names } of imports(directory)) {
				for (const name of names) {
					if (directoryOf.has(name)) continue;
					let reason = whyMissing(name, importer, rootManifest, installed, lock);
					if (!reason) continue;
					if (!importer) reason += `; ${directory}/package.json is not installed in this image`;
					const key = `${directory} -> ${name}`;
					if (!offenders.has(key)) offenders.set(key, { importer: directory, name, reason, files: [] });
					offenders.get(key).files.push(file);
				}
			}
		}

		for (const offender of offenders.values()) problems.push({ image: dockerfile, ...offender });
	}

	if (problems.length) {
		console.error(
			`runtime dependency check: ${problems.length} package(s) the images load at runtime are not installed in them:`
		);
		for (const { image, importer, name, reason, files } of problems) {
			console.error(`  ${image}: ${importer} imports ${name}`);
			console.error(`      ${reason}`);
			console.error(
				`      in ${files.length} file(s): ${files.slice(0, 3).join(', ')}${files.length > 3 ? ', …' : ''}`
			);
		}
		console.error('');
		console.error(
			"Declare each one in the importing workspace's `dependencies` (the image installs those — and install that " +
				"workspace's manifest in the image if it is not), or, when the import is only ever used as a type, write " +
				'it as `import type` so the code says what the compiler does. `yarn install --production` is what builds ' +
				'the runtime node_modules of these images.'
		);
		process.exit(1);
	}

	console.log(
		`runtime dependency check: PASSED — ${scanned} source file(s) loaded by ${IMAGES.length} image(s); every package ` +
			'they import at runtime is installed by the image.'
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
