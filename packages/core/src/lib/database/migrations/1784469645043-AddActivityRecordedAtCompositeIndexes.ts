import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';

export class AddActivityRecordedAtCompositeIndexes1784469645043 implements MigrationInterface {
	name = 'AddActivityRecordedAtCompositeIndexes1784469645043';

	/**
	 * Up Migration
	 *
	 * Adds composite indexes on `activity` to support the Time & Activity reports, which filter
	 * by `(organizationId, employeeId, recordedAt)` (per-employee) and `(organizationId, recordedAt)`
	 * (org-wide) over a date range. Previously those reports filtered on a non-sargable
	 * `concat(date, time)::timestamp` expression and could not use any index, forcing a full scan
	 * of the (multi-million row) activity table.
	 *
	 * NOTE: On existing large deployments these indexes should be created out-of-band with
	 * `CREATE INDEX CONCURRENTLY` first (the Postgres branch below uses `IF NOT EXISTS`, so it is a
	 * no-op when they already exist). Existing rows with a NULL `recordedAt` should likewise be
	 * backfilled out-of-band (`UPDATE activity SET "recordedAt" = concat(date,' ',time)::timestamp
	 * WHERE "recordedAt" IS NULL AND date IS NOT NULL AND time IS NOT NULL`) so the new
	 * `recordedAt`-based filter does not omit them.
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
	 * PostgreSQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "idx_activity_org_emp_recordedat" ON "activity" ("organizationId", "employeeId", "recordedAt")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "idx_activity_org_recordedat" ON "activity" ("organizationId", "recordedAt")`
		);
	}

	/**
	 * PostgreSQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX IF EXISTS "idx_activity_org_recordedat"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "idx_activity_org_emp_recordedat"`);
	}

	/**
	 * SQLite Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "idx_activity_org_emp_recordedat" ON "activity" ("organizationId", "employeeId", "recordedAt")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "idx_activity_org_recordedat" ON "activity" ("organizationId", "recordedAt")`
		);
	}

	/**
	 * SQLite Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX IF EXISTS "idx_activity_org_recordedat"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "idx_activity_org_emp_recordedat"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
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
