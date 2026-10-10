import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds `timesheet.reason`: why a timesheet was denied. `PUT /timesheet/status` writes it when the status
 * becomes DENIED, so the employee can see why their timesheet was refused.
 *
 * Nullable with no default: existing timesheets keep NULL. No existing row is read or written.
 *
 * Safe to run on a live database: on Postgres a nullable column without a default is a catalog-only
 * change. Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column check elsewhere), and a
 * transaction-scoped advisory lock makes two API processes that boot at the same time against one
 * database run it one after the other.
 *
 * `down` drops the column.
 */
export class AddTimesheetReason1790000025000 implements MigrationInterface {
	name = 'AddTimesheetReason1790000025000';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1790000025000;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const type = this.supportedType(queryRunner);
		if (type === DatabaseTypeEnum.postgres) {
			if (queryRunner.isTransactionActive) {
				await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
			}
			await queryRunner.query(`ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "reason" text`);
		} else if (!(await queryRunner.hasColumn('timesheet', 'reason'))) {
			await queryRunner.query(
				type === DatabaseTypeEnum.mysql
					? 'ALTER TABLE `timesheet` ADD `reason` text NULL'
					: `ALTER TABLE "timesheet" ADD COLUMN "reason" text`
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const type = this.supportedType(queryRunner);
		if (type === DatabaseTypeEnum.postgres) {
			await queryRunner.query(`ALTER TABLE "timesheet" DROP COLUMN IF EXISTS "reason"`);
		} else if (await queryRunner.hasColumn('timesheet', 'reason')) {
			await queryRunner.query(
				type === DatabaseTypeEnum.mysql
					? 'ALTER TABLE `timesheet` DROP COLUMN `reason`'
					: `ALTER TABLE "timesheet" DROP COLUMN "reason"`
			);
		}
	}

	/** The connection's database type. Both SQLite drivers take the double-quoted statements; any other database throws. */
	private supportedType(queryRunner: QueryRunner): DatabaseTypeEnum {
		const type = queryRunner.connection.options.type as DatabaseTypeEnum;
		const supported = [
			DatabaseTypeEnum.postgres,
			DatabaseTypeEnum.mysql,
			DatabaseTypeEnum.sqlite,
			DatabaseTypeEnum.betterSqlite3
		];
		if (!supported.includes(type)) {
			throw new Error(`Unsupported database: ${type}`);
		}
		return type;
	}
}
