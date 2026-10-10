import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds `employee.lastSeenAt` and `employee.isIdle`, written by the presence heartbeat
 * (`PUT /employee/me/presence`): when the employee's client last reported in, and whether it saw no
 * user input for a while at that time.
 *
 * Both are nullable with no default: existing employees keep NULL, which reads as "never seen", so no
 * existing row is read or written and no client that ignores the columns is affected.
 *
 * Safe to run on a live database: on Postgres a nullable column without a default is a catalog-only
 * change. Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column check elsewhere), and a
 * transaction-scoped advisory lock makes two API processes that boot at the same time against one
 * database run it one after the other.
 *
 * `down` drops both columns.
 */
export class AddEmployeePresence1790000025000 implements MigrationInterface {
	name = 'AddEmployeePresence1790000025000';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1790000025000;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.postgres:
				if (queryRunner.isTransactionActive) {
					await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
				}
				await queryRunner.query(`ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP`);
				await queryRunner.query(`ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "isIdle" boolean`);
				break;
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				if (!(await queryRunner.hasColumn('employee', 'lastSeenAt'))) {
					await queryRunner.query(`ALTER TABLE "employee" ADD COLUMN "lastSeenAt" datetime`);
				}
				if (!(await queryRunner.hasColumn('employee', 'isIdle'))) {
					await queryRunner.query(`ALTER TABLE "employee" ADD COLUMN "isIdle" boolean`);
				}
				break;
			case DatabaseTypeEnum.mysql:
				if (!(await queryRunner.hasColumn('employee', 'lastSeenAt'))) {
					await queryRunner.query('ALTER TABLE `employee` ADD `lastSeenAt` datetime NULL');
				}
				if (!(await queryRunner.hasColumn('employee', 'isIdle'))) {
					await queryRunner.query('ALTER TABLE `employee` ADD `isIdle` tinyint NULL');
				}
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.postgres:
				await queryRunner.query(`ALTER TABLE "employee" DROP COLUMN IF EXISTS "isIdle"`);
				await queryRunner.query(`ALTER TABLE "employee" DROP COLUMN IF EXISTS "lastSeenAt"`);
				break;
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				if (await queryRunner.hasColumn('employee', 'isIdle')) {
					await queryRunner.query(`ALTER TABLE "employee" DROP COLUMN "isIdle"`);
				}
				if (await queryRunner.hasColumn('employee', 'lastSeenAt')) {
					await queryRunner.query(`ALTER TABLE "employee" DROP COLUMN "lastSeenAt"`);
				}
				break;
			case DatabaseTypeEnum.mysql:
				if (await queryRunner.hasColumn('employee', 'isIdle')) {
					await queryRunner.query('ALTER TABLE `employee` DROP COLUMN `isIdle`');
				}
				if (await queryRunner.hasColumn('employee', 'lastSeenAt')) {
					await queryRunner.query('ALTER TABLE `employee` DROP COLUMN `lastSeenAt`');
				}
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}
}
