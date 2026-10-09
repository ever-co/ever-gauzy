import * as fs from 'fs';
import * as path from 'path';

/**
 * Every migration in the repository has a timestamp of its own, and its file, class and `name` agree on it.
 *
 * TypeORM orders a run by the 13-digit timestamp at the end of each migration's class name, and the platform
 * runs one list: the kernel's migrations, discovered from `database/migrations/`, followed by the classes every
 * configured plugin declares (`preBootstrapRegisterMigrations`). Two migrations with one timestamp have no
 * order between them but the order their files happened to be listed in, and the boot-time check that refuses
 * a collision (`orderPluginMigrations`) only sees the plugin half, because the kernel half is a directory glob
 * whose classes are not loaded until the data source initialises. That is how
 * `CreatePaymentTermTables1791000000160` (kernel) and `CreateInventoryTables1791000000160` (inventory plugin)
 * came to share a timestamp unnoticed; the inventory migration is now `1791000000161`, which keeps the order
 * the run already had (the kernel glob first, the plugin classes after it).
 *
 * This reads the sources rather than loading them, so it costs a directory walk instead of a ts-jest
 * transform of every migration (`migration-smoke.spec.ts` is the suite that runs them).
 */

/** The repository root, five levels above this directory (`packages/core/src/lib/database`). */
const REPO_ROOT = path.resolve(__dirname, '../../../../..');

/** `<13-digit timestamp>-<Name>.ts`, the repository's migration file convention. */
const MIGRATION_FILE = /^(\d{13})-([A-Za-z][A-Za-z0-9]*)\.ts$/;

/** The class a migration declares, which is the name TypeORM records as run and orders by. */
const MIGRATION_CLASS = /export class (\w+)\s+implements\s+MigrationInterface/;

/**
 * Migrations that shipped before this suite with a class name that does not repeat the file's name, keyed by
 * path. A shipped migration is immutable — installations have recorded its class name as run — so these are
 * recorded rather than renamed. An entry fails the suite once its file conforms, and nothing new is added: a
 * new migration names its class after its file.
 */
const SHIPPED_NAME_DEVIATIONS: Readonly<Record<string, string>> = Object.freeze({
	// The class carries an earlier timestamp than the file. TypeORM orders by the class, which is why the
	// uniqueness test below checks the class-name timestamps as well as the file names.
	'packages/core/src/lib/database/migrations/1676978573552-AlterOrganizationTable.ts': 'AlterOrganizationTable1676828580883',
	// The file name starts lower-case and the class upper-case.
	'packages/core/src/lib/database/migrations/1706968055472-upgradeEstimateEmailTableTokenColumnValue.ts':
		'UpgradeEstimateEmailTableTokenColumnValue1706968055472'
});

interface IMigrationFile {
	/** Repository-relative path, with forward slashes. */
	file: string;
	timestamp: string;
	base: string;
	source: string;
	/** The class name the file declares, when it declares one. */
	declared?: string;
}

/**
 * Every migration directory of the kernel and of the plugins: a directory named `migrations`. Build output
 * and dependencies are skipped.
 *
 * @param directory Where to start.
 * @param found The directories found so far.
 * @returns The migration directories.
 */
function migrationDirectories(directory: string, found: string[] = []): string[] {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (!entry.isDirectory() || ['node_modules', 'dist', '.git'].includes(entry.name)) {
			continue;
		}

		const child = path.join(directory, entry.name);

		if (entry.name === 'migrations') {
			found.push(child);
		}

		migrationDirectories(child, found);
	}

	return found;
}

/** The migrations of the kernel and every plugin, read once for the whole suite. */
function readMigrations(): IMigrationFile[] {
	const roots = [path.join(REPO_ROOT, 'packages', 'core', 'src'), path.join(REPO_ROOT, 'packages', 'plugins')];
	const migrations: IMigrationFile[] = [];

	for (const directory of roots.flatMap((root) => migrationDirectories(root))) {
		for (const name of fs.readdirSync(directory)) {
			const match = name.match(MIGRATION_FILE);

			if (!match) {
				continue;
			}

			const absolute = path.join(directory, name);
			const source = fs.readFileSync(absolute, 'utf8');

			migrations.push({
				file: path.relative(REPO_ROOT, absolute).split(path.sep).join('/'),
				timestamp: match[1],
				base: match[2],
				source,
				declared: source.match(MIGRATION_CLASS)?.[1]
			});
		}
	}

	return migrations.sort((left, right) => left.file.localeCompare(right.file));
}

