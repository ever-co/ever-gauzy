import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the purchasing tables and extends the platform's supplier master.
 *
 * Four tables: a purchase order and its lines are what the organization intends to buy, a goods
 * receipt and its lines are what actually arrived. Keeping intention and fact apart is what makes a
 * short delivery visible — the order keeps the outstanding quantity, the receipt records only what
 * came — and it is what lets the receiving location's incoming figure be recomputed from the open
 * orders rather than adjusted by them.
 *
 * The supplier is **not** a table of this package. `organization_vendor` is the platform's supplier
 * master and already models the concept, so the six purchasing columns it was missing are added to it
 * here, guarded, and `purchase_order.vendorId` points at that row. A second party table would have
 * been a parallel copy of the same supplier with its own lifecycle to keep in step — which is the
 * mistake the extend-rather-than-duplicate rule exists to prevent.
 *
 * The signature of each table is what makes the domain's rules enforceable in the database rather than
 * only in a service: one line per ordered variant, one order number and one receipt number per
 * organization, a received counter that cascades with its order, and a `stockMovementId` on every
 * receipt line that links the receipt to the ledger row it produced in both directions.
 *
 * The foreign keys into tables this package does not own (`organization_vendor`, `warehouse`,
 * `product_variant`, `user`, `stock_movement`) are created here as well: the tables belong to other
 * capabilities, but the constraint belongs to the relationship, and a purchase order naming a
 * supplier that does not exist is a defect whichever package wrote it. `goods_receipt_line.warehouseBinId`
 * is the one exception — the bin table is created by a later migration set, so the column is created
 * here without its constraint, which the set that owns the target adds.
 *
 * All three dialects are written by hand, and the down migration reverses every statement in the
 * opposite order.
 */
export class CreatePurchasingTables1791000000340 implements MigrationInterface {
	name = 'CreatePurchasingTables1791000000340';

	/** The supplier master this package extends, and the index it adds to it. */
	private static readonly VENDOR_TABLE = 'organization_vendor';

