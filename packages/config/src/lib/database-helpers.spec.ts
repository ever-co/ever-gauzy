import { DataSource, DataSourceOptions, EntitySchema, IsNull, Repository } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from './database-helpers';

/**
 * Regression suite for GHSA-44pv-34gx-q9p4.
 *
 * TypeORM 1.0 lets the connection decide what a `null` / `undefined` value inside a `where` object
 * means. The application shipped `null: 'ignore'`, which silently DROPPED the predicate: a lookup
 * meant as `"tenantId" IS NULL` (the global, tenant-less row) matched every tenant's rows. The
 * shipped behavior is now `null: 'sql-null'` (emit `IS NULL`) and `undefined: 'ignore'` (omit the
 * key — the optional-filter idiom the whole codebase relies on).
 *
 * The behavior is exercised against a real better-sqlite3 database, the default DB_TYPE, using the
 * SAME exported constant the connection profiles use. Every "the fix works" test is paired with a
 * CONTROL running the pre-fix `ignore` setting, so a green run proves the suite can tell the two
 * apart rather than passing vacuously.
 */

const RowSchema = new EntitySchema({
	name: 'Row',
	tableName: 'row',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		name: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	}
});

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

async function openDataSource(invalidWhereValuesBehavior: DataSourceOptions['invalidWhereValuesBehavior']) {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [RowSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior
	});
	await dataSource.initialize();
	const rows: Repository<any> = dataSource.getRepository('Row');
	await rows.save([
		{ name: 'global', tenantId: null, organizationId: null },
		{ name: 'tenant-a', tenantId: TENANT_A, organizationId: null },
		{ name: 'tenant-b', tenantId: TENANT_B, organizationId: 'org-b' }
	]);
	return { dataSource, rows };
}

const names = (items: any[]) => items.map((r) => r.name).sort();

describe('TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR (GHSA-44pv-34gx-q9p4)', () => {
	it('is the fail-closed setting: null -> IS NULL, undefined -> key omitted, and is frozen', () => {
		expect(TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR).toEqual({ null: 'sql-null', undefined: 'ignore' });
		expect(Object.isFrozen(TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR)).toBe(true);
		// The one value that must never come back: it turns "IS NULL" into "no predicate at all".
		expect(TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR.null).not.toBe('ignore');
	});

	describe('shipped connection profiles', () => {
		const originalDbType = process.env.DB_TYPE;
		afterEach(() => {
			if (originalDbType === undefined) delete process.env.DB_TYPE;
			else process.env.DB_TYPE = originalDbType;
		});

		it.each(['better-sqlite3', 'sqlite', 'postgres', 'mysql'])(
			'DB_TYPE=%s TypeORM profile uses the shared constant',
			(dbType) => {
				process.env.DB_TYPE = dbType;
				jest.isolateModules(() => {
					// database.ts builds the profile for process.env.DB_TYPE at import time. Compare against
					// the constant from the SAME isolated module registry so identity (not just shape) is proven.
					const helpers = require('./database-helpers');
					const { dbTypeOrmConnectionConfig } = require('./database');
					expect(dbTypeOrmConnectionConfig.invalidWhereValuesBehavior).toBe(
						helpers.TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
					);
					expect(dbTypeOrmConnectionConfig.invalidWhereValuesBehavior).toEqual({
						null: 'sql-null',
						undefined: 'ignore'
					});
				});
			}
		);
	});

	describe('against a real better-sqlite3 database', () => {
		let fixed: { dataSource: DataSource; rows: Repository<any> };
		let control: { dataSource: DataSource; rows: Repository<any> };

		beforeAll(async () => {
			fixed = await openDataSource(TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR);
			control = await openDataSource({ null: 'ignore', undefined: 'ignore' }); // the pre-fix shipped setting
		});

		afterAll(async () => {
			for (const ds of [fixed?.dataSource, control?.dataSource]) {
				if (ds?.isInitialized) await ds.destroy();
			}
		});

		it('find({ where: { tenantId: null } }) matches ONLY the tenant-less row', async () => {
			const items = await fixed.rows.find({ where: { tenantId: null } });
			expect(names(items)).toEqual(['global']);
		});

		it('CONTROL: under the pre-fix "ignore" setting the same query returns EVERY tenant', async () => {
			const items = await control.rows.find({ where: { tenantId: null } });
			expect(names(items)).toEqual(['global', 'tenant-a', 'tenant-b']);
		});

		it('findOneBy with two null keys pins BOTH columns to IS NULL', async () => {
			// { tenantId: null, organizationId: null } is exactly the accounting-template "global" lookup.
			const row = await fixed.rows.findOneBy({ tenantId: null, organizationId: null });
			expect(row?.name).toBe('global');
			// tenant-a also has organizationId NULL but a real tenantId — it must not be reachable.
			const notTenantA = await fixed.rows.findOneBy({ tenantId: null, name: 'tenant-a' });
			expect(notTenantA).toBeNull();
		});

		it('CONTROL: under "ignore", the two-null lookup happily returns another tenant\'s row', async () => {
			const row = await control.rows.findOneBy({ tenantId: null, organizationId: null, name: 'tenant-b' });
			expect(row?.name).toBe('tenant-b');
		});

		it('null behaves exactly like the explicit IsNull() operator', async () => {
			const viaNull = await fixed.rows.find({ where: { tenantId: null } });
			const viaOperator = await fixed.rows.find({ where: { tenantId: IsNull() } });
			expect(names(viaNull)).toEqual(names(viaOperator));
		});

		it('undefined still omits the key (optional-filter idiom: where: { tenantId, organizationId })', async () => {
			const organizationId: string | undefined = undefined;
			const items = await fixed.rows.find({ where: { tenantId: TENANT_A, organizationId } });
			expect(names(items)).toEqual(['tenant-a']);
			const all = await fixed.rows.find({ where: { tenantId: undefined } });
			expect(all).toHaveLength(3);
		});

		it('count / exists / delete criteria honour the same IS NULL semantics', async () => {
			expect(await fixed.rows.countBy({ tenantId: null })).toBe(1);
			expect(await fixed.rows.existsBy({ tenantId: null, name: 'tenant-b' })).toBe(false);
			// A tenant-less DELETE must not touch tenant rows.
			const { dataSource, rows } = await openDataSource(TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR);
			try {
				const { affected } = await rows.delete({ tenantId: null });
				expect(affected).toBe(1);
				expect(names(await rows.find())).toEqual(['tenant-a', 'tenant-b']);
			} finally {
				await dataSource.destroy();
			}
		});

		it('CONTROL: under "ignore" a tenant-less DELETE would wipe every tenant', async () => {
			const { dataSource, rows } = await openDataSource({ null: 'ignore', undefined: 'ignore' });
			try {
				const { affected } = await rows.delete({ tenantId: null });
				expect(affected).toBe(3);
			} finally {
				await dataSource.destroy();
			}
		});
	});
});
