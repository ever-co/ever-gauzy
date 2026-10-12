import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Candidate bill/pay rates (`billRateValue`, `minimumBillingRate`) were stored as integers, so a
 * rate like `10.49` was truncated to `10` (issue #10199; employees were fixed by
 * `AlterEmployeeBillingRateColumnsToNumeric1790000014000`). Money columns become `numeric(14,2)` /
 * `decimal(14,2)` so cents survive, and a hired candidate's rate reaches the employee intact.
 * Weekly hour limit (`reWeeklyLimit`) is left as integer.
 *
 * Postgres and MySQL change both columns in ONE `ALTER TABLE`: one table rewrite instead of two on
 * Postgres, and no half-applied state on MySQL (its DDL commits implicitly).
 *
 * SQLite cannot `ALTER COLUMN … TYPE`. A rebuild that restates the full `candidate` DDL would
 * silently drop any column added after it was written, so this uses ADD / UPDATE / DROP / RENAME
 * instead (SQLite ≥ 3.35; bundled better-sqlite3 ships 3.51).
 *
 * Rolling back rounds the rates to whole numbers, and on Postgres/MySQL it fails if a rate above
 * 2,147,483,647 was saved after the upgrade (the old `integer` limit).
 */
export class AlterCandidateBillingRateColumnsToNumeric1790000016000 implements MigrationInterface {
	name = 'AlterCandidateBillingRateColumnsToNumeric1790000016000';

	private readonly moneyColumns = ['billRateValue', 'minimumBillingRate'] as const;

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.postgresLimitLockWait(queryRunner);
		const alterations = this.moneyColumns.map(
			(column) => `ALTER COLUMN "${column}" TYPE numeric(14,2) USING "${column}"::numeric(14,2)`
		);
		await queryRunner.query(`ALTER TABLE "candidate" ${alterations.join(', ')}`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.postgresLimitLockWait(queryRunner);
		const alterations = this.moneyColumns.map(
			(column) => `ALTER COLUMN "${column}" TYPE integer USING ROUND("${column}")::integer`
		);
		await queryRunner.query(`ALTER TABLE "candidate" ${alterations.join(', ')}`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of this.moneyColumns) {
			await this.sqliteRewriteColumn(queryRunner, column, 'numeric(14,2)');
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of this.moneyColumns) {
			await this.sqliteRewriteColumn(queryRunner, column, 'integer');
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		const alterations = this.moneyColumns.map((column) => `MODIFY \`${column}\` decimal(14,2) NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate\` ${alterations.join(', ')}`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		const alterations = this.moneyColumns.map((column) => `MODIFY \`${column}\` int NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate\` ${alterations.join(', ')}`);
	}

	/**
	 * `ALTER COLUMN … TYPE` needs an ACCESS EXCLUSIVE lock on `candidate`. While it waits for a
	 * long-running transaction, every later query on the table (candidate pages, interviews,
	 * feedbacks) queues behind it, with no upper bound. Give up after 5 s instead: the migration rolls back, requests
	 * flow again, and the API's TypeORM connection retry (every few seconds) runs it again.
	 * With `migrationsTransactionMode: 'each'`, which every Gauzy entry point uses, `SET LOCAL` lasts
	 * only until this migration's transaction ends.
	 */
	private async postgresLimitLockWait(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
	}

	/**
	 * SQLite has no `ALTER COLUMN TYPE`. Copy through a temporary column instead of restating the
	 * full `candidate` table (a stale rebuild would drop later-added columns).
	 */
	private async sqliteRewriteColumn(queryRunner: QueryRunner, column: string, declaredType: string): Promise<void> {
		const temporary = `${column}__tmp`;
		const copyExpression = declaredType === 'integer' ? `CAST(ROUND("${column}") AS INTEGER)` : `"${column}"`;
		await queryRunner.query(`ALTER TABLE "candidate" ADD COLUMN "${temporary}" ${declaredType}`);
		await queryRunner.query(`UPDATE "candidate" SET "${temporary}" = ${copyExpression}`);
		await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "${column}"`);
		await queryRunner.query(`ALTER TABLE "candidate" RENAME COLUMN "${temporary}" TO "${column}"`);
	}
}
