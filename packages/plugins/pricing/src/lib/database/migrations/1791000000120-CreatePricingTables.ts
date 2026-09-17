import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the pricing tables.
 *
 * Four tables, each with one job: `price_list` is a named, scoped, time-boxed set of prices;
 * `product_price` is what one product variant costs — the single place in the platform that answers
 * that question; `price_preference` says how a currency, region or channel presents prices; and
 * `exchange_rate` converts between two currencies from an instant.
 *
 * Three decisions in this file are load-bearing:
 *
 * 1. **Money is `numeric(20,6)` with a sibling currency column, and a rate is `numeric(20,10)`.**
 *    Nothing is a float: a binary fraction cannot hold a cent exactly, and a price that rounds
 *    differently on two rows is a defect a customer notices.
 * 2. **Business uniqueness is a partial unique index with the predicate `deletedAt IS NULL`.** Every
 *    table here is soft-deletable, so a plain `UNIQUE` would keep a deleted row's key occupied
 *    forever and prevent a legitimate re-create. Postgres and SQLite support the partial form
 *    directly; MySQL does not, and the fallback documented on each unique index there is used
 *    instead of silently weakening the rule.
 * 3. **A variant's price cascades with the variant, and a list's prices cascade with the list.** A
 *    price is part of both, so it is removed with either rather than blocking it — the deliberate
 *    deviation from the rule that a mandatory reference to a master row restricts deletion.
 *
 * The optional references — a channel, a region, a customer group — are `SET NULL`, because a list
 * that named a channel must survive that channel being deleted and simply stop being scoped by it.
 */