	/** The unique index that makes a supplier code mean one supplier inside one organization. */
	private static readonly VENDOR_CODE_INDEX = 'UQ_organization_vendor_org_code';

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
		// The order comes first: both its own lines and its receipts reference it.
		await queryRunner.query(
			`CREATE TABLE "purchase_order" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "number" character varying(64) NOT NULL, "vendorId" uuid NOT NULL, "warehouseId" uuid NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'DRAFT', "currency" character varying(3) NOT NULL, "subtotal" numeric(20,6) NOT NULL DEFAULT 0, "discountTotal" numeric(20,6) NOT NULL DEFAULT 0, "taxTotal" numeric(20,6) NOT NULL DEFAULT 0, "shippingTotal" numeric(20,6) NOT NULL DEFAULT 0, "grandTotal" numeric(20,6) NOT NULL DEFAULT 0, "expectedAt" TIMESTAMP, "orderedAt" TIMESTAMP, "sentAt" TIMESTAMP, "acknowledgedAt" TIMESTAMP, "approvedAt" TIMESTAMP, "approvedByUserId" uuid, "approvalId" uuid, "receivedAt" TIMESTAMP, "canceledAt" TIMESTAMP, "closedAt" TIMESTAMP, "version" integer NOT NULL DEFAULT 1, "note" text, "metadata" jsonb, CONSTRAINT "PK_purchase_order_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_created_by_user" ON "purchase_order" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_updated_by_user" ON "purchase_order" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_deleted_by_user" ON "purchase_order" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_is_active" ON "purchase_order" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_is_archived" ON "purchase_order" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_tenant" ON "purchase_order" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_organization" ON "purchase_order" ("organizationId")`);
		// One order number per organization: a supplier quoting a number means one document.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_purchase_order_number" ON "purchase_order" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "number") WHERE "deletedAt" IS NULL`
		);
		// The three scans the domain actually runs: the open order queue, one supplier's orders, and
		// the orders destined for one location.
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_status" ON "purchase_order" ("organizationId", "status", "expectedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_vendor" ON "purchase_order" ("vendorId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_warehouse" ON "purchase_order" ("warehouseId", "status") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "purchase_order_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "purchaseOrderId" uuid NOT NULL, "variantId" uuid NOT NULL, "quantity" numeric(20,6) NOT NULL, "receivedQuantity" numeric(20,6) NOT NULL DEFAULT 0, "damagedQuantity" numeric(20,6) NOT NULL DEFAULT 0, "unitCost" numeric(20,6) NOT NULL, "taxRate" numeric(9,6), "discountTotal" numeric(20,6) NOT NULL DEFAULT 0, "total" numeric(20,6) NOT NULL DEFAULT 0, "expectedAt" TIMESTAMP, "note" text, "metadata" jsonb, CONSTRAINT "PK_purchase_order_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_created_by_user" ON "purchase_order_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_updated_by_user" ON "purchase_order_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_deleted_by_user" ON "purchase_order_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_line_is_active" ON "purchase_order_line" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_is_archived" ON "purchase_order_line" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_line_tenant" ON "purchase_order_line" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_organization" ON "purchase_order_line" ("organizationId")`
		);
		// One line per ordered variant, which is what makes the received counter unambiguous.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_purchase_order_line" ON "purchase_order_line" ("purchaseOrderId", "variantId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_variant" ON "purchase_order_line" ("variantId")`
		);

		await queryRunner.query(
			`CREATE TABLE "goods_receipt" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "purchaseOrderId" uuid NOT NULL, "warehouseId" uuid NOT NULL, "number" character varying(64) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'POSTED', "receivedAt" TIMESTAMP NOT NULL DEFAULT now(), "receivedByUserId" uuid, "canceledAt" TIMESTAMP, "version" integer NOT NULL DEFAULT 1, "note" text, "metadata" jsonb, CONSTRAINT "PK_goods_receipt_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_created_by_user" ON "goods_receipt" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_updated_by_user" ON "goods_receipt" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_deleted_by_user" ON "goods_receipt" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_is_active" ON "goods_receipt" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_is_archived" ON "goods_receipt" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_tenant" ON "goods_receipt" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_organization" ON "goods_receipt" ("organizationId")`);
		// One receipt number per organization, and the two listings the domain runs.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_goods_receipt_number" ON "goods_receipt" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_po" ON "goods_receipt" ("purchaseOrderId", "receivedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_warehouse" ON "goods_receipt" ("warehouseId", "receivedAt") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "goods_receipt_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "receiptId" uuid NOT NULL, "purchaseOrderLineId" uuid NOT NULL, "variantId" uuid NOT NULL, "quantity" numeric(20,6) NOT NULL, "damagedQuantity" numeric(20,6) NOT NULL DEFAULT 0, "unitCost" numeric(20,6) NOT NULL, "batchNumber" character varying(64), "expiresAt" TIMESTAMP, "warehouseBinId" uuid, "stockMovementId" uuid, "note" text, "metadata" jsonb, CONSTRAINT "PK_goods_receipt_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_created_by_user" ON "goods_receipt_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_updated_by_user" ON "goods_receipt_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_deleted_by_user" ON "goods_receipt_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_line_is_active" ON "goods_receipt_line" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_is_archived" ON "goods_receipt_line" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_line_tenant" ON "goods_receipt_line" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_organization" ON "goods_receipt_line" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_receipt" ON "goods_receipt_line" ("receiptId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_po_line" ON "goods_receipt_line" ("purchaseOrderLineId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_line_variant" ON "goods_receipt_line" ("variantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_batch" ON "goods_receipt_line" ("batchNumber") WHERE "batchNumber" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_movement" ON "goods_receipt_line" ("stockMovementId") WHERE "stockMovementId" IS NOT NULL`
		);

		/*
		 * Foreign keys. Every table exists by now, so the order in which they are added does not matter.
		 * `warehouseBinId` deliberately has none: the bin table is created by a later migration set, and
		 * a constraint is added by the set that owns its target.
		 */
		await queryRunner.query(
			`ALTER TABLE "purchase_order" ADD CONSTRAINT "FK_purchase_order_vendor" FOREIGN KEY ("vendorId") REFERENCES "organization_vendor"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "purchase_order" ADD CONSTRAINT "FK_purchase_order_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "purchase_order_line" ADD CONSTRAINT "FK_purchase_order_line_order" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "purchase_order_line" ADD CONSTRAINT "FK_purchase_order_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goods_receipt" ADD CONSTRAINT "FK_goods_receipt_order" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goods_receipt" ADD CONSTRAINT "FK_goods_receipt_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goods_receipt" ADD CONSTRAINT "FK_goods_receipt_received_by" FOREIGN KEY ("receivedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "FK_goods_receipt_line_receipt" FOREIGN KEY ("receiptId") REFERENCES "goods_receipt"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "FK_goods_receipt_line_po_line" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "purchase_order_line"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "FK_goods_receipt_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "FK_goods_receipt_line_movement" FOREIGN KEY ("stockMovementId") REFERENCES "stock_movement"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await this.addVendorColumns(queryRunner, 'postgres');
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.removeVendorColumns(queryRunner, 'postgres');

		await queryRunner.query(`ALTER TABLE "goods_receipt_line" DROP CONSTRAINT "FK_goods_receipt_line_movement"`);
		await queryRunner.query(`ALTER TABLE "goods_receipt_line" DROP CONSTRAINT "FK_goods_receipt_line_variant"`);
		await queryRunner.query(`ALTER TABLE "goods_receipt_line" DROP CONSTRAINT "FK_goods_receipt_line_po_line"`);
		await queryRunner.query(`ALTER TABLE "goods_receipt_line" DROP CONSTRAINT "FK_goods_receipt_line_receipt"`);
		await queryRunner.query(`ALTER TABLE "goods_receipt" DROP CONSTRAINT "FK_goods_receipt_received_by"`);
		await queryRunner.query(`ALTER TABLE "goods_receipt" DROP CONSTRAINT "FK_goods_receipt_warehouse"`);
		await queryRunner.query(`ALTER TABLE "goods_receipt" DROP CONSTRAINT "FK_goods_receipt_order"`);
		await queryRunner.query(`ALTER TABLE "purchase_order_line" DROP CONSTRAINT "FK_purchase_order_line_variant"`);
		await queryRunner.query(`ALTER TABLE "purchase_order_line" DROP CONSTRAINT "FK_purchase_order_line_order"`);
		await queryRunner.query(`ALTER TABLE "purchase_order" DROP CONSTRAINT "FK_purchase_order_warehouse"`);
		await queryRunner.query(`ALTER TABLE "purchase_order" DROP CONSTRAINT "FK_purchase_order_vendor"`);

		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_movement"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_batch"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_po_line"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_receipt"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "goods_receipt_line"`);

		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_po"`);
		await queryRunner.query(`DROP INDEX "UQ_goods_receipt_number"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_created_by_user"`);
		await queryRunner.query(`DROP TABLE "goods_receipt"`);

		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_variant"`);
		await queryRunner.query(`DROP INDEX "UQ_purchase_order_line"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "purchase_order_line"`);

		await queryRunner.query(`DROP INDEX "IDX_purchase_order_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_vendor"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_status"`);
		await queryRunner.query(`DROP INDEX "UQ_purchase_order_number"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_created_by_user"`);
		await queryRunner.query(`DROP TABLE "purchase_order"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a constraint to an existing table, so every foreign key is declared inline with
	 * the table that owns it — in dependency order, so every reference points at a table that already
	 * exists by the time it is declared.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "purchase_order" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar(64) NOT NULL, "vendorId" varchar NOT NULL, "warehouseId" varchar NOT NULL, "status" varchar(32) NOT NULL DEFAULT ('DRAFT'), "currency" varchar(3) NOT NULL, "subtotal" numeric(20,6) NOT NULL DEFAULT (0), "discountTotal" numeric(20,6) NOT NULL DEFAULT (0), "taxTotal" numeric(20,6) NOT NULL DEFAULT (0), "shippingTotal" numeric(20,6) NOT NULL DEFAULT (0), "grandTotal" numeric(20,6) NOT NULL DEFAULT (0), "expectedAt" datetime, "orderedAt" datetime, "sentAt" datetime, "acknowledgedAt" datetime, "approvedAt" datetime, "approvedByUserId" varchar, "approvalId" varchar, "receivedAt" datetime, "canceledAt" datetime, "closedAt" datetime, "version" int NOT NULL DEFAULT (1), "note" text, "metadata" text, CONSTRAINT "FK_purchase_order_vendor" FOREIGN KEY ("vendorId") REFERENCES "organization_vendor" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_purchase_order_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_created_by_user" ON "purchase_order" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_updated_by_user" ON "purchase_order" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_deleted_by_user" ON "purchase_order" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_is_active" ON "purchase_order" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_is_archived" ON "purchase_order" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_tenant" ON "purchase_order" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_organization" ON "purchase_order" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_purchase_order_number" ON "purchase_order" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_status" ON "purchase_order" ("organizationId", "status", "expectedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_vendor" ON "purchase_order" ("vendorId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_warehouse" ON "purchase_order" ("warehouseId", "status") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "purchase_order_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "purchaseOrderId" varchar NOT NULL, "variantId" varchar NOT NULL, "quantity" numeric(20,6) NOT NULL, "receivedQuantity" numeric(20,6) NOT NULL DEFAULT (0), "damagedQuantity" numeric(20,6) NOT NULL DEFAULT (0), "unitCost" numeric(20,6) NOT NULL, "taxRate" numeric(9,6), "discountTotal" numeric(20,6) NOT NULL DEFAULT (0), "total" numeric(20,6) NOT NULL DEFAULT (0), "expectedAt" datetime, "note" text, "metadata" text, CONSTRAINT "FK_purchase_order_line_order" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_order" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_purchase_order_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_created_by_user" ON "purchase_order_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_updated_by_user" ON "purchase_order_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_deleted_by_user" ON "purchase_order_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_line_is_active" ON "purchase_order_line" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_is_archived" ON "purchase_order_line" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_purchase_order_line_tenant" ON "purchase_order_line" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_organization" ON "purchase_order_line" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_purchase_order_line" ON "purchase_order_line" ("purchaseOrderId", "variantId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_purchase_order_line_variant" ON "purchase_order_line" ("variantId")`
		);

		await queryRunner.query(
			`CREATE TABLE "goods_receipt" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "purchaseOrderId" varchar NOT NULL, "warehouseId" varchar NOT NULL, "number" varchar(64) NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('POSTED'), "receivedAt" datetime NOT NULL DEFAULT (datetime('now')), "receivedByUserId" varchar, "canceledAt" datetime, "version" int NOT NULL DEFAULT (1), "note" text, "metadata" text, CONSTRAINT "FK_goods_receipt_order" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_order" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_goods_receipt_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_goods_receipt_received_by" FOREIGN KEY ("receivedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_created_by_user" ON "goods_receipt" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_updated_by_user" ON "goods_receipt" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_deleted_by_user" ON "goods_receipt" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_is_active" ON "goods_receipt" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_is_archived" ON "goods_receipt" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_tenant" ON "goods_receipt" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_organization" ON "goods_receipt" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_goods_receipt_number" ON "goods_receipt" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_po" ON "goods_receipt" ("purchaseOrderId", "receivedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_warehouse" ON "goods_receipt" ("warehouseId", "receivedAt") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "goods_receipt_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "receiptId" varchar NOT NULL, "purchaseOrderLineId" varchar NOT NULL, "variantId" varchar NOT NULL, "quantity" numeric(20,6) NOT NULL, "damagedQuantity" numeric(20,6) NOT NULL DEFAULT (0), "unitCost" numeric(20,6) NOT NULL, "batchNumber" varchar(64), "expiresAt" datetime, "warehouseBinId" varchar, "stockMovementId" varchar, "note" text, "metadata" text, CONSTRAINT "FK_goods_receipt_line_receipt" FOREIGN KEY ("receiptId") REFERENCES "goods_receipt" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_goods_receipt_line_po_line" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "purchase_order_line" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_goods_receipt_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_goods_receipt_line_movement" FOREIGN KEY ("stockMovementId") REFERENCES "stock_movement" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_created_by_user" ON "goods_receipt_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_updated_by_user" ON "goods_receipt_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_deleted_by_user" ON "goods_receipt_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_line_is_active" ON "goods_receipt_line" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_is_archived" ON "goods_receipt_line" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_line_tenant" ON "goods_receipt_line" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_organization" ON "goods_receipt_line" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_receipt" ON "goods_receipt_line" ("receiptId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_po_line" ON "goods_receipt_line" ("purchaseOrderLineId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_goods_receipt_line_variant" ON "goods_receipt_line" ("variantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_batch" ON "goods_receipt_line" ("batchNumber") WHERE "batchNumber" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_goods_receipt_line_movement" ON "goods_receipt_line" ("stockMovementId") WHERE "stockMovementId" IS NOT NULL`
		);

		await this.addVendorColumns(queryRunner, 'sqlite');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.removeVendorColumns(queryRunner, 'sqlite');

		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_movement"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_batch"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_po_line"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_receipt"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "goods_receipt_line"`);

		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_po"`);
		await queryRunner.query(`DROP INDEX "UQ_goods_receipt_number"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_goods_receipt_created_by_user"`);
		await queryRunner.query(`DROP TABLE "goods_receipt"`);

		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_variant"`);
		await queryRunner.query(`DROP INDEX "UQ_purchase_order_line"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "purchase_order_line"`);

		await queryRunner.query(`DROP INDEX "IDX_purchase_order_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_vendor"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_status"`);
		await queryRunner.query(`DROP INDEX "UQ_purchase_order_number"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_purchase_order_created_by_user"`);
		await queryRunner.query(`DROP TABLE "purchase_order"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no partial index, so the predicates that make a unique index business-scoped are
	 * carried by the stored generated key columns `CreateSequenceTable1791000000000` documents for the
	 * whole set: `deletedKey` for `"deletedAt" IS NULL`, and
	 * `organizationKey` for the nullable scope column the document numbers are unique per. Including
	 * `deletedAt` itself in the key, which this file used to do, carries no rule at all — a unique
	 * index in MySQL exempts every tuple that contains a null, and `deletedAt` is null on exactly the
	 * live rows.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`purchase_order\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`number\` varchar(64) NOT NULL, \`vendorId\` varchar(36) NOT NULL, \`warehouseId\` varchar(36) NOT NULL, \`status\` varchar(32) NOT NULL DEFAULT 'DRAFT', \`currency\` varchar(3) NOT NULL, \`subtotal\` decimal(20,6) NOT NULL DEFAULT 0, \`discountTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`taxTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`shippingTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`grandTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`expectedAt\` datetime NULL, \`orderedAt\` datetime NULL, \`sentAt\` datetime NULL, \`acknowledgedAt\` datetime NULL, \`approvedAt\` datetime NULL, \`approvedByUserId\` varchar(36) NULL, \`approvalId\` varchar(36) NULL, \`receivedAt\` datetime NULL, \`canceledAt\` datetime NULL, \`closedAt\` datetime NULL, \`version\` int NOT NULL DEFAULT 1, \`note\` text NULL, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_purchase_order_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_purchase_order_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_purchase_order_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_purchase_order_is_active\` (\`isActive\`), INDEX \`IDX_purchase_order_is_archived\` (\`isArchived\`), INDEX \`IDX_purchase_order_tenant\` (\`tenantId\`), INDEX \`IDX_purchase_order_organization\` (\`organizationId\`), INDEX \`IDX_purchase_order_status\` (\`organizationId\`, \`status\`, \`expectedAt\`), INDEX \`IDX_purchase_order_vendor\` (\`vendorId\`, \`status\`), INDEX \`IDX_purchase_order_warehouse\` (\`warehouseId\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_purchase_order_number\` ON \`purchase_order\` (\`organizationKey\`, \`number\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`purchase_order_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`purchaseOrderId\` varchar(36) NOT NULL, \`variantId\` varchar(36) NOT NULL, \`quantity\` decimal(20,6) NOT NULL, \`receivedQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`damagedQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`unitCost\` decimal(20,6) NOT NULL, \`taxRate\` decimal(9,6) NULL, \`discountTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`total\` decimal(20,6) NOT NULL DEFAULT 0, \`expectedAt\` datetime NULL, \`note\` text NULL, \`metadata\` json NULL, \`expectedAtKey\` datetime GENERATED ALWAYS AS (IFNULL(\`expectedAt\`, '1970-01-01 00:00:00')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_purchase_order_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_purchase_order_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_purchase_order_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_purchase_order_line_is_active\` (\`isActive\`), INDEX \`IDX_purchase_order_line_is_archived\` (\`isArchived\`), INDEX \`IDX_purchase_order_line_tenant\` (\`tenantId\`), INDEX \`IDX_purchase_order_line_organization\` (\`organizationId\`), INDEX \`IDX_purchase_order_line_variant\` (\`variantId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_purchase_order_line\` ON \`purchase_order_line\` (\`purchaseOrderId\`, \`variantId\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`goods_receipt\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`purchaseOrderId\` varchar(36) NOT NULL, \`warehouseId\` varchar(36) NOT NULL, \`number\` varchar(64) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'POSTED', \`receivedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, \`receivedByUserId\` varchar(36) NULL, \`canceledAt\` datetime NULL, \`version\` int NOT NULL DEFAULT 1, \`note\` text NULL, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_goods_receipt_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_goods_receipt_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_goods_receipt_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_goods_receipt_is_active\` (\`isActive\`), INDEX \`IDX_goods_receipt_is_archived\` (\`isArchived\`), INDEX \`IDX_goods_receipt_tenant\` (\`tenantId\`), INDEX \`IDX_goods_receipt_organization\` (\`organizationId\`), INDEX \`IDX_goods_receipt_po\` (\`purchaseOrderId\`, \`receivedAt\`), INDEX \`IDX_goods_receipt_warehouse\` (\`warehouseId\`, \`receivedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_goods_receipt_number\` ON \`goods_receipt\` (\`organizationKey\`, \`number\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`goods_receipt_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`receiptId\` varchar(36) NOT NULL, \`purchaseOrderLineId\` varchar(36) NOT NULL, \`variantId\` varchar(36) NOT NULL, \`quantity\` decimal(20,6) NOT NULL, \`damagedQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`unitCost\` decimal(20,6) NOT NULL, \`batchNumber\` varchar(64) NULL, \`expiresAt\` datetime NULL, \`warehouseBinId\` varchar(36) NULL, \`stockMovementId\` varchar(36) NULL, \`note\` text NULL, \`metadata\` json NULL, INDEX \`IDX_goods_receipt_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_goods_receipt_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_goods_receipt_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_goods_receipt_line_is_active\` (\`isActive\`), INDEX \`IDX_goods_receipt_line_is_archived\` (\`isArchived\`), INDEX \`IDX_goods_receipt_line_tenant\` (\`tenantId\`), INDEX \`IDX_goods_receipt_line_organization\` (\`organizationId\`), INDEX \`IDX_goods_receipt_line_receipt\` (\`receiptId\`), INDEX \`IDX_goods_receipt_line_po_line\` (\`purchaseOrderLineId\`), INDEX \`IDX_goods_receipt_line_variant\` (\`variantId\`), INDEX \`IDX_goods_receipt_line_batch\` (\`batchNumber\`), INDEX \`IDX_goods_receipt_line_movement\` (\`stockMovementId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);

		/*
		 * Foreign keys. `warehouseBinId` deliberately has none: the bin table is created by a later
		 * migration set, which is the set that adds the constraint.
		 */
		await queryRunner.query(
			`ALTER TABLE \`purchase_order\` ADD CONSTRAINT \`FK_purchase_order_vendor\` FOREIGN KEY (\`vendorId\`) REFERENCES \`organization_vendor\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`purchase_order\` ADD CONSTRAINT \`FK_purchase_order_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`purchase_order_line\` ADD CONSTRAINT \`FK_purchase_order_line_order\` FOREIGN KEY (\`purchaseOrderId\`) REFERENCES \`purchase_order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`purchase_order_line\` ADD CONSTRAINT \`FK_purchase_order_line_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goods_receipt\` ADD CONSTRAINT \`FK_goods_receipt_order\` FOREIGN KEY (\`purchaseOrderId\`) REFERENCES \`purchase_order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goods_receipt\` ADD CONSTRAINT \`FK_goods_receipt_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goods_receipt\` ADD CONSTRAINT \`FK_goods_receipt_received_by\` FOREIGN KEY (\`receivedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goods_receipt_line\` ADD CONSTRAINT \`FK_goods_receipt_line_receipt\` FOREIGN KEY (\`receiptId\`) REFERENCES \`goods_receipt\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goods_receipt_line\` ADD CONSTRAINT \`FK_goods_receipt_line_po_line\` FOREIGN KEY (\`purchaseOrderLineId\`) REFERENCES \`purchase_order_line\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goods_receipt_line\` ADD CONSTRAINT \`FK_goods_receipt_line_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goods_receipt_line\` ADD CONSTRAINT \`FK_goods_receipt_line_movement\` FOREIGN KEY (\`stockMovementId\`) REFERENCES \`stock_movement\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await this.addVendorColumns(queryRunner, 'mysql');
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.removeVendorColumns(queryRunner, 'mysql');

		await queryRunner.query(
			`ALTER TABLE \`goods_receipt_line\` DROP FOREIGN KEY \`FK_goods_receipt_line_movement\``
		);
		await queryRunner.query(`ALTER TABLE \`goods_receipt_line\` DROP FOREIGN KEY \`FK_goods_receipt_line_variant\``);
		await queryRunner.query(`ALTER TABLE \`goods_receipt_line\` DROP FOREIGN KEY \`FK_goods_receipt_line_po_line\``);
		await queryRunner.query(`ALTER TABLE \`goods_receipt_line\` DROP FOREIGN KEY \`FK_goods_receipt_line_receipt\``);
		await queryRunner.query(`ALTER TABLE \`goods_receipt\` DROP FOREIGN KEY \`FK_goods_receipt_received_by\``);
		await queryRunner.query(`ALTER TABLE \`goods_receipt\` DROP FOREIGN KEY \`FK_goods_receipt_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`goods_receipt\` DROP FOREIGN KEY \`FK_goods_receipt_order\``);
		await queryRunner.query(`ALTER TABLE \`purchase_order_line\` DROP FOREIGN KEY \`FK_purchase_order_line_variant\``);
		await queryRunner.query(`ALTER TABLE \`purchase_order_line\` DROP FOREIGN KEY \`FK_purchase_order_line_order\``);
		await queryRunner.query(`ALTER TABLE \`purchase_order\` DROP FOREIGN KEY \`FK_purchase_order_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`purchase_order\` DROP FOREIGN KEY \`FK_purchase_order_vendor\``);

		await queryRunner.query(`DROP TABLE \`goods_receipt_line\``);
		await queryRunner.query(`DROP TABLE \`goods_receipt\``);
		await queryRunner.query(`DROP TABLE \`purchase_order_line\``);
		await queryRunner.query(`DROP TABLE \`purchase_order\``);
	}

	/*
	|--------------------------------------------------------------------------
	| The supplier master
	|--------------------------------------------------------------------------
	*/

	/**
	 * Adds the six purchasing columns to the platform's supplier master.
	 *
	 * Every one of them is nullable, so an installation that already keeps suppliers keeps working
	 * untouched and nothing is backfilled: a supplier with no code, no lead time and no agreed currency
	 * is exactly the supplier the platform had before this package existed.
	 *
	 * Each addition is guarded. The table is the platform's and another package's kernel migration may
	 * have extended it already, so the operation is a no-op when the table is absent or a column is
	 * present rather than a migration that fails on one installation and succeeds on another.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async addVendorColumns(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<void> {
		if (!(await queryRunner.hasTable(CreatePurchasingTables1791000000340.VENDOR_TABLE))) {
			return;
		}

		const quote = dialect === 'mysql' ? '`' : '"';
		const table = `${quote}${CreatePurchasingTables1791000000340.VENDOR_TABLE}${quote}`;
		const jsonType = dialect === 'postgres' ? 'jsonb' : dialect === 'mysql' ? 'json' : 'text';
		const statements: Array<[string, string]> = [
			['code', `${quote}code${quote} varchar(64)`],
			['currency', `${quote}currency${quote} varchar(3)`],
			['paymentTermsDays', `${quote}paymentTermsDays${quote} int`],
			['leadTimeDays', `${quote}leadTimeDays${quote} int`],
			['minimumOrderAmount', `${quote}minimumOrderAmount${quote} numeric(20,6)`],
			['metadata', `${quote}metadata${quote} ${jsonType}`]
		];

		for (const [column, definition] of statements) {
			if (await queryRunner.hasColumn(CreatePurchasingTables1791000000340.VENDOR_TABLE, column)) {
				continue;
			}

			await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
		}

		if (!(await queryRunner.hasColumn(CreatePurchasingTables1791000000340.VENDOR_TABLE, 'code'))) {
			return;
		}

		// The code is the key a purchase order or an import quotes, so it means one supplier inside one
		// organization. MySQL has no partial index, so the generated key columns carry the predicate and
		// the nullable scope instead — the form `CreateSequenceTable1791000000000` documents for the whole
		// set. `organization_vendor` is a table the platform already owned, so the two columns are added
		// here by `ALTER` and guarded exactly as the six business columns above are.
		if (dialect === 'mysql') {
			const keys: Array<[string, string]> = [
				['deletedKey', "varchar(36) GENERATED ALWAYS AS (IF(`deletedAt` IS NULL, '0', `id`)) STORED"],
				[
					'organizationKey',
					"varchar(36) GENERATED ALWAYS AS (IFNULL(`organizationId`, '00000000-0000-0000-0000-000000000000')) STORED"
				]
			];

			for (const [column, definition] of keys) {
				if (await queryRunner.hasColumn(CreatePurchasingTables1791000000340.VENDOR_TABLE, column)) {
					continue;
				}

				await queryRunner.query(
					`ALTER TABLE \`${CreatePurchasingTables1791000000340.VENDOR_TABLE}\` ADD COLUMN \`${column}\` ${definition}`
				);
			}

			if (await this.hasMysqlIndex(queryRunner, CreatePurchasingTables1791000000340.VENDOR_CODE_INDEX)) {
				return;
			}

			// `code` stays bare on purpose: the other two dialects exclude a null code with
			// `WHERE "code" IS NOT NULL`, and MySQL's exemption of any tuple that contains a null is
			// exactly that predicate.
			await queryRunner.query(
				`CREATE UNIQUE INDEX \`${CreatePurchasingTables1791000000340.VENDOR_CODE_INDEX}\` ON \`${CreatePurchasingTables1791000000340.VENDOR_TABLE}\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
			);

			return;
		}

		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${CreatePurchasingTables1791000000340.VENDOR_CODE_INDEX}" ON "${CreatePurchasingTables1791000000340.VENDOR_TABLE}" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "code") WHERE "code" IS NOT NULL AND "deletedAt" IS NULL`
		);
	}

	/**
	 * Removes the six purchasing columns from the platform's supplier master.
	 *
	 * The inverse of the additions, and guarded the same way so that a rollback on an installation that
	 * never received them is a no-op.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async removeVendorColumns(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		if (!(await queryRunner.hasTable(CreatePurchasingTables1791000000340.VENDOR_TABLE))) {
			return;
		}

		if (dialect === 'mysql') {
			if (await this.hasMysqlIndex(queryRunner, CreatePurchasingTables1791000000340.VENDOR_CODE_INDEX)) {
				await queryRunner.query(
					`DROP INDEX \`${CreatePurchasingTables1791000000340.VENDOR_CODE_INDEX}\` ON \`${CreatePurchasingTables1791000000340.VENDOR_TABLE}\``
				);
			}
		} else {
			await queryRunner.query(`DROP INDEX IF EXISTS "${CreatePurchasingTables1791000000340.VENDOR_CODE_INDEX}"`);
		}

		const quote = dialect === 'mysql' ? '`' : '"';
		const table = `${quote}${CreatePurchasingTables1791000000340.VENDOR_TABLE}${quote}`;
		// The two generated key columns are MySQL's stand-in for the other dialects' partial index, so
		// they exist only there and they go first: they are dropped after the index that names them and
		// before the `code` they sit beside in it. The `hasColumn` guard below makes the list safe on a
		// dialect that never received them.
		const columns = [
			...(dialect === 'mysql' ? ['organizationKey', 'deletedKey'] : []),
			'metadata',
			'minimumOrderAmount',
			'leadTimeDays',
			'paymentTermsDays',
			'currency',
			'code'
		];

		for (const column of columns) {
			if (!(await queryRunner.hasColumn(CreatePurchasingTables1791000000340.VENDOR_TABLE, column))) {
				continue;
			}

			// SQLite supports `DROP COLUMN` from 3.35, which is the floor this platform builds against;
			// every column added here is nullable, so nothing is rebuilt around them.
			await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN ${quote}${column}${quote}`);
		}
	}

	/**
	 * @param queryRunner The query runner.
	 * @param index The index name.
	 * @returns True when the supplier table already carries the index.
	 */
	private async hasMysqlIndex(queryRunner: QueryRunner, index: string): Promise<boolean> {
		const rows = await queryRunner.query(
			`SELECT COUNT(*) AS counted FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = '${CreatePurchasingTables1791000000340.VENDOR_TABLE}' AND index_name = '${index}'`
		);

		return Number(rows?.[0]?.counted ?? 0) > 0;
	}
}
