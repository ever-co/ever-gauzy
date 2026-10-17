import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * States that one payment-side money fact is one row of an order's money ledger (Q7-W1b).
 *
 * ## Why
 *
 * The payment domain reports every authorisation, capture, void and refund to the order's money ledger
 * (`OrderPaymentLedgerService`), and more than one path can report the same fact: the synchronous report
 * after the payment committed, the checkout that hands a cart's payments to its order, a retried request,
 * the outbox consumer that backs them up. The writer reads before it inserts, which leaves a window where
 * two reports of one capture both find nothing and both insert — and a second `CAPTURE` row counts the money
 * twice, overstates the paid total and can complete an order that still owes money (CodeRabbit on #10890).
 * `IDX_order_transaction_reference` (`1791000000220`) is not unique, so nothing refused it.
 *
 * ## What it covers: the payment domain's facts, and nothing else
 *
 * The rule is stated over the rows whose reference names a payment-side row — `referenceType` one of
 * `PAYMENT`, `PAYMENT_CAPTURE`, `REFUND` — keyed by `(orderId, type, referenceType, referenceId)`. An
 * authorisation and a void of one payment share their reference and differ by type, so both stand. Every
 * other ledger row (an operator's `MANUAL` correction, an order change's `CREDIT`) is exempt: those are not
 * facts reported more than once, and two corrections citing one document are legitimate.
 *
 * On Postgres and SQLite that is a partial unique index, **`UQ_order_transaction_payment_fact`**. MySQL has no
 * partial index, so the predicate is a virtual generated column, `paymentFactKey` — the four members joined
 * when the row is a payment fact, otherwise `NULL` — and the unique index covers it; MySQL never compares two
 * `NULL`s in a unique index, which exempts every other row. Nothing existing is replaced.
 *
 * ## Fail-safe: existing duplicates are reported, never deleted
 *
 * The ledger is append-only and its rows are money records a migration has no business choosing between.
 * Where duplicates already exist the tick creates nothing, changes no row and logs which orders are
 * affected; the writer's read-before-insert still stands. Every statement is guarded, so a re-run changes
 * nothing, and `down` drops exactly what this tick creates.
 */
export class AddOrderTransactionPaymentFactUniqueIndex1791000000793 implements MigrationInterface {
	name = 'AddOrderTransactionPaymentFactUniqueIndex1791000000793';

	/** The index this tick creates. */
	private static readonly INDEX = 'UQ_order_transaction_payment_fact';

	/** The table it is created on. */
	private static readonly TABLE = 'order_transaction';

	/** MySQL's generated column the index covers there. */
	private static readonly MYSQL_KEY = 'paymentFactKey';

	/** How many affected orders the duplicate report names. */
	private static readonly REPORT_LIMIT = 20;

	/** The rule, in the Postgres/SQLite form. */
	private static readonly FACT = `"referenceType" IN ('PAYMENT', 'PAYMENT_CAPTURE', 'REFUND') AND "referenceId" IS NOT NULL AND "deletedAt" IS NULL`;

	/** The rule, in MySQL's form. */
	private static readonly MYSQL_FACT =
		"`referenceType` IN ('PAYMENT', 'PAYMENT_CAPTURE', 'REFUND') AND `referenceId` IS NOT NULL AND `deletedAt` IS NULL";

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
			`DROP INDEX IF EXISTS "UQ_order_transaction_payment_fact"`
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
			`DROP INDEX IF EXISTS "UQ_order_transaction_payment_fact"`
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
		const self = AddOrderTransactionPaymentFactUniqueIndex1791000000793;
		const statements: string[] = [];

		if (!(await queryRunner.hasColumn(self.TABLE, self.MYSQL_KEY))) {
			statements.push(
				`ALTER TABLE \`order_transaction\` ADD COLUMN \`${self.MYSQL_KEY}\` varchar(191) GENERATED ALWAYS AS ` +
					`(IF(${self.MYSQL_FACT}, CONCAT(\`orderId\`, ':', \`type\`, ':', \`referenceType\`, ':', \`referenceId\`), NULL)) VIRTUAL`
			);
		}

		statements.push(
			`CREATE UNIQUE INDEX \`UQ_order_transaction_payment_fact\` ON \`order_transaction\` (\`${self.MYSQL_KEY}\`)`
		);

		await this.addIndex(queryRunner, DatabaseTypeEnum.mysql, statements);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		const self = AddOrderTransactionPaymentFactUniqueIndex1791000000793;

		await this.dropIndex(
			queryRunner,
			DatabaseTypeEnum.mysql,
			'DROP INDEX `UQ_order_transaction_payment_fact` ON `order_transaction`'
		);

		if ((await queryRunner.hasTable(self.TABLE)) && (await queryRunner.hasColumn(self.TABLE, self.MYSQL_KEY))) {
			await queryRunner.query(`ALTER TABLE \`order_transaction\` DROP COLUMN \`${self.MYSQL_KEY}\``);
		}
	}

	/**
	 * The partial unique index, in the form Postgres and SQLite share.
	 *
	 * @returns The statement.
	 */
	private partialIndexStatement(): string {
		return (
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_transaction_payment_fact" ON "order_transaction" ` +
			`("orderId", "type", "referenceType", "referenceId") WHERE ${AddOrderTransactionPaymentFactUniqueIndex1791000000793.FACT}`
		);
	}

	/**
	 * The query for the orders whose ledger already carries one payment fact twice.
	 *
	 * @param dialect The dialect whose quoting is used.
	 * @returns The query.
	 */
	private duplicatesQuery(dialect: DatabaseTypeEnum): string {
		const self = AddOrderTransactionPaymentFactUniqueIndex1791000000793;

		return dialect === DatabaseTypeEnum.mysql
			? `SELECT \`orderId\` FROM \`order_transaction\` WHERE ${self.MYSQL_FACT} GROUP BY \`orderId\`, \`type\`, \`referenceType\`, \`referenceId\` HAVING COUNT(*) > 1`
			: `SELECT "orderId" FROM "order_transaction" WHERE ${self.FACT} GROUP BY "orderId", "type", "referenceType", "referenceId" HAVING COUNT(*) > 1`;
	}

	/**
	 * Creates the unique index, unless it is already there or the rows would violate it.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is probed.
	 * @param statements The dialect's own statements, in order.
	 */
	private async addIndex(queryRunner: QueryRunner, dialect: DatabaseTypeEnum, statements: string[]): Promise<void> {
		const self = AddOrderTransactionPaymentFactUniqueIndex1791000000793;

		if (!(await queryRunner.hasTable(self.TABLE))) {
			return;
		}

		if (await this.indexExists(queryRunner, dialect)) {
			return;
		}

		const rows: unknown = await queryRunner.query(this.duplicatesQuery(dialect));
		const affected = Array.isArray(rows)
			? [...new Set(rows.map((row: any) => String(row?.orderId ?? row?.orderid ?? '')))]
			: [];

		if (affected.length > 0) {
			const named = affected.slice(0, self.REPORT_LIMIT).join(', ');
			const more =
				affected.length > self.REPORT_LIMIT ? ` (and ${affected.length - self.REPORT_LIMIT} more)` : '';

			console.warn(
				chalk.red(
					`${this.name}: ${affected.length} order(s) carry one payment fact more than once, so ${self.INDEX} was ` +
						`NOT created and no row was changed: ${named}${more}. Once a person has resolved them, create ` +
						`the index with the statements this migration issues: ${statements.join('; ')}`
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
		if (!(await queryRunner.hasTable(AddOrderTransactionPaymentFactUniqueIndex1791000000793.TABLE))) {
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
		const self = AddOrderTransactionPaymentFactUniqueIndex1791000000793;
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
