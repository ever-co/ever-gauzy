#!/usr/bin/env node
/**
 * The packaged desktop apps ship every @gauzy package their embedded API requires.
 *
 * Gauzy Desktop, Gauzy Server and Gauzy API Server fork an embedded API (`api/main.js`, built from apps/api by
 * `api:desktop-api` / `api:gauzy-server-api` / `api:server-api`). That bundle keeps every `@gauzy/*` package
 * external — it calls `require("@gauzy/<name>")` at load time — and in the packaged app those modules exist only
 * if the app manifest (`apps/<app>/src/package.json`) lists them in "dependencies": electron-builder installs that
 * list and nothing else. A plugin imported by apps/api but missing there is a packaged app whose API exits at load
 * with `Cannot find module '@gauzy/<name>'`, while every build, test and gate that runs from the monorepo passes.
 *
 * Measured on the released Gauzy Server v111.50.14 (2026-10-09): app.asar shipped exactly its 43 manifest
 * dependencies, and the embedded API required 47 — `@gauzy/plugin-ai-chat`, `@gauzy/plugin-docs` and fifteen
 * `@gauzy/plugin-ai-provider-*` resolved `MODULE_NOT_FOUND` under Electron.
 *
 * Three rules, per manifest:
 *   1. every `@gauzy` package apps/api imports at runtime is in "dependencies";
 *   2. every `@gauzy` package reachable from those (their own package.json dependencies) is in "resolutions",
 *      so yarn never looks a workspace package up on the public registry;
 *   3. every `@gauzy` entry points at the dist folder of the workspace package with that name.
 *
 * `--fix` inserts the missing entries (text insertion, so the file keeps its formatting) and exits 0.
 * Exits 1 when a rule fails, listing every gap.
 */
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FIX = process.argv.includes('--fix');

/** The apps that fork the full embedded API, with the manifest electron-builder packages. */
const MANIFESTS = ['apps/desktop/src/package.json', 'apps/server/src/package.json', 'apps/server-api/src/package.json'];

/** Where the embedded API's sources live. */
const API_SOURCES = 'apps/api/src';

function walk(dir, test, out = []) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) walk(path, test, out);
		else if (test(path)) out.push(path);
	}
	return out;
}

const toPosix = (path) => path.split(sep).join('/');

/** `@gauzy/<name>` → the workspace folder that publishes it, relative to `packages/`. */
const workspace = new Map();
for (const file of walk(join(ROOT, 'packages'), (path) => path.endsWith(`${sep}package.json`))) {
	let json;
	try {
		json = JSON.parse(readFileSync(file, 'utf8'));
	} catch {
		continue;
	}
	if (typeof json.name === 'string' && json.name.startsWith('@gauzy/') && !workspace.has(json.name)) {
		workspace.set(json.name, { dir: toPosix(relative(join(ROOT, 'packages'), dirname(file))), json });
	}
}

/**
 * The `@gauzy` packages apps/api loads at runtime: value imports and re-exports, side-effect imports, `require` and
 * `import()` — not `import type` / `export type`, and not a declaration whose every named specifier is `type`, which
 * TypeScript erases just the same (`import { type A, type B } from …`).
 */
