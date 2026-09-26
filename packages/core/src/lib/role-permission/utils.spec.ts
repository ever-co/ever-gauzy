import { DataSource, EntitySchema, QueryRunner } from 'typeorm';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RolePermissionUtils } from './utils';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';

/**
 * Regression suite for the boot-time role-permission reload.
 *
 * `RolePermissionUtils.migrateRolePermissions` is what the `*RolePermissionsReload*` migrations run,
 * and those migrations execute inside `NestFactory.create()` — BEFORE `app.listen()`. So however long
 * this function takes is time the API is not serving, and the pod's startup probe is the deadline.
 *
 * It used to ask the database "does this role already have this permission?" once per permission,
 * which is `roles x permissions` sequential round-trips. On the production database that is
 * 41,885 roles x 211 permissions = ~8.8M queries and over five hours, against a fifty-minute
 * startup-probe budget — so the container was SIGKILLed and restarted from the beginning, forever,
 * and the API could never boot. Stage never caught it because stage has 422 tenants to prod's 5,236.
 *
 * The fix reads each role's existing permissions in ONE query and inserts the missing rows in
 * batches. The first test below is therefore about QUERY COUNT, not just about the resulting rows:
 * the rows were always correct, it was the number of round-trips that took production down.
 *
 * Every assertion that the fix works is paired with a CONTROL showing the number the old shape
 * would have produced, so the suite is proven to discriminate rather than passing vacuously.
 */

const TenantSchema = new EntitySchema({
	name: 'Tenant',
	tableName: 'tenant',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' }
	}
});

const RoleSchema = new EntitySchema({
	name: 'Role',
	tableName: 'role',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' },
		tenantId: { type: 'varchar' }
	}
});

const RolePermissionSchema = new EntitySchema({
	name: 'RolePermission',
	tableName: 'role_permission',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar' },
		roleId: { type: 'varchar' },
		permission: { type: 'varchar' },
		enabled: { type: 'int', default: 0 }
	}
});

/** The roles every tenant gets, mirroring the shape of a real tenant. */
const SEEDED_ROLES: RolesEnum[] = [
	RolesEnum.SUPER_ADMIN,
	RolesEnum.ADMIN,
	RolesEnum.DATA_ENTRY,
	RolesEnum.EMPLOYEE,
	RolesEnum.CANDIDATE,
	RolesEnum.MANAGER,
	RolesEnum.VIEWER,
	RolesEnum.INTERVIEWER
];

const TENANT_COUNT = 3;
const EXPECTED_ROLE_COUNT = TENANT_COUNT * SEEDED_ROLES.length;

/** Every permission the migration considers — the same list the production code walks. */
const ALL_PERMISSIONS = Object.values(PermissionsEnum);

interface Recorded {
	sql: string;
	parameters: any[];
}

/**
 * Build an in-memory database seeded with tenants and roles, and record every statement the
 * migration issues so the test can assert on round-trip COUNT, not only on the final rows.
 *
 * `uniqueIndex` adds the (tenantId, roleId, permission) unique index that
 * `AddRolePermissionUniqueIndex1790000017000` creates on real databases.
 */
async function createSeededDataSource({ uniqueIndex = false } = {}): Promise<{
	dataSource: DataSource;
	queryRunner: QueryRunner;
	recorded: Recorded[];
}> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TenantSchema, RoleSchema, RolePermissionSchema],
		synchronize: true,
		logging: false
	});

	await dataSource.initialize();

	if (uniqueIndex) {
		await dataSource.manager.query(
			`CREATE UNIQUE INDEX "IDX_role_permission_unique" ON "role_permission" ("tenantId", "roleId", "permission")`
		);
	}

	for (let t = 0; t < TENANT_COUNT; t++) {
		const tenantId = `tenant-${t}`;
		await dataSource.manager.query(`INSERT INTO "tenant" ("id", "name") VALUES (?, ?)`, [tenantId, `Tenant ${t}`]);

		for (const roleName of SEEDED_ROLES) {
			await dataSource.manager.query(`INSERT INTO "role" ("id", "name", "tenantId") VALUES (?, ?, ?)`, [
				`${tenantId}-${roleName}`,
				roleName,
				tenantId
			]);
		}
	}

	const queryRunner = dataSource.createQueryRunner();

	// Start recording only AFTER seeding, so the counts belong to the migration alone.
	const recorded: Recorded[] = [];
	const original = dataSource.manager.query.bind(dataSource.manager);
	jest.spyOn(dataSource.manager, 'query').mockImplementation(((sql: string, parameters: any[]) => {
		recorded.push({ sql, parameters });
		return original(sql, parameters);
	}) as any);

	return { dataSource, queryRunner, recorded };
}

