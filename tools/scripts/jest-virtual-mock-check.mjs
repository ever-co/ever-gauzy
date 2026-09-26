#!/usr/bin/env node
/**
 * Gate: no spec mocks a workspace package with `{ virtual: true }`.
 *
 * `virtual: true` is Jest's escape hatch for a module that does not exist. Every `@gauzy/*` package resolves (the
 * Nx resolver falls back to the TypeScript path mapping), so on one of them the flag changes only one thing: the
 * id Jest files the mock under. A plain mock is filed under the module's resolved path (`…/packages/common/src/
 * index.ts`), a virtual one under its bare name (`@gauzy/common`).
 *
 * The two ids do not mix, and Jest does not keep them apart. The resolver that computes a module's id is created
 * once per project in each worker process and caches the id by the requiring file and the name, across every spec
 * file that worker runs, while the set of virtual mocks belongs to one spec file. So a spec that mocks
 * `@gauzy/common` virtually leaves `goods-receipt.controller.ts → @gauzy/common` cached under the bare name, and a
 * later spec in the same worker that mocks it plainly files its mock under the path: the controller's `require`
 * misses the mock and loads the real module. The reverse happens too — any spec that loads the module without
 * mocking it caches the path form, and a later virtual mock is then missed.
 *
 * Which specs share a worker depends on the durations Jest recorded in its cache, so the failure appears on a cold
 * cache (every CI runner) and vanishes on a warm one. It did, in `plugin-purchasing`: `feature-gate.spec.ts` read
 * the codes its `@gauzy/common` mock recorded and found none, because the controllers had been decorated by the
 * real `@FeatureFlag` — only when the controller specs, which mocked the module virtually, had run first in the
 * same worker.
 *
 * Only specs Jest actually runs are checked: those under a project with a `jest.config.*`.
 *
 * Run from the repository root: `node tools/scripts/jest-virtual-mock-check.mjs`
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PACKAGES = join(ROOT, 'packages');
const SKIP = new Set(['node_modules', 'dist', '.angular', 'coverage']);

/**
 * Every file under a directory whose name satisfies a test, skipping build output and installed modules.
 *
 * @param {string} directory Where to start.
 * @param {(name: string) => boolean} wanted Which file names to keep.
 * @returns {string[]} Absolute paths.
 */
function walk(directory, wanted) {
	const found = [];

	for (const name of readdirSync(directory)) {
		if (SKIP.has(name)) continue;

		const path = join(directory, name);

		if (statSync(path).isDirectory()) {
			found.push(...walk(path, wanted));
		} else if (wanted(name)) {
			found.push(path);
		}
	}

	return found;
}

/**
 * Whether a spec belongs to a project Jest runs: the nearest directory above it with a `project.json` has a
 * `jest.config.*` beside it.
 *
 * @param {string} spec The spec file.
 * @returns {boolean} True when some Jest config picks the spec up.
 */
function isRunByJest(spec) {
	for (let directory = dirname(spec); directory.startsWith(PACKAGES); directory = dirname(directory)) {
		if (existsSync(join(directory, 'project.json'))) {
			return ['jest.config.ts', 'jest.config.js', 'jest.config.cjs', 'jest.config.mjs'].some((config) =>
				existsSync(join(directory, config))
			);
		}
	}

	return false;
}

/**
 * The index of the paren closing the call whose argument list opens at `open`, skipping strings and comments.
 *
 * @param {string} text The source.
 * @param {number} open The index of the `(`.
 * @returns {number} The index of the matching `)`, or -1.
 */
function closingParen(text, open) {
	let depth = 0;

	for (let i = open; i < text.length; i++) {
		const char = text[i];
		const next = text[i + 1];

		if (char === '/' && next === '/') {
			i = text.indexOf('\n', i);
			if (i < 0) return -1;
			continue;
		}

		if (char === '/' && next === '*') {
			i = text.indexOf('*/', i + 2) + 1;
			continue;
		}

		if (char === "'" || char === '"' || char === '`') {
			for (i++; i < text.length && text[i] !== char; i++) {
				if (text[i] === '\\') i++;
			}
			continue;
		}

		if ('({['.includes(char)) depth++;

		if (')}]'.includes(char) && --depth === 0) return i;
	}

	return -1;
}

const workspacePackages = walk(PACKAGES, (name) => name === 'package.json')
	.map((file) => JSON.parse(readFileSync(file, 'utf8')).name)
	.filter((name) => typeof name === 'string' && name.length > 0);

/**
 * @param {string} specifier A module specifier.
 * @returns {boolean} True when it names a workspace package or a path inside one.
 */
const isWorkspaceModule = (specifier) =>
	workspacePackages.some((name) => specifier === name || specifier.startsWith(`${name}/`));

const MOCK = /jest\.mock\(\s*(['"])([^'"]+)\1/g;
const violations = [];
let mocks = 0;
let specs = 0;

for (const spec of walk(PACKAGES, (name) => name.endsWith('.spec.ts'))) {
	if (!isRunByJest(spec)) continue;

	specs++;

	const text = readFileSync(spec, 'utf8');

	for (const match of text.matchAll(MOCK)) {
		const specifier = match[2];

		if (!isWorkspaceModule(specifier)) continue;

		mocks++;

		const open = match.index + 'jest.mock'.length;
		const call = text.slice(open, closingParen(text, open) + 1);

		if (/\{\s*virtual\s*:\s*true\s*\}/.test(call)) {
			const line = text.slice(0, match.index).split('\n').length;
			violations.push(
				`${relative(ROOT, spec).split(sep).join('/')}:${line}  jest.mock('${specifier}', …, { virtual: true })`
			);
		}
	}
}

if (violations.length) {
	console.error(`jest virtual mock check: ${violations.length} mock(s) of a workspace package are virtual:`);

	for (const violation of violations) console.error(`  ${violation}`);

	console.error('');
	console.error(
		'Drop `{ virtual: true }`: the package resolves, so the flag only files the mock under the bare name, and a ' +
			'spec that mocks or loads the same package under its resolved path in the same Jest worker then makes ' +
			'one of the two miss — the real module loads where the mock was meant to be, depending on test order.'
	);
	process.exit(1);
}

console.log(
	`jest virtual mock check: PASSED — ${mocks} mock(s) of workspace packages across ${specs} spec(s) Jest runs, ` +
		'and none of them is virtual.'
);