/**
 * The entries of a multimap whose key is held by more than one value, as readable lines.
 *
 * @param pairs The key and the value naming who holds it.
 * @returns One line per shared key.
 */
function sharedKeys(pairs: Array<[string, string]>): string[] {
	const byKey = new Map<string, string[]>();

	for (const [key, holder] of pairs) {
		byKey.set(key, [...(byKey.get(key) ?? []), holder]);
	}

	return [...byKey.entries()]
		.filter(([, holders]) => holders.length > 1)
		.map(([key, holders]) => `${key}: ${holders.join(', ')}`);
}

describe('migration timestamps and names', () => {
	const migrations = readMigrations();

	it('scans the kernel and the plugins, not one directory', () => {
		expect(migrations.filter((migration) => migration.file.startsWith('packages/core/')).length).toBeGreaterThan(
			300
		);
		expect(migrations.filter((migration) => migration.file.startsWith('packages/plugins/')).length).toBeGreaterThan(
			40
		);
	});

	it('gives every migration file a timestamp no other migration file in the repository uses', () => {
		expect(sharedKeys(migrations.map((migration) => [migration.timestamp, migration.file]))).toEqual([]);
	});

	it('gives every migration class a timestamp no other class uses, which is what TypeORM orders by', () => {
		expect(
			sharedKeys(
				migrations.map((migration) => [
					migration.declared?.slice(-13) ?? `(no class in ${migration.file})`,
					migration.declared ?? migration.file
				])
			)
		).toEqual([]);
	});

	it('names each class and its `name` after the file, timestamp included', () => {
		const disagreements = migrations
			.map((migration) => {
				const expected = SHIPPED_NAME_DEVIATIONS[migration.file] ?? `${migration.base}${migration.timestamp}`;
				const named = migration.source.match(/\bname\s*=\s*['"`]([^'"`]+)['"`]/)?.[1];

				return migration.declared === expected && named === expected
					? null
					: `${migration.file}: class ${migration.declared ?? '(none)'}, name ${named ?? '(none)'}, expected ${expected}`;
			})
			.filter((disagreement): disagreement is string => disagreement !== null);

		expect(disagreements).toEqual([]);
	});

	it('keeps the recorded deviations honest: each one still names a file whose class differs from its name', () => {
		const stale = Object.keys(SHIPPED_NAME_DEVIATIONS).filter((file) => {
			const migration = migrations.find((candidate) => candidate.file === file);

			return !migration || migration.declared === `${migration.base}${migration.timestamp}`;
		});

		expect(stale).toEqual([]);
	});

	it('declares both directions on every migration', () => {
		const oneWay = migrations
			.filter(
				(migration) =>
					!/\bpublic\s+(?:async\s+)?up\s*\(/.test(migration.source) ||
					!/\bpublic\s+(?:async\s+)?down\s*\(/.test(migration.source)
			)
			.map((migration) => migration.file);

		expect(oneWay).toEqual([]);
	});

	it('keeps the two migrations that once shared 1791000000160 in the order the run already had', () => {
		const paymentTerms = migrations.find((migration) => migration.base === 'CreatePaymentTermTables');
		const inventory = migrations.find((migration) => migration.base === 'CreateInventoryTables');

		expect(paymentTerms?.timestamp).toBe('1791000000160');
		expect(inventory?.timestamp).toBe('1791000000161');
		// Neither creates or references the other's tables, so the pair has no dependency either way.
		expect(inventory?.source).not.toMatch(/payment_term/);
		expect(paymentTerms?.source).not.toMatch(/stock_|channel_warehouse/);
	});
});
