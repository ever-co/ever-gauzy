import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the vendor term table, and adds to the purchase documents what the agreement needs.
 *
 * `vendor_product_term` is the row that carries the agreement: the many-per-supplier and
 * many-per-product commercial term a purchase line is priced and dated from. The supplier master can
 * only state a vendor-level lead time and a default currency, which is not enough for the ordinary
 * case of a mixed basket — one supplier quotes one price for the 500-unit break of one variant and
 * another for the 100-unit break of a second — so the agreement is a table of its own rather than a
 * column on either parent.
 *
 * The same file adds the columns the documents were missing for it: the supplier's own reference and
 * the buyer on the order, the settlement snapshot and the due date, and on the line the unit the buyer
 * ordered in, the conversion factor that freezes it, the term that priced the line, the billed cache
 * the three-way match reads and the container the term quoted.
 *
 * **Why this timestamp.** The programme's plan reserved `1791000000425` for a file of this name. This
 * package's shipped set occupies `1791000000340` — a different sub-range of the window — and a
 * migration's timestamp is frozen once it has shipped, so the file cannot be placed at the planned tick
 * without renumbering a file that has already run. It therefore takes the **next free tick inside the
 * purchasing package's own sub-range**, `1791000000345`, which keeps it in exactly the position the plan
 * intends: after `CreatePurchasingTables` and before the constraint migration of the set.
 *
 * Two things are deliberately **not** constrained here. `purchase_order.paymentTermId` and
 * `purchase_order_line.unitId` are plain uuid columns: their targets (`payment_term` and `unit`) are
 * created by the kernel's measurement and settlement-term set, which owns them and adds the constraints
 * in `AddMeasurementAndTermForeignKeys` — the programme's rule that a constraint is added by the set
 * that owns its target. `vendor_product_term` and the column that points at it are this package's own,
 * so they are constrained here.
 *
 * All three dialects are written by hand and the down migration reverses every statement in the
 * opposite order. SQLite needs more than the other two: it cannot change a column's nullability and
 * cannot add a constraint to an existing table, so two tables are rebuilt from their own recorded
 * definitions — replaying the indexes a rebuilt table would otherwise lose — and the six check
 * constraints are left to the service and the nightly audit, because SQLite has no way to add one.
 */
export class CreateVendorProductTermTable1791000000345 implements MigrationInterface {
	name = 'CreateVendorProductTermTable1791000000345';

	/** The table this file creates. */
	private static readonly TERM_TABLE = 'vendor_product_term';

	/** The order whose columns and indexes the revision completes. */
	private static readonly ORDER_TABLE = 'purchase_order';

	/** The line whose columns, index and foreign key the revision completes. */
	private static readonly LINE_TABLE = 'purchase_order_line';

	/** The receipt whose order anchor becomes optional. */
	private static readonly RECEIPT_TABLE = 'goods_receipt';

	/** The foreign key that makes the term a line records its provenance a real relationship. */
	private static readonly LINE_TERM_FOREIGN_KEY = 'FK_purchase_order_line_vendor_term';

	/** The index over that foreign key. */
	private static readonly LINE_TERM_INDEX = 'IDX_purchase_order_line_vendor_term';

	/** The unique index whose tuple this revision widens. */
	private static readonly LINE_BUSINESS_KEY = 'UQ_purchase_order_line';

