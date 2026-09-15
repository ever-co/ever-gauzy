import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Employee bill/pay rates (`billRateValue`, `minimumBillingRate`) were stored as integers, so a
 * rate like `10.49` was truncated to `10` (issue #10199). Money columns become `numeric(10,2)` /
 * `decimal(10,2)` so cents survive. Weekly hour limit (`reWeeklyLimit`) is left as integer.
 *
 * SQLite cannot `ALTER COLUMN … TYPE`. Rebuilds that restated the full `employee` DDL have
 * silently dropped columns before, so this uses ADD / UPDATE / DROP / RENAME instead (SQLite ≥
 * 3.35; bundled better-sqlite3 ships 3.51).
 */
export class AlterEmployeeBillingRateColumnsToNumeric1790000014000 implements MigrationInterface {
	name = 'AlterEmployeeBillingRateColumnsToNumeric1790000014000';

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
		for (const column of this.moneyColumns) {
			await queryRunner.query(
				`ALTER TABLE "employee" ALTER COLUMN "${column}" TYPE numeric(10,2) USING "${column}"::numeric(10,2)`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of this.moneyColumns) {
			await queryRunner.query(
				`ALTER TABLE "employee" ALTER COLUMN "${column}" TYPE integer USING ROUND("${column}")::integer`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of this.moneyColumns) {
			await this.sqliteRewriteColumn(queryRunner, column, 'numeric(10,2)');
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
		for (const column of this.moneyColumns) {
			await queryRunner.query(`ALTER TABLE \`employee\` MODIFY \`${column}\` decimal(10,2) NULL`);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of this.moneyColumns) {
			await queryRunner.query(`ALTER TABLE \`employee\` MODIFY \`${column}\` int NULL`);
		}
	}

	/**
	 * SQLite has no `ALTER COLUMN TYPE`. Copy through a temporary column instead of restating the
	 * full `employee` table (a stale rebuild would drop later-added columns).
	 */
	private async sqliteRewriteColumn(
		queryRunner: QueryRunner,
		column: string,
		declaredType: string
	): Promise<void> {
		const temporary = `${column}__tmp`;
		const copyExpression =
			declaredType === 'integer' ? `CAST(ROUND("${column}") AS INTEGER)` : `"${column}"`;
		await queryRunner.query(`ALTER TABLE "employee" ADD COLUMN "${temporary}" ${declaredType}`);
		await queryRunner.query(`UPDATE "employee" SET "${temporary}" = ${copyExpression}`);
		await queryRunner.query(`ALTER TABLE "employee" DROP COLUMN "${column}"`);
		await queryRunner.query(`ALTER TABLE "employee" RENAME COLUMN "${temporary}" TO "${column}"`);
	}
}
