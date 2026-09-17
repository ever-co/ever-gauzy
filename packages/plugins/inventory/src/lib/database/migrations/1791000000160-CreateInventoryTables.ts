/**
 * Creates the inventory ledger, reservations, transfers, alerts, adjustments and count sessions.
 *
 * The level tables stay where they are: `warehouse`, `warehouse_product` and
 * `warehouse_product_variant` already model stock on hand, so this set adds the ledger beside them
 * rather than a second stock table. The level tables are a cache of that ledger, which is why the
 * movement table carries the resulting quantity on every row and why it refuses an update or a
 * delete at the database level as well as in the repository.
 *
 * The bin column is created without its foreign key: `warehouse_bin` belongs to the warehouse
 * package, which adds the constraint in its own layout migration.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the inventory tables.
 */
export class CreateInventoryTables1791000000160 implements MigrationInterface {
	name = 'CreateInventoryTables1791000000160';

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
		await queryRunner.query(`CREATE TABLE "stock_movement" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "warehouseId" uuid NOT NULL, "warehouseProductId" uuid, "warehouseProductVariantId" uuid, "variantId" uuid NOT NULL, "binId" uuid, "type" character varying(16) NOT NULL, "quantity" numeric(20, 6) NOT NULL, "quantityBefore" numeric(20, 6) NOT NULL, "quantityAfter" numeric(20, 6) NOT NULL, "reservedBefore" numeric(20, 6) NOT NULL, "reservedAfter" numeric(20, 6) NOT NULL, "referenceType" character varying(64) NOT NULL, "referenceId" uuid NOT NULL, "reason" character varying(64), "note" text, "occurredAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_stock_movement_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_level" ON "stock_movement" ("variantId", "warehouseId", "occurredAt") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_reference" ON "stock_movement" ("referenceType", "referenceId") WHERE "referenceId" IS NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_org_occurred" ON "stock_movement" ("organizationId", "occurredAt") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_type_occurred" ON "stock_movement" ("type", "occurredAt") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_wpv" ON "stock_movement" ("warehouseProductVariantId", "occurredAt") WHERE "warehouseProductVariantId" IS NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_bin" ON "stock_movement" ("binId", "variantId", "occurredAt") WHERE "binId" IS NOT NULL`);
		await queryRunner.query(`CREATE TABLE "stock_reservation" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "variantId" uuid NOT NULL, "warehouseId" uuid NOT NULL, "warehouseProductVariantId" uuid, "quantity" numeric(20, 6) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "referenceType" character varying(16) NOT NULL, "referenceId" uuid NOT NULL, "lineId" uuid, "expiresAt" TIMESTAMP, "releasedAt" TIMESTAMP, "consumedAt" TIMESTAMP, "isBackorder" boolean NOT NULL DEFAULT false, "expectedAt" TIMESTAMP, CONSTRAINT "PK_stock_reservation_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_reservation_reference" ON "stock_reservation" ("referenceType", "referenceId") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_reservation_expiry" ON "stock_reservation" ("status", "expiresAt") WHERE "status" = 'ACTIVE'`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_reservation_level" ON "stock_reservation" ("variantId", "warehouseId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_reservation_line" ON "stock_reservation" ("lineId") WHERE "lineId" IS NOT NULL`);
		await queryRunner.query(`CREATE TABLE "stock_transfer" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "number" character varying(64) NOT NULL, "fromWarehouseId" uuid NOT NULL, "toWarehouseId" uuid NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'DRAFT', "shippedAt" TIMESTAMP, "receivedAt" TIMESTAMP, "note" text, "version" integer NOT NULL DEFAULT 1, "metadata" jsonb, CONSTRAINT "CHK_stock_transfer_distinct" CHECK ("fromWarehouseId" <> "toWarehouseId"), CONSTRAINT "PK_stock_transfer_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_transfer_number" ON "stock_transfer" ("organizationId", "number")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_status" ON "stock_transfer" ("organizationId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_from" ON "stock_transfer" ("fromWarehouseId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_to" ON "stock_transfer" ("toWarehouseId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE TABLE "stock_transfer_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "transferId" uuid NOT NULL, "variantId" uuid NOT NULL, "requestedQuantity" numeric(20, 6) NOT NULL, "shippedQuantity" numeric(20, 6) NOT NULL DEFAULT 0, "receivedQuantity" numeric(20, 6) NOT NULL DEFAULT 0, "damagedQuantity" numeric(20, 6) NOT NULL DEFAULT 0, "unitCost" numeric(20, 6), "note" text, CONSTRAINT "PK_stock_transfer_line_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_transfer_line" ON "stock_transfer_line" ("transferId", "variantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_line_variant" ON "stock_transfer_line" ("variantId")`);
		await queryRunner.query(`CREATE TABLE "stock_alert" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "variantId" uuid NOT NULL, "warehouseId" uuid, "threshold" numeric(20, 6) NOT NULL, "notifyEmails" text, "notifyRoles" text, "lastTriggeredAt" TIMESTAMP, "cooldownMinutes" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_stock_alert_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_alert" ON "stock_alert" ("variantId", "warehouseId")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_alert_scan" ON "stock_alert" ("organizationId", "isActive") WHERE "isActive" = true AND "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_alert_warehouse" ON "stock_alert" ("warehouseId") WHERE "warehouseId" IS NOT NULL`);
		await queryRunner.query(`CREATE TABLE "channel_warehouse" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "channelId" uuid NOT NULL, "warehouseId" uuid NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "priority" integer NOT NULL DEFAULT 0, "metadata" jsonb, CONSTRAINT "PK_channel_warehouse_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_channel_warehouse" ON "channel_warehouse" ("channelId", "warehouseId")`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_warehouse_warehouse" ON "channel_warehouse" ("warehouseId") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_channel_warehouse_default" ON "channel_warehouse" ("channelId") WHERE "isDefault" = true AND "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE TABLE "stock_adjustment" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "number" character varying(32) NOT NULL, "warehouseId" uuid NOT NULL, "variantId" uuid NOT NULL, "warehouseProductVariantId" uuid, "type" character varying(16) NOT NULL, "quantity" numeric(20, 6) NOT NULL, "reasonCode" character varying(64), "reason" character varying(255), "note" text, "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "appliedAt" TIMESTAMP, "appliedByUserId" uuid, "movementId" uuid, "metadata" jsonb, CONSTRAINT "PK_stock_adjustment_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_adjustment_number" ON "stock_adjustment" ("organizationId", "number")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_adjustment_level" ON "stock_adjustment" ("warehouseId", "variantId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE TABLE "stock_count" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "number" character varying(32) NOT NULL, "warehouseId" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "scope" jsonb, "blindCount" boolean NOT NULL DEFAULT false, "startedAt" TIMESTAMP, "closedAt" TIMESTAMP, "startedByUserId" uuid, "closedByUserId" uuid, "note" text, "metadata" jsonb, "zoneId" uuid, "binId" uuid, "mode" character varying(16) NOT NULL DEFAULT 'FULL', "scopeCriteria" jsonb, "countedLineCount" integer NOT NULL DEFAULT 0, "varianceUnits" numeric(20, 6) NOT NULL DEFAULT 0, "varianceValue" numeric(20, 6) NOT NULL DEFAULT 0, "freezeMovements" boolean NOT NULL DEFAULT true, "recountOfId" uuid, CONSTRAINT "PK_stock_count_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_count_number" ON "stock_count" ("organizationId", "number")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_count_org_status" ON "stock_count" ("organizationId", "warehouseId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_count_open" ON "stock_count" ("warehouseId", "status") WHERE "status" IN ('OPEN','COUNTING','REVIEW')`);
		await queryRunner.query(`CREATE TABLE "stock_count_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "stockCountId" uuid NOT NULL, "variantId" uuid NOT NULL, "warehouseProductVariantId" uuid, "expectedQuantity" numeric(20, 6) NOT NULL DEFAULT 0, "countedQuantity" numeric(20, 6), "variance" numeric(20, 6), "countedAt" TIMESTAMP, "countedByUserId" uuid, "movementId" uuid, "note" text, "binId" uuid, "binPathSnapshot" character varying(255), "recountedQuantity" numeric(20, 6), "status" character varying(16) NOT NULL DEFAULT 'PENDING', CONSTRAINT "PK_stock_count_line_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_count_line" ON "stock_count_line" ("stockCountId", "variantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_count_line_pending" ON "stock_count_line" ("stockCountId") WHERE "countedQuantity" IS NULL AND "deletedAt" IS NULL`);
		await queryRunner.query(`ALTER TABLE "stock_movement" ADD CONSTRAINT "FK_stock_movement_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_movement" ADD CONSTRAINT "FK_stock_movement_warehouse_product" FOREIGN KEY ("warehouseProductId") REFERENCES "warehouse_product"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_movement" ADD CONSTRAINT "FK_stock_movement_warehouse_product_variant" FOREIGN KEY ("warehouseProductVariantId") REFERENCES "warehouse_product_variant"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_movement" ADD CONSTRAINT "FK_stock_movement_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_reservation" ADD CONSTRAINT "FK_stock_reservation_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_reservation" ADD CONSTRAINT "FK_stock_reservation_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_reservation" ADD CONSTRAINT "FK_stock_reservation_level" FOREIGN KEY ("warehouseProductVariantId") REFERENCES "warehouse_product_variant"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_transfer" ADD CONSTRAINT "FK_stock_transfer_from_warehouse" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_transfer" ADD CONSTRAINT "FK_stock_transfer_to_warehouse" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_transfer_line" ADD CONSTRAINT "FK_stock_transfer_line_transfer" FOREIGN KEY ("transferId") REFERENCES "stock_transfer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_transfer_line" ADD CONSTRAINT "FK_stock_transfer_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_alert" ADD CONSTRAINT "FK_stock_alert_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_alert" ADD CONSTRAINT "FK_stock_alert_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "channel_warehouse" ADD CONSTRAINT "FK_channel_warehouse_channel" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "channel_warehouse" ADD CONSTRAINT "FK_channel_warehouse_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_adjustment" ADD CONSTRAINT "FK_stock_adjustment_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_adjustment" ADD CONSTRAINT "FK_stock_adjustment_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_adjustment" ADD CONSTRAINT "FK_stock_adjustment_level" FOREIGN KEY ("warehouseProductVariantId") REFERENCES "warehouse_product_variant"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_adjustment" ADD CONSTRAINT "FK_stock_adjustment_applied_by" FOREIGN KEY ("appliedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_adjustment" ADD CONSTRAINT "FK_stock_adjustment_movement" FOREIGN KEY ("movementId") REFERENCES "stock_movement"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_count" ADD CONSTRAINT "FK_stock_count_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_count" ADD CONSTRAINT "FK_stock_count_started_by" FOREIGN KEY ("startedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_count" ADD CONSTRAINT "FK_stock_count_closed_by" FOREIGN KEY ("closedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_count" ADD CONSTRAINT "FK_stock_count_recount_of" FOREIGN KEY ("recountOfId") REFERENCES "stock_count"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_count_line" ADD CONSTRAINT "FK_stock_count_line_count" FOREIGN KEY ("stockCountId") REFERENCES "stock_count"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_count_line" ADD CONSTRAINT "FK_stock_count_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_count_line" ADD CONSTRAINT "FK_stock_count_line_level" FOREIGN KEY ("warehouseProductVariantId") REFERENCES "warehouse_product_variant"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_count_line" ADD CONSTRAINT "FK_stock_count_line_counted_by" FOREIGN KEY ("countedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "stock_count_line" ADD CONSTRAINT "FK_stock_count_line_movement" FOREIGN KEY ("movementId") REFERENCES "stock_movement"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`CREATE OR REPLACE FUNCTION stock_movement_append_only() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'stock_movement is append-only: a correction is a new reversing movement.';
END;
$$ LANGUAGE plpgsql`);
		await queryRunner.query(`CREATE TRIGGER "TRG_stock_movement_append_only" BEFORE UPDATE OR DELETE ON "stock_movement" FOR EACH ROW EXECUTE PROCEDURE stock_movement_append_only()`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TRIGGER "TRG_stock_movement_append_only" ON "stock_movement"`);
		await queryRunner.query(`DROP FUNCTION stock_movement_append_only()`);
		await queryRunner.query(`ALTER TABLE "stock_count_line" DROP CONSTRAINT "FK_stock_count_line_count"`);
		await queryRunner.query(`ALTER TABLE "stock_count_line" DROP CONSTRAINT "FK_stock_count_line_variant"`);
		await queryRunner.query(`ALTER TABLE "stock_count_line" DROP CONSTRAINT "FK_stock_count_line_level"`);
		await queryRunner.query(`ALTER TABLE "stock_count_line" DROP CONSTRAINT "FK_stock_count_line_counted_by"`);
		await queryRunner.query(`ALTER TABLE "stock_count_line" DROP CONSTRAINT "FK_stock_count_line_movement"`);
		await queryRunner.query(`ALTER TABLE "stock_count" DROP CONSTRAINT "FK_stock_count_warehouse"`);
		await queryRunner.query(`ALTER TABLE "stock_count" DROP CONSTRAINT "FK_stock_count_started_by"`);
		await queryRunner.query(`ALTER TABLE "stock_count" DROP CONSTRAINT "FK_stock_count_closed_by"`);
		await queryRunner.query(`ALTER TABLE "stock_count" DROP CONSTRAINT "FK_stock_count_recount_of"`);
		await queryRunner.query(`ALTER TABLE "stock_adjustment" DROP CONSTRAINT "FK_stock_adjustment_warehouse"`);
		await queryRunner.query(`ALTER TABLE "stock_adjustment" DROP CONSTRAINT "FK_stock_adjustment_variant"`);
		await queryRunner.query(`ALTER TABLE "stock_adjustment" DROP CONSTRAINT "FK_stock_adjustment_level"`);
		await queryRunner.query(`ALTER TABLE "stock_adjustment" DROP CONSTRAINT "FK_stock_adjustment_applied_by"`);
		await queryRunner.query(`ALTER TABLE "stock_adjustment" DROP CONSTRAINT "FK_stock_adjustment_movement"`);
		await queryRunner.query(`ALTER TABLE "channel_warehouse" DROP CONSTRAINT "FK_channel_warehouse_channel"`);
		await queryRunner.query(`ALTER TABLE "channel_warehouse" DROP CONSTRAINT "FK_channel_warehouse_warehouse"`);
		await queryRunner.query(`ALTER TABLE "stock_alert" DROP CONSTRAINT "FK_stock_alert_variant"`);
		await queryRunner.query(`ALTER TABLE "stock_alert" DROP CONSTRAINT "FK_stock_alert_warehouse"`);
		await queryRunner.query(`ALTER TABLE "stock_transfer_line" DROP CONSTRAINT "FK_stock_transfer_line_transfer"`);
		await queryRunner.query(`ALTER TABLE "stock_transfer_line" DROP CONSTRAINT "FK_stock_transfer_line_variant"`);
		await queryRunner.query(`ALTER TABLE "stock_transfer" DROP CONSTRAINT "FK_stock_transfer_from_warehouse"`);
		await queryRunner.query(`ALTER TABLE "stock_transfer" DROP CONSTRAINT "FK_stock_transfer_to_warehouse"`);
		await queryRunner.query(`ALTER TABLE "stock_reservation" DROP CONSTRAINT "FK_stock_reservation_variant"`);
		await queryRunner.query(`ALTER TABLE "stock_reservation" DROP CONSTRAINT "FK_stock_reservation_warehouse"`);
		await queryRunner.query(`ALTER TABLE "stock_reservation" DROP CONSTRAINT "FK_stock_reservation_level"`);
		await queryRunner.query(`ALTER TABLE "stock_movement" DROP CONSTRAINT "FK_stock_movement_warehouse"`);
		await queryRunner.query(`ALTER TABLE "stock_movement" DROP CONSTRAINT "FK_stock_movement_warehouse_product"`);
		await queryRunner.query(`ALTER TABLE "stock_movement" DROP CONSTRAINT "FK_stock_movement_warehouse_product_variant"`);
		await queryRunner.query(`ALTER TABLE "stock_movement" DROP CONSTRAINT "FK_stock_movement_variant"`);
		await queryRunner.query(`DROP TABLE "stock_count_line"`);
		await queryRunner.query(`DROP TABLE "stock_count"`);
		await queryRunner.query(`DROP TABLE "stock_adjustment"`);
		await queryRunner.query(`DROP TABLE "channel_warehouse"`);
		await queryRunner.query(`DROP TABLE "stock_alert"`);
		await queryRunner.query(`DROP TABLE "stock_transfer_line"`);
		await queryRunner.query(`DROP TABLE "stock_transfer"`);
		await queryRunner.query(`DROP TABLE "stock_reservation"`);
		await queryRunner.query(`DROP TABLE "stock_movement"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`CREATE TABLE "stock_movement" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "warehouseId" varchar NOT NULL, "warehouseProductId" varchar, "warehouseProductVariantId" varchar, "variantId" varchar NOT NULL, "binId" varchar, "type" varchar(16) NOT NULL, "quantity" numeric NOT NULL, "quantityBefore" numeric NOT NULL, "quantityAfter" numeric NOT NULL, "reservedBefore" numeric NOT NULL, "reservedAfter" numeric NOT NULL, "referenceType" varchar(64) NOT NULL, "referenceId" varchar NOT NULL, "reason" varchar(64), "note" text, "occurredAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_stock_movement_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_stock_movement_warehouse_product" FOREIGN KEY ("warehouseProductId") REFERENCES "warehouse_product" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_stock_movement_warehouse_product_variant" FOREIGN KEY ("warehouseProductVariantId") REFERENCES "warehouse_product_variant" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_stock_movement_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_level" ON "stock_movement" ("variantId", "warehouseId", "occurredAt") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_reference" ON "stock_movement" ("referenceType", "referenceId") WHERE "referenceId" IS NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_org_occurred" ON "stock_movement" ("organizationId", "occurredAt") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_type_occurred" ON "stock_movement" ("type", "occurredAt") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_wpv" ON "stock_movement" ("warehouseProductVariantId", "occurredAt") WHERE "warehouseProductVariantId" IS NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_movement_bin" ON "stock_movement" ("binId", "variantId", "occurredAt") WHERE "binId" IS NOT NULL`);
		await queryRunner.query(`CREATE TABLE "stock_reservation" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "variantId" varchar NOT NULL, "warehouseId" varchar NOT NULL, "warehouseProductVariantId" varchar, "quantity" numeric NOT NULL, "status" varchar(16) NOT NULL DEFAULT 'ACTIVE', "referenceType" varchar(16) NOT NULL, "referenceId" varchar NOT NULL, "lineId" varchar, "expiresAt" datetime, "releasedAt" datetime, "consumedAt" datetime, "isBackorder" boolean NOT NULL DEFAULT 0, "expectedAt" datetime, CONSTRAINT "FK_stock_reservation_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_stock_reservation_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_stock_reservation_level" FOREIGN KEY ("warehouseProductVariantId") REFERENCES "warehouse_product_variant" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_reservation_reference" ON "stock_reservation" ("referenceType", "referenceId") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_reservation_expiry" ON "stock_reservation" ("status", "expiresAt") WHERE "status" = 'ACTIVE'`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_reservation_level" ON "stock_reservation" ("variantId", "warehouseId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_reservation_line" ON "stock_reservation" ("lineId") WHERE "lineId" IS NOT NULL`);
		await queryRunner.query(`CREATE TABLE "stock_transfer" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar(64) NOT NULL, "fromWarehouseId" varchar NOT NULL, "toWarehouseId" varchar NOT NULL, "status" varchar(32) NOT NULL DEFAULT 'DRAFT', "shippedAt" datetime, "receivedAt" datetime, "note" text, "version" int NOT NULL DEFAULT (1), "metadata" text, CONSTRAINT "FK_stock_transfer_from_warehouse" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_stock_transfer_to_warehouse" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "CHK_stock_transfer_distinct" CHECK ("fromWarehouseId" <> "toWarehouseId"))`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_transfer_number" ON "stock_transfer" ("organizationId", "number")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_status" ON "stock_transfer" ("organizationId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_from" ON "stock_transfer" ("fromWarehouseId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_to" ON "stock_transfer" ("toWarehouseId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE TABLE "stock_transfer_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "transferId" varchar NOT NULL, "variantId" varchar NOT NULL, "requestedQuantity" numeric NOT NULL, "shippedQuantity" numeric NOT NULL DEFAULT 0, "receivedQuantity" numeric NOT NULL DEFAULT 0, "damagedQuantity" numeric NOT NULL DEFAULT 0, "unitCost" numeric, "note" text, CONSTRAINT "FK_stock_transfer_line_transfer" FOREIGN KEY ("transferId") REFERENCES "stock_transfer" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_stock_transfer_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_transfer_line" ON "stock_transfer_line" ("transferId", "variantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_line_variant" ON "stock_transfer_line" ("variantId")`);
		await queryRunner.query(`CREATE TABLE "stock_alert" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "variantId" varchar NOT NULL, "warehouseId" varchar, "threshold" numeric NOT NULL, "notifyEmails" text, "notifyRoles" text, "lastTriggeredAt" datetime, "cooldownMinutes" int NOT NULL DEFAULT (0), CONSTRAINT "FK_stock_alert_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_stock_alert_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_alert" ON "stock_alert" ("variantId", "warehouseId")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_alert_scan" ON "stock_alert" ("organizationId", "isActive") WHERE "isActive" = true AND "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_alert_warehouse" ON "stock_alert" ("warehouseId") WHERE "warehouseId" IS NOT NULL`);
		await queryRunner.query(`CREATE TABLE "channel_warehouse" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "channelId" varchar NOT NULL, "warehouseId" varchar NOT NULL, "isDefault" boolean NOT NULL DEFAULT 0, "priority" int NOT NULL DEFAULT (0), "metadata" text, CONSTRAINT "FK_channel_warehouse_channel" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_channel_warehouse_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_channel_warehouse" ON "channel_warehouse" ("channelId", "warehouseId")`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_warehouse_warehouse" ON "channel_warehouse" ("warehouseId") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_channel_warehouse_default" ON "channel_warehouse" ("channelId") WHERE "isDefault" = true AND "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE TABLE "stock_adjustment" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar(32) NOT NULL, "warehouseId" varchar NOT NULL, "variantId" varchar NOT NULL, "warehouseProductVariantId" varchar, "type" varchar(16) NOT NULL, "quantity" numeric NOT NULL, "reasonCode" varchar(64), "reason" varchar(255), "note" text, "status" varchar(16) NOT NULL DEFAULT 'DRAFT', "appliedAt" datetime, "appliedByUserId" varchar, "movementId" varchar, "metadata" text, CONSTRAINT "FK_stock_adjustment_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_stock_adjustment_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_stock_adjustment_level" FOREIGN KEY ("warehouseProductVariantId") REFERENCES "warehouse_product_variant" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_stock_adjustment_applied_by" FOREIGN KEY ("appliedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_stock_adjustment_movement" FOREIGN KEY ("movementId") REFERENCES "stock_movement" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_adjustment_number" ON "stock_adjustment" ("organizationId", "number")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_adjustment_level" ON "stock_adjustment" ("warehouseId", "variantId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE TABLE "stock_count" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar(32) NOT NULL, "warehouseId" varchar NOT NULL, "status" varchar(16) NOT NULL DEFAULT 'DRAFT', "scope" text, "blindCount" boolean NOT NULL DEFAULT 0, "startedAt" datetime, "closedAt" datetime, "startedByUserId" varchar, "closedByUserId" varchar, "note" text, "metadata" text, "zoneId" varchar, "binId" varchar, "mode" varchar(16) NOT NULL DEFAULT 'FULL', "scopeCriteria" text, "countedLineCount" int NOT NULL DEFAULT (0), "varianceUnits" numeric NOT NULL DEFAULT 0, "varianceValue" numeric NOT NULL DEFAULT 0, "freezeMovements" boolean NOT NULL DEFAULT 1, "recountOfId" varchar, CONSTRAINT "FK_stock_count_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_stock_count_started_by" FOREIGN KEY ("startedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_stock_count_closed_by" FOREIGN KEY ("closedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_stock_count_recount_of" FOREIGN KEY ("recountOfId") REFERENCES "stock_count" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_count_number" ON "stock_count" ("organizationId", "number")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_count_org_status" ON "stock_count" ("organizationId", "warehouseId", "status") WHERE "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_count_open" ON "stock_count" ("warehouseId", "status") WHERE "status" IN ('OPEN','COUNTING','REVIEW')`);
		await queryRunner.query(`CREATE TABLE "stock_count_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "stockCountId" varchar NOT NULL, "variantId" varchar NOT NULL, "warehouseProductVariantId" varchar, "expectedQuantity" numeric NOT NULL DEFAULT 0, "countedQuantity" numeric, "variance" numeric, "countedAt" datetime, "countedByUserId" varchar, "movementId" varchar, "note" text, "binId" varchar, "binPathSnapshot" varchar(255), "recountedQuantity" numeric, "status" varchar(16) NOT NULL DEFAULT 'PENDING', CONSTRAINT "FK_stock_count_line_count" FOREIGN KEY ("stockCountId") REFERENCES "stock_count" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_stock_count_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_stock_count_line_level" FOREIGN KEY ("warehouseProductVariantId") REFERENCES "warehouse_product_variant" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_stock_count_line_counted_by" FOREIGN KEY ("countedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_stock_count_line_movement" FOREIGN KEY ("movementId") REFERENCES "stock_movement" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_count_line" ON "stock_count_line" ("stockCountId", "variantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_stock_count_line_pending" ON "stock_count_line" ("stockCountId") WHERE "countedQuantity" IS NULL AND "deletedAt" IS NULL`);
		await queryRunner.query(`CREATE TRIGGER "TRG_stock_movement_no_update" BEFORE UPDATE ON "stock_movement" BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END`);
		await queryRunner.query(`CREATE TRIGGER "TRG_stock_movement_no_delete" BEFORE DELETE ON "stock_movement" BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TRIGGER "TRG_stock_movement_no_update"`);
		await queryRunner.query(`DROP TRIGGER "TRG_stock_movement_no_delete"`);
		await queryRunner.query(`DROP TABLE "stock_count_line"`);
		await queryRunner.query(`DROP TABLE "stock_count"`);
		await queryRunner.query(`DROP TABLE "stock_adjustment"`);
		await queryRunner.query(`DROP TABLE "channel_warehouse"`);
		await queryRunner.query(`DROP TABLE "stock_alert"`);
		await queryRunner.query(`DROP TABLE "stock_transfer_line"`);
		await queryRunner.query(`DROP TABLE "stock_transfer"`);
		await queryRunner.query(`DROP TABLE "stock_reservation"`);
		await queryRunner.query(`DROP TABLE "stock_movement"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`CREATE TABLE \`stock_movement\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`warehouseId\` varchar(36) NOT NULL, \`warehouseProductId\` varchar(36), \`warehouseProductVariantId\` varchar(36), \`variantId\` varchar(36) NOT NULL, \`binId\` varchar(36), \`type\` varchar(16) NOT NULL, \`quantity\` decimal(20, 6) NOT NULL, \`quantityBefore\` decimal(20, 6) NOT NULL, \`quantityAfter\` decimal(20, 6) NOT NULL, \`reservedBefore\` decimal(20, 6) NOT NULL, \`reservedAfter\` decimal(20, 6) NOT NULL, \`referenceType\` varchar(64) NOT NULL, \`referenceId\` varchar(36) NOT NULL, \`reason\` varchar(64), \`note\` text, \`occurredAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_movement_level\` ON \`stock_movement\` (\`variantId\`, \`warehouseId\`, \`occurredAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_movement_reference\` ON \`stock_movement\` (\`referenceType\`, \`referenceId\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_movement_org_occurred\` ON \`stock_movement\` (\`organizationId\`, \`occurredAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_movement_type_occurred\` ON \`stock_movement\` (\`type\`, \`occurredAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_movement_wpv\` ON \`stock_movement\` (\`warehouseProductVariantId\`, \`occurredAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_movement_bin\` ON \`stock_movement\` (\`binId\`, \`variantId\`, \`occurredAt\`)`);
		await queryRunner.query(`CREATE TABLE \`stock_reservation\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`variantId\` varchar(36) NOT NULL, \`warehouseId\` varchar(36) NOT NULL, \`warehouseProductVariantId\` varchar(36), \`quantity\` decimal(20, 6) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'ACTIVE', \`referenceType\` varchar(16) NOT NULL, \`referenceId\` varchar(36) NOT NULL, \`lineId\` varchar(36), \`expiresAt\` datetime, \`releasedAt\` datetime, \`consumedAt\` datetime, \`isBackorder\` tinyint NOT NULL DEFAULT 0, \`expectedAt\` datetime, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_reservation_reference\` ON \`stock_reservation\` (\`referenceType\`, \`referenceId\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_reservation_expiry\` ON \`stock_reservation\` (\`status\`, \`expiresAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_reservation_level\` ON \`stock_reservation\` (\`variantId\`, \`warehouseId\`, \`status\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_reservation_line\` ON \`stock_reservation\` (\`lineId\`)`);
		await queryRunner.query(`CREATE TABLE \`stock_transfer\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`number\` varchar(64) NOT NULL, \`fromWarehouseId\` varchar(36) NOT NULL, \`toWarehouseId\` varchar(36) NOT NULL, \`status\` varchar(32) NOT NULL DEFAULT 'DRAFT', \`shippedAt\` datetime, \`receivedAt\` datetime, \`note\` text, \`version\` int NOT NULL DEFAULT 1, \`metadata\` json, CONSTRAINT \`CHK_stock_transfer_distinct\` CHECK (\`fromWarehouseId\` <> \`toWarehouseId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_stock_transfer_number\` ON \`stock_transfer\` (\`organizationId\`, \`number\`, \`deletedAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_transfer_status\` ON \`stock_transfer\` (\`organizationId\`, \`status\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_transfer_from\` ON \`stock_transfer\` (\`fromWarehouseId\`, \`status\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_transfer_to\` ON \`stock_transfer\` (\`toWarehouseId\`, \`status\`)`);
		await queryRunner.query(`CREATE TABLE \`stock_transfer_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`transferId\` varchar(36) NOT NULL, \`variantId\` varchar(36) NOT NULL, \`requestedQuantity\` decimal(20, 6) NOT NULL, \`shippedQuantity\` decimal(20, 6) NOT NULL DEFAULT 0, \`receivedQuantity\` decimal(20, 6) NOT NULL DEFAULT 0, \`damagedQuantity\` decimal(20, 6) NOT NULL DEFAULT 0, \`unitCost\` decimal(20, 6), \`note\` text, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_stock_transfer_line\` ON \`stock_transfer_line\` (\`transferId\`, \`variantId\`, \`deletedAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_transfer_line_variant\` ON \`stock_transfer_line\` (\`variantId\`)`);
		await queryRunner.query(`CREATE TABLE \`stock_alert\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`variantId\` varchar(36) NOT NULL, \`warehouseId\` varchar(36), \`threshold\` decimal(20, 6) NOT NULL, \`notifyEmails\` text, \`notifyRoles\` text, \`lastTriggeredAt\` datetime, \`cooldownMinutes\` int NOT NULL DEFAULT 0, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_stock_alert\` ON \`stock_alert\` (\`variantId\`, \`warehouseId\`, \`deletedAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_alert_scan\` ON \`stock_alert\` (\`organizationId\`, \`isActive\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_alert_warehouse\` ON \`stock_alert\` (\`warehouseId\`)`);
		await queryRunner.query(`CREATE TABLE \`channel_warehouse\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`channelId\` varchar(36) NOT NULL, \`warehouseId\` varchar(36) NOT NULL, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`priority\` int NOT NULL DEFAULT 0, \`metadata\` json, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_channel_warehouse\` ON \`channel_warehouse\` (\`channelId\`, \`warehouseId\`, \`deletedAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_channel_warehouse_warehouse\` ON \`channel_warehouse\` (\`warehouseId\`)`);
		await queryRunner.query(`CREATE TABLE \`stock_adjustment\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`number\` varchar(32) NOT NULL, \`warehouseId\` varchar(36) NOT NULL, \`variantId\` varchar(36) NOT NULL, \`warehouseProductVariantId\` varchar(36), \`type\` varchar(16) NOT NULL, \`quantity\` decimal(20, 6) NOT NULL, \`reasonCode\` varchar(64), \`reason\` varchar(255), \`note\` text, \`status\` varchar(16) NOT NULL DEFAULT 'DRAFT', \`appliedAt\` datetime, \`appliedByUserId\` varchar(36), \`movementId\` varchar(36), \`metadata\` json, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_stock_adjustment_number\` ON \`stock_adjustment\` (\`organizationId\`, \`number\`, \`deletedAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_adjustment_level\` ON \`stock_adjustment\` (\`warehouseId\`, \`variantId\`, \`status\`)`);
		await queryRunner.query(`CREATE TABLE \`stock_count\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`number\` varchar(32) NOT NULL, \`warehouseId\` varchar(36) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'DRAFT', \`scope\` json, \`blindCount\` tinyint NOT NULL DEFAULT 0, \`startedAt\` datetime, \`closedAt\` datetime, \`startedByUserId\` varchar(36), \`closedByUserId\` varchar(36), \`note\` text, \`metadata\` json, \`zoneId\` varchar(36), \`binId\` varchar(36), \`mode\` varchar(16) NOT NULL DEFAULT 'FULL', \`scopeCriteria\` json, \`countedLineCount\` int NOT NULL DEFAULT 0, \`varianceUnits\` decimal(20, 6) NOT NULL DEFAULT 0, \`varianceValue\` decimal(20, 6) NOT NULL DEFAULT 0, \`freezeMovements\` tinyint NOT NULL DEFAULT 1, \`recountOfId\` varchar(36), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_stock_count_number\` ON \`stock_count\` (\`organizationId\`, \`number\`, \`deletedAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_count_org_status\` ON \`stock_count\` (\`organizationId\`, \`warehouseId\`, \`status\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_count_open\` ON \`stock_count\` (\`warehouseId\`, \`status\`)`);
		await queryRunner.query(`CREATE TABLE \`stock_count_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`stockCountId\` varchar(36) NOT NULL, \`variantId\` varchar(36) NOT NULL, \`warehouseProductVariantId\` varchar(36), \`expectedQuantity\` decimal(20, 6) NOT NULL DEFAULT 0, \`countedQuantity\` decimal(20, 6), \`variance\` decimal(20, 6), \`countedAt\` datetime, \`countedByUserId\` varchar(36), \`movementId\` varchar(36), \`note\` text, \`binId\` varchar(36), \`binPathSnapshot\` varchar(255), \`recountedQuantity\` decimal(20, 6), \`status\` varchar(16) NOT NULL DEFAULT 'PENDING', PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_stock_count_line\` ON \`stock_count_line\` (\`stockCountId\`, \`variantId\`, \`deletedAt\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_stock_count_line_pending\` ON \`stock_count_line\` (\`stockCountId\`)`);
		await queryRunner.query(`ALTER TABLE \`stock_movement\` ADD CONSTRAINT \`FK_stock_movement_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_movement\` ADD CONSTRAINT \`FK_stock_movement_warehouse_product\` FOREIGN KEY (\`warehouseProductId\`) REFERENCES \`warehouse_product\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_movement\` ADD CONSTRAINT \`FK_stock_movement_warehouse_product_variant\` FOREIGN KEY (\`warehouseProductVariantId\`) REFERENCES \`warehouse_product_variant\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_movement\` ADD CONSTRAINT \`FK_stock_movement_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_reservation\` ADD CONSTRAINT \`FK_stock_reservation_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_reservation\` ADD CONSTRAINT \`FK_stock_reservation_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_reservation\` ADD CONSTRAINT \`FK_stock_reservation_level\` FOREIGN KEY (\`warehouseProductVariantId\`) REFERENCES \`warehouse_product_variant\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_transfer\` ADD CONSTRAINT \`FK_stock_transfer_from_warehouse\` FOREIGN KEY (\`fromWarehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_transfer\` ADD CONSTRAINT \`FK_stock_transfer_to_warehouse\` FOREIGN KEY (\`toWarehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_transfer_line\` ADD CONSTRAINT \`FK_stock_transfer_line_transfer\` FOREIGN KEY (\`transferId\`) REFERENCES \`stock_transfer\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_transfer_line\` ADD CONSTRAINT \`FK_stock_transfer_line_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_alert\` ADD CONSTRAINT \`FK_stock_alert_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_alert\` ADD CONSTRAINT \`FK_stock_alert_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`channel_warehouse\` ADD CONSTRAINT \`FK_channel_warehouse_channel\` FOREIGN KEY (\`channelId\`) REFERENCES \`channel\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`channel_warehouse\` ADD CONSTRAINT \`FK_channel_warehouse_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_adjustment\` ADD CONSTRAINT \`FK_stock_adjustment_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_adjustment\` ADD CONSTRAINT \`FK_stock_adjustment_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_adjustment\` ADD CONSTRAINT \`FK_stock_adjustment_level\` FOREIGN KEY (\`warehouseProductVariantId\`) REFERENCES \`warehouse_product_variant\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_adjustment\` ADD CONSTRAINT \`FK_stock_adjustment_applied_by\` FOREIGN KEY (\`appliedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_adjustment\` ADD CONSTRAINT \`FK_stock_adjustment_movement\` FOREIGN KEY (\`movementId\`) REFERENCES \`stock_movement\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_count\` ADD CONSTRAINT \`FK_stock_count_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_count\` ADD CONSTRAINT \`FK_stock_count_started_by\` FOREIGN KEY (\`startedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_count\` ADD CONSTRAINT \`FK_stock_count_closed_by\` FOREIGN KEY (\`closedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_count\` ADD CONSTRAINT \`FK_stock_count_recount_of\` FOREIGN KEY (\`recountOfId\`) REFERENCES \`stock_count\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_count_line\` ADD CONSTRAINT \`FK_stock_count_line_count\` FOREIGN KEY (\`stockCountId\`) REFERENCES \`stock_count\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_count_line\` ADD CONSTRAINT \`FK_stock_count_line_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_count_line\` ADD CONSTRAINT \`FK_stock_count_line_level\` FOREIGN KEY (\`warehouseProductVariantId\`) REFERENCES \`warehouse_product_variant\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_count_line\` ADD CONSTRAINT \`FK_stock_count_line_counted_by\` FOREIGN KEY (\`countedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`stock_count_line\` ADD CONSTRAINT \`FK_stock_count_line_movement\` FOREIGN KEY (\`movementId\`) REFERENCES \`stock_movement\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`CREATE TRIGGER \`TRG_stock_movement_no_update\` BEFORE UPDATE ON \`stock_movement\` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock_movement is append-only'`);
		await queryRunner.query(`CREATE TRIGGER \`TRG_stock_movement_no_delete\` BEFORE DELETE ON \`stock_movement\` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock_movement is append-only'`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TRIGGER \`TRG_stock_movement_no_update\``);
		await queryRunner.query(`DROP TRIGGER \`TRG_stock_movement_no_delete\``);
		await queryRunner.query(`ALTER TABLE \`stock_count_line\` DROP FOREIGN KEY \`FK_stock_count_line_count\``);
		await queryRunner.query(`ALTER TABLE \`stock_count_line\` DROP FOREIGN KEY \`FK_stock_count_line_variant\``);
		await queryRunner.query(`ALTER TABLE \`stock_count_line\` DROP FOREIGN KEY \`FK_stock_count_line_level\``);
		await queryRunner.query(`ALTER TABLE \`stock_count_line\` DROP FOREIGN KEY \`FK_stock_count_line_counted_by\``);
		await queryRunner.query(`ALTER TABLE \`stock_count_line\` DROP FOREIGN KEY \`FK_stock_count_line_movement\``);
		await queryRunner.query(`ALTER TABLE \`stock_count\` DROP FOREIGN KEY \`FK_stock_count_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`stock_count\` DROP FOREIGN KEY \`FK_stock_count_started_by\``);
		await queryRunner.query(`ALTER TABLE \`stock_count\` DROP FOREIGN KEY \`FK_stock_count_closed_by\``);
		await queryRunner.query(`ALTER TABLE \`stock_count\` DROP FOREIGN KEY \`FK_stock_count_recount_of\``);
		await queryRunner.query(`ALTER TABLE \`stock_adjustment\` DROP FOREIGN KEY \`FK_stock_adjustment_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`stock_adjustment\` DROP FOREIGN KEY \`FK_stock_adjustment_variant\``);
		await queryRunner.query(`ALTER TABLE \`stock_adjustment\` DROP FOREIGN KEY \`FK_stock_adjustment_level\``);
		await queryRunner.query(`ALTER TABLE \`stock_adjustment\` DROP FOREIGN KEY \`FK_stock_adjustment_applied_by\``);
		await queryRunner.query(`ALTER TABLE \`stock_adjustment\` DROP FOREIGN KEY \`FK_stock_adjustment_movement\``);
		await queryRunner.query(`ALTER TABLE \`channel_warehouse\` DROP FOREIGN KEY \`FK_channel_warehouse_channel\``);
		await queryRunner.query(`ALTER TABLE \`channel_warehouse\` DROP FOREIGN KEY \`FK_channel_warehouse_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`stock_alert\` DROP FOREIGN KEY \`FK_stock_alert_variant\``);
		await queryRunner.query(`ALTER TABLE \`stock_alert\` DROP FOREIGN KEY \`FK_stock_alert_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`stock_transfer_line\` DROP FOREIGN KEY \`FK_stock_transfer_line_transfer\``);
		await queryRunner.query(`ALTER TABLE \`stock_transfer_line\` DROP FOREIGN KEY \`FK_stock_transfer_line_variant\``);
		await queryRunner.query(`ALTER TABLE \`stock_transfer\` DROP FOREIGN KEY \`FK_stock_transfer_from_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`stock_transfer\` DROP FOREIGN KEY \`FK_stock_transfer_to_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`stock_reservation\` DROP FOREIGN KEY \`FK_stock_reservation_variant\``);
		await queryRunner.query(`ALTER TABLE \`stock_reservation\` DROP FOREIGN KEY \`FK_stock_reservation_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`stock_reservation\` DROP FOREIGN KEY \`FK_stock_reservation_level\``);
		await queryRunner.query(`ALTER TABLE \`stock_movement\` DROP FOREIGN KEY \`FK_stock_movement_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`stock_movement\` DROP FOREIGN KEY \`FK_stock_movement_warehouse_product\``);
		await queryRunner.query(`ALTER TABLE \`stock_movement\` DROP FOREIGN KEY \`FK_stock_movement_warehouse_product_variant\``);
		await queryRunner.query(`ALTER TABLE \`stock_movement\` DROP FOREIGN KEY \`FK_stock_movement_variant\``);
		await queryRunner.query(`DROP TABLE \`stock_count_line\``);
		await queryRunner.query(`DROP TABLE \`stock_count\``);
		await queryRunner.query(`DROP TABLE \`stock_adjustment\``);
		await queryRunner.query(`DROP TABLE \`channel_warehouse\``);
		await queryRunner.query(`DROP TABLE \`stock_alert\``);
		await queryRunner.query(`DROP TABLE \`stock_transfer_line\``);
		await queryRunner.query(`DROP TABLE \`stock_transfer\``);
		await queryRunner.query(`DROP TABLE \`stock_reservation\``);
		await queryRunner.query(`DROP TABLE \`stock_movement\``);
	}
}
