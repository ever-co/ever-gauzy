import { QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { AlterEmployeeBillingRateColumnsToNumeric1790000014000 } from './migrations/1790000014000-AlterEmployeeBillingRateColumnsToNumeric';

type ExecutedQuery = { sql: string; parameters: any[] };

const createQueryRunner = (type: DatabaseTypeEnum): { queryRunner: QueryRunner; executed: ExecutedQuery[] } => {
	const executed: ExecutedQuery[] = [];
	const queryRunner = {
		connection: { options: { type } },
		dataSource: { options: { type } },
		query: jest.fn(async (sql: string, parameters: any[] = []) => {
			executed.push({ sql, parameters });
			return [];
		})
	} as unknown as QueryRunner;

	return { queryRunner, executed };
};

describe('AlterEmployeeBillingRateColumnsToNumeric1790000014000', () => {
	let migration: AlterEmployeeBillingRateColumnsToNumeric1790000014000;

	beforeEach(() => {
		migration = new AlterEmployeeBillingRateColumnsToNumeric1790000014000();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('widens postgres money columns to numeric(14,2) and leaves weekly hours alone', async () => {
		const { queryRunner, executed } = createQueryRunner(DatabaseTypeEnum.postgres);

		await migration.up(queryRunner);

		expect(executed.map(({ sql }) => sql)).toEqual([
			'ALTER TABLE "employee" ALTER COLUMN "billRateValue" TYPE numeric(14,2) USING "billRateValue"::numeric(14,2)',
			'ALTER TABLE "employee" ALTER COLUMN "minimumBillingRate" TYPE numeric(14,2) USING "minimumBillingRate"::numeric(14,2)'
		]);
		expect(executed.some(({ sql }) => /reWeeklyLimit/.test(sql))).toBe(false);
	});

	it('widens mysql money columns to decimal(14,2)', async () => {
		const { queryRunner, executed } = createQueryRunner(DatabaseTypeEnum.mysql);

		await migration.up(queryRunner);

		expect(executed.map(({ sql }) => sql)).toEqual([
			'ALTER TABLE `employee` MODIFY `billRateValue` decimal(14,2) NULL',
			'ALTER TABLE `employee` MODIFY `minimumBillingRate` decimal(14,2) NULL'
		]);
	});

	it.each([DatabaseTypeEnum.sqlite, DatabaseTypeEnum.betterSqlite3])(
		'rewrites sqlite money columns through a temp copy on %s',
		async (type) => {
			const { queryRunner, executed } = createQueryRunner(type);

			await migration.up(queryRunner);

			const sql = executed.map(({ sql }) => sql);
			expect(sql).toEqual([
				'ALTER TABLE "employee" ADD COLUMN "billRateValue__tmp" numeric(14,2)',
				'UPDATE "employee" SET "billRateValue__tmp" = "billRateValue"',
				'ALTER TABLE "employee" DROP COLUMN "billRateValue"',
				'ALTER TABLE "employee" RENAME COLUMN "billRateValue__tmp" TO "billRateValue"',
				'ALTER TABLE "employee" ADD COLUMN "minimumBillingRate__tmp" numeric(14,2)',
				'UPDATE "employee" SET "minimumBillingRate__tmp" = "minimumBillingRate"',
				'ALTER TABLE "employee" DROP COLUMN "minimumBillingRate"',
				'ALTER TABLE "employee" RENAME COLUMN "minimumBillingRate__tmp" TO "minimumBillingRate"'
			]);
			expect(sql.some((statement) => /reWeeklyLimit/.test(statement))).toBe(false);
			expect(sql.some((statement) => /CREATE TABLE/.test(statement))).toBe(false);
		}
	);

	it.each([DatabaseTypeEnum.sqlite, DatabaseTypeEnum.betterSqlite3])(
		'rounds sqlite money columns to integers on rollback for %s',
		async (type) => {
			const { queryRunner, executed } = createQueryRunner(type);

			await migration.down(queryRunner);

			const sql = executed.map(({ sql }) => sql);
			expect(sql).toEqual([
				'ALTER TABLE "employee" ADD COLUMN "billRateValue__tmp" integer',
				'UPDATE "employee" SET "billRateValue__tmp" = CAST(ROUND("billRateValue") AS INTEGER)',
				'ALTER TABLE "employee" DROP COLUMN "billRateValue"',
				'ALTER TABLE "employee" RENAME COLUMN "billRateValue__tmp" TO "billRateValue"',
				'ALTER TABLE "employee" ADD COLUMN "minimumBillingRate__tmp" integer',
				'UPDATE "employee" SET "minimumBillingRate__tmp" = CAST(ROUND("minimumBillingRate") AS INTEGER)',
				'ALTER TABLE "employee" DROP COLUMN "minimumBillingRate"',
				'ALTER TABLE "employee" RENAME COLUMN "minimumBillingRate__tmp" TO "minimumBillingRate"'
			]);
		}
	);
});
