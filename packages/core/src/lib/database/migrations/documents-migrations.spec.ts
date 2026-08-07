/**
 * `uuid` ships ESM only, which Jest does not transform out of `node_modules` — a counter
 * based stub keeps the ids unique (what the assertions below care about) and the module
 * graph CommonJS.
 */
jest.mock('uuid', () => {
	let counter = 0;
	return { v4: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}` };
});

import { QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { FeatureEnum } from '@gauzy/contracts';
import { RolePermissionUtils } from '../../role-permission/utils';
import { DocumentsRolePermissionsReload1790000003000 } from './1790000003000-DocumentsRolePermissionsReload';
import { SeedDocumentsFeature1790000004000 } from './1790000004000-SeedDocumentsFeature';

type ExecutedQuery = { sql: string; parameters: any[] };

/**
 * Minimal `QueryRunner` stand-in: records every statement a migration issues and lets a
 * test decide what a `SELECT` should return. Enough to desk-check the dialect routing and
 * the shape of the emitted SQL without a live database.
 */
const createQueryRunner = (
	type: DatabaseTypeEnum,
	onQuery: (sql: string) => any = () => []
): { queryRunner: QueryRunner; executed: ExecutedQuery[] } => {
	const executed: ExecutedQuery[] = [];
	const queryRunner = {
		connection: { options: { type } },
		dataSource: { options: { type } },
		query: jest.fn(async (sql: string, parameters: any[] = []) => {
			executed.push({ sql, parameters });
			return onQuery(sql);
		})
	} as unknown as QueryRunner;

	return { queryRunner, executed };
};

const SQL_DIALECTS: DatabaseTypeEnum[] = [
	DatabaseTypeEnum.sqlite,
	DatabaseTypeEnum.betterSqlite3,
	DatabaseTypeEnum.postgres,
	DatabaseTypeEnum.mysql
];

describe('SeedDocumentsFeature1790000004000', () => {
	let migration: SeedDocumentsFeature1790000004000;

	beforeEach(() => {
		migration = new SeedDocumentsFeature1790000004000();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	/**
	 * Regression guard: the migration used to insert ONLY the `feature` catalog row, which
	 * left `feature_organization` empty and therefore `Store.hasFeatureEnabled()` false —
	 * the Documents nav item and route stayed hidden on every already-seeded deployment.
	 */
	it.each(SQL_DIALECTS)('inserts the per-tenant feature_organization rows on %s', async (type) => {
		// A single tenant is missing its toggle row (the SQLite path resolves the pairs first)
		const { queryRunner, executed } = createQueryRunner(type, (sql) =>
			sql.trimStart().toUpperCase().startsWith('SELECT')
				? [{ tenantId: 'tenant-uuid-1', featureId: 'feature-uuid-1' }]
				: []
		);

		await migration.up(queryRunner);

		const featureOrganizationInserts = executed.filter(
			({ sql }) => /INSERT\s+INTO/i.test(sql) && /feature_organization/.test(sql)
		);
		expect(featureOrganizationInserts.length).toBeGreaterThan(0);

		// The catalog row is still seeded, guarded, first
		expect(executed[0].sql).toMatch(/INSERT\s+INTO\s+[`"]feature[`"]/i);
		expect(executed[0].sql).toMatch(/NOT EXISTS/i);
	});

	it.each([DatabaseTypeEnum.postgres, DatabaseTypeEnum.mysql])(
		'guards the feature_organization insert with NOT EXISTS on %s so it is re-runnable',
		async (type) => {
			const { queryRunner, executed } = createQueryRunner(type);

			await migration.up(queryRunner);

			const [insert] = executed.filter(
				({ sql }) => /INSERT\s+INTO/i.test(sql) && /feature_organization/.test(sql)
			);
			expect(insert.sql).toMatch(/NOT EXISTS/i);
			// tenant scoped rows only, exactly like `feature.seed.ts` creates them
			expect(insert.sql).toMatch(/organizationId[`"]?\s+IS NULL/i);
			// soft deleted tenants are skipped
			expect(insert.sql).toMatch(/deletedAt[`"]?\s+IS NULL/i);
			expect(insert.parameters).toEqual([FeatureEnum.FEATURE_DOCUMENTS]);
		}
	);

	it('generates an id per row on SQLite, where no server side UUID function exists', async () => {
		const { queryRunner, executed } = createQueryRunner(DatabaseTypeEnum.betterSqlite3, (sql) =>
			sql.trimStart().toUpperCase().startsWith('SELECT')
				? [
						{ tenantId: 'tenant-uuid-1', featureId: 'feature-uuid-1' },
						{ tenantId: 'tenant-uuid-2', featureId: 'feature-uuid-1' }
					]
				: []
		);

		await migration.up(queryRunner);

		const inserts = executed.filter(({ sql }) => /INSERT\s+INTO/i.test(sql) && /feature_organization/.test(sql));
		expect(inserts).toHaveLength(2);
		expect(inserts.map(({ parameters }) => parameters[1])).toEqual(['tenant-uuid-1', 'tenant-uuid-2']);
		// ids are unique and the rows are enabled
		expect(new Set(inserts.map(({ parameters }) => parameters[0])).size).toBe(2);
		inserts.forEach(({ parameters }) => expect(parameters[3]).toBe(1));
	});

	it('inserts nothing extra when every tenant already has a toggle row', async () => {
		const { queryRunner, executed } = createQueryRunner(DatabaseTypeEnum.sqlite, () => []);

		await migration.up(queryRunner);

		expect(executed.filter(({ sql }) => /INSERT\s+INTO/i.test(sql) && /feature_organization/.test(sql))).toEqual(
			[]
		);
	});

	it('throws for an unsupported database', async () => {
		const { queryRunner } = createQueryRunner('oracle' as DatabaseTypeEnum);
		await expect(migration.up(queryRunner)).rejects.toThrow(/Unsupported database/);
	});
});

describe('DocumentsRolePermissionsReload1790000003000', () => {
	let migration: DocumentsRolePermissionsReload1790000003000;
	let migrateRolePermissions: jest.SpyInstance;

	beforeEach(() => {
		migration = new DocumentsRolePermissionsReload1790000003000();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		migrateRolePermissions = jest.spyOn(RolePermissionUtils, 'migrateRolePermissions').mockResolvedValue(undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	/**
	 * Regression guard: MySQL used to be skipped, so no role ever received the `DOCS_*`
	 * permissions and the whole feature was inaccessible on a MySQL deployment.
	 */
	it.each(SQL_DIALECTS)('reloads the default role permissions on %s', async (type) => {
		const { queryRunner } = createQueryRunner(type);

		await migration.up(queryRunner);

		expect(migrateRolePermissions).toHaveBeenCalledTimes(1);
		expect(migrateRolePermissions).toHaveBeenCalledWith(queryRunner);
	});

	it('swallows a reload failure so the migration chain keeps going', async () => {
		migrateRolePermissions.mockRejectedValue(new Error('boom'));
		const { queryRunner } = createQueryRunner(DatabaseTypeEnum.mysql);

		await expect(migration.up(queryRunner)).resolves.toBeUndefined();
	});

	it('throws for an unsupported database', async () => {
		const { queryRunner } = createQueryRunner('oracle' as DatabaseTypeEnum);
		await expect(migration.up(queryRunner)).rejects.toThrow(/Unsupported database/);
	});
});
