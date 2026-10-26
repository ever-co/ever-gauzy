import { DataSource, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { CreateIdempotencyKeyTable1791000000010 } from '../database/migrations/1791000000010-CreateIdempotencyKeyTable';
import { CreateOperationTables1791000000030 } from '../database/migrations/1791000000030-CreateOperationTables';
import { ScopeIdempotencyKeyByTenant1791000000557 } from '../database/migrations/1791000000557-ScopeIdempotencyKeyByTenant';

/**
 * The unique indexes the two idempotency locks are, run as the database runs them.
 *
 * `IdempotencyService.findByKey` reads a key by tenant and organization, and the insert that claims a
 * key is refused by the unique index. The two have to scope a key the same way: the index the table
 * shipped with folded the organization but carried no tenant, so two tenants whose callers had no
 * organization selected shared one tuple, and the second tenant's claim was refused by a row its own read
 * could not see. `OperationService.findByIdempotencyKey` and `UQ_operation_idem` had the same gap for a
 * durable operation's submission key. `ScopeIdempotencyKeyByTenant1791000000557` puts the tenant into both
 * tuples.
 *
 * SQLite is run for real, on an in-memory better-sqlite3 database built by each table's own migration, so
 * the cases below are statements about the indexes rather than about a double of them. Postgres and MySQL
 * are read off the statements the migration issues, which is as far as a suite without those servers can
 * go; the MySQL branch is the one that differs in kind, because it indexes stored generated columns.
 */

const ZERO = '00000000-0000-0000-0000-000000000000';

let dataSource: DataSource;
let runner: QueryRunner;
let sequence = 0;

/** Inserts one key row the way a claim does, with only the columns the tuple is about varying. */
async function insertKey(values: { tenantId: string | null; organizationId?: string | null; key?: string; deletedAt?: string }) {
	sequence += 1;

	await runner.query(
		`INSERT INTO "idempotency_key" ("id", "tenantId", "organizationId", "key", "scope", "requestHash", "expiresAt", "deletedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			`row-${sequence}`,
			values.tenantId,
			values.organizationId ?? null,
			values.key ?? 'key-12345678',
			'checkout.complete',
			'a'.repeat(64),
			'2026-03-02 00:00:00',
			values.deletedAt ?? null
		]
	);
}

/** Inserts one operation the way a submission does, with only the columns its two rules read varying. */
async function insertOperation(values: {
	tenantId: string | null;
	organizationId?: string | null;
	idempotencyKey?: string | null;
	status?: string;
	aggregateId?: string | null;
	deletedAt?: string;
}) {
	sequence += 1;

	await runner.query(
		`INSERT INTO "operation" ("id", "tenantId", "organizationId", "type", "status", "input", "idempotencyKey", "aggregateType", "aggregateId", "deletedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			`operation-${sequence}`,
			values.tenantId,
			values.organizationId ?? null,
			'CHECKOUT_COMPLETE',
			values.status ?? 'COMPLETED',
			'{}',
			values.idempotencyKey === undefined ? 'submission-1' : values.idempotencyKey,
			values.aggregateId ? 'cart' : null,
			values.aggregateId ?? null,
			values.deletedAt ?? null
		]
	);
}

/** The unique indexes a table carries, by name. */
async function uniqueIndexes(table = 'idempotency_key'): Promise<string[]> {
	const rows: { name: string }[] = await runner.query(
		`SELECT "name" FROM "sqlite_master" WHERE "type" = 'index' AND "tbl_name" = ? AND "sql" LIKE 'CREATE UNIQUE INDEX%' ORDER BY "name"`,
		[table]
	);

	return rows.map((row) => row.name);
}

describe('the idempotency locks on SQLite', () => {
	beforeEach(async () => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);

		dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:' });
		await dataSource.initialize();
		runner = dataSource.createQueryRunner();

		await new CreateIdempotencyKeyTable1791000000010().up(runner);
		await new CreateOperationTables1791000000030().up(runner);
	});

	afterEach(async () => {
		await runner.release();
		await dataSource.destroy();
		jest.restoreAllMocks();
	});

	describe('the idempotency key', () => {
		it("refused a second tenant's key before the tenant was part of the tuple", async () => {
			// Control, and the defect itself: two tenants, neither with an organization selected, one key. The
			// index the table shipped with collapses them onto one tuple.
			await insertKey({ tenantId: 'tenant-1' });

			await expect(insertKey({ tenantId: 'tenant-2' })).rejects.toThrow(/UNIQUE constraint failed/);
		});

		it('lets two tenants hold one key once the tenant is part of the tuple, and still locks it inside one', async () => {
			await new ScopeIdempotencyKeyByTenant1791000000557().up(runner);

			await insertKey({ tenantId: 'tenant-1' });
			await insertKey({ tenantId: 'tenant-2' });

			// The lock itself is unchanged inside a tenant: the retry of the same key by the same caller is
			// refused, which is the answer the claim is decided by.
			await expect(insertKey({ tenantId: 'tenant-1' })).rejects.toThrow(/UNIQUE constraint failed/);
			// A null in either scope column is folded rather than exempt. Control: a bare nullable column would
			// let a caller with no tenant and no organization claim one key any number of times.
			await insertKey({ tenantId: null });
			await expect(insertKey({ tenantId: null })).rejects.toThrow(/UNIQUE constraint failed/);
			// An organization is one more member of the tuple, as it always was.
			await insertKey({ tenantId: 'tenant-1', organizationId: 'org-1' });
			await expect(insertKey({ tenantId: 'tenant-1', organizationId: 'org-1' })).rejects.toThrow(
				/UNIQUE constraint failed/
			);

			expect(await uniqueIndexes()).toEqual(['UQ_idempotency_tenant_org_scope_key']);
		});

		it('keeps the soft-delete predicate, so a released key can be claimed again', async () => {
			await new ScopeIdempotencyKeyByTenant1791000000557().up(runner);

			await insertKey({ tenantId: 'tenant-1', deletedAt: '2026-03-01 09:00:00' });
			await insertKey({ tenantId: 'tenant-1' });

			await expect(insertKey({ tenantId: 'tenant-1' })).rejects.toThrow(/UNIQUE constraint failed/);
		});

		it('builds on live rows, because the old tuple already kept the new one unique', async () => {
			await insertKey({ tenantId: 'tenant-1' });
			await insertKey({ tenantId: 'tenant-1', key: 'key-87654321' });
			await insertKey({ tenantId: 'tenant-1', organizationId: 'org-1' });

			await new ScopeIdempotencyKeyByTenant1791000000557().up(runner);

			expect(await uniqueIndexes()).toEqual(['UQ_idempotency_tenant_org_scope_key']);
		});

		it('restores the original index on the way down', async () => {
			const migration = new ScopeIdempotencyKeyByTenant1791000000557();

			await migration.up(runner);
			await migration.down(runner);

			expect(await uniqueIndexes()).toEqual(['UQ_idempotency_org_scope_key']);
			await insertKey({ tenantId: 'tenant-1' });
			await expect(insertKey({ tenantId: 'tenant-2' })).rejects.toThrow(/UNIQUE constraint failed/);
		});
	});

	describe("an operation's submission key", () => {
		it("refused a second tenant's submission before the tenant was part of the tuple", async () => {
			// Control, and the defect: `OperationService` reads a submission by tenant and organization, so the
			// second tenant found nothing, lost the insert to this row, and was answered `409` for a key it had
			// never used.
			await insertOperation({ tenantId: 'tenant-1' });

			await expect(insertOperation({ tenantId: 'tenant-2' })).rejects.toThrow(/UNIQUE constraint failed/);
		});

		it('lets two tenants submit under one key once the tenant is part of the tuple, and still locks it inside one', async () => {
			await new ScopeIdempotencyKeyByTenant1791000000557().up(runner);

			await insertOperation({ tenantId: 'tenant-1' });
			await insertOperation({ tenantId: 'tenant-2' });

			// A retried submission inside one tenant is still refused, which is what hands it the original
			// operation instead of a second one.
			await expect(insertOperation({ tenantId: 'tenant-1' })).rejects.toThrow(/UNIQUE constraint failed/);
			// The tenant is folded rather than exempt, like the organization beside it.
			await insertOperation({ tenantId: null });
			await expect(insertOperation({ tenantId: null })).rejects.toThrow(/UNIQUE constraint failed/);
			// An operation with no key is still outside the rule, and a released one frees its key.
			await insertOperation({ tenantId: 'tenant-1', idempotencyKey: null });
			await insertOperation({ tenantId: 'tenant-1', idempotencyKey: null });
			await insertOperation({ tenantId: 'tenant-3', deletedAt: '2026-03-01 09:00:00' });
			await insertOperation({ tenantId: 'tenant-3' });

			expect(await uniqueIndexes('operation')).toEqual(['UQ_operation_aggregate_live', 'UQ_operation_tenant_idem']);
		});

		it('leaves the live-aggregate rule as it was', async () => {
			await new ScopeIdempotencyKeyByTenant1791000000557().up(runner);

			// An aggregate id names one row of one tenant, so the rule carries no tenant and still refuses a
			// second live operation on the aggregate.
			await insertOperation({ tenantId: 'tenant-1', idempotencyKey: null, status: 'RUNNING', aggregateId: 'cart-1' });

			await expect(
				insertOperation({ tenantId: 'tenant-1', idempotencyKey: null, status: 'PENDING', aggregateId: 'cart-1' })
			).rejects.toThrow(/UNIQUE constraint failed/);
		});

		it('restores the original index on the way down', async () => {
			const migration = new ScopeIdempotencyKeyByTenant1791000000557();

			await migration.up(runner);
			await migration.down(runner);

			expect(await uniqueIndexes('operation')).toEqual(['UQ_operation_aggregate_live', 'UQ_operation_idem']);
			await insertOperation({ tenantId: 'tenant-1' });
			await expect(insertOperation({ tenantId: 'tenant-2' })).rejects.toThrow(/UNIQUE constraint failed/);
		});
	});

	it('runs twice without failing, because a migration can be retried', async () => {
		const migration = new ScopeIdempotencyKeyByTenant1791000000557();

		await migration.up(runner);
		await migration.up(runner);

		expect(await uniqueIndexes()).toEqual(['UQ_idempotency_tenant_org_scope_key']);
		expect(await uniqueIndexes('operation')).toEqual(['UQ_operation_aggregate_live', 'UQ_operation_tenant_idem']);
	});
});

