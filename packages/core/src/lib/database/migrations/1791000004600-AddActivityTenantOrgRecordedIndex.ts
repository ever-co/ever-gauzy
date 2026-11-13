import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

type Dialect = 'postgres' | 'sqlite' | 'mysql';

const TABLE = 'activity';

/** The index, as `Activity` declares it (`@ColumnIndex`), so `synchronize` and this migration agree. */
export const ACTIVITY_TENANT_ORG_RECORDED_INDEX = 'IDX_activity_tenant_org_recorded';

const COLUMNS = ['tenantId', 'organizationId', 'recordedAt'] as const;

/**
 * An index on `activity (tenantId, organizationId, recordedAt)`.
 *
 * The activity reports (`GET /timesheet/activity/report`, the Apps & URLs page of Ever Teams, and
 * `/timesheet/activity/daily`, its Apps and Visited Sites tabs) aggregate an organization's activity rows of a
 * date range (`recordedAt BETWEEN`). The table had single-column indexes only (`tenantId`, `organizationId`,
 * `recordedAt`, ...): Postgres probed the rows through the slots' index and filtered the range row by row, and
 * SQLite, without planner statistics, walked every row of the organization and, for each, every time log of
 * the organization (4 s for a week on the demo database). With the tenant, the organization and the instant in
 * one index the read is a range scan of the rows it answers.
 *
 * Safe to run on a live database: an added index, nothing rewritten. On Postgres it is built
 * CONCURRENTLY, which never blocks reads or writes of the table, and therefore outside a transaction
 * (`transaction = false`; Gauzy runs migrations in `each` mode). A concurrent build that was interrupted
 * leaves an INVALID index behind, which `IF NOT EXISTS` would then keep: such a leftover is dropped and
 * rebuilt. Inside a transaction block (a rollback, or the `all` transaction mode, which both wrap the
 * migration whatever it declares) the statements run without CONCURRENTLY, which Postgres would refuse
 * there. `down` drops the index.
 */
export class AddActivityTenantOrgRecordedIndex1791000004600 implements MigrationInterface {
	name = 'AddActivityTenantOrgRecordedIndex1791000004600';

	/** `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. */
	transaction = false;

	readonly mysqlLockName = `gauzy:migration:1791000004600`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		switch (dialect) {
			case 'postgres':
				await this.postgresUp(queryRunner);
				break;
			case 'sqlite':
				await queryRunner.query(
					`CREATE INDEX IF NOT EXISTS "${ACTIVITY_TENANT_ORG_RECORDED_INDEX}" ON "${TABLE}" (${COLUMNS.map(
						(column) => `"${column}"`
					).join(', ')})`
				);
				break;
			case 'mysql':
				// MySQL has no `CREATE INDEX IF NOT EXISTS`; the check and the DDL are one critical section.
				await withMysqlNamedLock(queryRunner, this.mysqlLockName, async () => {
					if (await this.mysqlHasIndex(queryRunner)) {
						return;
					}
					await queryRunner.query(
						`CREATE INDEX \`${ACTIVITY_TENANT_ORG_RECORDED_INDEX}\` ON \`${TABLE}\` (${COLUMNS.map(
							(column) => `\`${column}\``
						).join(', ')})`
					);
				});
				break;
		}
	}

	/**
	 * `CONCURRENTLY`, unless the statement runs inside a transaction block, where Postgres refuses it: the
	 * executor honours `transaction = false` on `up`, but a rollback (`migration:revert`) or an `all`
	 * transaction mode still wraps the migration, and a plain `CREATE` / `DROP INDEX` (a short lock on the
	 * table) is better than a failed migration there.
	 */
	private concurrently(queryRunner: QueryRunner): string {
		return queryRunner.isTransactionActive ? '' : 'CONCURRENTLY ';
	}

	/**
	 * Builds the index without blocking the table. An earlier, interrupted concurrent build leaves an index
	 * that is not valid (`pg_index.indisvalid = false`) and is never used: it is dropped first, so the index
	 * is rebuilt rather than kept broken.
	 */
	private async postgresUp(queryRunner: QueryRunner): Promise<void> {
		const [existing] = (await queryRunner.query(
			`SELECT i.indisvalid AS "valid"
			 FROM pg_class c
			 JOIN pg_index i ON i.indexrelid = c.oid
			 JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE c.relname = $1 AND n.nspname = current_schema()`,
			[ACTIVITY_TENANT_ORG_RECORDED_INDEX]
		)) as Array<{ valid: boolean }>;

		if (existing?.valid === true) {
			return;
		}
		const concurrently = this.concurrently(queryRunner);
		if (existing) {
			await queryRunner.query(
				`DROP INDEX ${concurrently}IF EXISTS "${ACTIVITY_TENANT_ORG_RECORDED_INDEX}"`
			);
		}
		await queryRunner.query(
			`CREATE INDEX ${concurrently}IF NOT EXISTS "${ACTIVITY_TENANT_ORG_RECORDED_INDEX}" ON "${TABLE}" (${COLUMNS.map(
				(column) => `"${column}"`
			).join(', ')})`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		switch (dialect) {
			case 'postgres':
				await queryRunner.query(
					`DROP INDEX ${this.concurrently(queryRunner)}IF EXISTS "${ACTIVITY_TENANT_ORG_RECORDED_INDEX}"`
				);
				break;
			case 'sqlite':
				await queryRunner.query(`DROP INDEX IF EXISTS "${ACTIVITY_TENANT_ORG_RECORDED_INDEX}"`);
				break;
			case 'mysql':
				await withMysqlNamedLock(queryRunner, this.mysqlLockName, async () => {
					if (!(await this.mysqlHasIndex(queryRunner))) {
						return;
					}
					await queryRunner.query(
						`DROP INDEX \`${ACTIVITY_TENANT_ORG_RECORDED_INDEX}\` ON \`${TABLE}\``
					);
				});
				break;
		}
	}

	/** Whether the MySQL table already carries the index. */
	private async mysqlHasIndex(queryRunner: QueryRunner): Promise<boolean> {
		const rows = (await queryRunner.query(
			`SELECT 1 FROM information_schema.statistics
			 WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
			 LIMIT 1`,
			[TABLE, ACTIVITY_TENANT_ORG_RECORDED_INDEX]
		)) as unknown[];
		return rows.length > 0;
	}

	/** The dialect of the connection's driver. Throws before any statement runs on any other database. */
	private dialectOf(queryRunner: QueryRunner): Dialect {
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.postgres:
				return 'postgres';
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				return 'sqlite';
			case DatabaseTypeEnum.mysql:
				return 'mysql';
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}
}

/**
 * Runs `work` while holding a MySQL named lock (`GET_LOCK`), so that two processes running the same migration
 * concurrently run its check and DDL one after the other. The lock is session-level and released in `finally`.
 */
async function withMysqlNamedLock(
	queryRunner: QueryRunner,
	lockName: string,
	work: () => Promise<void>
): Promise<void> {
	const [row] = await queryRunner.query(`SELECT GET_LOCK(?, 120) AS \`acquired\``, [lockName]);
	if (Number(row?.acquired) !== 1) {
		throw new Error(`Could not acquire the MySQL migration lock ${lockName}.`);
	}
	try {
		await work();
	} finally {
		await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
	}
}
