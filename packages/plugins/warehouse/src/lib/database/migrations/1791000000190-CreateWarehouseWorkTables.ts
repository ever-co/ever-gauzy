import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the work of the warehouse: the waves picking is released in, the lists a picker is handed,
 * the lines they confirm, the packing record and the manifest the carrier accepts.
 *
 * Five tables, in the order the work is done:
 *
 * - `pick_wave` — a batch of picking work released to the floor together, and the unit an operator
 *   releases, assigns, watches and closes;
 * - `pick_list` — the work for one picker, generated from the shipment side rather than authored;
 * - `pick_list_line` — what, how much, from which bin, and what actually happened;
 * - `pack_slip` — the package as a physical object, with its weight and its label;
 * - `carrier_manifest` — the document that ends the platform's custody of the parcels.
 *
 * **`pack_slip` and `carrier_manifest` do not reference each other.** A manifest's members are
 * fulfilments, linked through `fulfillment.metadata.manifestId`, because a manifest covers shipments
 * and a shipment may contain several packages — so neither table needs a key into the other and there
 * is no ordering constraint between them.
 *
 * **Four columns deliberately carry no foreign key.** `pick_wave.channelId` points at `channel`,
 * which the kernel set creates. `pick_list.fulfillmentId` / `.orderId`, `pick_list_line.orderId` /
 * `.fulfillmentLineId` and `pack_slip.orderId` / `.fulfillmentId` point at `order`, `order_line`,
 * `fulfillment` and `fulfillment_line`, which the sets at higher ticks of this window create. A set may
 * only constrain a target that already exists (§24, rule 10), so those columns are created as plain
 * nullable relation ids and the relationship is enforced by the service; the constraint belongs to the
 * set that owns the target and cannot be created by a set that runs before it.
 *
 * All three dialects are written by hand, and the down migration reverses every statement in the
 * opposite order.
 */
