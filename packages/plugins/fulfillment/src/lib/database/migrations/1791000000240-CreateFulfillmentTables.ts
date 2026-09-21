import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the fulfilment domain: shipping profiles, their variant attachments, the sellable shipping
 * options, and the shipments themselves.
 *
 * The order matters inside the set: `shipping_profile` before `shipping_profile_variant` and before
 * `shipping_option`, because both reference it; `fulfillment` before `fulfillment_line`, for the same
 * reason. Two columns reference tables this set does not own and both are created here without a
 * constraint, because their targets already exist by the time this set runs — the order line of a
 * fulfilment line, and the location a shipment leaves from. Both are plain identifiers with a foreign
 * key, added inline, since their targets are created earlier.
 *
 * The two foreign keys this set *is* responsible for — the cart's and the order's chosen shipping
 * option, whose target `shipping_option` is created here — are added by
 * `AddCartShippingOptionForeignKey1791000000250`, the companion file of this set.
 *
 * Partial unique indexes are the Postgres and SQLite form. MySQL has no filtered index, so its branch
 * carries each predicate in a stored generated key column instead, in the form
 * `CreateSequenceTable1791000000000` documents for the whole set. Where a rule has no index on that
 * dialect the comment beside it says so, and the tuple is enforced by the service inside the writing
 * transaction and audited by the `schema-uniqueness-audit` job.
 */
