import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Cross-database column-type guard.
 *
 * Demo runs **better-sqlite3**; stage and production run **PostgreSQL**. A column declared
 * `type: 'timestamp'` is perfectly valid on Postgres and is rejected outright by better-sqlite3:
 *
 *     DataTypeNotSupportedError: Data type "timestamp" in
 *     "DocumentInboundAddress.domainVerifiedAt" is not supported by "better-sqlite3"
 *
 * That is a **boot-time** failure — the API crash-loops before serving anything. It passed tsc, the
 * full unit suite, the Angular build, and a migration verified against a real PostgreSQL container,
 * because none of those instantiate the ORM against SQLite. Demo was down for hours.
 *
 * The fix is to declare nothing but the portable types and let TypeORM infer the rest from the
 * TypeScript type, which it maps per database. This test pins that convention across every entity
 * in the plugin, so the next `type: 'timestamp'` (or `'int'`, `'boolean'`, `'datetime'`, `'uuid'`…)
 * fails here instead of in a deployment.
 *
 * Dialect-portable helpers (`jsonColumnType()`, `binaryColumnType()`) are function calls rather than
 * string literals and are therefore invisible to this check by construction — which is correct, they
 * exist precisely to resolve per dialect.
 */
describe('entity column types are portable across Postgres, MySQL and SQLite', () => {
	const entitiesDir = __dirname;
	/** The only literal types every supported driver accepts, and the only ones already in use. */
	const PORTABLE = new Set(['varchar', 'text']);

	const entityFiles = readdirSync(entitiesDir).filter((name) => name.endsWith('.entity.ts'));

	it('finds the entity files (guard against an empty sweep passing vacuously)', () => {
		expect(entityFiles.length).toBeGreaterThan(5);
	});

	/**
	 * Comments must be stripped first. The entity that caused the outage now carries a comment
	 * *warning* against `type: 'timestamp'`, and a naive scan flags that warning as the very defect
	 * it documents — a guard that fires on its own documentation is worse than no guard.
	 */
	const stripComments = (source: string): string =>
		source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

	it.each(entityFiles)('%s declares only portable literal column types', (file) => {
		const source = stripComments(readFileSync(join(entitiesDir, file), 'utf8'));
		const declared = [...source.matchAll(/type:\s*'([a-z0-9]+)'/gi)].map((m) => m[1].toLowerCase());
		const offending = [...new Set(declared)].filter((type) => !PORTABLE.has(type));

		// `timestamp` is the one that actually took demo down; anything outside the portable set is
		// the same hazard waiting to happen, so the assertion names what it found.
		expect(offending).toEqual([]);
	});
});