export class CreateWarehouseWorkTables1791000000190 implements MigrationInterface {
	name = 'CreateWarehouseWorkTables1791000000190';

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
			`CREATE TABLE "pick_wave" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "warehouseId" uuid NOT NULL, "channelId" uuid, "number" character varying(32) NOT NULL, "strategy" character varying(16) NOT NULL DEFAULT 'BATCH', "status" character varying(32) NOT NULL DEFAULT 'DRAFT', "priority" integer NOT NULL DEFAULT 0, "pickerUserId" uuid, "plannedAt" TIMESTAMP, "releasedAt" TIMESTAMP, "startedAt" TIMESTAMP, "completedAt" TIMESTAMP, "orderCount" integer NOT NULL DEFAULT 0, "lineCount" integer NOT NULL DEFAULT 0, "version" integer NOT NULL DEFAULT 1, "metadata" jsonb, CONSTRAINT "FK_pick_wave_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_pick_wave_channel" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_wave_picker" FOREIGN KEY ("pickerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "PK_pick_wave_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_created_by_user" ON "pick_wave" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_updated_by_user" ON "pick_wave" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_deleted_by_user" ON "pick_wave" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_is_active" ON "pick_wave" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_is_archived" ON "pick_wave" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_tenant" ON "pick_wave" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_organization" ON "pick_wave" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_pick_wave_number" ON "pick_wave" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_wave_dispatch" ON "pick_wave" ("warehouseId", "status", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_wave_planned" ON "pick_wave" ("warehouseId", "status", "plannedAt") WHERE "status" IN ('RELEASED', 'IN_PROGRESS')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_wave_picker" ON "pick_wave" ("pickerUserId", "status") WHERE "pickerUserId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "pick_list" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "waveId" uuid, "warehouseId" uuid NOT NULL, "zoneId" uuid, "fulfillmentId" uuid, "orderId" uuid, "number" character varying(32) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'PENDING', "assignedToUserId" uuid, "priority" integer NOT NULL DEFAULT 0, "lineCount" integer NOT NULL DEFAULT 0, "pickedCount" integer NOT NULL DEFAULT 0, "shortCount" integer NOT NULL DEFAULT 0, "startedAt" TIMESTAMP, "completedAt" TIMESTAMP, "note" text, "version" integer NOT NULL DEFAULT 1, "metadata" jsonb, CONSTRAINT "FK_pick_list_wave" FOREIGN KEY ("waveId") REFERENCES "pick_wave"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_zone" FOREIGN KEY ("zoneId") REFERENCES "warehouse_zone"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_assignee" FOREIGN KEY ("assignedToUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "PK_pick_list_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_created_by_user" ON "pick_list" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_updated_by_user" ON "pick_list" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_deleted_by_user" ON "pick_list" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_is_active" ON "pick_list" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_is_archived" ON "pick_list" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_tenant" ON "pick_list" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_organization" ON "pick_list" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_pick_list_number" ON "pick_list" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "number") WHERE "deletedAt" IS NULL`
		);
		// Generation is idempotent per shipment and zone, which is what stops a re-run of the generator
		// doubling the work.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_pick_list_fulfillment_zone" ON "pick_list" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "fulfillmentId", "zoneId") WHERE "fulfillmentId" IS NOT NULL AND "zoneId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_wave" ON "pick_list" ("waveId", "status") WHERE "waveId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_fulfillment" ON "pick_list" ("fulfillmentId") WHERE "fulfillmentId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_assignee" ON "pick_list" ("assignedToUserId", "status") WHERE "assignedToUserId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_warehouse_status" ON "pick_list" ("warehouseId", "status", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_zone" ON "pick_list" ("zoneId") WHERE "zoneId" IS NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_order" ON "pick_list" ("orderId") WHERE "orderId" IS NOT NULL`);

		await queryRunner.query(
			`CREATE TABLE "pack_slip" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "warehouseId" uuid NOT NULL, "pickListId" uuid, "orderId" uuid, "fulfillmentId" uuid, "number" character varying(32) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'OPEN', "carrierKey" character varying(64), "packageCount" integer NOT NULL DEFAULT 1, "totalWeight" numeric(12,4), "totalVolume" numeric(12,4), "trackingNumber" character varying(255), "labelUrl" character varying(1024), "packedAt" TIMESTAMP, "packedByUserId" uuid, "note" text, "version" integer NOT NULL DEFAULT 1, "metadata" jsonb, CONSTRAINT "CHK_pack_slip_package_count" CHECK ("packageCount" >= 1), CONSTRAINT "FK_pack_slip_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_pack_slip_pick_list" FOREIGN KEY ("pickListId") REFERENCES "pick_list"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pack_slip_packed_by" FOREIGN KEY ("packedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "PK_pack_slip_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_created_by_user" ON "pack_slip" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_updated_by_user" ON "pack_slip" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_deleted_by_user" ON "pack_slip" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_is_active" ON "pack_slip" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_is_archived" ON "pack_slip" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_tenant" ON "pack_slip" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_organization" ON "pack_slip" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_pack_slip_number" ON "pack_slip" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "number") WHERE "deletedAt" IS NULL`
		);
		// A tracking number is unique per carrier, which is what stops one label being attached to two
		// packages.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_pack_slip_tracking" ON "pack_slip" (COALESCE("carrierKey", ''), "trackingNumber") WHERE "trackingNumber" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pack_slip_fulfillment" ON "pack_slip" ("fulfillmentId", "status") WHERE "fulfillmentId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pack_slip_warehouse_status" ON "pack_slip" ("warehouseId", "status", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_pick_list" ON "pack_slip" ("pickListId") WHERE "pickListId" IS NOT NULL`);

		await queryRunner.query(
			`CREATE TABLE "pick_list_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "pickListId" uuid NOT NULL, "orderLineId" uuid, "fulfillmentLineId" uuid, "variantId" uuid NOT NULL, "binId" uuid, "zoneId" uuid, "quantityRequested" numeric(20,6) NOT NULL, "quantityPicked" numeric(20,6) NOT NULL DEFAULT 0, "quantityShort" numeric(20,6) NOT NULL DEFAULT 0, "status" character varying(16) NOT NULL DEFAULT 'PENDING', "substituteVariantId" uuid, "substituteQuantity" numeric(20,6), "substitutionReason" character varying(255), "packSlipId" uuid, "position" integer NOT NULL DEFAULT 0, "pickedAt" TIMESTAMP, "pickedByUserId" uuid, "lotNumber" character varying(64), "expiryDate" date, "serialNumbers" text, "note" text, "metadata" jsonb, CONSTRAINT "CHK_pick_list_line_quantities" CHECK ("quantityPicked" + "quantityShort" <= "quantityRequested"), CONSTRAINT "CHK_pick_list_line_substitute" CHECK (("substituteVariantId" IS NULL AND "substituteQuantity" IS NULL) OR ("substituteVariantId" IS NOT NULL AND "substituteQuantity" IS NOT NULL)), CONSTRAINT "FK_pick_list_line_list" FOREIGN KEY ("pickListId") REFERENCES "pick_list"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_bin" FOREIGN KEY ("binId") REFERENCES "warehouse_bin"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_zone" FOREIGN KEY ("zoneId") REFERENCES "warehouse_zone"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_substitute" FOREIGN KEY ("substituteVariantId") REFERENCES "product_variant"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_pack_slip" FOREIGN KEY ("packSlipId") REFERENCES "pack_slip"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_picked_by" FOREIGN KEY ("pickedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "PK_pick_list_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_created_by_user" ON "pick_list_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_updated_by_user" ON "pick_list_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_deleted_by_user" ON "pick_list_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_line_is_active" ON "pick_list_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_line_is_archived" ON "pick_list_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_line_tenant" ON "pick_list_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_line_organization" ON "pick_list_line" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_list" ON "pick_list_line" ("pickListId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_status" ON "pick_list_line" ("pickListId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_fulfillment" ON "pick_list_line" ("fulfillmentLineId") WHERE "fulfillmentLineId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_bin" ON "pick_list_line" ("binId", "status") WHERE "binId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_variant" ON "pick_list_line" ("variantId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_pack_slip" ON "pick_list_line" ("packSlipId") WHERE "packSlipId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_order_line" ON "pick_list_line" ("orderLineId") WHERE "orderLineId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "carrier_manifest" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "warehouseId" uuid NOT NULL, "carrier" character varying(64) NOT NULL, "service" character varying(64), "number" character varying(32) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "manifestDate" date NOT NULL DEFAULT CURRENT_DATE, "windowFrom" TIMESTAMP, "windowTo" TIMESTAMP, "shipmentCount" integer NOT NULL DEFAULT 0, "packageCount" integer NOT NULL DEFAULT 0, "totalWeight" numeric(12,4) NOT NULL DEFAULT 0, "closedAt" TIMESTAMP, "handedOverAt" TIMESTAMP, "canceledAt" TIMESTAMP, "documentUrl" character varying(1024), "documentData" jsonb, "note" text, "version" integer NOT NULL DEFAULT 1, "metadata" jsonb, CONSTRAINT "FK_carrier_manifest_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "PK_carrier_manifest_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_created_by_user" ON "carrier_manifest" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_updated_by_user" ON "carrier_manifest" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_deleted_by_user" ON "carrier_manifest" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_is_active" ON "carrier_manifest" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_is_archived" ON "carrier_manifest" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_tenant" ON "carrier_manifest" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_organization" ON "carrier_manifest" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_carrier_manifest_number" ON "carrier_manifest" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_carrier_manifest_status" ON "carrier_manifest" ("warehouseId", "status", "manifestDate") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_carrier_manifest_carrier" ON "carrier_manifest" ("carrier", "manifestDate", "status") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "carrier_manifest"`);
		await queryRunner.query(`DROP TABLE "pick_list_line"`);
		await queryRunner.query(`DROP TABLE "pack_slip"`);
		await queryRunner.query(`DROP TABLE "pick_list"`);
		await queryRunner.query(`DROP TABLE "pick_wave"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite stores a `jsonb` column as text and a `simple-array` as text, and has no native uuid type.
	 * One comma per column list: the comma that ends the columns and the comma that begins the
	 * constraints are the same comma.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "pick_wave" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "warehouseId" varchar NOT NULL, "channelId" varchar, "number" varchar(32) NOT NULL, "strategy" varchar(16) NOT NULL DEFAULT ('BATCH'), "status" varchar(32) NOT NULL DEFAULT ('DRAFT'), "priority" integer NOT NULL DEFAULT (0), "pickerUserId" varchar, "plannedAt" datetime, "releasedAt" datetime, "startedAt" datetime, "completedAt" datetime, "orderCount" integer NOT NULL DEFAULT (0), "lineCount" integer NOT NULL DEFAULT (0), "version" integer NOT NULL DEFAULT (1), "metadata" text, CONSTRAINT "FK_pick_wave_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_pick_wave_channel" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_wave_picker" FOREIGN KEY ("pickerUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_created_by_user" ON "pick_wave" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_updated_by_user" ON "pick_wave" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_deleted_by_user" ON "pick_wave" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_is_active" ON "pick_wave" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_is_archived" ON "pick_wave" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_tenant" ON "pick_wave" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_wave_organization" ON "pick_wave" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_pick_wave_number" ON "pick_wave" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_wave_dispatch" ON "pick_wave" ("warehouseId", "status", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_wave_planned" ON "pick_wave" ("warehouseId", "status", "plannedAt") WHERE "status" IN ('RELEASED', 'IN_PROGRESS')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_wave_picker" ON "pick_wave" ("pickerUserId", "status") WHERE "pickerUserId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "pick_list" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "waveId" varchar, "warehouseId" varchar NOT NULL, "zoneId" varchar, "fulfillmentId" varchar, "orderId" varchar, "number" varchar(32) NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('PENDING'), "assignedToUserId" varchar, "priority" integer NOT NULL DEFAULT (0), "lineCount" integer NOT NULL DEFAULT (0), "pickedCount" integer NOT NULL DEFAULT (0), "shortCount" integer NOT NULL DEFAULT (0), "startedAt" datetime, "completedAt" datetime, "note" text, "version" integer NOT NULL DEFAULT (1), "metadata" text, CONSTRAINT "FK_pick_list_wave" FOREIGN KEY ("waveId") REFERENCES "pick_wave" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_zone" FOREIGN KEY ("zoneId") REFERENCES "warehouse_zone" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_assignee" FOREIGN KEY ("assignedToUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_created_by_user" ON "pick_list" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_updated_by_user" ON "pick_list" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_deleted_by_user" ON "pick_list" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_is_active" ON "pick_list" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_is_archived" ON "pick_list" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_tenant" ON "pick_list" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_organization" ON "pick_list" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_pick_list_number" ON "pick_list" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_pick_list_fulfillment_zone" ON "pick_list" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "fulfillmentId", "zoneId") WHERE "fulfillmentId" IS NOT NULL AND "zoneId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_wave" ON "pick_list" ("waveId", "status") WHERE "waveId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_fulfillment" ON "pick_list" ("fulfillmentId") WHERE "fulfillmentId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_assignee" ON "pick_list" ("assignedToUserId", "status") WHERE "assignedToUserId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_warehouse_status" ON "pick_list" ("warehouseId", "status", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_zone" ON "pick_list" ("zoneId") WHERE "zoneId" IS NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_order" ON "pick_list" ("orderId") WHERE "orderId" IS NOT NULL`);

		await queryRunner.query(
			`CREATE TABLE "pack_slip" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "warehouseId" varchar NOT NULL, "pickListId" varchar, "orderId" varchar, "fulfillmentId" varchar, "number" varchar(32) NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('OPEN'), "carrierKey" varchar(64), "packageCount" integer NOT NULL DEFAULT (1), "totalWeight" numeric(12,4), "totalVolume" numeric(12,4), "trackingNumber" varchar(255), "labelUrl" varchar(1024), "packedAt" datetime, "packedByUserId" varchar, "note" text, "version" integer NOT NULL DEFAULT (1), "metadata" text, CONSTRAINT "CHK_pack_slip_package_count" CHECK ("packageCount" >= 1), CONSTRAINT "FK_pack_slip_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_pack_slip_pick_list" FOREIGN KEY ("pickListId") REFERENCES "pick_list" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pack_slip_packed_by" FOREIGN KEY ("packedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_created_by_user" ON "pack_slip" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_updated_by_user" ON "pack_slip" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_deleted_by_user" ON "pack_slip" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_is_active" ON "pack_slip" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_is_archived" ON "pack_slip" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_tenant" ON "pack_slip" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_organization" ON "pack_slip" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_pack_slip_number" ON "pack_slip" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_pack_slip_tracking" ON "pack_slip" (COALESCE("carrierKey", ''), "trackingNumber") WHERE "trackingNumber" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pack_slip_fulfillment" ON "pack_slip" ("fulfillmentId", "status") WHERE "fulfillmentId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pack_slip_warehouse_status" ON "pack_slip" ("warehouseId", "status", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pack_slip_pick_list" ON "pack_slip" ("pickListId") WHERE "pickListId" IS NOT NULL`);

		await queryRunner.query(
			`CREATE TABLE "pick_list_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pickListId" varchar NOT NULL, "orderLineId" varchar, "fulfillmentLineId" varchar, "variantId" varchar NOT NULL, "binId" varchar, "zoneId" varchar, "quantityRequested" numeric(20,6) NOT NULL, "quantityPicked" numeric(20,6) NOT NULL DEFAULT (0), "quantityShort" numeric(20,6) NOT NULL DEFAULT (0), "status" varchar(16) NOT NULL DEFAULT ('PENDING'), "substituteVariantId" varchar, "substituteQuantity" numeric(20,6), "substitutionReason" varchar(255), "packSlipId" varchar, "position" integer NOT NULL DEFAULT (0), "pickedAt" datetime, "pickedByUserId" varchar, "lotNumber" varchar(64), "expiryDate" date, "serialNumbers" text, "note" text, "metadata" text, CONSTRAINT "CHK_pick_list_line_quantities" CHECK ("quantityPicked" + "quantityShort" <= "quantityRequested"), CONSTRAINT "CHK_pick_list_line_substitute" CHECK (("substituteVariantId" IS NULL AND "substituteQuantity" IS NULL) OR ("substituteVariantId" IS NOT NULL AND "substituteQuantity" IS NOT NULL)), CONSTRAINT "FK_pick_list_line_list" FOREIGN KEY ("pickListId") REFERENCES "pick_list" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_bin" FOREIGN KEY ("binId") REFERENCES "warehouse_bin" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_zone" FOREIGN KEY ("zoneId") REFERENCES "warehouse_zone" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_substitute" FOREIGN KEY ("substituteVariantId") REFERENCES "product_variant" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_pack_slip" FOREIGN KEY ("packSlipId") REFERENCES "pack_slip" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_pick_list_line_picked_by" FOREIGN KEY ("pickedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_created_by_user" ON "pick_list_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_updated_by_user" ON "pick_list_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_deleted_by_user" ON "pick_list_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_line_is_active" ON "pick_list_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_line_is_archived" ON "pick_list_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_line_tenant" ON "pick_list_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_pick_list_line_organization" ON "pick_list_line" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_list" ON "pick_list_line" ("pickListId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_status" ON "pick_list_line" ("pickListId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_fulfillment" ON "pick_list_line" ("fulfillmentLineId") WHERE "fulfillmentLineId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_bin" ON "pick_list_line" ("binId", "status") WHERE "binId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_variant" ON "pick_list_line" ("variantId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_pack_slip" ON "pick_list_line" ("packSlipId") WHERE "packSlipId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_pick_list_line_order_line" ON "pick_list_line" ("orderLineId") WHERE "orderLineId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "carrier_manifest" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "warehouseId" varchar NOT NULL, "carrier" varchar(64) NOT NULL, "service" varchar(64), "number" varchar(32) NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('DRAFT'), "manifestDate" date NOT NULL DEFAULT (date('now')), "windowFrom" datetime, "windowTo" datetime, "shipmentCount" integer NOT NULL DEFAULT (0), "packageCount" integer NOT NULL DEFAULT (0), "totalWeight" numeric(12,4) NOT NULL DEFAULT (0), "closedAt" datetime, "handedOverAt" datetime, "canceledAt" datetime, "documentUrl" varchar(1024), "documentData" text, "note" text, "version" integer NOT NULL DEFAULT (1), "metadata" text, CONSTRAINT "FK_carrier_manifest_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_created_by_user" ON "carrier_manifest" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_updated_by_user" ON "carrier_manifest" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_deleted_by_user" ON "carrier_manifest" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_is_active" ON "carrier_manifest" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_is_archived" ON "carrier_manifest" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_tenant" ON "carrier_manifest" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_carrier_manifest_organization" ON "carrier_manifest" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_carrier_manifest_number" ON "carrier_manifest" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_carrier_manifest_status" ON "carrier_manifest" ("warehouseId", "status", "manifestDate") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_carrier_manifest_carrier" ON "carrier_manifest" ("carrier", "manifestDate", "status") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "carrier_manifest"`);
		await queryRunner.query(`DROP TABLE "pick_list_line"`);
		await queryRunner.query(`DROP TABLE "pack_slip"`);
		await queryRunner.query(`DROP TABLE "pick_list"`);
		await queryRunner.query(`DROP TABLE "pick_wave"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no partial index, so the document-numbering rules are carried by the stored generated
	 * key columns `CreateSequenceTable1791000000000` documents for the whole set: `deletedKey` for
	 * `"deletedAt" IS NULL`, and `organizationKey` for the nullable scope the numbers are unique per.
	 * `pack_slip` needs a third, `carrierKeyKey`, because a slip whose carrier is not yet known must
	 * still not share a tracking number with another such slip.
	 *
	 * `fulfillmentId`, `zoneId` and `trackingNumber` stay raw, and that is the whole of their guard on
	 * this dialect: each is already a member of its tuple, so MySQL's rule that a null key part exempts
	 * the tuple is exactly the `IS NOT NULL` the Postgres predicate writes out.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`pick_wave\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`warehouseId\` varchar(36) NOT NULL, \`channelId\` varchar(36) NULL, \`number\` varchar(32) NOT NULL, \`strategy\` varchar(16) NOT NULL DEFAULT 'BATCH', \`status\` varchar(32) NOT NULL DEFAULT 'DRAFT', \`priority\` int NOT NULL DEFAULT 0, \`pickerUserId\` varchar(36) NULL, \`plannedAt\` datetime NULL, \`releasedAt\` datetime NULL, \`startedAt\` datetime NULL, \`completedAt\` datetime NULL, \`orderCount\` int NOT NULL DEFAULT 0, \`lineCount\` int NOT NULL DEFAULT 0, \`version\` int NOT NULL DEFAULT 1, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_pick_wave_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_pick_wave_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_pick_wave_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_pick_wave_is_active\` (\`isActive\`), INDEX \`IDX_pick_wave_is_archived\` (\`isArchived\`), INDEX \`IDX_pick_wave_tenant\` (\`tenantId\`), INDEX \`IDX_pick_wave_organization\` (\`organizationId\`), INDEX \`IDX_pick_wave_dispatch\` (\`warehouseId\`, \`status\`, \`priority\`), INDEX \`IDX_pick_wave_planned\` (\`warehouseId\`, \`status\`, \`plannedAt\`), INDEX \`IDX_pick_wave_picker\` (\`pickerUserId\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_pick_wave_number\` ON \`pick_wave\` (\`organizationKey\`, \`warehouseId\`, \`number\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_wave\` ADD CONSTRAINT \`FK_pick_wave_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_wave\` ADD CONSTRAINT \`FK_pick_wave_channel\` FOREIGN KEY (\`channelId\`) REFERENCES \`channel\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_wave\` ADD CONSTRAINT \`FK_pick_wave_picker\` FOREIGN KEY (\`pickerUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`pick_list\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`waveId\` varchar(36) NULL, \`warehouseId\` varchar(36) NOT NULL, \`zoneId\` varchar(36) NULL, \`fulfillmentId\` varchar(36) NULL, \`orderId\` varchar(36) NULL, \`number\` varchar(32) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'PENDING', \`assignedToUserId\` varchar(36) NULL, \`priority\` int NOT NULL DEFAULT 0, \`lineCount\` int NOT NULL DEFAULT 0, \`pickedCount\` int NOT NULL DEFAULT 0, \`shortCount\` int NOT NULL DEFAULT 0, \`startedAt\` datetime NULL, \`completedAt\` datetime NULL, \`note\` text NULL, \`version\` int NOT NULL DEFAULT 1, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_pick_list_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_pick_list_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_pick_list_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_pick_list_is_active\` (\`isActive\`), INDEX \`IDX_pick_list_is_archived\` (\`isArchived\`), INDEX \`IDX_pick_list_tenant\` (\`tenantId\`), INDEX \`IDX_pick_list_organization\` (\`organizationId\`), INDEX \`IDX_pick_list_wave\` (\`waveId\`, \`status\`), INDEX \`IDX_pick_list_fulfillment\` (\`fulfillmentId\`), INDEX \`IDX_pick_list_assignee\` (\`assignedToUserId\`, \`status\`), INDEX \`IDX_pick_list_warehouse_status\` (\`warehouseId\`, \`status\`, \`priority\`), INDEX \`IDX_pick_list_zone\` (\`zoneId\`), INDEX \`IDX_pick_list_order\` (\`orderId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_pick_list_number\` ON \`pick_list\` (\`organizationKey\`, \`warehouseId\`, \`number\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_pick_list_fulfillment_zone\` ON \`pick_list\` (\`organizationKey\`, \`fulfillmentId\`, \`zoneId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list\` ADD CONSTRAINT \`FK_pick_list_wave\` FOREIGN KEY (\`waveId\`) REFERENCES \`pick_wave\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list\` ADD CONSTRAINT \`FK_pick_list_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list\` ADD CONSTRAINT \`FK_pick_list_zone\` FOREIGN KEY (\`zoneId\`) REFERENCES \`warehouse_zone\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list\` ADD CONSTRAINT \`FK_pick_list_assignee\` FOREIGN KEY (\`assignedToUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`pack_slip\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`warehouseId\` varchar(36) NOT NULL, \`pickListId\` varchar(36) NULL, \`orderId\` varchar(36) NULL, \`fulfillmentId\` varchar(36) NULL, \`number\` varchar(32) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'OPEN', \`carrierKey\` varchar(64) NULL, \`packageCount\` int NOT NULL DEFAULT 1, \`totalWeight\` decimal(12,4) NULL, \`totalVolume\` decimal(12,4) NULL, \`trackingNumber\` varchar(255) NULL, \`labelUrl\` varchar(1024) NULL, \`packedAt\` datetime NULL, \`packedByUserId\` varchar(36) NULL, \`note\` text NULL, \`version\` int NOT NULL DEFAULT 1, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`carrierKeyKey\` varchar(64) GENERATED ALWAYS AS (IFNULL(\`carrierKey\`, '')) STORED, INDEX \`IDX_pack_slip_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_pack_slip_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_pack_slip_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_pack_slip_is_active\` (\`isActive\`), INDEX \`IDX_pack_slip_is_archived\` (\`isArchived\`), INDEX \`IDX_pack_slip_tenant\` (\`tenantId\`), INDEX \`IDX_pack_slip_organization\` (\`organizationId\`), INDEX \`IDX_pack_slip_fulfillment\` (\`fulfillmentId\`, \`status\`), INDEX \`IDX_pack_slip_warehouse_status\` (\`warehouseId\`, \`status\`, \`createdAt\`), INDEX \`IDX_pack_slip_pick_list\` (\`pickListId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_pack_slip_number\` ON \`pack_slip\` (\`organizationKey\`, \`warehouseId\`, \`number\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_pack_slip_tracking\` ON \`pack_slip\` (\`carrierKeyKey\`, \`trackingNumber\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`pack_slip\` ADD CONSTRAINT \`CHK_pack_slip_package_count\` CHECK (\`packageCount\` >= 1)`
		);
		await queryRunner.query(
			`ALTER TABLE \`pack_slip\` ADD CONSTRAINT \`FK_pack_slip_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pack_slip\` ADD CONSTRAINT \`FK_pack_slip_pick_list\` FOREIGN KEY (\`pickListId\`) REFERENCES \`pick_list\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pack_slip\` ADD CONSTRAINT \`FK_pack_slip_packed_by\` FOREIGN KEY (\`packedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`pick_list_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`pickListId\` varchar(36) NOT NULL, \`orderLineId\` varchar(36) NULL, \`fulfillmentLineId\` varchar(36) NULL, \`variantId\` varchar(36) NOT NULL, \`binId\` varchar(36) NULL, \`zoneId\` varchar(36) NULL, \`quantityRequested\` decimal(20,6) NOT NULL, \`quantityPicked\` decimal(20,6) NOT NULL DEFAULT 0, \`quantityShort\` decimal(20,6) NOT NULL DEFAULT 0, \`status\` varchar(16) NOT NULL DEFAULT 'PENDING', \`substituteVariantId\` varchar(36) NULL, \`substituteQuantity\` decimal(20,6) NULL, \`substitutionReason\` varchar(255) NULL, \`packSlipId\` varchar(36) NULL, \`position\` int NOT NULL DEFAULT 0, \`pickedAt\` datetime NULL, \`pickedByUserId\` varchar(36) NULL, \`lotNumber\` varchar(64) NULL, \`expiryDate\` date NULL, \`serialNumbers\` text NULL, \`note\` text NULL, \`metadata\` json NULL, INDEX \`IDX_pick_list_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_pick_list_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_pick_list_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_pick_list_line_is_active\` (\`isActive\`), INDEX \`IDX_pick_list_line_is_archived\` (\`isArchived\`), INDEX \`IDX_pick_list_line_tenant\` (\`tenantId\`), INDEX \`IDX_pick_list_line_organization\` (\`organizationId\`), INDEX \`IDX_pick_list_line_list\` (\`pickListId\`, \`position\`), INDEX \`IDX_pick_list_line_status\` (\`pickListId\`, \`status\`), INDEX \`IDX_pick_list_line_fulfillment\` (\`fulfillmentLineId\`), INDEX \`IDX_pick_list_line_bin\` (\`binId\`, \`status\`), INDEX \`IDX_pick_list_line_variant\` (\`variantId\`, \`status\`), INDEX \`IDX_pick_list_line_pack_slip\` (\`packSlipId\`), INDEX \`IDX_pick_list_line_order_line\` (\`orderLineId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list_line\` ADD CONSTRAINT \`CHK_pick_list_line_quantities\` CHECK (\`quantityPicked\` + \`quantityShort\` <= \`quantityRequested\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list_line\` ADD CONSTRAINT \`CHK_pick_list_line_substitute\` CHECK ((\`substituteVariantId\` IS NULL AND \`substituteQuantity\` IS NULL) OR (\`substituteVariantId\` IS NOT NULL AND \`substituteQuantity\` IS NOT NULL))`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list_line\` ADD CONSTRAINT \`FK_pick_list_line_list\` FOREIGN KEY (\`pickListId\`) REFERENCES \`pick_list\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list_line\` ADD CONSTRAINT \`FK_pick_list_line_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list_line\` ADD CONSTRAINT \`FK_pick_list_line_bin\` FOREIGN KEY (\`binId\`) REFERENCES \`warehouse_bin\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list_line\` ADD CONSTRAINT \`FK_pick_list_line_zone\` FOREIGN KEY (\`zoneId\`) REFERENCES \`warehouse_zone\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list_line\` ADD CONSTRAINT \`FK_pick_list_line_substitute\` FOREIGN KEY (\`substituteVariantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list_line\` ADD CONSTRAINT \`FK_pick_list_line_pack_slip\` FOREIGN KEY (\`packSlipId\`) REFERENCES \`pack_slip\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pick_list_line\` ADD CONSTRAINT \`FK_pick_list_line_picked_by\` FOREIGN KEY (\`pickedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`carrier_manifest\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`warehouseId\` varchar(36) NOT NULL, \`carrier\` varchar(64) NOT NULL, \`service\` varchar(64) NULL, \`number\` varchar(32) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'DRAFT', \`manifestDate\` date NOT NULL DEFAULT (CURRENT_DATE), \`windowFrom\` datetime NULL, \`windowTo\` datetime NULL, \`shipmentCount\` int NOT NULL DEFAULT 0, \`packageCount\` int NOT NULL DEFAULT 0, \`totalWeight\` decimal(12,4) NOT NULL DEFAULT 0, \`closedAt\` datetime NULL, \`handedOverAt\` datetime NULL, \`canceledAt\` datetime NULL, \`documentUrl\` varchar(1024) NULL, \`documentData\` json NULL, \`note\` text NULL, \`version\` int NOT NULL DEFAULT 1, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_carrier_manifest_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_carrier_manifest_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_carrier_manifest_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_carrier_manifest_is_active\` (\`isActive\`), INDEX \`IDX_carrier_manifest_is_archived\` (\`isArchived\`), INDEX \`IDX_carrier_manifest_tenant\` (\`tenantId\`), INDEX \`IDX_carrier_manifest_organization\` (\`organizationId\`), INDEX \`IDX_carrier_manifest_status\` (\`warehouseId\`, \`status\`, \`manifestDate\`), INDEX \`IDX_carrier_manifest_carrier\` (\`carrier\`, \`manifestDate\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_carrier_manifest_number\` ON \`carrier_manifest\` (\`organizationKey\`, \`warehouseId\`, \`number\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`carrier_manifest\` ADD CONSTRAINT \`FK_carrier_manifest_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE \`carrier_manifest\``);
		await queryRunner.query(`DROP TABLE \`pick_list_line\``);
		await queryRunner.query(`DROP TABLE \`pack_slip\``);
		await queryRunner.query(`DROP TABLE \`pick_list\``);
		await queryRunner.query(`DROP TABLE \`pick_wave\``);
	}
}
