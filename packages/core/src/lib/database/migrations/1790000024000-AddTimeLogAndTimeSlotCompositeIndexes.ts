import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';

/** The names `TimeLog` and `TimeSlot` declare for these indexes, so schema diffs stay quiet. */
const INDEXES: ReadonlyArray<{ name: string; table: string; columns: string[] }> = [
	{
		name: 'IDX_time_log_tenant_org_employee_started',
		table: 'time_log',
		columns: ['tenantId', 'organizationId', 'employeeId', 'startedAt']
	},
	{
		name: 'IDX_time_log_tenant_org_started',
		table: 'time_log',
		columns: ['tenantId', 'organizationId', 'startedAt']
	},
	{
		name: 'IDX_time_slot_tenant_org_employee_started',
		table: 'time_slot',
		columns: ['tenantId', 'organizationId', 'employeeId', 'startedAt']
	},
	{
		name: 'IDX_time_slot_tenant_org_started',
		table: 'time_slot',
		columns: ['tenantId', 'organizationId', 'startedAt']
	}
];

export class AddTimeLogAndTimeSlotCompositeIndexes1790000024000 implements MigrationInterface {
	name = 'AddTimeLogAndTimeSlotCompositeIndexes1790000024000';

	/**
	 * Up Migration
	 *
	 * Adds composite indexes on `time_log` and `time_slot`. The timer status, the team's last logs, the
	 * time slot lookup on upload and the dashboard statistics filter these tables by tenant, organization
	 * and one or more employees, over a `startedAt` range or ordered by it, and only single-column indexes
	 * existed. The statistics also run organization-wide with no employee filter, which the second index
	 * of each table serves.
	 *
	 * NOTE: On existing large deployments, create the indexes out-of-band first with
	 * `CREATE INDEX CONCURRENTLY` under the same names (the Postgres/SQLite branch uses `IF NOT EXISTS`,
	 * so this migration is then a no-op for them), so the in-transaction build does not hold a write lock
	 * on both tables, which every timer start/stop and screenshot upload writes to. A concurrent build
	 * that fails leaves an INVALID index behind, which `IF NOT EXISTS` would accept: drop it first.
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		for (const { name, table, columns } of INDEXES) {
			switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
				case DatabaseTypeEnum.sqlite:
				case DatabaseTypeEnum.betterSqlite3:
				case DatabaseTypeEnum.postgres:
					await queryRunner.query(
						`CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${columns.map((column) => `"${column}"`).join(', ')})`
					);
					break;
				case DatabaseTypeEnum.mysql:
					// MySQL has no `CREATE INDEX ... IF NOT EXISTS` and commits each index on its own, so an
					// index built by an interrupted run is looked up rather than failing the retry.
					if (!(await this.mysqlIndexExists(queryRunner, table, name))) {
						await queryRunner.query(
							`CREATE INDEX \`${name}\` ON \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')})`
						);
					}
					break;
				default:
					throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
			}
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		for (const { name, table } of INDEXES) {
			switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
				case DatabaseTypeEnum.sqlite:
				case DatabaseTypeEnum.betterSqlite3:
				case DatabaseTypeEnum.postgres:
					await queryRunner.query(`DROP INDEX IF EXISTS "${name}"`);
					break;
				case DatabaseTypeEnum.mysql:
					if (await this.mysqlIndexExists(queryRunner, table, name)) {
						await queryRunner.query(`DROP INDEX \`${name}\` ON \`${table}\``);
					}
					break;
				default:
					throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
			}
		}
	}

	private async mysqlIndexExists(queryRunner: QueryRunner, table: string, name: string): Promise<boolean> {
		const rows: unknown[] = await queryRunner.query(
			`SELECT \`INDEX_NAME\` FROM \`information_schema\`.\`STATISTICS\` WHERE \`TABLE_SCHEMA\` = DATABASE() AND \`TABLE_NAME\` = ? AND \`INDEX_NAME\` = ?`,
			[table, name]
		);
		return rows.length > 0;
	}
}
