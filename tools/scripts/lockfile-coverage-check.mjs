#!/usr/bin/env node
/**
 * Gate: every dependency range a workspace declares is resolved in `yarn.lock`.
 *
 * A yarn v1 lockfile records one entry per *requested range* — `"@nestjs/graphql@^13.4.2":` — and a
 * range no entry names is a range the lockfile does not cover. Two things follow, and both happened:
 *
 *   - **`yarn install --frozen-lockfile` refuses the install**, and every workflow in this repository that
 *     installs does so with that flag. The branch is then unbuildable in CI while every local checkout —
 *     installed long before the range was added — keeps working.
 *   - **An install without the flag resolves the range afresh**, to whatever the registry holds that day.
 *     Thirteen commerce plugins asked for `@nestjs/graphql@^13.0.0`–`^13.2.0` while the lockfile held only
 *     core's `^13.4.2` (13.4.2); a plain install resolved theirs to 13.4.5, hoisted it to the root, and
 *     nested core's 13.4.2 under `packages/core`. Two copies of `@nestjs/graphql` are two `GraphQLFactory`
 *     classes, and the API did not boot: `Nest can't resolve dependencies of the ApolloDriver
 *     (graphQlFactory)`.
 *
 * The check reads the workspaces the root `package.json` declares, and for every dependency of every
 * workspace — and of the root — asks whether `name@range` is a key of the lockfile. A dependency on another
 * workspace is not a registry range and is skipped, as are `file:`, `link:` and `workspace:` ranges.
 *
 * Run from the repository root: `node tools/scripts/lockfile-coverage-check.mjs`
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];

/**
 * The requested ranges the lockfile resolves.
 *
 * An entry's header lists every range it satisfies, comma-separated and each optionally quoted:
 * `"@babel/core@^7.0.0", "@babel/core@^7.1.0":`. Only unindented header lines are read, so a
 * `dependencies:` block inside an entry is never mistaken for a range.
 *
 * @returns The set of `name@range` keys.
 */
function lockedRanges() {
	const keys = new Set();

	for (const line of readFileSync(join(ROOT, 'yarn.lock'), 'utf8').split(/\r?\n/)) {
		if (!line || line.startsWith(' ') || line.startsWith('#') || !line.endsWith(':')) continue;

		for (const key of line.slice(0, -1).split(', ')) keys.add(key.trim().replace(/^"|"$/g, ''));
	}

	return keys;
}

/**
 * The `package.json` files of the root and of every workspace it declares.
 *
 * The workspace globs this repository uses are a directory or a directory followed by `/*`, so those two
 * shapes are expanded by hand rather than with a glob dependency the gate would have to install.
 *
 * @returns Absolute paths of the manifests.
 */
function manifests() {
	const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
	const patterns = Array.isArray(root.workspaces) ? root.workspaces : root.workspaces?.packages ?? [];
	const found = [join(ROOT, 'package.json')];

	for (const pattern of patterns) {
		const directories = pattern.endsWith('/*')
			? readdirSync(join(ROOT, pattern.slice(0, -2)))
					.map((name) => join(ROOT, pattern.slice(0, -2), name))
					.filter((path) => statSync(path).isDirectory())
			: [join(ROOT, pattern)];

		for (const directory of directories) {
			const manifest = join(directory, 'package.json');
			if (existsSync(manifest)) found.push(manifest);
		}
	}

	return found;
}

const locked = lockedRanges();
const files = manifests();
const parsed = files.map((file) => ({ file, json: JSON.parse(readFileSync(file, 'utf8')) }));
const workspaceNames = new Set(parsed.map(({ json }) => json.name).filter(Boolean));

const missing = [];
let checked = 0;

for (const { file, json } of parsed) {
	for (const section of SECTIONS) {
		for (const [name, range] of Object.entries(json[section] ?? {})) {
			if (workspaceNames.has(name) || /^(file|link|workspace):/.test(String(range))) continue;

			checked++;

			if (!locked.has(`${name}@${range}`)) {
				missing.push({ file: relative(ROOT, file).split(sep).join('/'), section, name, range });
			}
		}
	}
}

if (missing.length) {
	console.error(`lockfile coverage check: ${missing.length} declared range(s) have no entry in yarn.lock:`);

	for (const { file, section, name, range } of missing) {
		console.error(`  ${file}  ${section}  ${name}@${range}`);
	}

	console.error('');
	console.error(
		'Either state a range the lockfile already resolves (the one the rest of the repository uses), or run ' +
			'`yarn install` and commit the updated yarn.lock. A range the lockfile does not cover fails every ' +
			'`--frozen-lockfile` install, and resolving it afresh can put a second copy of a framework package ' +
			'beside the first.'
	);
	process.exit(1);
}

console.log(
	`lockfile coverage check: PASSED — ${checked} registry range(s) declared across ${files.length} manifest(s) ` +
		'are all resolved in yarn.lock.'
);