const required = new Set();
/** `@gauzy/<name>` → the first apps/api file that imports it, for the report. */
const importedFrom = new Map();
/** `import|export <clause> from '@gauzy/<name>'`, with the clause captured so a type-only one can be told apart. */
const DECLARATION = /^\s*(?:import|export)\s+(?!type\s)([^;]*?)\s+from\s+['"](@gauzy\/[a-z0-9-]+)['"]/gm;
const RUNTIME = [
	/^\s*import\s+['"](@gauzy\/[a-z0-9-]+)['"]/gm,
	/\brequire\(\s*['"](@gauzy\/[a-z0-9-]+)['"]\s*\)/g,
	/\bimport\(\s*['"](@gauzy\/[a-z0-9-]+)['"]\s*\)/g
];

/** True when a declaration's clause is only `{ … }` and every specifier in it is `type …`. */
function typeOnly(clause) {
	const named = clause.trim().match(/^\{([\s\S]*)\}$/);
	if (!named) return false; // a default or namespace binding, or `export *`, is a value
	const specifiers = named[1]
		.split(',')
		.map((specifier) => specifier.trim())
		.filter(Boolean);
	return specifiers.length > 0 && specifiers.every((specifier) => /^type\s/.test(specifier));
}

// The API build compiles neither `.spec.ts` nor `.test.ts` (apps/api/tsconfig.app.json), so neither can require a package.
const isRuntimeSource = (path) => path.endsWith('.ts') && !path.endsWith('.spec.ts') && !path.endsWith('.test.ts');
for (const file of walk(join(ROOT, API_SOURCES), isRuntimeSource)) {
	const source = readFileSync(file, 'utf8');
	const names = [];
	for (const match of source.matchAll(DECLARATION)) {
		if (!typeOnly(match[1])) names.push(match[2]);
	}
	for (const pattern of RUNTIME) {
		for (const match of source.matchAll(pattern)) names.push(match[1]);
	}
	for (const name of names) {
		required.add(name);
		if (!importedFrom.has(name)) importedFrom.set(name, toPosix(relative(ROOT, file)));
	}
}

/** Everything those packages pull in through their own `@gauzy` dependencies. */
const closure = new Set();
const pending = [...required];
while (pending.length) {
	const name = pending.pop();
	if (closure.has(name)) continue;
	closure.add(name);
	const pkg = workspace.get(name)?.json;
	for (const field of ['dependencies', 'peerDependencies']) {
		for (const dependency of Object.keys(pkg?.[field] ?? {})) {
			if (dependency.startsWith('@gauzy/') && workspace.has(dependency)) pending.push(dependency);
		}
	}
}

const target = (name) => `file:../../../dist/packages/${workspace.get(name).dir}`;

/**
 * Inserts `"name": "target"` entries into one top-level object of a manifest, keeping every existing line as it
 * is (only the comma of the entry that stops being last can change): before `"@gauzy/scheduler"` when the block
 * has it (where the existing @gauzy entries end), else after the block's last `@gauzy` entry, else at its start.
 * Works for an empty block (`{}`) and for one with no `@gauzy` entry yet.
 */
function insert(text, block, names) {
	const key = text.indexOf(`"${block}":`);
	// Without the key, the first `{` would be the manifest's own top-level object — refuse rather than write there.
	if (key === -1) throw new Error(`the manifest has no "${block}" block to insert into`);
	const open = text.indexOf('{', key);
	if (open === -1) throw new Error(`the manifest's "${block}" is not an object`);
	// Manifest values are plain strings with no braces, so the first `}` at depth 0 closes the block.
	let depth = 0;
	let close = open;
	for (; close < text.length; close++) {
		if (text[close] === '{') depth++;
		else if (text[close] === '}' && --depth === 0) break;
	}
	const indent = '\t\t';
	const entries = text
		.slice(open + 1, close)
		.split('\n')
		.map((line) => line.replace(/,\s*$/, ''))
		.filter((line) => line.trim() !== '');
	const added = names.sort().map((name) => `${indent}"${name}": "${target(name)}"`);

	let at = entries.findIndex((line) => line.trim().startsWith('"@gauzy/scheduler"'));
	if (at === -1) {
		const last = entries.map((line) => line.trim().startsWith('"@gauzy/')).lastIndexOf(true);
		at = last === -1 ? 0 : last + 1;
	}
	entries.splice(at, 0, ...added);

	const closingIndent = text.slice(text.lastIndexOf('\n', close) + 1, close).match(/^\s*/)[0] || '\t';
	const body = `\n${entries.join(',\n')}\n${closingIndent}`;
	return `${text.slice(0, open + 1)}${body}${text.slice(close)}`;
}

const failures = [];
let fixed = 0;

for (const manifest of MANIFESTS) {
	const file = join(ROOT, manifest);
	try {
		statSync(file);
	} catch {
		failures.push(`${manifest} does not exist`);
		continue;
	}
	let text = readFileSync(file, 'utf8');
	const json = JSON.parse(text);
	const dependencies = json.dependencies ?? {};
	const resolutions = json.resolutions ?? {};

	const missingDependencies = [...required].filter((name) => !(name in dependencies) && workspace.has(name));
	const missingResolutions = [...closure].filter((name) => !(name in resolutions) && workspace.has(name));
	const wrongTargets = [
		...Object.entries(dependencies).map(([name, value]) => ['dependencies', name, value]),
		...Object.entries(resolutions).map(([name, value]) => ['resolutions', name, value])
	].filter(([, name, value]) => name.startsWith('@gauzy/') && workspace.has(name) && value !== target(name));

	if (FIX) {
		if (missingDependencies.length) text = insert(text, 'dependencies', missingDependencies);
		if (missingResolutions.length) text = insert(text, 'resolutions', missingResolutions);
		if (missingDependencies.length || missingResolutions.length) {
			JSON.parse(text); // the edit must leave valid JSON
			writeFileSync(file, text);
			fixed += missingDependencies.length + missingResolutions.length;
		}
	} else {
		for (const name of missingDependencies.sort()) {
			failures.push(`${manifest}: "dependencies" lacks ${name} — the embedded API requires it at load`);
		}
		for (const name of missingResolutions.sort()) {
			failures.push(`${manifest}: "resolutions" lacks ${name} — yarn would look it up on the public registry`);
		}
	}
	for (const [block, name, value] of wrongTargets) {
		failures.push(`${manifest}: ${block}.${name} is "${value}", expected "${target(name)}"`);
	}
}

// An import of a @gauzy name no workspace package publishes cannot be shipped from dist at all, and it would
// pass every rule above unnoticed — so it is a failure of its own, reported with the file that imports it.
const unknown = [...required].filter((name) => !workspace.has(name)).sort();
for (const name of unknown) {
	failures.push(`${importedFrom.get(name)} imports ${name}, which no workspace package under packages/ publishes`);
}

console.log('desktop API dependency check');
console.log('============================');
console.log(`@gauzy packages apps/api loads at runtime : ${required.size}`);
console.log(`with their @gauzy dependencies            : ${closure.size}`);
console.log(`manifests checked                         : ${MANIFESTS.length}`);
if (FIX) console.log(`entries inserted                          : ${fixed}`);

if (failures.length) {
	console.error('\nFAILED:');
	for (const failure of failures) console.error(`  ${failure}`);
	console.error(`\n${failures.length} gap(s). Run with --fix to insert the missing entries.`);
	process.exit(1);
}

console.log('\nPASSED — every packaged app ships what its embedded API requires.');
