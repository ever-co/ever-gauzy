import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { getMigrationsConfig } from '../bootstrap';

/**
 * TASK 7 of the improvement roadmap (P2 — Database Migration Compatibility Matrix).
 *
 * Runs the REAL migration chain (297 files as of writing, in
 * `packages/core/src/lib/database/migrations/`, resolved via the exact same `getMigrationsConfig()`
 * the production app and the `migration:run` CLI use) from an empty database, end to end, and
 * checks a handful of "must exist" tables/columns/indexes/foreign keys afterward.
 *
 * Scoped to SQLite (`better-sqlite3`) only: it is the one of the three production-supported engines
 * (Postgres/MySQL/SQLite — see `DatabaseTypeEnum`; `mongodb` is unimplemented) that needs no external
 * service to test, matching every other harness in this improvement effort (TASK 1–6) avoiding a
 * live Postgres/MySQL/Redis dependency in this sandboxed environment. It is also the engine this
 * repo already runs full migrations against today, incidentally, in the self-hosted Playwright E2E
 * job (which deletes `apps/api/data/gauzy.sqlite3` and boots the API against an empty file) — this
 * test gives that same coverage a direct, explicit test failure instead of only surfacing as "the API
 * never came up" inside a 10-minute E2E poll loop.
 *
 * It is NOT a fast or PR-level check. Every migration file goes through ts-jest, so a run takes about
 * 3-6 minutes with a warm transform cache and up to half an hour on a cold one. It is therefore
 * excluded from the default `nx test core` run (`testPathIgnorePatterns` in
 * `packages/core/jest.config.ts`) and has its own target instead, which no workflow runs today — run
 * it on demand before merging a migration change:
 *
 *   yarn nx run core:test-migration-smoke
 *
 * (Unit tests run in CI only on pushes to `stage`, and `.github/workflows/test-unit.yml` runs the
 * `test` target alone, so this target is not part of that run either.)
 *
 * Real Postgres/MySQL fresh-migration runs are NOT covered here — see this file's own "Known gaps"
 * note at the bottom and `packages/core/project.json`'s `test-postgres-migrations` target, which
 * already exercises ONE migration (`UniqueTenantStripeCustomer...`) against a real Postgres service
 * in CI (`.github/workflows/build.yml`); extending that pattern to the full chain, and adding an
 * equivalent MySQL service job, is the natural next slice.
 *
 * 194 of the 297 migrations (~65%) branch on `queryRunner.connection.options.type` — a real,
 * systemic "works on one engine, breaks on another" risk this repo has already been burned by (see
 * `documents-migrations.spec.ts`'s MySQL-permissions-skip bug and
 * `packages/plugins/docs/src/lib/entities/column-type-portability.spec.ts`'s Postgres/SQLite
 * type-literal incident, both narrower, reactive versions of what this test generalizes).
 */
