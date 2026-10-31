import { QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { ConnectTimeOffBalancesToApproval1791000003630 } from './migrations/1791000003630-ConnectTimeOffBalancesToApproval';

/**
 * `time_off_balance_deduction` and `time_off_policy.requireSufficientBalance` (ever-co/ever-gauzy#10183) on PostgreSQL
 * and MySQL, desk-checked through a recording `QueryRunner`. The SQLite statements run on a real database in
 * `time-off.status.handler.balance.spec.ts`, where TypeORM finds nothing to change between what they create and the
 * entities.
 */

type ExecutedQuery = { sql: string; parameters: any[] };

const createQueryRunner = (
	type: DatabaseTypeEnum,
	{ hasTable = false, hasColumn = false, lockAcquired = 1, isTransactionActive = true } = {}
): { queryRunner: QueryRunner; executed: ExecutedQuery[] } => {
	const executed: ExecutedQuery[] = [];
	const queryRunner = {
		connection: { options: { type } },
		isTransactionActive,
		hasTable: jest.fn(async () => hasTable),
		hasColumn: jest.fn(async () => hasColumn),
		query: jest.fn(async (sql: string, parameters: any[] = []) => {
			executed.push({ sql, parameters });
			return /GET_LOCK/.test(sql) ? [{ acquired: lockAcquired }] : [];
		})
	} as unknown as QueryRunner;

	return { queryRunner, executed };
};

const FOREIGN_KEYS = [
	['createdByUserId', 'user'],
	['updatedByUserId', 'user'],
	['deletedByUserId', 'user'],
	['tenantId', 'tenant'],
	['organizationId', 'organization'],
	['timeOffRequestId', 'time_off_request'],
	['balanceId', 'time_off_balance']
];

describe('ConnectTimeOffBalancesToApproval1791000003630', () => {
	let migration: ConnectTimeOffBalancesToApproval1791000003630;

	beforeEach(() => {
		migration = new ConnectTimeOffBalancesToApproval1791000003630();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('on PostgreSQL', () => {
		it('creates the table under the advisory lock, with its indexes, the unique pair and cascading keys', async () => {
			const { queryRunner, executed } = createQueryRunner(DatabaseTypeEnum.postgres);

			await migration.up(queryRunner);

			const statements = executed.map(({ sql }) => sql);
			expect(statements[0]).toBe('SELECT pg_advisory_xact_lock($1)');
			expect(executed[0].parameters).toEqual([1791000003630]);
			expect(statements[1]).toBe(
				'ALTER TABLE "time_off_policy" ADD "requireSufficientBalance" boolean DEFAULT false'
			);
			expect(statements[2]).toMatch(/^CREATE TABLE "time_off_balance_deduction" \(/);
			expect(statements[2]).toContain('"days" numeric(10,2) NOT NULL');
			expect(statements[2]).toContain('"timeOffRequestId" uuid NOT NULL');
			expect(statements[2]).toContain('"balanceId" uuid NOT NULL');
			expect(statements.filter((sql) => /^CREATE INDEX/.test(sql))).toHaveLength(9);
			expect(statements).toContain(
				'CREATE UNIQUE INDEX "IDX_time_off_balance_deduction_unique" ON "time_off_balance_deduction" ("timeOffRequestId", "balanceId") '
			);
			const keys = statements.filter((sql) => /FOREIGN KEY/.test(sql));
			expect(keys).toHaveLength(FOREIGN_KEYS.length);
			for (const [column, table] of FOREIGN_KEYS) {
				expect(keys).toContainEqual(
					expect.stringContaining(`FOREIGN KEY ("${column}") REFERENCES "${table}"("id") ON DELETE CASCADE`)
				);
			}
		});

		it('adds nothing when the table and the column are there already', async () => {
			const { queryRunner, executed } = createQueryRunner(DatabaseTypeEnum.postgres, {
				hasTable: true,
				hasColumn: true
			});

			await migration.up(queryRunner);

			expect(executed.map(({ sql }) => sql)).toEqual(['SELECT pg_advisory_xact_lock($1)']);
		});

		it('adds the column alone when the table is there already', async () => {
			const { queryRunner, executed } = createQueryRunner(DatabaseTypeEnum.postgres, { hasTable: true });

			await migration.up(queryRunner);

			expect(executed.map(({ sql }) => sql)).toEqual([
				'SELECT pg_advisory_xact_lock($1)',
				'ALTER TABLE "time_off_policy" ADD "requireSufficientBalance" boolean DEFAULT false'
			]);
		});
	});

	describe('on MySQL', () => {
		it('adds the column, and creates the table, its indexes and keys in one statement, under a named lock', async () => {
			const { queryRunner, executed } = createQueryRunner(DatabaseTypeEnum.mysql);

			await migration.up(queryRunner);

			const statements = executed.map(({ sql }) => sql);
			expect(statements).toHaveLength(4);
			expect(statements[0]).toMatch(/GET_LOCK/);
			expect(statements[1]).toBe(
				'ALTER TABLE `time_off_policy` ADD `requireSufficientBalance` tinyint NULL DEFAULT 0'
			);
			expect(statements[3]).toMatch(/RELEASE_LOCK/);
			const create = statements[2];
			expect(create).toMatch(/^CREATE TABLE `time_off_balance_deduction` \(/);
			expect(create).toContain('`days` decimal(10,2) NOT NULL');
			expect(create).toContain(
				'UNIQUE INDEX `IDX_time_off_balance_deduction_unique` (`timeOffRequestId`, `balanceId`)'
			);
			for (const [column, table] of FOREIGN_KEYS) {
				expect(create).toContain(
					`FOREIGN KEY (\`${column}\`) REFERENCES \`${table}\`(\`id\`) ON DELETE CASCADE`
				);
			}
		});

		it('refuses to run without the lock, and releases it when the statement fails', async () => {
			const refused = createQueryRunner(DatabaseTypeEnum.mysql, { lockAcquired: 0 });
			await expect(migration.up(refused.queryRunner)).rejects.toThrow(/could not acquire/);
			expect(refused.executed).toHaveLength(1);

			const failing = createQueryRunner(DatabaseTypeEnum.mysql);
			(failing.queryRunner.hasTable as jest.Mock).mockRejectedValueOnce(new Error('boom'));
			await expect(migration.up(failing.queryRunner)).rejects.toThrow('boom');
			expect(failing.executed.map(({ sql }) => sql).pop()).toMatch(/RELEASE_LOCK/);
		});
	});

	it.each([
		[
			DatabaseTypeEnum.postgres,
			[
				'DROP TABLE IF EXISTS "time_off_balance_deduction"',
				'ALTER TABLE "time_off_policy" DROP COLUMN "requireSufficientBalance"'
			]
		],
		[
			DatabaseTypeEnum.betterSqlite3,
			[
				'DROP TABLE IF EXISTS "time_off_balance_deduction"',
				'ALTER TABLE "time_off_policy" DROP COLUMN "requireSufficientBalance"'
			]
		],
		[
			DatabaseTypeEnum.mysql,
			[
				'DROP TABLE IF EXISTS `time_off_balance_deduction`',
				'ALTER TABLE `time_off_policy` DROP COLUMN `requireSufficientBalance`'
			]
		]
	])('down drops the table and the column on %s', async (type, statements) => {
		const { queryRunner, executed } = createQueryRunner(type, { hasColumn: true });

		await migration.down(queryRunner);

		expect(executed.map(({ sql }) => sql)).toEqual(statements);
	});
});