/** A `QueryRunner` stand-in that records every statement a dialect's branch issues. */
function recordingRunner(type: DatabaseTypeEnum, columns: string[] = []) {
	const executed: string[] = [];
	const queryRunner = {
		connection: { options: { type } },
		hasTable: jest.fn(async () => true),
		hasColumn: jest.fn(async (table: string, column: string) => columns.includes(`${table}.${column}`)),
		query: jest.fn(async (sql: string) => {
			executed.push(sql);

			return [];
		})
	} as unknown as QueryRunner;

	return { queryRunner, executed };
}

describe('the idempotency locks on the server dialects', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('folds the tenant beside the organization on Postgres, creating each new index before dropping the old', async () => {
		const { queryRunner, executed } = recordingRunner(DatabaseTypeEnum.postgres);

		await new ScopeIdempotencyKeyByTenant1791000000557().up(queryRunner);

		expect(executed).toEqual([
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_idempotency_tenant_org_scope_key" ON "idempotency_key" (COALESCE("tenantId", '${ZERO}'), COALESCE("organizationId", '${ZERO}'), "scope", "key") WHERE "deletedAt" IS NULL`,
			`DROP INDEX IF EXISTS "UQ_idempotency_org_scope_key"`,
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_operation_tenant_idem" ON "operation" (COALESCE("tenantId", '${ZERO}'), COALESCE("organizationId", '${ZERO}'), "type", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL`,
			`DROP INDEX IF EXISTS "UQ_operation_idem"`
		]);
	});

	it('restores both original indexes on Postgres on the way down', async () => {
		const { queryRunner, executed } = recordingRunner(DatabaseTypeEnum.postgres);

		await new ScopeIdempotencyKeyByTenant1791000000557().down(queryRunner);

		expect(executed).toEqual([
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_operation_idem" ON "operation" (COALESCE("organizationId", '${ZERO}'), "type", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL`,
			`DROP INDEX IF EXISTS "UQ_operation_tenant_idem"`,
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_idempotency_org_scope_key" ON "idempotency_key" (COALESCE("organizationId", '${ZERO}'), "scope", "key") WHERE "deletedAt" IS NULL`,
			`DROP INDEX IF EXISTS "UQ_idempotency_tenant_org_scope_key"`
		]);
	});

	it('indexes a stored generated tenant column on MySQL, which has no expression or filtered index', async () => {
		const { queryRunner, executed } = recordingRunner(DatabaseTypeEnum.mysql);

		await new ScopeIdempotencyKeyByTenant1791000000557().up(queryRunner);

		// A bare nullable `tenantId` in a MySQL unique index would exempt every row whose tenant is null —
		// MySQL skips any tuple containing a null — so the tenant is folded into a stored column first, the
		// way `organizationKey` and `deletedKey` already are. `idempotencyKey` stays raw on `operation`, as
		// it was: its null is the exemption the other dialects state as a predicate.
		expect(executed).toEqual([
			"ALTER TABLE `idempotency_key` ADD `tenantKey` varchar(36) GENERATED ALWAYS AS (IFNULL(`tenantId`, '" +
				ZERO +
				"')) STORED",
			'CREATE UNIQUE INDEX `UQ_idempotency_tenant_org_scope_key` ON `idempotency_key` (`tenantKey`, `organizationKey`, `scope`, `key`, `deletedKey`)',
			'DROP INDEX `UQ_idempotency_org_scope_key` ON `idempotency_key`',
			"ALTER TABLE `operation` ADD `tenantKey` varchar(36) GENERATED ALWAYS AS (IFNULL(`tenantId`, '" + ZERO + "')) STORED",
			'CREATE UNIQUE INDEX `UQ_operation_tenant_idem` ON `operation` (`tenantKey`, `organizationKey`, `type`, `idempotencyKey`, `deletedKey`)',
			'DROP INDEX `UQ_operation_idem` ON `operation`'
		]);
	});

	it('does not add a MySQL column twice when the migration is retried', async () => {
		const { queryRunner, executed } = recordingRunner(DatabaseTypeEnum.mysql, [
			'idempotency_key.tenantKey',
			'operation.tenantKey'
		]);

		(queryRunner.query as jest.Mock).mockImplementation(async (sql: string) => {
			executed.push(sql);

			// What MySQL answers on a retry: the new index is already there, and the old one is already gone.
			if (sql.startsWith('CREATE UNIQUE INDEX')) {
				throw new Error("ER_DUP_KEYNAME: Duplicate key name 'UQ_idempotency_tenant_org_scope_key'");
			}

			if (sql.startsWith('DROP INDEX')) {
				throw new Error("ER_CANT_DROP_FIELD_OR_KEY: Can't DROP 'UQ_idempotency_org_scope_key'; check that column/key exists");
			}

			return [];
		});

		await new ScopeIdempotencyKeyByTenant1791000000557().up(queryRunner);

		expect(executed.some((sql) => sql.startsWith('ALTER TABLE'))).toBe(false);
		// Both tables were still visited, so a retry that stopped after the first finishes the second.
		expect(executed.filter((sql) => sql.startsWith('CREATE UNIQUE INDEX'))).toHaveLength(2);
	});

	it('does not swallow a MySQL failure that is not the retry it tolerates', async () => {
		const { queryRunner } = recordingRunner(DatabaseTypeEnum.mysql, ['idempotency_key.tenantKey']);

		(queryRunner.query as jest.Mock).mockRejectedValueOnce(new Error('ER_LOCK_WAIT_TIMEOUT: Lock wait timeout exceeded'));

		// Control: a create that failed for any other reason leaves the old, coarser index in place, and
		// that has to be seen rather than recorded as a migration that ran.
		await expect(new ScopeIdempotencyKeyByTenant1791000000557().up(queryRunner)).rejects.toThrow(/Lock wait timeout/);
	});

	it('restores the original MySQL indexes and removes the columns on the way down', async () => {
		const { queryRunner, executed } = recordingRunner(DatabaseTypeEnum.mysql, [
			'idempotency_key.tenantKey',
			'operation.tenantKey'
		]);

		await new ScopeIdempotencyKeyByTenant1791000000557().down(queryRunner);

		expect(executed).toEqual([
			'CREATE UNIQUE INDEX `UQ_operation_idem` ON `operation` (`organizationKey`, `type`, `idempotencyKey`, `deletedKey`)',
			'DROP INDEX `UQ_operation_tenant_idem` ON `operation`',
			'ALTER TABLE `operation` DROP COLUMN `tenantKey`',
			'CREATE UNIQUE INDEX `UQ_idempotency_org_scope_key` ON `idempotency_key` (`organizationKey`, `scope`, `key`, `deletedKey`)',
			'DROP INDEX `UQ_idempotency_tenant_org_scope_key` ON `idempotency_key`',
			'ALTER TABLE `idempotency_key` DROP COLUMN `tenantKey`'
		]);
	});

	it('leaves a table that is not there alone', async () => {
		const { queryRunner, executed } = recordingRunner(DatabaseTypeEnum.postgres);

		(queryRunner.hasTable as jest.Mock).mockImplementation(async (table: string) => table === 'idempotency_key');

		await new ScopeIdempotencyKeyByTenant1791000000557().up(queryRunner);

		expect(executed).toHaveLength(2);
		expect(executed.some((sql) => sql.includes('"operation"'))).toBe(false);
	});
});
