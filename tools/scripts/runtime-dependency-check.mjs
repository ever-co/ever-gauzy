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
 * the root). develop had never failed only by accident: rimraf 3 reached its production tree through another
 * package's dependencies, and the package update removed that path.
 *
 * For each image (`.deploy/api/Dockerfile`, `.deploy/worker/Dockerfile`) the check
 *
 *   1. reads the manifests its `prod-dependencies` stage copies (`COPY … <dir>/package.json …`) plus the root's;
 *   2. resolves, through `yarn.lock`, every version those manifests declare of each package, in any section;
 *   3. reads every value import of the non-test sources of those workspaces (`<dir>/src/**`): `import … from`,
 *      `import '…'`, `export … from`, `require('…')` and `import('…')`. `import type` / `export type` and
 *      imports whose specifiers are all `type` are erased by the compiler and skipped, as are comments;
 *   4. accepts an imported package only when the image is sure to hold it where the importer looks:
 *        - the importing workspace declares it in `dependencies` / `optionalDependencies` (the Dockerfile re-nests a
 *          workspace's own node_modules beside its build), or
 *        - the root declares it in `dependencies` / `optionalDependencies` (it is then the root copy), or
 *        - some manifest of the image declares it in `dependencies` / `optionalDependencies` and every manifest of the
 *          image that declares it — devDependencies included — resolves the same version, so the one copy is hoisted
 *          to the root, where every workspace finds it.
 *      A package that reaches the image only through another package's dependencies is refused: whether it lands at
 *      the root is up to the hoister, and a devDependency of another version claims the root first. That is the
 *      rimraf failure — rimraf 3 came in transitively, rimraf 6 (a root devDependency) took the root slot, and
 *      the production install, which leaves devDependencies out, left the slot empty.
 *
 * What it cannot see: a value import whose bindings are only ever used as types (the compiler drops it too). Write
 * such an import as `import type` — then the code says what the compiler does. A real runtime import of a package
 * the image does not install is fixed by declaring it in the importing workspace's `dependencies`.
 *
 * Reads the tree with `node:fs` alone — no install. Run from the repository root:
 * `node tools/scripts/runtime-dependency-check.mjs`
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const IMAGES = ['.deploy/api/Dockerfile', '.deploy/worker/Dockerfile'];
const BUILTINS = new Set(builtinModules);

/** Files that are never part of a built image: specs, test helpers, declarations, stories. */
const NOT_RUNTIME = [
	/\.(spec|test|e2e-spec|stories)\.[cm]?[jt]sx?$/,
	/\.d\.ts$/,
	/(^|\/)(test|tests|__tests__|__mocks__|testing|e2e|fixtures)\//,
	/(^|\/)(jest\.config|test-setup|jest\.setup)\.[cm]?[jt]s$/
];

const posix = (path) => relative(ROOT, path).split(sep).join('/');

/**
 * The yarn v1 lockfile as `name@range -> { version, dependencies: [[dependency, range], …] }`.
 *
 * An entry's header lists every range it satisfies (`"a@^1.0.0", "a@^1.1.0":`); its `dependencies:` and
 * `optionalDependencies:` blocks list one `name "range"` per line, four spaces in.
 */
function readLockfile() {
	const entries = new Map();
	let current = null;
	let collecting = false;

	for (const line of readFileSync(join(ROOT, 'yarn.lock'), 'utf8').split(/\r?\n/)) {
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

/** Every workspace's manifest, keyed by its directory (`packages/core`). */
function workspaces() {
	const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
	const patterns = Array.isArray(root.workspaces) ? root.workspaces : (root.workspaces?.packages ?? []);
	const found = new Map();

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

/** The workspace directories an image's `prod-dependencies` stage copies a manifest of. */
function productionWorkspaces(dockerfile) {
	const text = readFileSync(join(ROOT, dockerfile), 'utf8');
	const stage = text.split(/^FROM\s/m).find((block) => /\sAS\s+prod-dependencies\b/i.test(block.split('\n')[0]));

	if (!stage)
		throw new Error(`${dockerfile}: no "prod-dependencies" stage — the gate cannot tell what the image installs`);

	return [...stage.matchAll(/^COPY\s+(?:--\S+\s+)*(\S+)\/package\.json\s/gm)].map((match) =>
		match[1].replace(/^\.\//, '')
	);
}

const RUNTIME_SECTIONS = ['dependencies', 'optionalDependencies'];
// What an install puts on disk. A peer range is a promise someone else installs the package; it is not an install.
const INSTALLED_SECTIONS = [...RUNTIME_SECTIONS, 'devDependencies'];

/**
 * Whether the image holds `name` where a file of the `importer` workspace looks for it (rules in the header).
 *
 * @returns null when it does, or the reason it may not.
 */
function whyMissing(name, importer, rootManifest, manifests, lock, workspaceNames) {
	if (workspaceNames.has(name)) return null;
	if (RUNTIME_SECTIONS.some((section) => importer[section]?.[name])) return null;
	if (RUNTIME_SECTIONS.some((section) => rootManifest[section]?.[name])) return null;

	const declarations = [];
	for (const manifest of [rootManifest, ...manifests]) {
		for (const section of INSTALLED_SECTIONS) {
			const range = manifest[section]?.[name];
			if (range === undefined) continue;
			const resolved = lock.get(`${name}@${range}`)?.version ?? String(range);
			declarations.push({
				manifest: manifest === rootManifest ? 'root' : manifest.name,
				section,
				version: resolved
			});
		}
	}

	const runtime = declarations.filter(({ section }) => RUNTIME_SECTIONS.includes(section));
	if (!runtime.length) {
		return declarations.length
			? `declared only as ${[...new Set(declarations.map(({ section }) => section))].join('/')} (${declarations
					.map(({ manifest, version }) => `${manifest} ${version}`)
					.join(', ')}) — a production install leaves it out`
			: 'declared by no manifest of the image — present only if another package happens to bring it';
	}

	const versions = new Set(declarations.map(({ version }) => version));
	if (versions.size === 1) return null;

	return `declared at ${versions.size} versions (${declarations
		.map(({ manifest, section, version }) => `${manifest} ${section} ${version}`)
		.join(', ')}) — which one the root holds is the hoister's choice`;
}

/** The source without comments; string and template contents are kept (the specifiers live there). */
function stripComments(source) {
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
function packageOf(specifier) {
	if (/^[./]/.test(specifier) || specifier.startsWith('node:')) return null;
	const parts = specifier.split('/');
	return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** The packages a source file loads at runtime. */
function runtimeImports(source) {
	const code = stripComments(source);
	const found = new Set();

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

	return [...found].map(packageOf).filter((name) => name && !BUILTINS.has(name));
}

function sourceFiles(directory) {
	const files = [];
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

const lock = readLockfile();
const all = workspaces();
const workspaceNames = new Set([...all.values()].map((manifest) => manifest.name).filter(Boolean));
const rootManifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const problems = [];
let scanned = 0;

for (const image of IMAGES) {
	const directories = productionWorkspaces(image).filter((directory) => directory !== '' && directory !== '.');
	const manifests = directories.map((directory) => all.get(directory)).filter(Boolean);
	const offenders = new Map();

	for (const directory of directories) {
		const importer = all.get(directory);
		if (!importer) continue;
		for (const file of sourceFiles(`${directory}/src`)) {
			scanned++;
			for (const name of new Set(runtimeImports(readFileSync(join(ROOT, file), 'utf8')))) {
				const reason = whyMissing(name, importer, rootManifest, manifests, lock, workspaceNames);
				if (!reason) continue;
				const key = `${importer.name} -> ${name}`;
				if (!offenders.has(key)) offenders.set(key, { importer: directory, name, reason, files: [] });
				offenders.get(key).files.push(file);
			}
		}
	}

	for (const offender of offenders.values()) problems.push({ image, ...offender });
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
		"Declare each one in the importing workspace's `dependencies` (the image installs those), or, when the import " +
			'is only ever used as a type, write it as `import type` so the code says what the compiler does. ' +
			'`yarn install --production` is what builds the runtime node_modules of these images.'
	);
	process.exit(1);
}

console.log(
	`runtime dependency check: PASSED — ${scanned} source file(s) of ${IMAGES.length} image(s); every package they load ` +
		'at runtime is installed by the image.'
);