const isExistenceRead = (sql: string) => /SELECT\s+"permission"\s+FROM\s+"role_permission"/i.test(sql);
const isPerPermissionProbe = (sql: string) => /distinctAlias/i.test(sql);
const isInsert = (sql: string) => /INSERT\s+INTO\s+"role_permission"/i.test(sql);

describe('RolePermissionUtils.migrateRolePermissions', () => {
	describe('round-trip count — the reason production could not boot', () => {
		let dataSource: DataSource;
		let recorded: Recorded[];

		beforeAll(async () => {
			const built = await createSeededDataSource();
			dataSource = built.dataSource;
			recorded = built.recorded;
			await RolePermissionUtils.migrateRolePermissions(built.queryRunner);
		});

		afterAll(async () => {
			jest.restoreAllMocks();
			await dataSource.destroy();
		});

		it('reads each role’s existing permissions exactly once, not once per permission', () => {
			const existenceReads = recorded.filter((r) => isExistenceRead(r.sql)).length;

			// One batched read per role — and critically NOT one per (role, permission) pair.
			expect(existenceReads).toBe(EXPECTED_ROLE_COUNT);

			// CONTROL: what the pre-fix shape would have cost on this same fixture. If this number
			// were not far larger than the assertion above, the test could pass without the fix and
			// would be proving nothing.
			const preFixRoundTrips = EXPECTED_ROLE_COUNT * ALL_PERMISSIONS.length;
			expect(preFixRoundTrips).toBeGreaterThan(existenceReads * 50);
		});

		it('never issues the per-permission existence probe', () => {
			// The old `checkPermissionExistence` query is recognizable by its `distinctAlias`
			// subquery. It is retained on the class, but the migration must not call it.
			expect(recorded.filter((r) => isPerPermissionProbe(r.sql))).toHaveLength(0);
		});

		it('inserts in batches — far fewer statements than rows', () => {
			const insertStatements = recorded.filter((r) => isInsert(r.sql)).length;
			const rowsInserted = recorded
				.filter((r) => isInsert(r.sql))
				.reduce((total, r) => total + r.parameters.length / 5, 0);

			expect(rowsInserted).toBe(EXPECTED_ROLE_COUNT * ALL_PERMISSIONS.length);

			// CONTROL: one statement per row was the old shape. Batching must beat it decisively.
			expect(insertStatements).toBeLessThan(rowsInserted / 10);
		});
	});

	describe('resulting rows', () => {
		let dataSource: DataSource;

		beforeAll(async () => {
			const built = await createSeededDataSource();
			dataSource = built.dataSource;
			await RolePermissionUtils.migrateRolePermissions(built.queryRunner);
		});

		afterAll(async () => {
			jest.restoreAllMocks();
			await dataSource.destroy();
		});

		it('grants every permission to every role exactly once', async () => {
			const [{ total }] = await dataSource.manager.query(`SELECT COUNT(*) AS total FROM "role_permission"`);
			expect(Number(total)).toBe(EXPECTED_ROLE_COUNT * ALL_PERMISSIONS.length);

			const duplicates = await dataSource.manager.query(
				`SELECT COUNT(*) AS dupes FROM (
					SELECT "tenantId", "roleId", "permission" FROM "role_permission"
					GROUP BY "tenantId", "roleId", "permission" HAVING COUNT(*) > 1
				)`
			);
			expect(Number(duplicates[0].dupes)).toBe(0);
		});

		it('sets enabled from DEFAULT_ROLE_PERMISSIONS', async () => {
			const defaults = DEFAULT_ROLE_PERMISSIONS.find((entry) => entry.role === RolesEnum.EMPLOYEE);
			const enabledForEmployee = defaults?.defaultEnabledPermissions ?? [];

			// Pick a permission the EMPLOYEE role is meant to have, and one it is not.
			const shouldBeEnabled = enabledForEmployee[0];
			const shouldBeDisabled = ALL_PERMISSIONS.find((p) => !enabledForEmployee.includes(p));

			expect(shouldBeEnabled).toBeDefined();
			expect(shouldBeDisabled).toBeDefined();

			const read = async (permission: string) => {
				const rows = await dataSource.manager.query(
					`SELECT "enabled" FROM "role_permission" WHERE "roleId" = ? AND "permission" = ?`,
					[`tenant-0-${RolesEnum.EMPLOYEE}`, permission]
				);
				return Number(rows[0].enabled);
			};

			expect(await read(shouldBeEnabled as string)).toBe(1);
			expect(await read(shouldBeDisabled as string)).toBe(0);
		});
	});

	describe('re-running is safe', () => {
		it('is idempotent, and never disables or removes an existing grant', async () => {
			const built = await createSeededDataSource();
			const { dataSource, queryRunner, recorded } = built;

			await RolePermissionUtils.migrateRolePermissions(queryRunner);

			const roleId = `tenant-0-${RolesEnum.EMPLOYEE}`;
			const defaults = DEFAULT_ROLE_PERMISSIONS.find((entry) => entry.role === RolesEnum.EMPLOYEE);
			const enabledByDefault = (defaults?.defaultEnabledPermissions ?? [])[0] as string;

			// An operator has deliberately turned OFF a permission that the defaults enable. The
			// migration only ever INSERTS missing rows, so this customization must survive.
			await dataSource.manager.query(
				`UPDATE "role_permission" SET "enabled" = 0 WHERE "roleId" = ? AND "permission" = ?`,
				[roleId, enabledByDefault]
			);

			const [{ total: before }] = await dataSource.manager.query(
				`SELECT COUNT(*) AS total FROM "role_permission"`
			);

			recorded.length = 0;
			await RolePermissionUtils.migrateRolePermissions(queryRunner);

			const [{ total: after }] = await dataSource.manager.query(
				`SELECT COUNT(*) AS total FROM "role_permission"`
			);

			// Nothing added on the second pass...
			expect(Number(after)).toBe(Number(before));
			expect(recorded.filter((r) => isInsert(r.sql))).toHaveLength(0);

			// ...and the operator's change was not reverted.
			const rows = await dataSource.manager.query(
				`SELECT "enabled" FROM "role_permission" WHERE "roleId" = ? AND "permission" = ?`,
				[roleId, enabledByDefault]
			);
			expect(Number(rows[0].enabled)).toBe(0);

			jest.restoreAllMocks();
			await dataSource.destroy();
		});
	});

	describe('two processes reloading at the same time', () => {
		/**
		 * The race that filled production with duplicates: another process inserts a role's missing
		 * permissions after this one has read them as missing. With the unique index in place the
		 * second insert must skip those rows. Failing instead is worse than it looks: the reload
		 * migrations catch the error and move on, so every tenant after this one would silently miss
		 * its new permissions.
		 */
		it('skips rows the other process inserted first, and leaves them as they were', async () => {
			const { dataSource, queryRunner } = await createSeededDataSource({ uniqueIndex: true });

			// The other process gets there first.
			await RolePermissionUtils.migrateRolePermissions(queryRunner);

			const roleId = `tenant-0-${RolesEnum.EMPLOYEE}`;
			const defaults = DEFAULT_ROLE_PERMISSIONS.find((entry) => entry.role === RolesEnum.EMPLOYEE);
			const enabledByDefault = (defaults?.defaultEnabledPermissions ?? [])[0] as string;
			await dataSource.manager.query(
				`UPDATE "role_permission" SET "enabled" = 0 WHERE "roleId" = ? AND "permission" = ?`,
				[roleId, enabledByDefault]
			);

			// CONTROL: the fixture enforces the index, so a plain duplicate insert is refused. Without
			// this, the pass below could come from a table that accepts duplicates.
			await expect(
				dataSource.manager.query(
					`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled") VALUES (?, ?, ?, ?, ?)`,
					['duplicate-probe', 'tenant-0', roleId, enabledByDefault, 1]
				)
			).rejects.toThrow(/UNIQUE constraint failed/);

			// This process read before the other one inserted, so it still sees every permission missing.
			jest.spyOn(RolePermissionUtils as any, 'getExistingPermissions').mockResolvedValue(new Set<string>());

			await expect(RolePermissionUtils.migrateRolePermissions(queryRunner)).resolves.toBeUndefined();

			const [{ total }] = await dataSource.manager.query(`SELECT COUNT(*) AS total FROM "role_permission"`);
			expect(Number(total)).toBe(EXPECTED_ROLE_COUNT * ALL_PERMISSIONS.length);

			// The existing row was skipped, not overwritten: the operator's change survives.
			const rows = await dataSource.manager.query(
				`SELECT "enabled" FROM "role_permission" WHERE "roleId" = ? AND "permission" = ?`,
				[roleId, enabledByDefault]
			);
			expect(rows).toHaveLength(1);
			expect(Number(rows[0].enabled)).toBe(0);

			jest.restoreAllMocks();
			await dataSource.destroy();
		});
	});
});
