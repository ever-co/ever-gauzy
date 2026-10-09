import * as fs from 'fs';
import * as path from 'path';
import { FEATURE_GRAPHQL } from './graphql-feature.code';

/**
 * The plugins reach `FEATURE_GRAPHQL` — and everything else of the kernel's — through `@gauzy/core`.
 *
 * Eighty-five plugin resolvers across sixteen packages imported the code as
 * `@gauzy/core/src/lib/feature/graphql-feature.code`, a path into this package's sources. The workspace's
 * TypeScript paths map `@gauzy/core` to `packages/core/src/index.ts` and nothing below it, so such a path
 * resolves only through `node_modules/@gauzy/core` — the workspace link in a checkout, the built package in an
 * image — and it resolves to whatever that link points at rather than to the sources being compiled. A
 * package that is published, or a checkout whose link points at another tree, reads a different file or none.
 * The code is exported from the public barrel instead, and this suite keeps it that way.
 *
 * Both checks read sources rather than loading them: importing the barrel would evaluate the whole kernel.
 * Specs are not scanned, because a spec that doubles `@gauzy/core` deliberately pulls single kernel modules
 * through the seam with `jest.requireActual('@gauzy/core/src/...')` so as not to boot it.
 */

/** The repository root, five levels above this directory (`packages/core/src/lib/feature`). */
const REPO_ROOT = path.resolve(__dirname, '../../../../..');

/** An import, export or require of a path inside the kernel's sources. */
const DEEP_IMPORT = /(?:from\s+|import\s+|require\(\s*)['"]@gauzy\/core\/src\//;

/**
 * The non-spec TypeScript sources under a directory.
 *
 * @param directory Where to start.
 * @param found The files found so far.
 * @returns Absolute paths.
 */
function sources(directory: string, found: string[] = []): string[] {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (['node_modules', 'dist', '.git'].includes(entry.name)) {
			continue;
		}

		const child = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			sources(child, found);
		} else if (/\.tsx?$/.test(entry.name) && !/\.(spec|test)\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
			found.push(child);
		}
	}

	return found;
}

describe('FEATURE_GRAPHQL is public API', () => {
	it('is exported from the package barrel, from the module that declares it', () => {
		const barrel = fs.readFileSync(path.join(REPO_ROOT, 'packages', 'core', 'src', 'index.ts'), 'utf8');

		expect(barrel).toMatch(/export \{ FEATURE_GRAPHQL \} from '\.\/lib\/feature\/graphql-feature\.code';/);
		// The value the catalogue's row carries; the barrel re-exports the binding, so this is what plugins read.
		expect(FEATURE_GRAPHQL).toBe('FEATURE_GRAPHQL');
	});

	it('is the only thing plugins needed from the kernel sources, and no plugin source reaches into them now', () => {
		const pluginsRoot = path.join(REPO_ROOT, 'packages', 'plugins');
		const files = sources(pluginsRoot);
		const deep = files
			.filter((file) => DEEP_IMPORT.test(fs.readFileSync(file, 'utf8')))
			.map((file) => path.relative(REPO_ROOT, file).split(path.sep).join('/'));

		// The control: the scan reads the plugin tree, resolvers included.
		expect(files.filter((file) => file.endsWith('.resolver.ts')).length).toBeGreaterThan(80);
		expect(deep).toEqual([]);
	});
});