export class CreateFulfillmentTables1791000000240 implements MigrationInterface {
	name = 'CreateFulfillmentTables1791000000240';

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
			`CREATE TABLE "shipping_profile" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "code" character varying(64) NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "description" text, "metadata" jsonb, CONSTRAINT "PK_shipping_profile_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_created_by_user" ON "shipping_profile" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_updated_by_user" ON "shipping_profile" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_deleted_by_user" ON "shipping_profile" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_is_active" ON "shipping_profile" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_is_archived" ON "shipping_profile" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_tenant" ON "shipping_profile" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_organization" ON "shipping_profile" ("organizationId")`);
		// A code identifies a profile inside an organization.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_shipping_profile_org_code" ON "shipping_profile" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		// One default profile per organization: two would make a variant's shipping behaviour depend on
		// row order.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_shipping_profile_default" ON "shipping_profile" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\')) WHERE "isDefault" = true AND "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_code" ON "shipping_profile" ("code") WHERE "deletedAt" IS NULL`);

		await queryRunner.query(
			`CREATE TABLE "shipping_profile_variant" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "profileId" uuid NOT NULL, "variantId" uuid NOT NULL, "metadata" jsonb, CONSTRAINT "PK_shipping_profile_variant_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_created_by_user" ON "shipping_profile_variant" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_updated_by_user" ON "shipping_profile_variant" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_deleted_by_user" ON "shipping_profile_variant" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_variant_is_active" ON "shipping_profile_variant" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_is_archived" ON "shipping_profile_variant" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_variant_tenant" ON "shipping_profile_variant" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_organization" ON "shipping_profile_variant" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_shipping_profile_variant" ON "shipping_profile_variant" ("profileId", "variantId") WHERE "deletedAt" IS NULL`
		);
		// A variant belongs to **at most one** profile. The pair index above would happily allow the same
		// variant in two profiles; this one is what expresses the rule.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_shipping_profile_variant_one" ON "shipping_profile_variant" ("variantId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_profile" ON "shipping_profile_variant" ("profileId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_variant" ON "shipping_profile_variant" ("variantId")`
		);
		await queryRunner.query(
			`ALTER TABLE "shipping_profile_variant" ADD CONSTRAINT "FK_shipping_profile_variant_profile" FOREIGN KEY ("profileId") REFERENCES "shipping_profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "shipping_profile_variant" ADD CONSTRAINT "FK_shipping_profile_variant_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "shipping_option" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "code" character varying(64) NOT NULL, "priceType" character varying(16) NOT NULL DEFAULT 'FLAT', "amount" numeric(20,6), "currency" character varying(3), "isTaxInclusive" boolean NOT NULL DEFAULT false, "taxCategoryId" uuid, "providerKey" character varying(64), "profileId" uuid, "channelId" uuid, "regionId" uuid, "priority" integer NOT NULL DEFAULT 0, "estimatedMinDays" integer, "estimatedMaxDays" integer, "requiresShippingAddress" boolean NOT NULL DEFAULT true, "allowPickup" boolean NOT NULL DEFAULT false, "maxWeight" numeric(12,4), "maxItemCount" integer, "version" integer NOT NULL DEFAULT 1, "metadata" jsonb, CONSTRAINT "PK_shipping_option_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_created_by_user" ON "shipping_option" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_updated_by_user" ON "shipping_option" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_deleted_by_user" ON "shipping_option" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_is_active" ON "shipping_option" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_is_archived" ON "shipping_option" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_tenant" ON "shipping_option" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_organization" ON "shipping_option" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_shipping_option_org_code" ON "shipping_option" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		// The eligibility read: an active option of this organization, on this channel and region, in
		// priority order.
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_option_eligibility" ON "shipping_option" ("organizationId", "isActive", "channelId", "regionId", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_option_profile" ON "shipping_option" ("profileId") WHERE "profileId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_option_tax_category" ON "shipping_option" ("taxCategoryId") WHERE "taxCategoryId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_option_channel" ON "shipping_option" ("channelId") WHERE "channelId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_option_region" ON "shipping_option" ("regionId") WHERE "regionId" IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "shipping_option" ADD CONSTRAINT "CHK_shipping_option_days" CHECK ("estimatedMinDays" IS NULL OR "estimatedMaxDays" IS NULL OR "estimatedMinDays" <= "estimatedMaxDays")`
		);
		await queryRunner.query(
			`ALTER TABLE "shipping_option" ADD CONSTRAINT "FK_shipping_option_profile" FOREIGN KEY ("profileId") REFERENCES "shipping_profile"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "shipping_option" ADD CONSTRAINT "FK_shipping_option_channel" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "shipping_option" ADD CONSTRAINT "FK_shipping_option_region" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "fulfillment" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid NOT NULL, "direction" character varying(16) NOT NULL DEFAULT 'OUTBOUND', "warehouseId" uuid, "providerId" character varying(64), "status" character varying(16) NOT NULL DEFAULT 'PENDING', "trackingNumber" character varying(128), "trackingUrl" character varying(1024), "carrier" character varying(64), "service" character varying(64), "labelUrl" character varying(1024), "labelData" jsonb, "shippedAt" TIMESTAMP, "deliveredAt" TIMESTAMP, "canceledAt" TIMESTAMP, "requiresShipping" boolean NOT NULL DEFAULT true, "noNotification" boolean NOT NULL DEFAULT false, "note" text, "version" integer NOT NULL DEFAULT 1, "metadata" jsonb, CONSTRAINT "PK_fulfillment_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_created_by_user" ON "fulfillment" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_updated_by_user" ON "fulfillment" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_deleted_by_user" ON "fulfillment" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_is_active" ON "fulfillment" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_is_archived" ON "fulfillment" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_tenant" ON "fulfillment" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_organization" ON "fulfillment" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_order" ON "fulfillment" ("orderId", "direction", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_status" ON "fulfillment" ("organizationId", "status", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_tracking" ON "fulfillment" ("trackingNumber") WHERE "trackingNumber" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_warehouse" ON "fulfillment" ("warehouseId") WHERE "warehouseId" IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "fulfillment" ADD CONSTRAINT "FK_fulfillment_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "fulfillment" ADD CONSTRAINT "FK_fulfillment_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "fulfillment_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "fulfillmentId" uuid NOT NULL, "orderLineId" uuid NOT NULL, "quantity" numeric(20,6) NOT NULL, "warehouseId" uuid, "metadata" jsonb, CONSTRAINT "PK_fulfillment_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_created_by_user" ON "fulfillment_line" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_updated_by_user" ON "fulfillment_line" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_deleted_by_user" ON "fulfillment_line" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_is_active" ON "fulfillment_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_is_archived" ON "fulfillment_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_tenant" ON "fulfillment_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_organization" ON "fulfillment_line" ("organizationId")`);
		// One row per shipment and order line: a second partial shipment of the same line is a second
		// fulfilment, which is what keeps a picking list unambiguous.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_fulfillment_line" ON "fulfillment_line" ("fulfillmentId", "orderLineId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_line_order_line" ON "fulfillment_line" ("orderLineId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_line_warehouse" ON "fulfillment_line" ("warehouseId") WHERE "warehouseId" IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "fulfillment_line" ADD CONSTRAINT "CHK_fulfillment_line_positive" CHECK ("quantity" > 0)`
		);
		await queryRunner.query(
			`ALTER TABLE "fulfillment_line" ADD CONSTRAINT "FK_fulfillment_line_fulfillment" FOREIGN KEY ("fulfillmentId") REFERENCES "fulfillment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "fulfillment_line" ADD CONSTRAINT "FK_fulfillment_line_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "fulfillment_line" ADD CONSTRAINT "FK_fulfillment_line_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "fulfillment_line" DROP CONSTRAINT "FK_fulfillment_line_warehouse"`);
		await queryRunner.query(`ALTER TABLE "fulfillment_line" DROP CONSTRAINT "FK_fulfillment_line_order_line"`);
		await queryRunner.query(`ALTER TABLE "fulfillment_line" DROP CONSTRAINT "FK_fulfillment_line_fulfillment"`);
		await queryRunner.query(`ALTER TABLE "fulfillment_line" DROP CONSTRAINT "CHK_fulfillment_line_positive"`);
		await queryRunner.query(`DROP TABLE "fulfillment_line"`);
		await queryRunner.query(`ALTER TABLE "fulfillment" DROP CONSTRAINT "FK_fulfillment_warehouse"`);
		await queryRunner.query(`ALTER TABLE "fulfillment" DROP CONSTRAINT "FK_fulfillment_order"`);
		await queryRunner.query(`DROP TABLE "fulfillment"`);
		await queryRunner.query(`ALTER TABLE "shipping_option" DROP CONSTRAINT "FK_shipping_option_region"`);
		await queryRunner.query(`ALTER TABLE "shipping_option" DROP CONSTRAINT "FK_shipping_option_channel"`);
		await queryRunner.query(`ALTER TABLE "shipping_option" DROP CONSTRAINT "FK_shipping_option_profile"`);
		await queryRunner.query(`ALTER TABLE "shipping_option" DROP CONSTRAINT "CHK_shipping_option_days"`);
		await queryRunner.query(`DROP TABLE "shipping_option"`);
		await queryRunner.query(
			`ALTER TABLE "shipping_profile_variant" DROP CONSTRAINT "FK_shipping_profile_variant_variant"`
		);
		await queryRunner.query(
			`ALTER TABLE "shipping_profile_variant" DROP CONSTRAINT "FK_shipping_profile_variant_profile"`
		);
		await queryRunner.query(`DROP TABLE "shipping_profile_variant"`);
		await queryRunner.query(`DROP TABLE "shipping_profile"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "shipping_profile" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "description" text, "metadata" text)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_created_by_user" ON "shipping_profile" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_updated_by_user" ON "shipping_profile" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_deleted_by_user" ON "shipping_profile" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_is_active" ON "shipping_profile" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_is_archived" ON "shipping_profile" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_tenant" ON "shipping_profile" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_organization" ON "shipping_profile" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_shipping_profile_org_code" ON "shipping_profile" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_shipping_profile_default" ON "shipping_profile" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\')) WHERE "isDefault" = 1 AND "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_code" ON "shipping_profile" ("code") WHERE "deletedAt" IS NULL`);

		await queryRunner.query(
			`CREATE TABLE "shipping_profile_variant" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "profileId" varchar NOT NULL, "variantId" varchar NOT NULL, "metadata" text, CONSTRAINT "FK_shipping_profile_variant_profile" FOREIGN KEY ("profileId") REFERENCES "shipping_profile" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_shipping_profile_variant_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_created_by_user" ON "shipping_profile_variant" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_updated_by_user" ON "shipping_profile_variant" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_deleted_by_user" ON "shipping_profile_variant" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_variant_is_active" ON "shipping_profile_variant" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_is_archived" ON "shipping_profile_variant" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_profile_variant_tenant" ON "shipping_profile_variant" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_organization" ON "shipping_profile_variant" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_shipping_profile_variant" ON "shipping_profile_variant" ("profileId", "variantId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_shipping_profile_variant_one" ON "shipping_profile_variant" ("variantId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_profile" ON "shipping_profile_variant" ("profileId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_profile_variant_variant" ON "shipping_profile_variant" ("variantId")`
		);

		await queryRunner.query(
			`CREATE TABLE "shipping_option" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "priceType" varchar(16) NOT NULL DEFAULT ('FLAT'), "amount" numeric(20,6), "currency" varchar(3), "isTaxInclusive" boolean NOT NULL DEFAULT (0), "taxCategoryId" varchar, "providerKey" varchar(64), "profileId" varchar, "channelId" varchar, "regionId" varchar, "priority" integer NOT NULL DEFAULT (0), "estimatedMinDays" integer, "estimatedMaxDays" integer, "requiresShippingAddress" boolean NOT NULL DEFAULT (1), "allowPickup" boolean NOT NULL DEFAULT (0), "maxWeight" numeric(12,4), "maxItemCount" integer, "version" integer NOT NULL DEFAULT (1), "metadata" text, CONSTRAINT "FK_shipping_option_profile" FOREIGN KEY ("profileId") REFERENCES "shipping_profile" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_shipping_option_channel" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_shipping_option_region" FOREIGN KEY ("regionId") REFERENCES "region" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_created_by_user" ON "shipping_option" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_updated_by_user" ON "shipping_option" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_deleted_by_user" ON "shipping_option" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_is_active" ON "shipping_option" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_is_archived" ON "shipping_option" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_tenant" ON "shipping_option" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_shipping_option_organization" ON "shipping_option" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_shipping_option_org_code" ON "shipping_option" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_option_eligibility" ON "shipping_option" ("organizationId", "isActive", "channelId", "regionId", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_option_profile" ON "shipping_option" ("profileId") WHERE "profileId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_option_tax_category" ON "shipping_option" ("taxCategoryId") WHERE "taxCategoryId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_option_channel" ON "shipping_option" ("channelId") WHERE "channelId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_shipping_option_region" ON "shipping_option" ("regionId") WHERE "regionId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "fulfillment" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar NOT NULL, "direction" varchar(16) NOT NULL DEFAULT ('OUTBOUND'), "warehouseId" varchar, "providerId" varchar(64), "status" varchar(16) NOT NULL DEFAULT ('PENDING'), "trackingNumber" varchar(128), "trackingUrl" varchar(1024), "carrier" varchar(64), "service" varchar(64), "labelUrl" varchar(1024), "labelData" text, "shippedAt" datetime, "deliveredAt" datetime, "canceledAt" datetime, "requiresShipping" boolean NOT NULL DEFAULT (1), "noNotification" boolean NOT NULL DEFAULT (0), "note" text, "version" integer NOT NULL DEFAULT (1), "metadata" text, CONSTRAINT "FK_fulfillment_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fulfillment_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_created_by_user" ON "fulfillment" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_updated_by_user" ON "fulfillment" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_deleted_by_user" ON "fulfillment" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_is_active" ON "fulfillment" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_is_archived" ON "fulfillment" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_tenant" ON "fulfillment" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_organization" ON "fulfillment" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_order" ON "fulfillment" ("orderId", "direction", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_status" ON "fulfillment" ("organizationId", "status", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_tracking" ON "fulfillment" ("trackingNumber") WHERE "trackingNumber" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_warehouse" ON "fulfillment" ("warehouseId") WHERE "warehouseId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "fulfillment_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "fulfillmentId" varchar NOT NULL, "orderLineId" varchar NOT NULL, "quantity" numeric(20,6) NOT NULL, "warehouseId" varchar, "metadata" text, CONSTRAINT "FK_fulfillment_line_fulfillment" FOREIGN KEY ("fulfillmentId") REFERENCES "fulfillment" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fulfillment_line_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fulfillment_line_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_created_by_user" ON "fulfillment_line" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_updated_by_user" ON "fulfillment_line" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_deleted_by_user" ON "fulfillment_line" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_is_active" ON "fulfillment_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_is_archived" ON "fulfillment_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_tenant" ON "fulfillment_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_fulfillment_line_organization" ON "fulfillment_line" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_fulfillment_line" ON "fulfillment_line" ("fulfillmentId", "orderLineId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_line_order_line" ON "fulfillment_line" ("orderLineId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fulfillment_line_warehouse" ON "fulfillment_line" ("warehouseId") WHERE "warehouseId" IS NOT NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_line_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_line_order_line"`);
		await queryRunner.query(`DROP INDEX "UQ_fulfillment_line"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "fulfillment_line"`);

		await queryRunner.query(`DROP INDEX "IDX_fulfillment_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_tracking"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_status"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_order"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_fulfillment_created_by_user"`);
		await queryRunner.query(`DROP TABLE "fulfillment"`);

		await queryRunner.query(`DROP INDEX "IDX_shipping_option_region"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_option_channel"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_option_tax_category"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_option_profile"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_option_eligibility"`);
		await queryRunner.query(`DROP INDEX "UQ_shipping_option_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_option_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_option_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_option_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_option_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_option_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_option_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_option_created_by_user"`);
		await queryRunner.query(`DROP TABLE "shipping_option"`);

		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_variant_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_variant_profile"`);
		await queryRunner.query(`DROP INDEX "UQ_shipping_profile_variant_one"`);
		await queryRunner.query(`DROP INDEX "UQ_shipping_profile_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_variant_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_variant_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_variant_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_variant_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_variant_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_variant_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_variant_created_by_user"`);
		await queryRunner.query(`DROP TABLE "shipping_profile_variant"`);

		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_code"`);
		await queryRunner.query(`DROP INDEX "UQ_shipping_profile_default"`);
		await queryRunner.query(`DROP INDEX "UQ_shipping_profile_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_shipping_profile_created_by_user"`);
		await queryRunner.query(`DROP TABLE "shipping_profile"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`shipping_profile\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NOT NULL, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`description\` text NULL, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_shipping_profile_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_shipping_profile_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_shipping_profile_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_shipping_profile_is_active\` (\`isActive\`), INDEX \`IDX_shipping_profile_is_archived\` (\`isArchived\`), INDEX \`IDX_shipping_profile_tenant\` (\`tenantId\`), INDEX \`IDX_shipping_profile_organization\` (\`organizationId\`), INDEX \`IDX_shipping_profile_code\` (\`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// MySQL has no filtered index, so "one code per organization" is carried by the generated key
		// columns declared above — `organizationKey` for the nullable scope, `deletedKey` for the
		// soft-delete predicate. "One default profile per organization" has no index on this dialect at
		// all and stays with ShippingProfileService inside the writing transaction, audited by the
		// schema-uniqueness-audit job; a boolean key of the `isDefaultKey` shape would express it.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_shipping_profile_org_code\` ON \`shipping_profile\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_shipping_profile_default\` ON \`shipping_profile\` (\`organizationId\`, \`isDefault\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`shipping_profile_variant\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`profileId\` varchar(36) NOT NULL, \`variantId\` varchar(36) NOT NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_shipping_profile_variant_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_shipping_profile_variant_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_shipping_profile_variant_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_shipping_profile_variant_is_active\` (\`isActive\`), INDEX \`IDX_shipping_profile_variant_is_archived\` (\`isArchived\`), INDEX \`IDX_shipping_profile_variant_tenant\` (\`tenantId\`), INDEX \`IDX_shipping_profile_variant_organization\` (\`organizationId\`), INDEX \`IDX_shipping_profile_variant_profile\` (\`profileId\`), INDEX \`IDX_shipping_profile_variant_variant\` (\`variantId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// "A variant belongs to at most one profile" is enforced by ShippingProfileService.assignVariants,
		// which moves an existing attachment rather than inserting a second row, and audited by the
		// schema-uniqueness-audit job. The pair key below is the narrower rule the index does carry: one
		// row per profile and variant among the live rows, through the table's `deletedKey`.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_shipping_profile_variant\` ON \`shipping_profile_variant\` (\`profileId\`, \`variantId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`shipping_profile_variant\` ADD CONSTRAINT \`FK_shipping_profile_variant_profile\` FOREIGN KEY (\`profileId\`) REFERENCES \`shipping_profile\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`shipping_profile_variant\` ADD CONSTRAINT \`FK_shipping_profile_variant_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`shipping_option\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NOT NULL, \`priceType\` varchar(16) NOT NULL DEFAULT 'FLAT', \`amount\` decimal(20,6) NULL, \`currency\` varchar(3) NULL, \`isTaxInclusive\` tinyint NOT NULL DEFAULT 0, \`taxCategoryId\` varchar(36) NULL, \`providerKey\` varchar(64) NULL, \`profileId\` varchar(36) NULL, \`channelId\` varchar(36) NULL, \`regionId\` varchar(36) NULL, \`priority\` int NOT NULL DEFAULT 0, \`estimatedMinDays\` int NULL, \`estimatedMaxDays\` int NULL, \`requiresShippingAddress\` tinyint NOT NULL DEFAULT 1, \`allowPickup\` tinyint NOT NULL DEFAULT 0, \`maxWeight\` decimal(12,4) NULL, \`maxItemCount\` int NULL, \`version\` int NOT NULL DEFAULT 1, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_shipping_option_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_shipping_option_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_shipping_option_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_shipping_option_is_active\` (\`isActive\`), INDEX \`IDX_shipping_option_is_archived\` (\`isArchived\`), INDEX \`IDX_shipping_option_tenant\` (\`tenantId\`), INDEX \`IDX_shipping_option_organization\` (\`organizationId\`), INDEX \`IDX_shipping_option_eligibility\` (\`organizationId\`, \`isActive\`, \`channelId\`, \`regionId\`, \`priority\`), INDEX \`IDX_shipping_option_profile\` (\`profileId\`), INDEX \`IDX_shipping_option_tax_category\` (\`taxCategoryId\`), INDEX \`IDX_shipping_option_channel\` (\`channelId\`), INDEX \`IDX_shipping_option_region\` (\`regionId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_shipping_option_org_code\` ON \`shipping_option\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`shipping_option\` ADD CONSTRAINT \`CHK_shipping_option_days\` CHECK (\`estimatedMinDays\` IS NULL OR \`estimatedMaxDays\` IS NULL OR \`estimatedMinDays\` <= \`estimatedMaxDays\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`shipping_option\` ADD CONSTRAINT \`FK_shipping_option_profile\` FOREIGN KEY (\`profileId\`) REFERENCES \`shipping_profile\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`shipping_option\` ADD CONSTRAINT \`FK_shipping_option_channel\` FOREIGN KEY (\`channelId\`) REFERENCES \`channel\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`shipping_option\` ADD CONSTRAINT \`FK_shipping_option_region\` FOREIGN KEY (\`regionId\`) REFERENCES \`region\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`fulfillment\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NOT NULL, \`direction\` varchar(16) NOT NULL DEFAULT 'OUTBOUND', \`warehouseId\` varchar(36) NULL, \`providerId\` varchar(64) NULL, \`status\` varchar(16) NOT NULL DEFAULT 'PENDING', \`trackingNumber\` varchar(128) NULL, \`trackingUrl\` varchar(1024) NULL, \`carrier\` varchar(64) NULL, \`service\` varchar(64) NULL, \`labelUrl\` varchar(1024) NULL, \`labelData\` json NULL, \`shippedAt\` datetime NULL, \`deliveredAt\` datetime NULL, \`canceledAt\` datetime NULL, \`requiresShipping\` tinyint NOT NULL DEFAULT 1, \`noNotification\` tinyint NOT NULL DEFAULT 0, \`note\` text NULL, \`version\` int NOT NULL DEFAULT 1, \`metadata\` json NULL, INDEX \`IDX_fulfillment_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_fulfillment_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_fulfillment_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_fulfillment_is_active\` (\`isActive\`), INDEX \`IDX_fulfillment_is_archived\` (\`isArchived\`), INDEX \`IDX_fulfillment_tenant\` (\`tenantId\`), INDEX \`IDX_fulfillment_organization\` (\`organizationId\`), INDEX \`IDX_fulfillment_order\` (\`orderId\`, \`direction\`, \`status\`), INDEX \`IDX_fulfillment_status\` (\`organizationId\`, \`status\`, \`createdAt\`), INDEX \`IDX_fulfillment_tracking\` (\`trackingNumber\`), INDEX \`IDX_fulfillment_warehouse\` (\`warehouseId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`fulfillment\` ADD CONSTRAINT \`FK_fulfillment_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`fulfillment\` ADD CONSTRAINT \`FK_fulfillment_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`fulfillment_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`fulfillmentId\` varchar(36) NOT NULL, \`orderLineId\` varchar(36) NOT NULL, \`quantity\` decimal(20,6) NOT NULL, \`warehouseId\` varchar(36) NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_fulfillment_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_fulfillment_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_fulfillment_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_fulfillment_line_is_active\` (\`isActive\`), INDEX \`IDX_fulfillment_line_is_archived\` (\`isArchived\`), INDEX \`IDX_fulfillment_line_tenant\` (\`tenantId\`), INDEX \`IDX_fulfillment_line_organization\` (\`organizationId\`), INDEX \`IDX_fulfillment_line_order_line\` (\`orderLineId\`), INDEX \`IDX_fulfillment_line_warehouse\` (\`warehouseId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_fulfillment_line\` ON \`fulfillment_line\` (\`fulfillmentId\`, \`orderLineId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`fulfillment_line\` ADD CONSTRAINT \`CHK_fulfillment_line_positive\` CHECK (\`quantity\` > 0)`
		);
		await queryRunner.query(
			`ALTER TABLE \`fulfillment_line\` ADD CONSTRAINT \`FK_fulfillment_line_fulfillment\` FOREIGN KEY (\`fulfillmentId\`) REFERENCES \`fulfillment\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`fulfillment_line\` ADD CONSTRAINT \`FK_fulfillment_line_order_line\` FOREIGN KEY (\`orderLineId\`) REFERENCES \`order_line\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`fulfillment_line\` ADD CONSTRAINT \`FK_fulfillment_line_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`fulfillment_line\` DROP FOREIGN KEY \`FK_fulfillment_line_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`fulfillment_line\` DROP FOREIGN KEY \`FK_fulfillment_line_order_line\``);
		await queryRunner.query(`ALTER TABLE \`fulfillment_line\` DROP FOREIGN KEY \`FK_fulfillment_line_fulfillment\``);
		await queryRunner.query(`DROP TABLE \`fulfillment_line\``);
		await queryRunner.query(`ALTER TABLE \`fulfillment\` DROP FOREIGN KEY \`FK_fulfillment_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`fulfillment\` DROP FOREIGN KEY \`FK_fulfillment_order\``);
		await queryRunner.query(`DROP TABLE \`fulfillment\``);
		await queryRunner.query(`ALTER TABLE \`shipping_option\` DROP FOREIGN KEY \`FK_shipping_option_region\``);
		await queryRunner.query(`ALTER TABLE \`shipping_option\` DROP FOREIGN KEY \`FK_shipping_option_channel\``);
		await queryRunner.query(`ALTER TABLE \`shipping_option\` DROP FOREIGN KEY \`FK_shipping_option_profile\``);
		await queryRunner.query(`DROP TABLE \`shipping_option\``);
		await queryRunner.query(
			`ALTER TABLE \`shipping_profile_variant\` DROP FOREIGN KEY \`FK_shipping_profile_variant_variant\``
		);
		await queryRunner.query(
			`ALTER TABLE \`shipping_profile_variant\` DROP FOREIGN KEY \`FK_shipping_profile_variant_profile\``
		);
		await queryRunner.query(`DROP TABLE \`shipping_profile_variant\``);
		await queryRunner.query(`DROP TABLE \`shipping_profile\``);
	}
}
