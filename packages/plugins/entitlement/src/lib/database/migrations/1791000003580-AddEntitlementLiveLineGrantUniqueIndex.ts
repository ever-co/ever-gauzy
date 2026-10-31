import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * States that one order line grants at most one **live** right of a kind (#11023).
 *
 * ## Why
 *
 * `EntitlementService.grant` is idempotent on the provenance: a grant replayed from the same order line
 * returns the right the first call created. It finds that right with a read before it inserts, which leaves a
 * window — two deliveries of one `order.placed` (the consumer is at-least-once and reorderable), or an
 * operator's grant racing the event, both read nothing and both insert. `IDX_entitlement_order_line`
 * (`1791000000360`) is not unique, so nothing refused the second row, and the customer held two licences
 * for one purchase (CodeRabbit on #10914).
 *
 * ## What it covers: live rights granted by a line
 *
 * The rule is stated over the rows that carry an `orderLineId`, are not `REVOKED` and are not soft-deleted,
 * keyed by `(tenantId, orderLineId, kind)` — the same predicate the grant's own duplicate lookup reads. A
 * revoked right stays as history and does not count, so a line whose licence was withdrawn can be granted
 * again; a right with no line (an operator's grant, a subscription's) is exempt.
 *
 * On Postgres and SQLite that is a partial unique index, **`UQ_entitlement_live_line_grant`**. MySQL has no
 * partial index, so the predicate is a virtual generated column, `liveLineGrantKey` — the three members
 * joined while the row is a live line grant, otherwise `NULL` — and the unique index covers it; MySQL never
 * compares two `NULL`s in a unique index, which exempts every other row. A row with no tenant is exempt on
 * all three dialects alike (a `NULL` member, or a `NULL` key). Nothing existing is replaced.
 *
 * `grant` answers the refusal: a second insert that loses the race re-reads the right the winner wrote and
 * returns it as a replay.
 *
 * ## Fail-safe: existing duplicates are reported, never revoked
 *
 * Which of two live rights a customer keeps is a decision about a licence they hold, not one a migration may
 * take. Where duplicates already exist the tick creates nothing, changes no row and logs which order lines
 * are affected; the grant's read-before-insert still stands. Every statement is guarded, so a re-run changes
 * nothing, and `down` drops exactly what this tick creates.
 */
export class AddEntitlementLiveLineGrantUniqueIndex1791000003580 implements MigrationInterface {
	name = 'AddEntitlementLiveLineGrantUniqueIndex1791000003580';

	/** The index this tick creates. */
	private static readonly INDEX = 'UQ_entitlement_live_line_grant';

	/** The table it is created on. */
	private static readonly TABLE = 'entitlement';

	/** MySQL's generated column the index covers there. */
	private static readonly MYSQL_KEY = 'liveLineGrantKey';

	/** How many affected order lines the duplicate report names. */
	private static readonly REPORT_LIMIT = 20;

	/** The rule, in the Postgres/SQLite form. */
	private static readonly LIVE_LINE_GRANT = `"orderLineId" IS NOT NULL AND "status" <> 'REVOKED' AND "deletedAt" IS NULL`;

	/** The rule, in MySQL's form. */
	private static readonly MYSQL_LIVE_LINE_GRANT =
		"`orderLineId` IS NOT NULL AND `status` <> 'REVOKED' AND `deletedAt` IS NULL";

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
		await this.addIndex(queryRunner, DatabaseTypeEnum.postgres, [this.partialIndexStatement()]);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropIndex(
			queryRunner,
			DatabaseTypeEnum.postgres,
			`DROP INDEX IF EXISTS "UQ_entitlement_live_line_grant"`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addIndex(queryRunner, DatabaseTypeEnum.sqlite, [this.partialIndexStatement()]);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropIndex(
			queryRunner,
			DatabaseTypeEnum.sqlite,
			`DROP INDEX IF EXISTS "UQ_entitlement_live_line_grant"`
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * The generated column is virtual, so adding it rewrites no row; a column left behind by an earlier,
	 * interrupted run is reused rather than added twice.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		const self = AddEntitlementLiveLineGrantUniqueIndex1791000003580;
		const statements: string[] = [];

		if (!(await queryRunner.hasColumn(self.TABLE, self.MYSQL_KEY))) {
			statements.push(
				`ALTER TABLE \`entitlement\` ADD COLUMN \`${self.MYSQL_KEY}\` varchar(128) GENERATED ALWAYS AS ` +
					`(IF(${self.MYSQL_LIVE_LINE_GRANT}, CONCAT(\`tenantId\`, ':', \`orderLineId\`, ':', \`kind\`), NULL)) VIRTUAL`
			);
		}

		statements.push(
			`CREATE UNIQUE INDEX \`UQ_entitlement_live_line_grant\` ON \`entitlement\` (\`${self.MYSQL_KEY}\`)`
		);

		await this.addIndex(queryRunner, DatabaseTypeEnum.mysql, statements);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		const self = AddEntitlementLiveLineGrantUniqueIndex1791000003580;

		await this.dropIndex(
			queryRunner,
			DatabaseTypeEnum.mysql,
			'DROP INDEX `UQ_entitlement_live_line_grant` ON `entitlement`'
		);

		if ((await queryRunner.hasTable(self.TABLE)) && (await queryRunner.hasColumn(self.TABLE, self.MYSQL_KEY))) {
			await queryRunner.query(`ALTER TABLE \`entitlement\` DROP COLUMN \`${self.MYSQL_KEY}\``);
		}
	}

	/**
	 * The partial unique index, in the form Postgres and SQLite share.
	 *
	 * @returns The statement.
	 */
	private partialIndexStatement(): string {
		return (
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_entitlement_live_line_grant" ON "entitlement" ` +
			`("tenantId", "orderLineId", "kind") WHERE ${AddEntitlementLiveLineGrantUniqueIndex1791000003580.LIVE_LINE_GRANT}`
		);
	}

	/**
	 * The query for the order lines that already carry more than one live right of a kind.
	 *
	 * A row with no tenant is left out, because the index exempts it on every dialect: reporting it would
	 * withhold the index over rows it would never have refused.
	 *
	 * @param dialect The dialect whose quoting is used.
	 * @returns The query.
	 */
	private duplicatesQuery(dialect: DatabaseTypeEnum): string {
		const self = AddEntitlementLiveLineGrantUniqueIndex1791000003580;

		return dialect === DatabaseTypeEnum.mysql
			? `SELECT \`orderLineId\` FROM \`entitlement\` WHERE ${self.MYSQL_LIVE_LINE_GRANT} AND \`tenantId\` IS NOT NULL GROUP BY \`tenantId\`, \`orderLineId\`, \`kind\` HAVING COUNT(*) > 1`
			: `SELECT "orderLineId" FROM "entitlement" WHERE ${self.LIVE_LINE_GRANT} AND "tenantId" IS NOT NULL GROUP BY "tenantId", "orderLineId", "kind" HAVING COUNT(*) > 1`;
	}

	/**
	 * Creates the unique index, unless it is already there or the rows would violate it.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is probed.
	 * @param statements The dialect's own statements, in order.
	 */
	private async addIndex(queryRunner: QueryRunner, dialect: DatabaseTypeEnum, statements: string[]): Promise<void> {
		const self = AddEntitlementLiveLineGrantUniqueIndex1791000003580;

		if (!(await queryRunner.hasTable(self.TABLE))) {
			return;
		}

		if (await this.indexExists(queryRunner, dialect)) {
			return;
		}

		const rows: unknown = await queryRunner.query(this.duplicatesQuery(dialect));
		const affected = Array.isArray(rows)
			? [
					...new Set(
						rows.map((row: { orderLineId?: unknown; orderlineid?: unknown } | null) =>
							String(row?.orderLineId ?? row?.orderlineid ?? '')
						)
					)
				]
			: [];

		if (affected.length > 0) {
			const named = affected.slice(0, self.REPORT_LIMIT).join(', ');
			const more =
				affected.length > self.REPORT_LIMIT ? ` (and ${affected.length - self.REPORT_LIMIT} more)` : '';

			console.warn(
				chalk.red(
					`${this.name}: ${affected.length} order line(s) carry more than one live right of a kind, so ${self.INDEX} ` +
						`was NOT created and no row was changed: ${named}${more}. Once a person has revoked the extra rights, ` +
						`create the index with the statements this migration issues: ${statements.join('; ')}`
				)
			);

			return;
		}

		for (const statement of statements) {
			await queryRunner.query(statement);
		}
	}

	/**
	 * Drops the unique index, when it is present.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is probed.
	 * @param statement The dialect's own `DROP INDEX`.
	 */
	private async dropIndex(queryRunner: QueryRunner, dialect: DatabaseTypeEnum, statement: string): Promise<void> {
		if (!(await queryRunner.hasTable(AddEntitlementLiveLineGrantUniqueIndex1791000003580.TABLE))) {
			return;
		}

		if (!(await this.indexExists(queryRunner, dialect))) {
			return;
		}

		await queryRunner.query(statement);
	}

	/**
	 * Whether the dialect's catalogue already carries the index.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is read.
	 * @returns True when the index exists.
	 */
	private async indexExists(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<boolean> {
		const self = AddEntitlementLiveLineGrantUniqueIndex1791000003580;
		let rows: unknown;

		if (dialect === DatabaseTypeEnum.mysql) {
			rows = await queryRunner.query(
				`SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
				[self.TABLE, self.INDEX]
			);
		} else if (dialect === DatabaseTypeEnum.sqlite) {
			rows = await queryRunner.query(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1`, [
				self.INDEX
			]);
		} else {
			rows = await queryRunner.query(`SELECT 1 FROM pg_indexes WHERE indexname = $1 LIMIT 1`, [self.INDEX]);
		}

		return Array.isArray(rows) && rows.length > 0;
	}
}