describe('TypeORM migrations: fresh SQLite database smoke test', () => {
	let dbPath: string;
	let dataSource: DataSource;
	// What the single `runMigrations()` in `beforeAll` applied. Running the chain there, rather than in
	// the first test, gives every test the migrated schema even when it runs on its own (for example
	// with --testNamePattern), and a migration that throws fails every test with that error instead of
	// cascading into confusing "no such table" failures in the schema checks.
	let applied: Awaited<ReturnType<DataSource['runMigrations']>>;

	// `initialize()` loads the migration classes, which is where ts-jest transforms (and type-checks)
	// all ~300 files, and `runMigrations()` then applies the whole chain. On a cold transform cache
	// loading alone ran past the 10 minutes this hook used to allow, and the whole run took about 30
	// minutes on a busy machine. Any change to the resolved Jest config — including
	// `testPathIgnorePatterns` — starts a new cache, so the first run after one is always cold.
	// Generous, but still bounded.
	const initializeTimeoutMs = 60 * 60 * 1000;

	beforeAll(async () => {
		// A real temp FILE, not `:memory:` — several migrations reference `queryRunner.connection`
		// options / pragma behavior that only apply to a file-backed connection, matching how the
		// app and CLI actually run migrations in practice.
		dbPath = path.join(os.tmpdir(), `gauzy-migration-smoke-${process.pid}-${Date.now()}.sqlite3`);
		const { migrations } = getMigrationsConfig();

		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations,
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		applied = await dataSource.runMigrations({ transaction: 'each' });
	}, initializeTimeoutMs);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	it(
		'runs the entire migration chain from an empty database without throwing',
		() => {
			// A loose bound (e.g. `> 250`) would silently tolerate dozens of migrations quietly failing
			// to register (e.g. a glob/import regression) as long as enough still ran anyway. Assert the
			// exact migration-file count instead — computed here, not hardcoded, with the same `.ts` /
			// `.js` extensions as the `*{.ts,.js}` glob `getMigrationsConfig()` hands TypeORM — so this
			// test fails loudly (a real diff, not a silent pass) the day the chain's actual length and
			// the files on disk disagree, without needing to hand-update a magic number every time a
			// migration is added.
			const migrationFileCount = fs
				.readdirSync(path.join(__dirname, 'migrations'))
				.filter((file) => file.endsWith('.ts') || file.endsWith('.js')).length;
			expect(applied).toHaveLength(migrationFileCount);
		},
		10 * 60 * 1000
	);

	it('schema consistency: representative tables exist with their expected columns', async () => {
		const tableNames: string[] = (
			await dataSource.query("SELECT name FROM sqlite_master WHERE type = 'table'")
		).map((row: { name: string }) => row.name);

		for (const table of ['tenant', 'organization', 'user', 'employee', 'invoice', 'time_log']) {
			expect(tableNames).toContain(table);
		}

		const employeeColumns: string[] = (await dataSource.query('PRAGMA table_info(employee)')).map(
			(row: { name: string }) => row.name
		);
		expect(employeeColumns).toEqual(expect.arrayContaining(['id', 'tenantId', 'organizationId']));
	});

	it('schema consistency: a representative index and foreign key survive the full chain', async () => {
		// `employee.tenantId` is indexed by every tenant-scoped entity's base class (`ColumnIndex()`
		// on `TenantBaseEntity.tenantId` — see TASK 1/3's persistence-invariant work); a migration
		// that silently failed to (re)create it would not show up as a thrown error, only as slow
		// tenant-scoped queries in production. TypeORM names indexes with an opaque content hash
		// (e.g. `IDX_4b3303a6b7eb92d237a4379734`), so check the indexed COLUMN via the index's SQL
		// definition rather than the index name.
		const employeeIndexSql: Array<{ sql: string | null }> = await dataSource.query(
			"SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'employee'"
		);
		expect(employeeIndexSql.some((row) => row.sql?.includes('"tenantId"'))).toBe(true);

		const employeeForeignKeys: Array<{ table: string }> = await dataSource.query(
			'PRAGMA foreign_key_list(employee)'
		);
		expect(employeeForeignKeys.some((fk) => fk.table === 'tenant')).toBe(true);
	});

	it('schema consistency: both idempotency locks carry the tenant at the end of the chain', async () => {
		// `ScopeIdempotencyKeyByTenant1791000000557` replaces two unique indexes that folded the organization
		// but not the tenant, so two tenants with no organization selected shared one tuple. What must hold
		// once the whole chain has run is the replacement, not merely that the migration ran: the old names
		// are gone, the new ones fold `tenantId`, and the live-aggregate rule is left as it was.
		const uniqueIndexSql: Array<{ name: string; sql: string | null }> = await dataSource.query(
			"SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('idempotency_key', 'operation') AND sql LIKE 'CREATE UNIQUE INDEX%' ORDER BY name"
		);
		const byName = new Map(uniqueIndexSql.map((row) => [row.name, row.sql ?? '']));

		expect([...byName.keys()]).toEqual([
			'UQ_idempotency_tenant_org_scope_key',
			'UQ_operation_aggregate_live',
			'UQ_operation_tenant_idem'
		]);
		expect(byName.get('UQ_idempotency_tenant_org_scope_key')).toContain('COALESCE("tenantId"');
		expect(byName.get('UQ_operation_tenant_idem')).toContain('COALESCE("tenantId"');
		expect(byName.get('UQ_operation_tenant_idem')).toContain('WHERE "idempotencyKey" IS NOT NULL');
		expect(byName.get('UQ_operation_aggregate_live')).not.toContain('tenantId');
	});
});

/**
 * Known gaps (left for later, per the roadmap's own P2/"start narrow" framing):
 * - Postgres and MySQL fresh-migration runs need a real service and are not covered here.
 * - Rollback of the FULL chain (`undoLastMigration` only reverts one migration per call) is not
 *   exercised — only forward migration.
 * - Schema consistency checks above cover a handful of representative tables/columns/index/FK, not
 *   an exhaustive check of every one of the 297 migrations' effects.
 */
