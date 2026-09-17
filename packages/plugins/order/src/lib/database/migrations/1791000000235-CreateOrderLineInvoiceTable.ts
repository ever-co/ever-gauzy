import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates `order_line_invoice` and adds the per-line registers an order line was missing.
 *
 * **The pivot.** The line's link to invoicing was one column, `order_line.invoiceItemId`, whose partial
 * unique index guaranteed one line per item — so a line could be flattened into exactly one invoice
 * item, once, for ever. A deposit taken at placement and the balance billed on delivery could not both
 * be written, and a credit note's negative item had nothing linking it back to the line it credited.
 * This table is that link: one row per invoice item and per credit-note item, with a direction that
 * says which counter the row moves, and a unique index on the item that stops the pivot degenerating
 * back into a 1:1 relation.
 *
 * **The registers on `order_line`.** `invoicedQuantity` and `creditedQuantity` are the pivot's sum,
 * `invoiceStatus` is what the two imply for the basis the line is billed against, `refundedQuantity`
 * and `refundedAmount` are the sum of the `refund_line` rows of succeeded refunds, and
 * `overFulfilledQuantity` records what was delivered **beyond** what was outstanding. `kind` is what
 * makes a quotation's heading a heading rather than a fake product line, and `promisedAt` with its
 * `leadTimeDays` is the promise the customer was given.
 *
 * **The columns on `order`.** `paymentTermId` is the settlement schedule the order was placed against —
 * it carries **no foreign key**, because `payment_term` belongs to the kernel's settlement-term set,
 * which owns the target and adds the constraint once it exists. `promisedAt` is a cache of the lines:
 * the promise is made per deliverable, so the order's own date is `max(line.promisedAt)`.
 *
 * **The backfill.** Exactly one `INVOICE` row is written per non-null `invoiceItemId`, which is what
 * carries an existing installation's 1:1 links into the pivot without inventing any. The two counters
 * are then re-derived from the pivot, so a line that predates the revision reports what it actually
 * billed rather than a default zero. The retained column is **gated, not dropped**: the bridge stops
 * reading it, and until it is retired the two structures describe the same fact and the
 * reconciliation asserts they agree.
 *
 * **Why this timestamp.** The plan allocated this file the tick after the tables it extends, and this
 * package's shipped set occupies `1791000000220` and `1791000000230` inside the order sub-range. A
 * migration's timestamp is frozen once it has shipped, so the revision takes the **next free tick of
 * this package's own sub-range**, `1791000000235`, which keeps the file in exactly the position
 * intended: after both shipped files.
 *
 * Every addition is guarded by `hasColumn` and every index is created only where it is absent, so a
 * second run of this file adds nothing. The inverse drops the registers, the pivot and the two order
 * columns, returning the aggregate to the shape an installation had before the revision.
 */
export class CreateOrderLineInvoiceTable1791000000235 implements MigrationInterface {
	name = 'CreateOrderLineInvoiceTable1791000000235';

	/** The pivot this file creates. */
	private static readonly LINK_TABLE = 'order_line_invoice';

	/** The line whose registers the revision completes. */
	private static readonly LINE_TABLE = 'order_line';

