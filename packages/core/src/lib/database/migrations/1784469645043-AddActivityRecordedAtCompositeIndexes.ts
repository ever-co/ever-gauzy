import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';

export class AddActivityRecordedAtCompositeIndexes1784469645043 implements MigrationInterface {
	name = 'AddActivityRecordedAtCompositeIndexes1784469645043';

	/**
	 * Up Migration
	 *
	 * (1) Backfills `activity.recordedAt` from `date` + `time` for legacy rows where it is NULL,
	 *     so the report/statistic queries — which now filter on `recordedAt` — do not silently
	 *     omit those rows.
	 * (2) Adds composite indexes on `activity` to support the Time & Activity reports and the
	 *     dashboard activity statistics, which filter by `(organizationId, employeeId, recordedAt)`
	 *     (per-employee) and `(organizationId, recordedAt)` (org-wide) over a date range.
	 *
	 * NOTE: On existing large deployments, create the indexes out-of-band first with
	 * `CREATE INDEX CONCURRENTLY` (the Postgres/SQLite branches use `IF NOT EXISTS`, so this
	 * migration is then a no-op for them) and run the backfill out-of-band too, so this migration's
	 * in-transaction backfill + index build stays fast and does not hold a write lock.
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
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
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
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Postgres and SQLite share identical index DDL (both accept double-quoted identifiers and
	 * `IF NOT EXISTS`), so the creation/removal is factored out to avoid duplicated SQL.
	 */
	private async createStandardIndexes(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "idx_activity_org_emp_recordedat" ON "activity" ("organizationId", "employeeId", "recordedAt")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "idx_activity_org_recordedat" ON "activity" ("organizationId", "recordedAt")`
		);
	}

	private async dropStandardIndexes(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "idx_activity_org_recordedat"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "idx_activity_org_emp_recordedat"`);
	}

	/**
	 * PostgreSQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`UPDATE "activity" SET "recordedAt" = CONCAT("date", ' ', "time")::timestamp WHERE "recordedAt" IS NULL AND "date" IS NOT NULL AND "time" IS NOT NULL`
		);
		await this.createStandardIndexes(queryRunner);
	}

	/**
	 * PostgreSQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropStandardIndexes(queryRunner);
	}

	/**
	 * SQLite Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`UPDATE "activity" SET "recordedAt" = datetime("date" || ' ' || "time") WHERE "recordedAt" IS NULL AND "date" IS NOT NULL AND "time" IS NOT NULL`
		);
		await this.createStandardIndexes(queryRunner);
	}

	/**
	 * SQLite Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropStandardIndexes(queryRunner);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no `CREATE INDEX ... IF NOT EXISTS`, so these run as plain statements. MySQL is not
	 * part of the out-of-band `CREATE INDEX CONCURRENTLY` pre-creation path, so a fresh migration
	 * run does not encounter pre-existing indexes.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`UPDATE \`activity\` SET \`recordedAt\` = STR_TO_DATE(CONCAT(\`date\`, ' ', \`time\`), '%Y-%m-%d %H:%i:%s') WHERE \`recordedAt\` IS NULL AND \`date\` IS NOT NULL AND \`time\` IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX \`idx_activity_org_emp_recordedat\` ON \`activity\` (\`organizationId\`, \`employeeId\`, \`recordedAt\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`idx_activity_org_recordedat\` ON \`activity\` (\`organizationId\`, \`recordedAt\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`idx_activity_org_recordedat\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`idx_activity_org_emp_recordedat\` ON \`activity\``);
	}
}