	/** The suffix the rebuild gives the replacement table while it is being filled. */
	private static readonly REBUILD_SUFFIX = '_1791000000345_rebuild';

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
			`CREATE TABLE "vendor_product_term" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "vendorId" uuid NOT NULL, "variantId" uuid NOT NULL, "currency" character varying(3) NOT NULL, "unitCost" numeric(20,6) NOT NULL, "discountPercent" numeric(9,6), "minQuantity" numeric(20,6) NOT NULL DEFAULT 0, "packSize" numeric(20,6), "packLabel" character varying(16), "leadTimeDays" integer, "vendorProductCode" character varying(64), "vendorProductName" character varying(255), "overReceiptTolerancePercent" numeric(9,6), "priority" integer NOT NULL DEFAULT 100, "startsAt" TIMESTAMP, "endsAt" TIMESTAMP, "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "metadata" jsonb, CONSTRAINT "PK_vendor_product_term_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_vendor_term_created_by_user" ON "vendor_product_term" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_vendor_term_updated_by_user" ON "vendor_product_term" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_vendor_term_deleted_by_user" ON "vendor_product_term" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_vendor_term_is_active" ON "vendor_product_term" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_vendor_term_is_archived" ON "vendor_product_term" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_vendor_term_tenant" ON "vendor_product_term" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_vendor_term_organization" ON "vendor_product_term" ("organizationId")`
		);
		// One row per agreement: the same supplier, unit, currency and quantity break cannot be agreed
		// twice with the same start. A second break, a second window and a second currency are further
		// rows, which is exactly what the tuple expresses.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_vendor_product_term" ON "vendor_product_term" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "vendorId", "variantId", "currency", "minQuantity", COALESCE("startsAt", '1970-01-01 00:00:00')) WHERE "deletedAt" IS NULL`
		);
		// The three scans the domain actually runs: the resolution for one unit, one supplier's standing
		// terms, and the supplier's own code matched against a quotation or a bill.
		await queryRunner.query(
			`CREATE INDEX "IDX_vendor_term_resolve" ON "vendor_product_term" ("organizationId", "variantId", "status", "startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_vendor_term_vendor" ON "vendor_product_term" ("vendorId", "variantId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_vendor_term_code" ON "vendor_product_term" ("vendorId", "vendorProductCode") WHERE "vendorProductCode" IS NOT NULL AND "deletedAt" IS NULL`
		);
		// The six rules a term row cannot break: a price and a break are never negative, and a discount,
		// a window, a container and an allowance are only meaningful inside their own bounds.
		await queryRunner.query(
			`ALTER TABLE "vendor_product_term" ADD CONSTRAINT "CHK_vendor_term_price" CHECK ("unitCost" >= 0)`
		);
		await queryRunner.query(
			`ALTER TABLE "vendor_product_term" ADD CONSTRAINT "CHK_vendor_term_min_qty" CHECK ("minQuantity" >= 0)`
		);
		await queryRunner.query(
			`ALTER TABLE "vendor_product_term" ADD CONSTRAINT "CHK_vendor_term_discount" CHECK ("discountPercent" IS NULL OR ("discountPercent" >= 0 AND "discountPercent" <= 100))`
		);
		await queryRunner.query(
			`ALTER TABLE "vendor_product_term" ADD CONSTRAINT "CHK_vendor_term_window" CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt")`
		);
		await queryRunner.query(
			`ALTER TABLE "vendor_product_term" ADD CONSTRAINT "CHK_vendor_term_tolerance" CHECK ("overReceiptTolerancePercent" IS NULL OR ("overReceiptTolerancePercent" >= 0 AND "overReceiptTolerancePercent" <= 100))`
		);
		await queryRunner.query(
			`ALTER TABLE "vendor_product_term" ADD CONSTRAINT "CHK_vendor_term_pack" CHECK ("packSize" IS NULL OR "packSize" > 0)`
		);
		// Both targets are long-standing platform tables, so both constraints belong here.
		await queryRunner.query(
			`ALTER TABLE "vendor_product_term" ADD CONSTRAINT "FK_vendor_product_term_vendor" FOREIGN KEY ("vendorId") REFERENCES "organization_vendor"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "vendor_product_term" ADD CONSTRAINT "FK_vendor_product_term_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);

		await this.addOrderColumns(queryRunner, 'postgres');
		await this.addLineColumns(queryRunner, 'postgres');
		await this.widenLineBusinessKey(queryRunner, 'postgres');
		await this.makeReceiptOrderOptional(queryRunner, 'postgres');
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.makeReceiptOrderRequired(queryRunner, 'postgres');
		await this.restoreLineBusinessKey(queryRunner, 'postgres');
		await queryRunner.query(
			`ALTER TABLE "purchase_order_line" DROP CONSTRAINT "${CreateVendorProductTermTable1791000000345.LINE_TERM_FOREIGN_KEY}"`
		);

		await this.removeLineColumns(queryRunner, 'postgres');
		await this.removeOrderColumns(queryRunner, 'postgres');

		await queryRunner.query(`ALTER TABLE "vendor_product_term" DROP CONSTRAINT "CHK_vendor_term_pack"`);
		await queryRunner.query(`ALTER TABLE "vendor_product_term" DROP CONSTRAINT "CHK_vendor_term_tolerance"`);
		await queryRunner.query(`ALTER TABLE "vendor_product_term" DROP CONSTRAINT "CHK_vendor_term_window"`);
		await queryRunner.query(`ALTER TABLE "vendor_product_term" DROP CONSTRAINT "CHK_vendor_term_discount"`);
		await queryRunner.query(`ALTER TABLE "vendor_product_term" DROP CONSTRAINT "CHK_vendor_term_min_qty"`);
		await queryRunner.query(`ALTER TABLE "vendor_product_term" DROP CONSTRAINT "CHK_vendor_term_price"`);
		await queryRunner.query(`ALTER TABLE "vendor_product_term" DROP CONSTRAINT "FK_vendor_product_term_variant"`);
		await queryRunner.query(`ALTER TABLE "vendor_product_term" DROP CONSTRAINT "FK_vendor_product_term_vendor"`);
		await queryRunner.query(`DROP INDEX "IDX_vendor_term_code"`);
		await queryRunner.query(`DROP INDEX "IDX_vendor_term_vendor"`);
		await queryRunner.query(`DROP INDEX "IDX_vendor_term_resolve"`);
		await queryRunner.query(`DROP INDEX "UQ_vendor_product_term"`);
		await queryRunner.query(`DROP INDEX "IDX_vendor_term_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_vendor_term_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_vendor_term_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_vendor_term_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_vendor_term_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_vendor_term_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_vendor_term_created_by_user"`);
		await queryRunner.query(`DROP TABLE "vendor_product_term"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a constraint to an existing table and cannot change a column's nullability, so
	 * the purchase line is rebuilt to gain its columns and the foreign key that makes the term it records
	 * real, and the receipt is rebuilt so its order anchor can be null. Both rebuilds replay the indexes
	 * they read before the rebuild, because a rebuilt table loses them silently.
	 *
	 * The six check constraints have no SQLite form at all — the dialect cannot add one after the table
	 * is created — so on this dialect those rules are a service check plus the nightly audit, which is
	 * what the programme prescribes for a rule a dialect cannot state.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "vendor_product_term" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "vendorId" varchar NOT NULL, "variantId" varchar NOT NULL, "currency" varchar(3) NOT NULL, "unitCost" numeric(20,6) NOT NULL, "discountPercent" numeric(9,6), "minQuantity" numeric(20,6) NOT NULL DEFAULT (0), "packSize" numeric(20,6), "packLabel" varchar(16), "leadTimeDays" int, "vendorProductCode" varchar(64), "vendorProductName" varchar(255), "overReceiptTolerancePercent" numeric(9,6), "priority" int NOT NULL DEFAULT (100), "startsAt" datetime, "endsAt" datetime, "status" varchar(16) NOT NULL DEFAULT ('ACTIVE'), "metadata" text, CONSTRAINT "FK_vendor_product_term_vendor" FOREIGN KEY ("vendorId") REFERENCES "organization_vendor" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_vendor_product_term_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_vendor_term_created_by_user" ON "vendor_product_term" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_vendor_term_updated_by_user" ON "vendor_product_term" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_vendor_term_deleted_by_user" ON "vendor_product_term" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_vendor_term_is_active" ON "vendor_product_term" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_vendor_term_is_archived" ON "vendor_product_term" ("isArchived")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_vendor_term_tenant" ON "vendor_product_term" ("tenantId")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_vendor_term_organization" ON "vendor_product_term" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vendor_product_term" ON "vendor_product_term" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "vendorId", "variantId", "currency", "minQuantity", COALESCE("startsAt", '1970-01-01 00:00:00')) WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_vendor_term_resolve" ON "vendor_product_term" ("organizationId", "variantId", "status", "startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_vendor_term_vendor" ON "vendor_product_term" ("vendorId", "variantId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_vendor_term_code" ON "vendor_product_term" ("vendorId", "vendorProductCode") WHERE "vendorProductCode" IS NOT NULL AND "deletedAt" IS NULL`
		);

		await this.addOrderColumns(queryRunner, 'sqlite');
		await this.addLineColumns(queryRunner, 'sqlite');

		// The columns are added the same way on all three dialects; what SQLite cannot do is accept the
		// foreign key afterwards, so the line is rebuilt for the constraint alone. The receipt is rebuilt
		// for the one change SQLite has no `ALTER TABLE` for at all: dropping `NOT NULL` from a column.
		await queryRunner.query('PRAGMA foreign_keys = OFF');
		await this.rebuildSqliteTable(
			queryRunner,
			CreateVendorProductTermTable1791000000345.LINE_TABLE,
			(definition) => this.addLineForeignKeyToSqliteDefinition(definition),
			(index) => this.isWidenedBusinessKey(index)
		);
		await this.rebuildSqliteTable(
			queryRunner,
			CreateVendorProductTermTable1791000000345.RECEIPT_TABLE,
			(definition) => this.makeSqliteColumnNullable(definition, 'purchaseOrderId')
		);
		await queryRunner.query('PRAGMA foreign_keys = ON');

		await this.widenLineBusinessKey(queryRunner, 'sqlite');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * The inverse rebuilds the two tables without what the up added — the same operation in the opposite
	 * direction, and the only way to remove a constraint or to restore a nullability the dialect has no
	 * `ALTER TABLE` for.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query('PRAGMA foreign_keys = OFF');
		await this.rebuildSqliteTable(
			queryRunner,
			CreateVendorProductTermTable1791000000345.RECEIPT_TABLE,
			(definition) => this.makeSqliteColumnRequired(definition, 'purchaseOrderId')
		);
		await this.rebuildSqliteTable(
			queryRunner,
			CreateVendorProductTermTable1791000000345.LINE_TABLE,
			(definition) => this.removeLineForeignKeyFromSqliteDefinition(definition),
			// The widened tuple is restored below, and the index over the term cannot survive a column
			// that is about to be dropped.
			(index) => this.isWidenedBusinessKey(index) || index.includes('"vendorTermId"')
		);
		await queryRunner.query('PRAGMA foreign_keys = ON');

		await this.restoreLineBusinessKey(queryRunner, 'sqlite');
		await this.removeLineColumns(queryRunner, 'sqlite');
		await this.removeOrderColumns(queryRunner, 'sqlite');

		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_term_code"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_term_vendor"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_term_resolve"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_vendor_product_term"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_term_organization"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_term_tenant"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_term_is_archived"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_term_is_active"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_term_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_term_updated_by_user"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_term_created_by_user"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "vendor_product_term"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no partial index, so the predicate that makes the agreement unique among live rows is
	 * carried by the stored generated `deletedKey` that `CreateSequenceTable1791000000000` documents for
	 * the whole set. Two further members of this tuple are nullable and are folded rather than left raw:
	 * `organizationKey` for the scope column, and `startsAtKey` for the start of the window, because an
	 * agreement with no start date is one agreement and not an unlimited supply of them. Including
	 * `deletedAt` itself in the key, which this file used to do, carries no rule at all — a unique index
	 * in MySQL exempts every tuple that contains a null. The partial indexes that are not unique lose
	 * their predicate instead, which is a narrowing rather than a rule.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`vendor_product_term\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`vendorId\` varchar(36) NOT NULL, \`variantId\` varchar(36) NOT NULL, \`currency\` varchar(3) NOT NULL, \`unitCost\` decimal(20,6) NOT NULL, \`discountPercent\` decimal(9,6) NULL, \`minQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`packSize\` decimal(20,6) NULL, \`packLabel\` varchar(16) NULL, \`leadTimeDays\` int NULL, \`vendorProductCode\` varchar(64) NULL, \`vendorProductName\` varchar(255) NULL, \`overReceiptTolerancePercent\` decimal(9,6) NULL, \`priority\` int NOT NULL DEFAULT 100, \`startsAt\` datetime NULL, \`endsAt\` datetime NULL, \`status\` varchar(16) NOT NULL DEFAULT 'ACTIVE', \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`startsAtKey\` datetime GENERATED ALWAYS AS (IFNULL(\`startsAt\`, '1970-01-01 00:00:00')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_vendor_term_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_vendor_term_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_vendor_term_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_vendor_term_is_active\` (\`isActive\`), INDEX \`IDX_vendor_term_is_archived\` (\`isArchived\`), INDEX \`IDX_vendor_term_tenant\` (\`tenantId\`), INDEX \`IDX_vendor_term_organization\` (\`organizationId\`), INDEX \`IDX_vendor_term_resolve\` (\`organizationId\`, \`variantId\`, \`status\`, \`startsAt\`, \`endsAt\`), INDEX \`IDX_vendor_term_vendor\` (\`vendorId\`, \`variantId\`, \`status\`), INDEX \`IDX_vendor_term_code\` (\`vendorId\`, \`vendorProductCode\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_vendor_product_term\` ON \`vendor_product_term\` (\`organizationKey\`, \`vendorId\`, \`variantId\`, \`currency\`, \`minQuantity\`, \`startsAtKey\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`vendor_product_term\` ADD CONSTRAINT \`CHK_vendor_term_price\` CHECK (\`unitCost\` >= 0)`
		);
		await queryRunner.query(
			`ALTER TABLE \`vendor_product_term\` ADD CONSTRAINT \`CHK_vendor_term_min_qty\` CHECK (\`minQuantity\` >= 0)`
		);
		await queryRunner.query(
			`ALTER TABLE \`vendor_product_term\` ADD CONSTRAINT \`CHK_vendor_term_discount\` CHECK (\`discountPercent\` IS NULL OR (\`discountPercent\` >= 0 AND \`discountPercent\` <= 100))`
		);
		await queryRunner.query(
			`ALTER TABLE \`vendor_product_term\` ADD CONSTRAINT \`CHK_vendor_term_window\` CHECK (\`endsAt\` IS NULL OR \`startsAt\` IS NULL OR \`endsAt\` > \`startsAt\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`vendor_product_term\` ADD CONSTRAINT \`CHK_vendor_term_tolerance\` CHECK (\`overReceiptTolerancePercent\` IS NULL OR (\`overReceiptTolerancePercent\` >= 0 AND \`overReceiptTolerancePercent\` <= 100))`
		);
		await queryRunner.query(
			`ALTER TABLE \`vendor_product_term\` ADD CONSTRAINT \`CHK_vendor_term_pack\` CHECK (\`packSize\` IS NULL OR \`packSize\` > 0)`
		);
		await queryRunner.query(
			`ALTER TABLE \`vendor_product_term\` ADD CONSTRAINT \`FK_vendor_product_term_vendor\` FOREIGN KEY (\`vendorId\`) REFERENCES \`organization_vendor\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`vendor_product_term\` ADD CONSTRAINT \`FK_vendor_product_term_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);

		await this.addOrderColumns(queryRunner, 'mysql');
		await this.addLineColumns(queryRunner, 'mysql');
		await this.widenLineBusinessKey(queryRunner, 'mysql');
		await this.makeReceiptOrderOptional(queryRunner, 'mysql');
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.makeReceiptOrderRequired(queryRunner, 'mysql');
		await this.restoreLineBusinessKey(queryRunner, 'mysql');
		await queryRunner.query(
			`ALTER TABLE \`purchase_order_line\` DROP FOREIGN KEY \`${CreateVendorProductTermTable1791000000345.LINE_TERM_FOREIGN_KEY}\``
		);

		await this.removeLineColumns(queryRunner, 'mysql');
		await this.removeOrderColumns(queryRunner, 'mysql');

		await queryRunner.query(`DROP TABLE \`vendor_product_term\``);
	}

	/*
	|--------------------------------------------------------------------------
	| The purchase documents
	|--------------------------------------------------------------------------
	*/

	/**
	 * Adds the columns the order was missing beside its supplier.
	 *
	 * `vendorReference` is the supplier's own order number — without it the three-way match is guesswork
	 * by amount and date; `buyerUserId` is the routing key for every approval and follow-up;
	 * `paymentTermId` and `paymentTermsDaysSnapshot` are the settlement schedule and the simple form it
	 * stood in at order time; and `dueDate` is computed once from them and snapshotted, so an ageing
	 * report reads the order rather than a supplier row that may since have been renegotiated.
	 *
	 * Every addition is guarded, so the file is a no-op where a column is already there. The settlement
	 * columns carry **no constraint**: `payment_term` is created by the kernel's own set, which owns the
	 * target and adds the constraint once it exists.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async addOrderColumns(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<void> {
		if (!(await queryRunner.hasTable(CreateVendorProductTermTable1791000000345.ORDER_TABLE))) {
			return;
		}

		if (dialect === 'postgres') {
			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'vendorReference'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order" ADD COLUMN "vendorReference" varchar(64)`);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'buyerUserId'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order" ADD COLUMN "buyerUserId" uuid`);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'dueDate'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order" ADD COLUMN "dueDate" TIMESTAMP`);
			}

			if (
				!(await queryRunner.hasColumn(
					CreateVendorProductTermTable1791000000345.ORDER_TABLE,
					'paymentTermsDaysSnapshot'
				))
			) {
				await queryRunner.query(`ALTER TABLE "purchase_order" ADD COLUMN "paymentTermsDaysSnapshot" int`);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'paymentTermId'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order" ADD COLUMN "paymentTermId" uuid`);
			}
		}

		if (dialect === 'mysql') {
			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'vendorReference'))) {
				await queryRunner.query(`ALTER TABLE \`purchase_order\` ADD COLUMN \`vendorReference\` varchar(64) NULL`);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'buyerUserId'))) {
				await queryRunner.query(`ALTER TABLE \`purchase_order\` ADD COLUMN \`buyerUserId\` varchar(36) NULL`);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'dueDate'))) {
				await queryRunner.query(`ALTER TABLE \`purchase_order\` ADD COLUMN \`dueDate\` datetime NULL`);
			}

			if (
				!(await queryRunner.hasColumn(
					CreateVendorProductTermTable1791000000345.ORDER_TABLE,
					'paymentTermsDaysSnapshot'
				))
			) {
				await queryRunner.query(`ALTER TABLE \`purchase_order\` ADD COLUMN \`paymentTermsDaysSnapshot\` int NULL`);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'paymentTermId'))) {
				await queryRunner.query(`ALTER TABLE \`purchase_order\` ADD COLUMN \`paymentTermId\` varchar(36) NULL`);
			}
		}

		if (dialect === 'sqlite') {
			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'vendorReference'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order" ADD COLUMN "vendorReference" varchar(64)`);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'buyerUserId'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order" ADD COLUMN "buyerUserId" varchar`);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'dueDate'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order" ADD COLUMN "dueDate" datetime`);
			}

			if (
				!(await queryRunner.hasColumn(
					CreateVendorProductTermTable1791000000345.ORDER_TABLE,
					'paymentTermsDaysSnapshot'
				))
			) {
				await queryRunner.query(`ALTER TABLE "purchase_order" ADD COLUMN "paymentTermsDaysSnapshot" int`);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'paymentTermId'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order" ADD COLUMN "paymentTermId" varchar`);
			}
		}

		// The two scans the new columns exist for: matching a supplier's acknowledgement or their bill by
		// their own reference, and the ageing report over the due date.
		await this.createIndex(
			queryRunner,
			dialect,
			'IDX_purchase_order_vendor_ref',
			CreateVendorProductTermTable1791000000345.ORDER_TABLE,
			['vendorId', 'vendorReference'],
			'"vendorReference" IS NOT NULL AND "deletedAt" IS NULL'
		);
		await this.createIndex(
			queryRunner,
			dialect,
			'IDX_purchase_order_due',
			CreateVendorProductTermTable1791000000345.ORDER_TABLE,
			['organizationId', 'dueDate'],
			'"dueDate" IS NOT NULL AND "deletedAt" IS NULL'
		);

		// The buyer is a user the platform already holds, so the constraint belongs here — and it is
		// `SET NULL`, because an order outlives the employment of the person who raised it. SQLite has no
		// way to add a constraint to an existing table, so on that dialect the column stands alone.
		if (dialect === 'mysql') {
			await queryRunner.query(
				`ALTER TABLE \`purchase_order\` ADD CONSTRAINT \`FK_purchase_order_buyer\` FOREIGN KEY (\`buyerUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
			);

			return;
		}

		if (dialect === 'sqlite') {
			return;
		}

		await queryRunner.query(
			`ALTER TABLE "purchase_order" ADD CONSTRAINT "FK_purchase_order_buyer" FOREIGN KEY ("buyerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * Removes the columns the order gained for the agreement, and their indexes.
	 *
	 * Guarded the same way as the additions, so a rollback on an installation that never received them
	 * is a no-op.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async removeOrderColumns(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		if (!(await queryRunner.hasTable(CreateVendorProductTermTable1791000000345.ORDER_TABLE))) {
			return;
		}

		await this.dropIndex(
			queryRunner,
			dialect,
			'IDX_purchase_order_due',
			CreateVendorProductTermTable1791000000345.ORDER_TABLE
		);
		await this.dropIndex(
			queryRunner,
			dialect,
			'IDX_purchase_order_vendor_ref',
			CreateVendorProductTermTable1791000000345.ORDER_TABLE
		);

		if (dialect === 'mysql') {
			if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'buyerUserId')) {
				await queryRunner.query(`ALTER TABLE \`purchase_order\` DROP FOREIGN KEY \`FK_purchase_order_buyer\``);
			}

			if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'paymentTermId')) {
				await queryRunner.query(`ALTER TABLE \`purchase_order\` DROP COLUMN \`paymentTermId\``);
			}

			if (
				await queryRunner.hasColumn(
					CreateVendorProductTermTable1791000000345.ORDER_TABLE,
					'paymentTermsDaysSnapshot'
				)
			) {
				await queryRunner.query(`ALTER TABLE \`purchase_order\` DROP COLUMN \`paymentTermsDaysSnapshot\``);
			}

			if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'dueDate')) {
				await queryRunner.query(`ALTER TABLE \`purchase_order\` DROP COLUMN \`dueDate\``);
			}

			if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'buyerUserId')) {
				await queryRunner.query(`ALTER TABLE \`purchase_order\` DROP COLUMN \`buyerUserId\``);
			}

			if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'vendorReference')) {
				await queryRunner.query(`ALTER TABLE \`purchase_order\` DROP COLUMN \`vendorReference\``);
			}

			return;
		}

		if (dialect === 'postgres') {
			// The buyer's foreign key is Postgres's alone: SQLite cannot add — or drop — a constraint on a
			// table that already exists, which is why the column stands alone there.
			if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'buyerUserId')) {
				await queryRunner.query(`ALTER TABLE "purchase_order" DROP CONSTRAINT "FK_purchase_order_buyer"`);
			}
		}

		// SQLite supports `DROP COLUMN` from 3.35, which is the floor this platform builds against; every
		// column added here is nullable, so nothing is rebuilt around them.
		if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'paymentTermId')) {
			await queryRunner.query(`ALTER TABLE "purchase_order" DROP COLUMN "paymentTermId"`);
		}

		if (
			await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'paymentTermsDaysSnapshot')
		) {
			await queryRunner.query(`ALTER TABLE "purchase_order" DROP COLUMN "paymentTermsDaysSnapshot"`);
		}

		if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'dueDate')) {
			await queryRunner.query(`ALTER TABLE "purchase_order" DROP COLUMN "dueDate"`);
		}

		if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'buyerUserId')) {
			await queryRunner.query(`ALTER TABLE "purchase_order" DROP COLUMN "buyerUserId"`);
		}

		if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.ORDER_TABLE, 'vendorReference')) {
			await queryRunner.query(`ALTER TABLE "purchase_order" DROP COLUMN "vendorReference"`);
		}
	}

	/**
	 * Adds the columns the line was missing, the index over the term it records, and the constraint that
	 * makes that term a real relationship.
	 *
	 * `unitId` is the unit the buyer ordered in — a supplier who sells by the case of twelve while we
	 * stock eaches is the ordinary case — and `conversionFactor` freezes that unit's factor at entry, so
	 * the quantity in reference units is derivable without re-reading the measurement tables.
	 * `vendorTermId` is the provenance of the price: which term row priced the line, which the line never
	 * re-reads afterwards. `billedQuantity` is the third of the three quantities the match compares, and
	 * it is a cache the bill side re-derives rather than a counter anybody increments.
	 * `orderedPackSize` is the supplier's container as it stood when the line was priced.
	 *
	 * Every addition is guarded, and `unitId` carries **no constraint**: `unit` belongs to the kernel's
	 * measurement set, which owns the target and adds the constraint once it exists. The constraint on
	 * `vendorTermId` is added by the caller on Postgres and MySQL, and by the rebuild on SQLite, which is
	 * the only way that dialect accepts a constraint on an existing table.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async addLineColumns(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<void> {
		if (!(await queryRunner.hasTable(CreateVendorProductTermTable1791000000345.LINE_TABLE))) {
			return;
		}

		if (dialect === 'postgres') {
			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'unitId'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order_line" ADD COLUMN "unitId" uuid`);
			}

			if (
				!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'conversionFactor'))
			) {
				await queryRunner.query(
					`ALTER TABLE "purchase_order_line" ADD COLUMN "conversionFactor" numeric(24,12) NOT NULL DEFAULT 1`
				);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'vendorTermId'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order_line" ADD COLUMN "vendorTermId" uuid`);
			}

			if (
				!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'billedQuantity'))
			) {
				await queryRunner.query(
					`ALTER TABLE "purchase_order_line" ADD COLUMN "billedQuantity" numeric(20,6) NOT NULL DEFAULT 0`
				);
			}

			if (
				!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'orderedPackSize'))
			) {
				await queryRunner.query(`ALTER TABLE "purchase_order_line" ADD COLUMN "orderedPackSize" numeric(20,6)`);
			}
		}

		if (dialect === 'mysql') {
			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'unitId'))) {
				await queryRunner.query(`ALTER TABLE \`purchase_order_line\` ADD COLUMN \`unitId\` varchar(36) NULL`);
			}

			if (
				!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'conversionFactor'))
			) {
				await queryRunner.query(
					`ALTER TABLE \`purchase_order_line\` ADD COLUMN \`conversionFactor\` decimal(24,12) NOT NULL DEFAULT 1`
				);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'vendorTermId'))) {
				await queryRunner.query(`ALTER TABLE \`purchase_order_line\` ADD COLUMN \`vendorTermId\` varchar(36) NULL`);
			}

			if (
				!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'billedQuantity'))
			) {
				await queryRunner.query(
					`ALTER TABLE \`purchase_order_line\` ADD COLUMN \`billedQuantity\` decimal(20,6) NOT NULL DEFAULT 0`
				);
			}

			if (
				!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'orderedPackSize'))
			) {
				await queryRunner.query(
					`ALTER TABLE \`purchase_order_line\` ADD COLUMN \`orderedPackSize\` decimal(20,6) NULL`
				);
			}
		}

		if (dialect === 'sqlite') {
			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'unitId'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order_line" ADD COLUMN "unitId" varchar`);
			}

			if (
				!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'conversionFactor'))
			) {
				await queryRunner.query(
					`ALTER TABLE "purchase_order_line" ADD COLUMN "conversionFactor" numeric(24,12) NOT NULL DEFAULT (1)`
				);
			}

			if (!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'vendorTermId'))) {
				await queryRunner.query(`ALTER TABLE "purchase_order_line" ADD COLUMN "vendorTermId" varchar`);
			}

			if (
				!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'billedQuantity'))
			) {
				await queryRunner.query(
					`ALTER TABLE "purchase_order_line" ADD COLUMN "billedQuantity" numeric(20,6) NOT NULL DEFAULT (0)`
				);
			}

			if (
				!(await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'orderedPackSize'))
			) {
				await queryRunner.query(`ALTER TABLE "purchase_order_line" ADD COLUMN "orderedPackSize" numeric(20,6)`);
			}
		}

		await this.createIndex(
			queryRunner,
			dialect,
			CreateVendorProductTermTable1791000000345.LINE_TERM_INDEX,
			CreateVendorProductTermTable1791000000345.LINE_TABLE,
			['vendorTermId'],
			'"vendorTermId" IS NOT NULL'
		);

		if (dialect === 'sqlite') {
			// The constraint arrives with the rebuild the caller performs: SQLite has no way to add one to
			// a table that already exists.
			return;
		}

		const constraint =
			dialect === 'mysql'
				? `ALTER TABLE \`purchase_order_line\` ADD CONSTRAINT \`${CreateVendorProductTermTable1791000000345.LINE_TERM_FOREIGN_KEY}\` FOREIGN KEY (\`vendorTermId\`) REFERENCES \`vendor_product_term\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
				: `ALTER TABLE "purchase_order_line" ADD CONSTRAINT "${CreateVendorProductTermTable1791000000345.LINE_TERM_FOREIGN_KEY}" FOREIGN KEY ("vendorTermId") REFERENCES "vendor_product_term"("id") ON DELETE SET NULL ON UPDATE NO ACTION`;

		await queryRunner.query(constraint);
	}

	/**
	 * Removes the columns the line gained, and the index over them.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async removeLineColumns(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		if (!(await queryRunner.hasTable(CreateVendorProductTermTable1791000000345.LINE_TABLE))) {
			return;
		}

		await this.dropIndex(
			queryRunner,
			dialect,
			CreateVendorProductTermTable1791000000345.LINE_TERM_INDEX,
			CreateVendorProductTermTable1791000000345.LINE_TABLE
		);

		if (dialect === 'mysql') {
			if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'orderedPackSize')) {
				await queryRunner.query(`ALTER TABLE \`purchase_order_line\` DROP COLUMN \`orderedPackSize\``);
			}

			if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'billedQuantity')) {
				await queryRunner.query(`ALTER TABLE \`purchase_order_line\` DROP COLUMN \`billedQuantity\``);
			}

			if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'vendorTermId')) {
				await queryRunner.query(`ALTER TABLE \`purchase_order_line\` DROP COLUMN \`vendorTermId\``);
			}

			if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'conversionFactor')) {
				await queryRunner.query(`ALTER TABLE \`purchase_order_line\` DROP COLUMN \`conversionFactor\``);
			}

			if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'unitId')) {
				await queryRunner.query(`ALTER TABLE \`purchase_order_line\` DROP COLUMN \`unitId\``);
			}

			return;
		}

		if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'orderedPackSize')) {
			await queryRunner.query(`ALTER TABLE "purchase_order_line" DROP COLUMN "orderedPackSize"`);
		}

		if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'billedQuantity')) {
			await queryRunner.query(`ALTER TABLE "purchase_order_line" DROP COLUMN "billedQuantity"`);
		}

		if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'vendorTermId')) {
			await queryRunner.query(`ALTER TABLE "purchase_order_line" DROP COLUMN "vendorTermId"`);
		}

		if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'conversionFactor')) {
			await queryRunner.query(`ALTER TABLE "purchase_order_line" DROP COLUMN "conversionFactor"`);
		}

		if (await queryRunner.hasColumn(CreateVendorProductTermTable1791000000345.LINE_TABLE, 'unitId')) {
			await queryRunner.query(`ALTER TABLE "purchase_order_line" DROP COLUMN "unitId"`);
		}
	}

	/**
	 * Widens the line's business key from `(order, variant)` to `(order, variant, expected date)`.
	 *
	 * A split commitment — a hundred units now and five hundred next quarter at a better price — was
	 * inexpressible while the tuple stopped at the variant, and the price break the agreement introduces
	 * is exactly what makes a tenant want one. The widening only relaxes, so every row that satisfied the
	 * old key satisfies the new one, and a same-date duplicate is still refused, which is the intent: the
	 * constraint continues to catch a double entry.
	 *
	 * The index is dropped and created again rather than edited, because it has shipped and its tuple is
	 * the thing being changed.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async widenLineBusinessKey(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		if (!(await queryRunner.hasTable(CreateVendorProductTermTable1791000000345.LINE_TABLE))) {
			return;
		}

		// A second run finds the tuple already widened, and dropping an index only to create it again
		// with the same definition is not the no-op a guarded migration promises.
		const current = await this.indexDefinition(
			queryRunner,
			dialect,
			CreateVendorProductTermTable1791000000345.LINE_BUSINESS_KEY
		);

		if (current?.includes('expectedAt')) {
			return;
		}

		await this.dropIndex(
			queryRunner,
			dialect,
			CreateVendorProductTermTable1791000000345.LINE_BUSINESS_KEY,
			CreateVendorProductTermTable1791000000345.LINE_TABLE
		);

		if (dialect === 'mysql') {
			// `deletedKey` rather than `deletedAt`, and `expectedAtKey` rather than `expectedAt`: every
			// live row carries a null `deletedAt`, and a unique index in MySQL exempts any tuple that
			// contains a null, so this tuple constrained nothing at all. The date is folded for the same
			// reason, and folded on the other two dialects as well — neither of them compares two nulls
			// equal either, so a line with no expected date could be written twice on every dialect.
			// Both generated columns are declared by `CreatePurchasingTables1791000000340`, which creates
			// this table.
			await queryRunner.query(
				`CREATE UNIQUE INDEX \`${CreateVendorProductTermTable1791000000345.LINE_BUSINESS_KEY}\` ON \`purchase_order_line\` (\`purchaseOrderId\`, \`variantId\`, \`expectedAtKey\`, \`deletedKey\`)`
			);

			return;
		}

		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${CreateVendorProductTermTable1791000000345.LINE_BUSINESS_KEY}" ON "${CreateVendorProductTermTable1791000000345.LINE_TABLE}" ("purchaseOrderId", "variantId", COALESCE("expectedAt", '1970-01-01 00:00:00')) WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * Narrows the line's business key back to `(order, variant)`.
	 *
	 * The inverse of the widening, and safe for the same reason the widening was: the old tuple is the
	 * stricter one, so it holds whenever no two lines of one order share a variant and differ in date —
	 * which is what a rollback of this feature assumes. Where that is not true the index creation fails
	 * loudly rather than losing a line.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async restoreLineBusinessKey(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		if (!(await queryRunner.hasTable(CreateVendorProductTermTable1791000000345.LINE_TABLE))) {
			return;
		}

		// Nothing to narrow when the index is already the pre-revision tuple, or when it is absent: the
		// revert either already ran, or the rebuild that removed the constraint took the widened tuple with
		// it and the narrow one is created below.
		const current = await this.indexDefinition(
			queryRunner,
			dialect,
			CreateVendorProductTermTable1791000000345.LINE_BUSINESS_KEY
		);

		if (current !== undefined && !current.includes('expectedAt')) {
			return;
		}

		if (current !== undefined) {
			await this.dropIndex(
				queryRunner,
				dialect,
				CreateVendorProductTermTable1791000000345.LINE_BUSINESS_KEY,
				CreateVendorProductTermTable1791000000345.LINE_TABLE
			);
		}

		if (dialect === 'mysql') {
			await queryRunner.query(
				`CREATE UNIQUE INDEX \`${CreateVendorProductTermTable1791000000345.LINE_BUSINESS_KEY}\` ON \`purchase_order_line\` (\`purchaseOrderId\`, \`variantId\`, \`deletedKey\`)`
			);

			return;
		}

		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${CreateVendorProductTermTable1791000000345.LINE_BUSINESS_KEY}" ON "${CreateVendorProductTermTable1791000000345.LINE_TABLE}" ("purchaseOrderId", "variantId") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * Makes the receipt's order anchor optional.
	 *
	 * A consolidated delivery covering several orders is routine, and so is goods arriving with no order
	 * at all: the authoritative relation is already the receipt line's own order line, so the header
	 * column was the only obstacle. Every reader that assumed it is always present has to handle null,
	 * and the partial index over it keeps the existing query shape fast.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async makeReceiptOrderOptional(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		if (dialect === 'sqlite') {
			// SQLite has no `ALTER COLUMN`: the caller rebuilt the table instead.
			return;
		}

		if (!(await queryRunner.hasTable(CreateVendorProductTermTable1791000000345.RECEIPT_TABLE))) {
			return;
		}

		const nullable = await this.columnIsNullable(
			queryRunner,
			dialect,
			CreateVendorProductTermTable1791000000345.RECEIPT_TABLE,
			'purchaseOrderId'
		);

		if (nullable !== false) {
			return;
		}

		if (dialect === 'mysql') {
			await queryRunner.query(`ALTER TABLE \`goods_receipt\` MODIFY COLUMN \`purchaseOrderId\` varchar(36) NULL`);

			return;
		}

		await queryRunner.query(`ALTER TABLE "goods_receipt" ALTER COLUMN "purchaseOrderId" DROP NOT NULL`);
	}

	/**
	 * Puts the receipt's order anchor back to mandatory.
	 *
	 * The inverse, refused by the database itself when a consolidated receipt exists: a receipt with no
	 * order cannot be expressed by a column that requires one, and failing loudly is the right answer to
	 * a rollback that would have to discard one.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async makeReceiptOrderRequired(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		if (dialect === 'sqlite') {
			return;
		}

		if (!(await queryRunner.hasTable(CreateVendorProductTermTable1791000000345.RECEIPT_TABLE))) {
			return;
		}

		const nullable = await this.columnIsNullable(
			queryRunner,
			dialect,
			CreateVendorProductTermTable1791000000345.RECEIPT_TABLE,
			'purchaseOrderId'
		);

		if (nullable !== true) {
			return;
		}

		if (dialect === 'mysql') {
			await queryRunner.query(
				`ALTER TABLE \`goods_receipt\` MODIFY COLUMN \`purchaseOrderId\` varchar(36) NOT NULL`
			);

			return;
		}

		await queryRunner.query(`ALTER TABLE "goods_receipt" ALTER COLUMN "purchaseOrderId" SET NOT NULL`);
	}

	/*
	|--------------------------------------------------------------------------
	| Dialect plumbing
	|--------------------------------------------------------------------------
	*/

	/**
	 * Creates a named index where it is not already there.
	 *
	 * Postgres and SQLite have `IF NOT EXISTS`; MySQL does not, so the catalogue is asked first — the
	 * only portable way to make a second run of the same statement a no-op.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 * @param name The index name.
	 * @param table The indexed table.
	 * @param columns The indexed columns.
	 * @param predicate The partial predicate, which MySQL cannot express and therefore loses.
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
			if (await this.hasMysqlIndex(queryRunner, table, name)) {
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
			if (await this.hasMysqlIndex(queryRunner, table, name)) {
				await queryRunner.query(`DROP INDEX \`${name}\` ON \`${table}\``);
			}

			return;
		}

		await queryRunner.query(`DROP INDEX IF EXISTS "${name}"`);
	}

	/**
	 * @param queryRunner The query runner.
	 * @param table The table the index belongs to.
	 * @param index The index name.
	 * @returns True when MySQL already carries the index.
	 */
	private async hasMysqlIndex(queryRunner: QueryRunner, table: string, index: string): Promise<boolean> {
		const rows = await queryRunner.query(
			`SELECT COUNT(*) AS counted FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = '${table}' AND index_name = '${index}'`
		);

		return Number(rows?.[0]?.counted ?? 0) > 0;
	}

	/**
	 * Reads an index's own definition out of the catalogue, or undefined when it is not there.
	 *
	 * This is what makes the business-key change idempotent: the tuple has to be replaced when the index
	 * is the shipped narrow one and left alone when it is already the widened one, and the only authority
	 * on which of the two it is, is the catalogue.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 * @param index The index name.
	 * @returns What the index keys on, as the catalogue states it, or undefined when the index is absent.
	 */
	private async indexDefinition(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite',
		index: string
	): Promise<string | undefined> {
		if (dialect === 'mysql') {
			const rows = await queryRunner.query(
				`SELECT column_name AS columnName FROM information_schema.statistics WHERE table_schema = DATABASE() AND index_name = '${index}'`
			);

			if (!rows?.length) {
				return undefined;
			}

			return (rows as Array<{ columnName?: string }>).map((row) => String(row.columnName)).join(', ');
		}

		const rows =
			dialect === 'sqlite'
				? await queryRunner.query(
						`SELECT sql AS definition FROM sqlite_master WHERE type = 'index' AND name = '${index}'`
					)
				: await queryRunner.query(`SELECT indexdef AS definition FROM pg_indexes WHERE indexname = '${index}'`);

		return rows?.[0]?.definition === undefined ? undefined : String(rows[0].definition);
	}

	/**
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 * @param table The table.
	 * @param column The column.
	 * @returns True when the column accepts null, false when it does not, and undefined when the table or
	 * the column is absent.
	 */
	private async columnIsNullable(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql',
		table: string,
		column: string
	): Promise<boolean | undefined> {
		const scope = dialect === 'mysql' ? `table_schema = DATABASE() AND ` : '';
		const rows = await queryRunner.query(
			`SELECT is_nullable AS nullable FROM information_schema.columns WHERE ${scope}table_name = '${table}' AND column_name = '${column}'`
		);

		if (!rows?.length) {
			return undefined;
		}

		return String(rows[0].nullable).toUpperCase() === 'YES';
	}

	/*
	|--------------------------------------------------------------------------
	| The SQLite rebuild
	|--------------------------------------------------------------------------
	*/

	/**
	 * Rebuilds a SQLite table from its own recorded definition.
	 *
	 * The definition is read back from `sqlite_master`, handed to the caller's transform and written as a
	 * replacement table; the rows are copied across by name, the original is dropped and the replacement
	 * takes its name. Reading the definition rather than restating it is what keeps this file from
	 * drifting away from the table's actual shape.
	 *
	 * **The indexes are read before the rebuild and replayed after it, which is the part that is easy to
	 * lose.** SQLite moves a table's indexes with it when it is renamed and drops them with it when it is
	 * dropped, so a rebuilt table comes back with none at all unless they are recreated — and nothing
	 * about the result looks wrong until a query slows down. Their definitions are read first because a
	 * rename rewrites the table name inside them, and the replacement is built under a temporary name and
	 * renamed into place last, so no reference another table holds to the original is ever rewritten to a
	 * name this migration is about to drop.
	 *
	 * The transform returning its input unchanged is what makes a second run a no-op: nothing is created,
	 * nothing is copied and nothing is dropped.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table to rebuild.
	 * @param transform Turns the current definition into the wanted one.
	 * @param skipIndex Tells the replay which index definitions not to recreate, when the caller is
	 * replacing one of them.
	 */
	private async rebuildSqliteTable(
		queryRunner: QueryRunner,
		table: string,
		transform: (definition: string) => string,
		skipIndex: (definition: string) => boolean = (definition) => this.isWidenedBusinessKey(definition)
	): Promise<void> {
		const current = await this.readSqliteTable(queryRunner, table);

		if (!current) {
			return;
		}

		const rebuilt = transform(current.definition);

		if (!rebuilt || rebuilt === current.definition) {
			return;
		}

		const replacement = `${table}${CreateVendorProductTermTable1791000000345.REBUILD_SUFFIX}`;
		const columns = current.columns.map((column) => `"${column}"`).join(', ');
		const created = rebuilt.replace(new RegExp(`^(CREATE TABLE\\s+)"?${table}"?`), `$1"${replacement}"`);

		// The name belongs to this migration, so a replacement left behind by an attempt that failed
		// half-way is discarded rather than allowed to block the retry.
		await queryRunner.query(`DROP TABLE IF EXISTS "${replacement}"`);
		await queryRunner.query(created);
		await queryRunner.query(`INSERT INTO "${replacement}" (${columns}) SELECT ${columns} FROM "${table}"`);
		await queryRunner.query(`DROP TABLE "${table}"`);
		await queryRunner.query(`ALTER TABLE "${replacement}" RENAME TO "${table}"`);

		for (const index of current.indexes) {
			if (skipIndex(index)) {
				continue;
			}

			await queryRunner.query(index);
		}

		console.log(chalk.gray(`Rebuilt ${table} for the vendor term revision.`));
	}

	/**
	 * Reads a SQLite table's definition, its column names and the indexes defined over it.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table.
	 * @returns The definition, the columns in order and the index statements, or null when the table does
	 * not exist.
	 */
	private async readSqliteTable(
		queryRunner: QueryRunner,
		table: string
	): Promise<{ definition: string; columns: string[]; indexes: string[] } | null> {
		const tables: Array<{ sql?: string }> = await queryRunner.query(
			`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
			[table]
		);
		const definition = tables?.[0]?.sql;

		if (!definition) {
			return null;
		}

		const described: Array<{ name?: string }> = await queryRunner.query(`PRAGMA table_info("${table}")`);
		const indexes: Array<{ sql?: string }> = await queryRunner.query(
			`SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL`,
			[table]
		);

		return {
			definition,
			columns: (described ?? []).map((column) => String(column.name)),
			indexes: (indexes ?? []).map((index) => String(index.sql)).filter(Boolean)
		};
	}

	/**
	 * @param definition An index definition read from `sqlite_master`.
	 * @returns True when it is the line's business key, whose tuple this file changes.
	 */
	private isWidenedBusinessKey(definition: string): boolean {
		return definition.includes(CreateVendorProductTermTable1791000000345.LINE_BUSINESS_KEY);
	}

	/**
	 * @param definition A SQLite `CREATE TABLE` statement.
	 * @param column The column whose nullability is being relaxed.
	 * @returns The statement with `NOT NULL` removed from that column, unchanged when it is already
	 * nullable.
	 */
	private makeSqliteColumnNullable(definition: string, column: string): string {
		return definition.replace(new RegExp(`("${column}"\\s+[^,]*?)\\s+NOT NULL`), '$1');
	}

	/**
	 * @param definition A SQLite `CREATE TABLE` statement.
	 * @param column The column whose nullability is being restored.
	 * @returns The statement with `NOT NULL` on that column, unchanged when it already carries it.
	 */
	private makeSqliteColumnRequired(definition: string, column: string): string {
		if (new RegExp(`"${column}"\\s+[^,]*?\\s+NOT NULL`).test(definition)) {
			return definition;
		}

		return definition.replace(new RegExp(`"${column}"\\s+([^,]*?)(,|\\s+CONSTRAINT)`), `"${column}" $1 NOT NULL$2`);
	}

	/**
	 * @param definition The purchase line's SQLite `CREATE TABLE` statement.
	 * @returns The statement with the foreign key that makes the term a line records real, unchanged when
	 * it is already there.
	 */
	private addLineForeignKeyToSqliteDefinition(definition: string): string {
		if (definition.includes(CreateVendorProductTermTable1791000000345.LINE_TERM_FOREIGN_KEY)) {
			return definition;
		}

		return definition.replace(
			/\)\s*$/,
			`, CONSTRAINT "${CreateVendorProductTermTable1791000000345.LINE_TERM_FOREIGN_KEY}" FOREIGN KEY ("vendorTermId") REFERENCES "vendor_product_term" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
	}

	/**
	 * @param definition The purchase line's SQLite `CREATE TABLE` statement.
	 * @returns The statement without the foreign key the revision added, unchanged when it is not there.
	 */
	private removeLineForeignKeyFromSqliteDefinition(definition: string): string {
		return definition.replace(
			`, CONSTRAINT "${CreateVendorProductTermTable1791000000345.LINE_TERM_FOREIGN_KEY}" FOREIGN KEY ("vendorTermId") REFERENCES "vendor_product_term" ("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
			''
		);
	}
}