export class CreatePricingTables1791000000120 implements MigrationInterface {
	name = 'CreatePricingTables1791000000120';

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
			`CREATE TABLE "price_list" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "code" character varying(64) NOT NULL, "description" text, "type" character varying(16) NOT NULL DEFAULT 'SALE', "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "priority" integer NOT NULL DEFAULT 0, "currency" character varying(3), "channelId" uuid, "customerGroupId" uuid, "regionId" uuid, "startsAt" TIMESTAMP, "endsAt" TIMESTAMP, "isTaxInclusive" boolean NOT NULL DEFAULT false, "metadata" jsonb, CONSTRAINT "PK_price_list_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_created_by_user" ON "price_list" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_updated_by_user" ON "price_list" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_deleted_by_user" ON "price_list" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_is_active" ON "price_list" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_is_archived" ON "price_list" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_tenant" ON "price_list" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_organization" ON "price_list" ("organizationId")`);
		// One list per code per organization: a code is how an integration addresses a list, so a
		// second live one would make an import write to whichever row the planner reached first.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_price_list_org_code" ON "price_list" ("organizationId", "code") WHERE "deletedAt" IS NULL`
		);
		// Eligibility is a predicate over the status and the window, which is what a resolution asks
		// first: which lists are in force right now.
		await queryRunner.query(
			`CREATE INDEX "IDX_price_list_window" ON "price_list" ("organizationId", "status", "startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_list_priority" ON "price_list" ("priority") WHERE "deletedAt" IS NULL`
		);
		// The scope tuple: a list is narrowed by channel, region, customer group and currency, and a
		// resolution looks for the lists that name any of them.
		await queryRunner.query(
			`CREATE INDEX "IDX_price_list_scope" ON "price_list" ("channelId", "regionId", "customerGroupId", "currency") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "price_list" ADD CONSTRAINT "FK_price_list_channel" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "price_list" ADD CONSTRAINT "FK_price_list_region" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "price_list" ADD CONSTRAINT "FK_price_list_customer_group" FOREIGN KEY ("customerGroupId") REFERENCES "contact_group"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "product_price" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "priceListId" uuid, "variantId" uuid NOT NULL, "currency" character varying(3) NOT NULL, "amount" numeric(20,6) NOT NULL, "compareAtAmount" numeric(20,6), "costAmount" numeric(20,6), "minQuantity" numeric(20,6), "maxQuantity" numeric(20,6), "taxInclusive" boolean, "minMarginPercent" numeric(9,6), "maxDiscountPercent" numeric(9,6), "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "startsAt" TIMESTAMP, "endsAt" TIMESTAMP, "metadata" jsonb, CONSTRAINT "CHK_price_tier_bounds" CHECK ("minQuantity" IS NULL OR "maxQuantity" IS NULL OR "minQuantity" <= "maxQuantity"), CONSTRAINT "CHK_price_amount_nonneg" CHECK ("amount" >= 0), CONSTRAINT "PK_product_price_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_price_created_by_user" ON "product_price" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_price_updated_by_user" ON "product_price" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_price_deleted_by_user" ON "product_price" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_product_price_is_active" ON "product_price" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_price_is_archived" ON "product_price" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_price_tenant" ON "product_price" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_price_organization" ON "product_price" ("organizationId")`);
		// The resolution's own lookup: a variant's prices in one currency that are active.
		await queryRunner.query(
			`CREATE INDEX "IDX_price_variant_ccy_status" ON "product_price" ("variantId", "currency", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_list" ON "product_price" ("priceListId") WHERE "priceListId" IS NOT NULL`
		);
		// The scheduled-price lookup: a price's own window narrows its list's window rather than
		// replacing it, so both are read together.
		await queryRunner.query(
			`CREATE INDEX "IDX_price_window" ON "product_price" ("variantId", "status", "startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_org_created" ON "product_price" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);
		// Exact duplicates are refused here; overlapping quantity bands are refused by the service,
		// because a band is a range and no index can see that two ranges intersect.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_price_tier" ON "product_price" ("variantId", "currency", "priceListId", "minQuantity", "maxQuantity") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "product_price" ADD CONSTRAINT "FK_product_price_price_list" FOREIGN KEY ("priceListId") REFERENCES "price_list"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_price" ADD CONSTRAINT "FK_product_price_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "price_preference" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "attribute" character varying(16) NOT NULL, "value" character varying(64) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_price_preference_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_preference_created_by_user" ON "price_preference" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_preference_updated_by_user" ON "price_preference" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_preference_deleted_by_user" ON "price_preference" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_price_preference_is_active" ON "price_preference" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_preference_is_archived" ON "price_preference" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_price_preference_tenant" ON "price_preference" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_preference_organization" ON "price_preference" ("organizationId")`
		);
		// One answer per scope: two answers for one scope would make a displayed price depend on row
		// order.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_price_preference" ON "price_preference" ("organizationId", "attribute", "value") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "exchange_rate" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "fromCurrency" character varying(3) NOT NULL, "toCurrency" character varying(3) NOT NULL, "rate" numeric(20,10) NOT NULL, "providerKey" character varying(64), "validFrom" TIMESTAMP NOT NULL, "validUntil" TIMESTAMP, "isManual" boolean NOT NULL DEFAULT false, CONSTRAINT "CHK_exchange_rate_pair" CHECK ("fromCurrency" <> "toCurrency"), CONSTRAINT "CHK_exchange_rate_positive" CHECK ("rate" > 0), CONSTRAINT "PK_exchange_rate_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_created_by_user" ON "exchange_rate" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_updated_by_user" ON "exchange_rate" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_deleted_by_user" ON "exchange_rate" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_is_active" ON "exchange_rate" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_is_archived" ON "exchange_rate" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_tenant" ON "exchange_rate" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_organization" ON "exchange_rate" ("organizationId")`);
		// Re-quoting the same pair on the same day updates the row; quoting it for another day adds one.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_exchange_rate" ON "exchange_rate" ("organizationId", "fromCurrency", "toCurrency", "validFrom") WHERE "deletedAt" IS NULL`
		);
		// The rate in force at an instant is the row with the greatest validFrom at or before it whose
		// validUntil has not passed, which is exactly this tuple.
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_rate_lookup" ON "exchange_rate" ("organizationId", "fromCurrency", "toCurrency", "validFrom", "validUntil") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "product_price" DROP CONSTRAINT "FK_product_price_variant"`);
		await queryRunner.query(`ALTER TABLE "product_price" DROP CONSTRAINT "FK_product_price_price_list"`);
		await queryRunner.query(`ALTER TABLE "price_list" DROP CONSTRAINT "FK_price_list_customer_group"`);
		await queryRunner.query(`ALTER TABLE "price_list" DROP CONSTRAINT "FK_price_list_region"`);
		await queryRunner.query(`ALTER TABLE "price_list" DROP CONSTRAINT "FK_price_list_channel"`);
		await queryRunner.query(`DROP TABLE "exchange_rate"`);
		await queryRunner.query(`DROP TABLE "price_preference"`);
		await queryRunner.query(`DROP TABLE "product_price"`);
		await queryRunner.query(`DROP TABLE "price_list"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "price_list" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "description" text, "type" varchar(16) NOT NULL DEFAULT ('SALE'), "status" varchar(16) NOT NULL DEFAULT ('DRAFT'), "priority" integer NOT NULL DEFAULT (0), "currency" varchar(3), "channelId" varchar, "customerGroupId" varchar, "regionId" varchar, "startsAt" datetime, "endsAt" datetime, "isTaxInclusive" boolean NOT NULL DEFAULT (0), "metadata" text, CONSTRAINT "FK_price_list_channel" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_price_list_region" FOREIGN KEY ("regionId") REFERENCES "region" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_price_list_customer_group" FOREIGN KEY ("customerGroupId") REFERENCES "contact_group" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_created_by_user" ON "price_list" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_updated_by_user" ON "price_list" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_deleted_by_user" ON "price_list" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_is_active" ON "price_list" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_is_archived" ON "price_list" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_tenant" ON "price_list" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_price_list_organization" ON "price_list" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_price_list_org_code" ON "price_list" ("organizationId", "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_list_window" ON "price_list" ("organizationId", "status", "startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_list_priority" ON "price_list" ("priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_list_scope" ON "price_list" ("channelId", "regionId", "customerGroupId", "currency") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "product_price" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "priceListId" varchar, "variantId" varchar NOT NULL, "currency" varchar(3) NOT NULL, "amount" numeric(20,6) NOT NULL, "compareAtAmount" numeric(20,6), "costAmount" numeric(20,6), "minQuantity" numeric(20,6), "maxQuantity" numeric(20,6), "taxInclusive" boolean, "minMarginPercent" numeric(9,6), "maxDiscountPercent" numeric(9,6), "status" varchar(16) NOT NULL DEFAULT ('ACTIVE'), "startsAt" datetime, "endsAt" datetime, "metadata" text, CONSTRAINT "CHK_price_tier_bounds" CHECK ("minQuantity" IS NULL OR "maxQuantity" IS NULL OR "minQuantity" <= "maxQuantity"), CONSTRAINT "CHK_price_amount_nonneg" CHECK ("amount" >= 0), CONSTRAINT "FK_product_price_price_list" FOREIGN KEY ("priceListId") REFERENCES "price_list" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_product_price_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_price_created_by_user" ON "product_price" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_price_updated_by_user" ON "product_price" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_price_deleted_by_user" ON "product_price" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_product_price_is_active" ON "product_price" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_price_is_archived" ON "product_price" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_price_tenant" ON "product_price" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_price_organization" ON "product_price" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_variant_ccy_status" ON "product_price" ("variantId", "currency", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_list" ON "product_price" ("priceListId") WHERE "priceListId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_window" ON "product_price" ("variantId", "status", "startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_org_created" ON "product_price" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_price_tier" ON "product_price" ("variantId", "currency", "priceListId", "minQuantity", "maxQuantity") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "price_preference" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "attribute" varchar(16) NOT NULL, "value" varchar(64) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT (0))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_preference_created_by_user" ON "price_preference" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_preference_updated_by_user" ON "price_preference" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_preference_deleted_by_user" ON "price_preference" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_price_preference_is_active" ON "price_preference" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_preference_is_archived" ON "price_preference" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_price_preference_tenant" ON "price_preference" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_price_preference_organization" ON "price_preference" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_price_preference" ON "price_preference" ("organizationId", "attribute", "value") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "exchange_rate" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "fromCurrency" varchar(3) NOT NULL, "toCurrency" varchar(3) NOT NULL, "rate" numeric(20,10) NOT NULL, "providerKey" varchar(64), "validFrom" datetime NOT NULL, "validUntil" datetime, "isManual" boolean NOT NULL DEFAULT (0), CONSTRAINT "CHK_exchange_rate_pair" CHECK ("fromCurrency" <> "toCurrency"), CONSTRAINT "CHK_exchange_rate_positive" CHECK ("rate" > 0))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_created_by_user" ON "exchange_rate" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_updated_by_user" ON "exchange_rate" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_deleted_by_user" ON "exchange_rate" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_is_active" ON "exchange_rate" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_is_archived" ON "exchange_rate" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_tenant" ON "exchange_rate" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_rate_organization" ON "exchange_rate" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_exchange_rate" ON "exchange_rate" ("organizationId", "fromCurrency", "toCurrency", "validFrom") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_rate_lookup" ON "exchange_rate" ("organizationId", "fromCurrency", "toCurrency", "validFrom", "validUntil") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_exchange_rate_lookup"`);
		await queryRunner.query(`DROP INDEX "UQ_exchange_rate"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_rate_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_rate_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_rate_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_rate_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_rate_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_rate_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_rate_created_by_user"`);
		await queryRunner.query(`DROP TABLE "exchange_rate"`);

		await queryRunner.query(`DROP INDEX "UQ_price_preference"`);
		await queryRunner.query(`DROP INDEX "IDX_price_preference_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_price_preference_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_price_preference_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_price_preference_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_price_preference_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_price_preference_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_price_preference_created_by_user"`);
		await queryRunner.query(`DROP TABLE "price_preference"`);

		await queryRunner.query(`DROP INDEX "UQ_price_tier"`);
		await queryRunner.query(`DROP INDEX "IDX_price_org_created"`);
		await queryRunner.query(`DROP INDEX "IDX_price_window"`);
		await queryRunner.query(`DROP INDEX "IDX_price_list"`);
		await queryRunner.query(`DROP INDEX "IDX_price_variant_ccy_status"`);
		await queryRunner.query(`DROP INDEX "IDX_product_price_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_product_price_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_product_price_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_product_price_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_product_price_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_product_price_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_product_price_created_by_user"`);
		await queryRunner.query(`DROP TABLE "product_price"`);

		await queryRunner.query(`DROP INDEX "IDX_price_list_scope"`);
		await queryRunner.query(`DROP INDEX "IDX_price_list_priority"`);
		await queryRunner.query(`DROP INDEX "IDX_price_list_window"`);
		await queryRunner.query(`DROP INDEX "UQ_price_list_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_price_list_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_price_list_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_price_list_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_price_list_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_price_list_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_price_list_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_price_list_created_by_user"`);
		await queryRunner.query(`DROP TABLE "price_list"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so every unique rule whose predicate is `deletedAt IS NULL` is
	 * expressed with the documented fallback: a stored generated column that is `'0'` for a live row
	 * and the row's own identifier for a deleted one, appended to the key. Live rows therefore collide
	 * on the tuple and deleted rows never do. A nullable member of a tuple (a tier's `priceListId`, its
	 * quantity bounds) is still distinct-from-null on this dialect, so the service refuses an
	 * overlapping or duplicated band as well — the index alone could not see it there.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`price_list\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NOT NULL, \`description\` text NULL, \`type\` varchar(16) NOT NULL DEFAULT 'SALE', \`status\` varchar(16) NOT NULL DEFAULT 'DRAFT', \`priority\` int NOT NULL DEFAULT 0, \`currency\` varchar(3) NULL, \`channelId\` varchar(36) NULL, \`customerGroupId\` varchar(36) NULL, \`regionId\` varchar(36) NULL, \`startsAt\` datetime NULL, \`endsAt\` datetime NULL, \`isTaxInclusive\` tinyint NOT NULL DEFAULT 0, \`metadata\` json NULL, INDEX \`IDX_price_list_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_price_list_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_price_list_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_price_list_is_active\` (\`isActive\`), INDEX \`IDX_price_list_is_archived\` (\`isArchived\`), INDEX \`IDX_price_list_tenant\` (\`tenantId\`), INDEX \`IDX_price_list_organization\` (\`organizationId\`), INDEX \`IDX_price_list_window\` (\`organizationId\`, \`status\`, \`startsAt\`, \`endsAt\`), INDEX \`IDX_price_list_priority\` (\`priority\`), INDEX \`IDX_price_list_scope\` (\`channelId\`, \`regionId\`, \`customerGroupId\`, \`currency\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`price_list\` ADD COLUMN \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_price_list_org_code\` ON \`price_list\` (\`organizationId\`, \`code\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`price_list\` ADD CONSTRAINT \`FK_price_list_channel\` FOREIGN KEY (\`channelId\`) REFERENCES \`channel\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`price_list\` ADD CONSTRAINT \`FK_price_list_region\` FOREIGN KEY (\`regionId\`) REFERENCES \`region\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`price_list\` ADD CONSTRAINT \`FK_price_list_customer_group\` FOREIGN KEY (\`customerGroupId\`) REFERENCES \`contact_group\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`product_price\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`priceListId\` varchar(36) NULL, \`variantId\` varchar(36) NOT NULL, \`currency\` varchar(3) NOT NULL, \`amount\` decimal(20,6) NOT NULL, \`compareAtAmount\` decimal(20,6) NULL, \`costAmount\` decimal(20,6) NULL, \`minQuantity\` decimal(20,6) NULL, \`maxQuantity\` decimal(20,6) NULL, \`taxInclusive\` tinyint NULL, \`minMarginPercent\` decimal(9,6) NULL, \`maxDiscountPercent\` decimal(9,6) NULL, \`status\` varchar(16) NOT NULL DEFAULT 'ACTIVE', \`startsAt\` datetime NULL, \`endsAt\` datetime NULL, \`metadata\` json NULL, INDEX \`IDX_product_price_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_product_price_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_product_price_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_product_price_is_active\` (\`isActive\`), INDEX \`IDX_product_price_is_archived\` (\`isArchived\`), INDEX \`IDX_product_price_tenant\` (\`tenantId\`), INDEX \`IDX_product_price_organization\` (\`organizationId\`), INDEX \`IDX_price_variant_ccy_status\` (\`variantId\`, \`currency\`, \`status\`), INDEX \`IDX_price_list\` (\`priceListId\`), INDEX \`IDX_price_window\` (\`variantId\`, \`status\`, \`startsAt\`, \`endsAt\`), INDEX \`IDX_price_org_created\` (\`organizationId\`, \`createdAt\`), CONSTRAINT \`CHK_price_tier_bounds\` CHECK (\`minQuantity\` IS NULL OR \`maxQuantity\` IS NULL OR \`minQuantity\` <= \`maxQuantity\`), CONSTRAINT \`CHK_price_amount_nonneg\` CHECK (\`amount\` >= 0), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_price\` ADD COLUMN \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_price_tier\` ON \`product_price\` (\`variantId\`, \`currency\`, \`priceListId\`, \`minQuantity\`, \`maxQuantity\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_price\` ADD CONSTRAINT \`FK_product_price_price_list\` FOREIGN KEY (\`priceListId\`) REFERENCES \`price_list\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_price\` ADD CONSTRAINT \`FK_product_price_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`price_preference\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`attribute\` varchar(16) NOT NULL, \`value\` varchar(64) NOT NULL, \`isTaxInclusive\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_price_preference_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_price_preference_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_price_preference_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_price_preference_is_active\` (\`isActive\`), INDEX \`IDX_price_preference_is_archived\` (\`isArchived\`), INDEX \`IDX_price_preference_tenant\` (\`tenantId\`), INDEX \`IDX_price_preference_organization\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`price_preference\` ADD COLUMN \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_price_preference\` ON \`price_preference\` (\`organizationId\`, \`attribute\`, \`value\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`exchange_rate\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`fromCurrency\` varchar(3) NOT NULL, \`toCurrency\` varchar(3) NOT NULL, \`rate\` decimal(20,10) NOT NULL, \`providerKey\` varchar(64) NULL, \`validFrom\` datetime NOT NULL, \`validUntil\` datetime NULL, \`isManual\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_exchange_rate_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_exchange_rate_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_exchange_rate_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_exchange_rate_is_active\` (\`isActive\`), INDEX \`IDX_exchange_rate_is_archived\` (\`isArchived\`), INDEX \`IDX_exchange_rate_tenant\` (\`tenantId\`), INDEX \`IDX_exchange_rate_organization\` (\`organizationId\`), INDEX \`IDX_exchange_rate_lookup\` (\`organizationId\`, \`fromCurrency\`, \`toCurrency\`, \`validFrom\`, \`validUntil\`), CONSTRAINT \`CHK_exchange_rate_pair\` CHECK (\`fromCurrency\` <> \`toCurrency\`), CONSTRAINT \`CHK_exchange_rate_positive\` CHECK (\`rate\` > 0), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`exchange_rate\` ADD COLUMN \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_exchange_rate\` ON \`exchange_rate\` (\`organizationId\`, \`fromCurrency\`, \`toCurrency\`, \`validFrom\`, \`deletedKey\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE \`exchange_rate\``);
		await queryRunner.query(`DROP TABLE \`price_preference\``);
		await queryRunner.query(`ALTER TABLE \`product_price\` DROP FOREIGN KEY \`FK_product_price_variant\``);
		await queryRunner.query(`ALTER TABLE \`product_price\` DROP FOREIGN KEY \`FK_product_price_price_list\``);
		await queryRunner.query(`DROP TABLE \`product_price\``);
		await queryRunner.query(`ALTER TABLE \`price_list\` DROP FOREIGN KEY \`FK_price_list_customer_group\``);
		await queryRunner.query(`ALTER TABLE \`price_list\` DROP FOREIGN KEY \`FK_price_list_region\``);
		await queryRunner.query(`ALTER TABLE \`price_list\` DROP FOREIGN KEY \`FK_price_list_channel\``);
		await queryRunner.query(`DROP TABLE \`price_list\``);
	}
}
