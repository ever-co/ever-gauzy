#!/usr/bin/env node
/**
 * Gate: nothing inside `packages/core/src/lib` imports the `lib/core` barrel.
 *
 * `packages/core/src/lib/core/index.ts` re-exports `core.module`, which imports `GraphqlApiModule` and through it
 * every domain module of the kernel. A file inside the kernel that imports that barrel (`from '../core'`,
 * `from '../../core'`) therefore drags the whole application's module graph in at the point it is evaluated,
 * and in CommonJS that closes a require cycle: a module further up the chain is still being evaluated, so its
 * export reads as `undefined` when the module below asks for it.
 *
 * It broke this branch twice, in two directions:
 *
 *   - `token.repository.ts` imported the barrel, so `TokenModule` was `undefined` when the refresh-token module
 *     used it, and `app.module.spec` could not load (fixed by importing `../../core/utils`).
 *   - With that import gone, the barrel was first reached from `refresh-token/current-user.provider.ts`, deep
 *     inside `EmailSendModule`'s own import graph, so `PaymentModule` read `EmailSendModule` while it was still
 *     being evaluated and the API failed to boot: `UndefinedModuleException: Nest cannot create the
 *     PaymentModule instance. The module at index [3] of the PaymentModule "imports" array is undefined.`
 *
 * Which file happens to load the barrel first decides whether the cycle bites, so the only stable rule is
 * that none does: import the sub-module that declares the symbol (`../core/crud`, `../core/context`,
 * `../core/utils`, `../core/dto`, `../core/entities/internal`, …). Spec files are not checked; a spec loads the
 * graph in its own order and is not the application's boot.
 *
 * Run from the repository root: `node tools/scripts/core-barrel-import-check.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const LIB = join(ROOT, 'packages', 'core', 'src', 'lib');
const BARREL_DIR = join(LIB, 'core');

/** Every `from '<spec>'` and `import '<spec>'`, including multi-line imports. */
const IMPORT = /(?:from|import)\s+['"]([^'"]+)['"]/g;

/**
 * The `.ts` files under a directory, excluding specs.
 *
 * @param {string} directory Where to start.
 * @returns {string[]} Absolute paths.
 */
function sources(directory) {
	const found = [];

	for (const name of readdirSync(directory)) {
		const path = join(directory, name);

		if (statSync(path).isDirectory()) {
			found.push(...sources(path));
		} else if (name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.d.ts')) {
			found.push(path);
		}
	}

	return found;
}

const violations = [];
let checked = 0;

for (const file of sources(LIB)) {
	const text = readFileSync(file, 'utf8');

	for (const match of text.matchAll(IMPORT)) {
		const specifier = match[1];

		if (!specifier.startsWith('.')) continue;

		checked++;

		// A relative import that resolves to the `lib/core` directory itself is the barrel.
		if (resolve(dirname(file), specifier) === BARREL_DIR) {
			const line = text.slice(0, match.index).split('\n').length;
			violations.push(`${relative(ROOT, file).split(sep).join('/')}:${line}  imports '${specifier}'`);
		}
	}
}

if (violations.length) {
	console.error(`core barrel import check: ${violations.length} kernel file(s) import the lib/core barrel:`);

	for (const violation of violations) console.error(`  ${violation}`);

	console.error('');
	console.error(
		'Import the sub-module that declares the symbol instead (../core/crud, ../core/context, ../core/utils, ' +
			'../core/dto, ../core/entities/internal, ...). The barrel re-exports core.module, so loading it from ' +
			'inside the kernel closes a require cycle whose victim is whichever module is mid-evaluation.'
	);
	process.exit(1);
}

console.log(
	`core barrel import check: PASSED — ${checked} relative import(s) across the kernel's non-spec sources, and none ` +
		'of them loads the lib/core barrel.'
);