	/** The order whose settlement schedule and promise the revision records. */
	private static readonly ORDER_TABLE = 'order';

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
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "order_line_invoice" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderLineId" uuid NOT NULL, "invoiceItemId" uuid NOT NULL, "direction" character varying(16) NOT NULL, "quantity" numeric(20,6) NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "metadata" jsonb, CONSTRAINT "PK_order_line_invoice_id" PRIMARY KEY ("id"))`
		);
		await this.createLinkIndexes(queryRunner, 'postgres');

		// A link has no meaning without its line, and the item is the document side of the same fact.
		if (!(await this.hasForeignKey(queryRunner, 'FK_order_line_invoice_line'))) {
			await queryRunner.query(
				`ALTER TABLE "order_line_invoice" ADD CONSTRAINT "FK_order_line_invoice_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
			);
		}
		if (!(await this.hasForeignKey(queryRunner, 'FK_order_line_invoice_item'))) {
			await queryRunner.query(
				`ALTER TABLE "order_line_invoice" ADD CONSTRAINT "FK_order_line_invoice_item" FOREIGN KEY ("invoiceItemId") REFERENCES "invoice_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
			);
		}

		await this.addLineColumns(queryRunner, 'postgres');
		await this.addOrderColumns(queryRunner, 'postgres');
		await this.addLineIndexes(queryRunner, 'postgres');
		await this.addOrderIndexes(queryRunner, 'postgres');
		await this.backfill(queryRunner, 'postgres');
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.removeOrderIndexes(queryRunner, 'postgres');
		await this.removeLineIndexes(queryRunner, 'postgres');
		await this.removeOrderColumns(queryRunner, 'postgres');
		await this.removeLineColumns(queryRunner, 'postgres');

		if (await queryRunner.hasTable(CreateOrderLineInvoiceTable1791000000235.LINK_TABLE)) {
			await queryRunner.query(`ALTER TABLE "order_line_invoice" DROP CONSTRAINT "FK_order_line_invoice_item"`);
			await queryRunner.query(`ALTER TABLE "order_line_invoice" DROP CONSTRAINT "FK_order_line_invoice_line"`);
			await queryRunner.query(`DROP TABLE "order_line_invoice"`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite accepts an added nullable column, and an added `NOT NULL` column that carries a constant
	 * default, without rebuilding the table — which is the shape every register this file adds has, so
	 * nothing here needs the copy-and-rename dance a nullability change would require.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "order_line_invoice" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderLineId" varchar NOT NULL, "invoiceItemId" varchar NOT NULL, "direction" varchar(16) NOT NULL, "quantity" numeric(20,6) NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "metadata" text, CONSTRAINT "FK_order_line_invoice_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_order_line_invoice_item" FOREIGN KEY ("invoiceItemId") REFERENCES "invoice_item" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await this.createLinkIndexes(queryRunner, 'sqlite');

		await this.addLineColumns(queryRunner, 'sqlite');
		await this.addOrderColumns(queryRunner, 'sqlite');
		await this.addLineIndexes(queryRunner, 'sqlite');
		await this.addOrderIndexes(queryRunner, 'sqlite');
		await this.backfill(queryRunner, 'sqlite');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.removeOrderIndexes(queryRunner, 'sqlite');
		await this.removeLineIndexes(queryRunner, 'sqlite');
		await this.removeOrderColumns(queryRunner, 'sqlite');
		await this.removeLineColumns(queryRunner, 'sqlite');

		await queryRunner.query(`DROP TABLE IF EXISTS "order_line_invoice"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so the two partial indexes of the pivot lose their predicates and
	 * the rules they carried are the service checks plus the nightly `schema-uniqueness-audit`, exactly
	 * as §1.7 of the schema specification provides for a dialect that cannot express them. The unique
	 * tuple includes `deletedAt`, so a soft-deleted link no longer collides with the live one that
	 * replaced it — which is the same property the predicate provides on the other two.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`order_line_invoice\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderLineId\` varchar(36) NOT NULL, \`invoiceItemId\` varchar(36) NOT NULL, \`direction\` varchar(16) NOT NULL, \`quantity\` decimal(20,6) NOT NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`metadata\` json NULL, INDEX \`IDX_order_line_invoice_line\` (\`orderLineId\`, \`direction\`), INDEX \`IDX_order_line_invoice_item\` (\`invoiceItemId\`, \`deletedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_order_line_invoice_item\` ON \`order_line_invoice\` (\`invoiceItemId\`, \`deletedAt\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_line_invoice\` ADD CONSTRAINT \`FK_order_line_invoice_line\` FOREIGN KEY (\`orderLineId\`) REFERENCES \`order_line\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_line_invoice\` ADD CONSTRAINT \`FK_order_line_invoice_item\` FOREIGN KEY (\`invoiceItemId\`) REFERENCES \`invoice_item\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await this.addLineColumns(queryRunner, 'mysql');
		await this.addOrderColumns(queryRunner, 'mysql');
		await this.addLineIndexes(queryRunner, 'mysql');
		await this.addOrderIndexes(queryRunner, 'mysql');
		await this.backfill(queryRunner, 'mysql');
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.removeOrderIndexes(queryRunner, 'mysql');
		await this.removeLineIndexes(queryRunner, 'mysql');
		await this.removeOrderColumns(queryRunner, 'mysql');
		await this.removeLineColumns(queryRunner, 'mysql');

		await queryRunner.query(`ALTER TABLE \`order_line_invoice\` DROP FOREIGN KEY \`FK_order_line_invoice_item\``);
		await queryRunner.query(`ALTER TABLE \`order_line_invoice\` DROP FOREIGN KEY \`FK_order_line_invoice_line\``);
		await queryRunner.query(`ALTER TABLE \`order_line_invoice\` DROP INDEX \`UQ_order_line_invoice_item\``);
		await queryRunner.query(`DROP TABLE \`order_line_invoice\``);
	}

	/*
	|--------------------------------------------------------------------------
	| The pivot
	|--------------------------------------------------------------------------
	*/

	/**
	 * Creates the seven base-class indexes and the two domain indexes of the pivot.
	 *
	 * `UQ_order_line_invoice_item` is what stops the pivot degenerating back into the 1:1 relation the
	 * revision replaces, and `IDX_order_line_invoice_line` is every read of one line's register.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async createLinkIndexes(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		if (dialect === 'mysql') {
			return;
		}

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_order_line_invoice_created_by_user" ON "order_line_invoice" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_order_line_invoice_updated_by_user" ON "order_line_invoice" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_order_line_invoice_deleted_by_user" ON "order_line_invoice" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_order_line_invoice_is_active" ON "order_line_invoice" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_order_line_invoice_is_archived" ON "order_line_invoice" ("isArchived")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_order_line_invoice_tenant" ON "order_line_invoice" ("tenantId")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_order_line_invoice_organization" ON "order_line_invoice" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_line_invoice_item" ON "order_line_invoice" ("invoiceItemId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_order_line_invoice_line" ON "order_line_invoice" ("orderLineId", "direction") WHERE "deletedAt" IS NULL`
		);
	}

	/*
	|--------------------------------------------------------------------------
	| The registers on the line
	|--------------------------------------------------------------------------
	*/

	/**
	 * Adds the registers an order line was missing, each addition guarded so a second run adds nothing.
	 *
	 * Every one of them is either nullable or carries a constant default, which is the shape SQLite adds
	 * in place — and every one is a **cache** of rows that exist elsewhere, written by the service that
	 * causes them in the same transaction, never by a caller.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async addLineColumns(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<void> {
		const table = CreateOrderLineInvoiceTable1791000000235.LINE_TABLE;

		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		if (dialect === 'postgres') {
			if (!(await queryRunner.hasColumn(table, 'kind'))) {
				await queryRunner.query(
					`ALTER TABLE "order_line" ADD COLUMN "kind" character varying(16) NOT NULL DEFAULT 'ITEM'`
				);
			}
			if (!(await queryRunner.hasColumn(table, 'invoicedQuantity'))) {
				await queryRunner.query(
					`ALTER TABLE "order_line" ADD COLUMN "invoicedQuantity" numeric(20,6) NOT NULL DEFAULT 0`
				);
			}
			if (!(await queryRunner.hasColumn(table, 'creditedQuantity'))) {
				await queryRunner.query(
					`ALTER TABLE "order_line" ADD COLUMN "creditedQuantity" numeric(20,6) NOT NULL DEFAULT 0`
				);
			}
			if (!(await queryRunner.hasColumn(table, 'invoiceStatus'))) {
				await queryRunner.query(
					`ALTER TABLE "order_line" ADD COLUMN "invoiceStatus" character varying(32) NOT NULL DEFAULT 'NOT_INVOICED'`
				);
			}
			if (!(await queryRunner.hasColumn(table, 'overFulfilledQuantity'))) {
				await queryRunner.query(
					`ALTER TABLE "order_line" ADD COLUMN "overFulfilledQuantity" numeric(20,6) NOT NULL DEFAULT 0`
				);
			}
			if (!(await queryRunner.hasColumn(table, 'refundedQuantity'))) {
				await queryRunner.query(
					`ALTER TABLE "order_line" ADD COLUMN "refundedQuantity" numeric(20,6) NOT NULL DEFAULT 0`
				);
			}
			if (!(await queryRunner.hasColumn(table, 'refundedAmount'))) {
				await queryRunner.query(
					`ALTER TABLE "order_line" ADD COLUMN "refundedAmount" numeric(20,6) NOT NULL DEFAULT 0`
				);
			}
			if (!(await queryRunner.hasColumn(table, 'promisedAt'))) {
				await queryRunner.query(`ALTER TABLE "order_line" ADD COLUMN "promisedAt" TIMESTAMP`);
			}
			if (!(await queryRunner.hasColumn(table, 'leadTimeDays'))) {
				await queryRunner.query(`ALTER TABLE "order_line" ADD COLUMN "leadTimeDays" integer`);
			}

			return;
		}

		if (dialect === 'mysql') {
			await this.addMysqlLineColumn(queryRunner, table, 'kind', 'varchar(16) NOT NULL DEFAULT \'ITEM\'');
			await this.addMysqlLineColumn(queryRunner, table, 'invoicedQuantity', 'decimal(20,6) NOT NULL DEFAULT 0');
			await this.addMysqlLineColumn(queryRunner, table, 'creditedQuantity', 'decimal(20,6) NOT NULL DEFAULT 0');
			await this.addMysqlLineColumn(
				queryRunner,
				table,
				'invoiceStatus',
				'varchar(32) NOT NULL DEFAULT \'NOT_INVOICED\''
			);
			await this.addMysqlLineColumn(
				queryRunner,
				table,
				'overFulfilledQuantity',
				'decimal(20,6) NOT NULL DEFAULT 0'
			);
			await this.addMysqlLineColumn(queryRunner, table, 'refundedQuantity', 'decimal(20,6) NOT NULL DEFAULT 0');
			await this.addMysqlLineColumn(queryRunner, table, 'refundedAmount', 'decimal(20,6) NOT NULL DEFAULT 0');
			await this.addMysqlLineColumn(queryRunner, table, 'promisedAt', 'datetime NULL');
			await this.addMysqlLineColumn(queryRunner, table, 'leadTimeDays', 'int NULL');

			return;
		}

		if (!(await queryRunner.hasColumn(table, 'kind'))) {
			await queryRunner.query(
				`ALTER TABLE "order_line" ADD COLUMN "kind" varchar(16) NOT NULL DEFAULT ('ITEM')`
			);
		}
		if (!(await queryRunner.hasColumn(table, 'invoicedQuantity'))) {
			await queryRunner.query(
				`ALTER TABLE "order_line" ADD COLUMN "invoicedQuantity" numeric(20,6) NOT NULL DEFAULT (0)`
			);
		}
		if (!(await queryRunner.hasColumn(table, 'creditedQuantity'))) {
			await queryRunner.query(
				`ALTER TABLE "order_line" ADD COLUMN "creditedQuantity" numeric(20,6) NOT NULL DEFAULT (0)`
			);
		}
		if (!(await queryRunner.hasColumn(table, 'invoiceStatus'))) {
			await queryRunner.query(
				`ALTER TABLE "order_line" ADD COLUMN "invoiceStatus" varchar(32) NOT NULL DEFAULT ('NOT_INVOICED')`
			);
		}
		if (!(await queryRunner.hasColumn(table, 'overFulfilledQuantity'))) {
			await queryRunner.query(
				`ALTER TABLE "order_line" ADD COLUMN "overFulfilledQuantity" numeric(20,6) NOT NULL DEFAULT (0)`
			);
		}
		if (!(await queryRunner.hasColumn(table, 'refundedQuantity'))) {
			await queryRunner.query(
				`ALTER TABLE "order_line" ADD COLUMN "refundedQuantity" numeric(20,6) NOT NULL DEFAULT (0)`
			);
		}
		if (!(await queryRunner.hasColumn(table, 'refundedAmount'))) {
			await queryRunner.query(
				`ALTER TABLE "order_line" ADD COLUMN "refundedAmount" numeric(20,6) NOT NULL DEFAULT (0)`
			);
		}
		if (!(await queryRunner.hasColumn(table, 'promisedAt'))) {
			await queryRunner.query(`ALTER TABLE "order_line" ADD COLUMN "promisedAt" datetime`);
		}
		if (!(await queryRunner.hasColumn(table, 'leadTimeDays'))) {
			await queryRunner.query(`ALTER TABLE "order_line" ADD COLUMN "leadTimeDays" int`);
		}
	}

	/**
	 * @param queryRunner The query runner.
	 * @param table The table being altered.
	 * @param column The column being added.
	 * @param definition The MySQL column definition.
	 */
	private async addMysqlLineColumn(
		queryRunner: QueryRunner,
		table: string,
		column: string,
		definition: string
	): Promise<void> {
		if (await queryRunner.hasColumn(table, column)) {
			return;
		}

		await queryRunner.query(`ALTER TABLE \`order_line\` ADD COLUMN \`${column}\` ${definition}`);
	}

	/**
	 * Removes the registers, in the reverse order they were added.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async removeLineColumns(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<void> {
		const table = CreateOrderLineInvoiceTable1791000000235.LINE_TABLE;

		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		const columns = [
			'leadTimeDays',
			'promisedAt',
			'refundedAmount',
			'refundedQuantity',
			'overFulfilledQuantity',
			'invoiceStatus',
			'creditedQuantity',
			'invoicedQuantity',
			'kind'
		];

		for (const column of columns) {
			if (!(await queryRunner.hasColumn(table, column))) {
				continue;
			}

			if (dialect === 'mysql') {
				await queryRunner.query(`ALTER TABLE \`order_line\` DROP COLUMN \`${column}\``);
			} else {
				await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "${column}"`);
			}
		}
	}

	/*
	|--------------------------------------------------------------------------
	| The settlement schedule and the promise on the order
	|--------------------------------------------------------------------------
	*/

	/**
	 * Adds the order's settlement schedule and its promised date.
	 *
	 * `paymentTermId` carries **no foreign key**: `payment_term` belongs to the kernel's settlement-term
	 * set, which owns the target and adds the constraint once it exists — the programme's rule for a
	 * reference that crosses a set boundary, and the same reason the purchasing set leaves its own
	 * `paymentTermId` unconstrained.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async addOrderColumns(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<void> {
		const table = CreateOrderLineInvoiceTable1791000000235.ORDER_TABLE;

		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		if (dialect === 'mysql') {
			if (!(await queryRunner.hasColumn(table, 'paymentTermId'))) {
				await queryRunner.query(`ALTER TABLE \`order\` ADD COLUMN \`paymentTermId\` varchar(36) NULL`);
			}
			if (!(await queryRunner.hasColumn(table, 'promisedAt'))) {
				await queryRunner.query(`ALTER TABLE \`order\` ADD COLUMN \`promisedAt\` datetime NULL`);
			}

			return;
		}

		if (dialect === 'postgres') {
			if (!(await queryRunner.hasColumn(table, 'paymentTermId'))) {
				await queryRunner.query(`ALTER TABLE "order" ADD COLUMN "paymentTermId" uuid`);
			}
			if (!(await queryRunner.hasColumn(table, 'promisedAt'))) {
				await queryRunner.query(`ALTER TABLE "order" ADD COLUMN "promisedAt" TIMESTAMP`);
			}

			return;
		}

		if (!(await queryRunner.hasColumn(table, 'paymentTermId'))) {
			await queryRunner.query(`ALTER TABLE "order" ADD COLUMN "paymentTermId" varchar`);
		}
		if (!(await queryRunner.hasColumn(table, 'promisedAt'))) {
			await queryRunner.query(`ALTER TABLE "order" ADD COLUMN "promisedAt" datetime`);
		}
	}

	/**
	 * Removes the two order columns.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async removeOrderColumns(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		const table = CreateOrderLineInvoiceTable1791000000235.ORDER_TABLE;

		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		for (const column of ['promisedAt', 'paymentTermId']) {
			if (!(await queryRunner.hasColumn(table, column))) {
				continue;
			}

			if (dialect === 'mysql') {
				await queryRunner.query(`ALTER TABLE \`order\` DROP COLUMN \`${column}\``);
			} else {
				await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "${column}"`);
			}
		}
	}

	/*
	|--------------------------------------------------------------------------
	| The indexes
	|--------------------------------------------------------------------------
	*/

	/**
	 * Creates the two indexes the registers exist for: the listing that filters on what is left to
	 * invoice, and the promised-date report.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async addLineIndexes(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<void> {
		await this.createIndex(
			queryRunner,
			dialect,
			'IDX_order_line_invoice_status',
			CreateOrderLineInvoiceTable1791000000235.LINE_TABLE,
			['orderId', 'invoiceStatus'],
			'"deletedAt" IS NULL'
		);
		await this.createIndex(
			queryRunner,
			dialect,
			'IDX_order_line_promised',
			CreateOrderLineInvoiceTable1791000000235.LINE_TABLE,
			['organizationId', 'promisedAt'],
			'"promisedAt" IS NOT NULL AND "deletedAt" IS NULL'
		);
	}

	/**
	 * Drops the two line indexes.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async removeLineIndexes(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<void> {
		await this.dropIndex(queryRunner, dialect, 'IDX_order_line_promised', CreateOrderLineInvoiceTable1791000000235.LINE_TABLE);
		await this.dropIndex(
			queryRunner,
			dialect,
			'IDX_order_line_invoice_status',
			CreateOrderLineInvoiceTable1791000000235.LINE_TABLE
		);
	}

	/**
	 * Creates the two indexes the order's new columns exist for.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async addOrderIndexes(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<void> {
		await this.createIndex(
			queryRunner,
			dialect,
			'IDX_order_payment_term',
			CreateOrderLineInvoiceTable1791000000235.ORDER_TABLE,
			['paymentTermId'],
			'"paymentTermId" IS NOT NULL'
		);
		await this.createIndex(
			queryRunner,
			dialect,
			'IDX_order_promised',
			CreateOrderLineInvoiceTable1791000000235.ORDER_TABLE,
			['organizationId', 'promisedAt'],
			'"promisedAt" IS NOT NULL AND "deletedAt" IS NULL'
		);
	}

	/**
	 * Drops the two order indexes.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async removeOrderIndexes(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		await this.dropIndex(queryRunner, dialect, 'IDX_order_promised', CreateOrderLineInvoiceTable1791000000235.ORDER_TABLE);
		await this.dropIndex(
			queryRunner,
			dialect,
			'IDX_order_payment_term',
			CreateOrderLineInvoiceTable1791000000235.ORDER_TABLE
		);
	}

	/**
	 * Creates a named index where it is not already there.
	 *
	 * Postgres and SQLite have `IF NOT EXISTS`; MySQL has neither that nor a filtered index, so the
	 * catalogue is asked first and the predicate is lost — the rule it expressed stays a read-time
	 * filter, which is what the programme prescribes for a rule a dialect cannot state.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 * @param name The index name.
	 * @param table The indexed table.
	 * @param columns The indexed columns.
	 * @param predicate The partial predicate, which MySQL cannot express.
	 */
	private async createIndex(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite',
		name: string,
		table: string,
		columns: string[],
		predicate?: string
	): Promise<void> {
		if (dialect === 'mysql') {
			if (await this.hasIndex(queryRunner, name)) {
				return;
			}

			await queryRunner.query(
				`CREATE INDEX \`${name}\` ON \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')})`
			);

			return;
		}

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${columns
				.map((column) => `"${column}"`)
				.join(', ')})${predicate ? ` WHERE ${predicate}` : ''}`
		);
	}

	/**
	 * Drops a named index where it is there.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 * @param name The index name.
	 * @param table The indexed table.
	 */
	private async dropIndex(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite',
		name: string,
		table: string
	): Promise<void> {
		if (dialect === 'mysql') {
			if (await this.hasIndex(queryRunner, name)) {
				await queryRunner.query(`DROP INDEX \`${name}\` ON \`${table}\``);
			}

			return;
		}

		await queryRunner.query(`DROP INDEX IF EXISTS "${name}"`);
	}

	/**
	 * @param queryRunner The query runner.
	 * @param name The index name.
	 * @returns True when MySQL already carries an index of that name.
	 */
	private async hasIndex(queryRunner: QueryRunner, name: string): Promise<boolean> {
		const rows: Array<{ counted?: string | number }> = await queryRunner.query(
			`SELECT COUNT(*) AS counted FROM information_schema.statistics WHERE table_schema = DATABASE() AND index_name = '${name}'`
		);

		return Number(rows?.[0]?.counted ?? 0) > 0;
	}

	/*
	|--------------------------------------------------------------------------
	| The backfill
	|--------------------------------------------------------------------------
	*/

	/**
	 * Carries an existing installation's 1:1 links into the pivot, and re-derives the counters from it.
	 *
	 * One `INVOICE` row per non-null `invoiceItemId` and nothing else: the retained column said exactly
	 * one thing, and the backfill invents no part it did not record. The `WHERE NOT EXISTS` makes a
	 * second run a no-op, and the two counter updates are re-derivations rather than increments, so
	 * running them twice produces the same numbers.
	 *
	 * The item's amount is read from the invoice item where the dialect can see it; where it cannot, the
	 * link is written with the line's own `unitPrice × quantity`, which is what the flattened item was
	 * written from. Either way the link's amount is the item's, not a recomputation of today's price.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async backfill(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<void> {
		if (!(await queryRunner.hasTable(CreateOrderLineInvoiceTable1791000000235.LINK_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(CreateOrderLineInvoiceTable1791000000235.LINE_TABLE, 'invoicedQuantity'))) {
			return;
		}

		const quote = dialect === 'mysql' ? '`' : '"';

		await queryRunner.query(
			`INSERT INTO ${quote}order_line_invoice${quote} (${quote}id${quote}, ${quote}createdAt${quote}, ${quote}updatedAt${quote}, ${quote}orderLineId${quote}, ${quote}invoiceItemId${quote}, ${quote}direction${quote}, ${quote}quantity${quote}, ${quote}amount${quote}, ${quote}currency${quote}, ${quote}tenantId${quote}, ${quote}organizationId${quote}) ` +
				`SELECT ${this.uuidExpression(dialect)}, ${this.nowExpression(dialect)}, ${this.nowExpression(dialect)}, ${quote}order_line${quote}.${quote}id${quote}, ${quote}order_line${quote}.${quote}invoiceItemId${quote}, 'INVOICE', ${quote}order_line${quote}.${quote}quantity${quote}, ${quote}order_line${quote}.${quote}quantity${quote} * ${quote}order_line${quote}.${quote}unitPrice${quote}, ${this.currencyExpression(quote)}, ${quote}order_line${quote}.${quote}tenantId${quote}, ${quote}order_line${quote}.${quote}organizationId${quote} ` +
				`FROM ${quote}order_line${quote} ` +
				`WHERE ${quote}order_line${quote}.${quote}invoiceItemId${quote} IS NOT NULL ` +
				`AND NOT EXISTS (SELECT 1 FROM ${quote}order_line_invoice${quote} ${quote}link${quote} WHERE ${quote}link${quote}.${quote}invoiceItemId${quote} = ${quote}order_line${quote}.${quote}invoiceItemId${quote})`
		);

		const direction = `${quote}order_line_invoice${quote}.${quote}direction${quote}`;
		const link = `${quote}order_line_invoice${quote}.${quote}orderLineId${quote}`;

		await queryRunner.query(
			`UPDATE ${quote}order_line${quote} SET ${quote}invoicedQuantity${quote} = COALESCE((SELECT SUM(${quote}quantity${quote}) FROM ${quote}order_line_invoice${quote} WHERE ${link} = ${quote}order_line${quote}.${quote}id${quote} AND ${direction} = 'INVOICE' AND ${quote}deletedAt${quote} IS NULL), 0), ` +
				`${quote}creditedQuantity${quote} = COALESCE((SELECT SUM(${quote}quantity${quote}) FROM ${quote}order_line_invoice${quote} WHERE ${link} = ${quote}order_line${quote}.${quote}id${quote} AND ${direction} = 'CREDIT' AND ${quote}deletedAt${quote} IS NULL), 0)`
		);

		await queryRunner.query(
			`UPDATE ${quote}order_line${quote} SET ${quote}invoiceStatus${quote} = CASE ` +
				`WHEN ${quote}invoicedQuantity${quote} - ${quote}creditedQuantity${quote} > ${quote}quantity${quote} THEN 'OVER_INVOICED' ` +
				`WHEN ${quote}invoicedQuantity${quote} - ${quote}creditedQuantity${quote} = ${quote}quantity${quote} THEN 'INVOICED' ` +
				`WHEN ${quote}invoicedQuantity${quote} - ${quote}creditedQuantity${quote} > 0 THEN 'PARTIALLY_INVOICED' ` +
				`ELSE 'NOT_INVOICED' END`
		);
	}

	/**
	 * @param dialect The dialect being migrated.
	 * @returns The expression that mints a uuid on that dialect, as the shipped migrations write it.
	 */
	private uuidExpression(dialect: 'postgres' | 'mysql' | 'sqlite'): string {
		if (dialect === 'postgres') {
			return 'gen_random_uuid()';
		}

		if (dialect === 'mysql') {
			return '(UUID())';
		}

		return `(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`;
	}

	/**
	 * @param dialect The dialect being migrated.
	 * @returns The expression that reads the current instant on that dialect.
	 */
	private nowExpression(dialect: 'postgres' | 'mysql' | 'sqlite'): string {
		if (dialect === 'postgres') {
			return 'now()';
		}

		if (dialect === 'mysql') {
			return 'CURRENT_TIMESTAMP(6)';
		}

		return `datetime('now')`;
	}

	/**
	 * @param quote The dialect's identifier quote.
	 * @returns The expression that reads the currency of the order a line belongs to, falling back to
	 * the organization's own when the order cannot be read.
	 */
	private currencyExpression(quote: string): string {
		return `COALESCE((SELECT ${quote}currency${quote} FROM ${quote}order${quote} WHERE ${quote}order${quote}.${quote}id${quote} = ${quote}order_line${quote}.${quote}orderId${quote}), 'USD')`;
	}

	/**
	 * @param queryRunner The query runner.
	 * @param name The constraint name.
	 * @returns True when Postgres already carries a foreign key of that name.
	 */
	private async hasForeignKey(queryRunner: QueryRunner, name: string): Promise<boolean> {
		const rows: Array<{ counted?: string | number }> = await queryRunner.query(
			`SELECT COUNT(*) AS counted FROM information_schema.table_constraints WHERE constraint_name = '${name}' AND constraint_type = 'FOREIGN KEY'`
		);

		return Number(rows?.[0]?.counted ?? 0) > 0;
	}
}
