import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the promotion domain: campaigns and their budgets, promotions and their actions, the
 * coupons that grant them, the usage ledger, and the gift-card instrument with its ledger.
 *
 * Three decisions in this file are worth reading before changing it.
 *
 * 1. **Conditions are not columns.** A promotion's eligibility is expressed as `rule` rows with owner
 *    type `PROMOTION`, and its target and buy selection as rows with owner type `PROMOTION_ACTION`.
 *    Those tables belong to the kernel set, which has already run, so nothing here re-creates them.
 * 2. **The ledgers are the authority.** `promotion_usage` is what the usage limits and the budgets are
 *    checked against, and `gift_card_transaction` is what the card balance is derived from. The
 *    counters on `promotion`, `coupon` and `campaign_budget` are caches of them, and the unique
 *    indexes below are what make "once per order" and "one budget per campaign" schema facts rather
 *    than conventions.
 * 3. **A column whose target table is created by a package that loads after this one carries no
 *    foreign key.** `promotion_usage.orderId`, `promotion_usage.cartId`, `gift_card.orderId` and
 *    `gift_card_transaction.orderId` are identifiers into the order and cart tables, which are
 *    created by later sets; the constraint belongs to the set that owns the target, exactly as the
 *    programme's migration rules require. Every other reference in this set is constrained here.
 */
export class CreatePromotionTables1791000000260 implements MigrationInterface {
	name = 'CreatePromotionTables1791000000260';

	/** Columns every table inherits from the platform base entities. */
	private readonly inheritedPostgres =
		'"deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid';

	/** Columns every table inherits, for SQLite. */
	private readonly inheritedSqlite =
		'"deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime(\'now\')), "updatedAt" datetime NOT NULL DEFAULT (datetime(\'now\')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar';

	/** Columns every table inherits, for MySQL. */
	private readonly inheritedMysql =
		'`deletedAt` datetime(6) NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `createdByUserId` varchar(36) NULL, `updatedByUserId` varchar(36) NULL, `deletedByUserId` varchar(36) NULL, `id` varchar(36) NOT NULL, `isActive` tinyint NULL DEFAULT 1, `isArchived` tinyint NULL DEFAULT 0, `archivedAt` datetime NULL, `tenantId` varchar(36) NULL, `organizationId` varchar(36) NULL';

	/** The nine tables of this set, in the order their foreign keys require. */
	private readonly tables = [
		'campaign',
		'campaign_budget',
		'campaign_budget_usage',
		'promotion',
		'promotion_action',
		'coupon',
		'promotion_usage',
		'gift_card',
		'gift_card_transaction'
	];

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
	 * Emits the seven base-class indexes of one table, in the shape the generated migrations use.
	 *
	 * @param queryRunner The runner to emit on.
	 * @param table The table to index.
	 */
	private async baseIndexes(queryRunner: QueryRunner, table: string): Promise<void> {
		await queryRunner.query(
			`CREATE INDEX "IDX_${table}_created_by_user" ON "${table}" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_${table}_updated_by_user" ON "${table}" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_${table}_deleted_by_user" ON "${table}" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_${table}_is_active" ON "${table}" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_${table}_is_archived" ON "${table}" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_${table}_tenant" ON "${table}" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_${table}_organization" ON "${table}" ("organizationId")`);
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		const i = this.inheritedPostgres;

		await queryRunner.query(
			`CREATE TABLE "campaign" (${i}, "identifier" character varying(64) NOT NULL, "name" character varying(255) NOT NULL, "description" text, "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "startsAt" TIMESTAMP, "endsAt" TIMESTAMP, "metadata" jsonb, CONSTRAINT "PK_campaign_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'campaign');
		// The stable handle an import is keyed on: a replayed import must not create a second campaign.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_campaign_identifier" ON "campaign" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "identifier") WHERE "deletedAt" IS NULL`
		);
		// The window query: which campaigns are running inside a channel at an instant.
		await queryRunner.query(
			`CREATE INDEX "IDX_campaign_window" ON "campaign" ("organizationId", "status", "startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "campaign_budget" (${i}, "campaignId" uuid NOT NULL, "type" character varying(32) NOT NULL DEFAULT 'SPEND', "limit" numeric(20,6) NOT NULL, "used" numeric(20,6) NOT NULL DEFAULT 0, "attribute" character varying(128), "currency" character varying(3), CONSTRAINT "PK_campaign_budget_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'campaign_budget');
		// One budget per campaign: a second one would make "the ceiling" ambiguous.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_campaign_budget" ON "campaign_budget" ("campaignId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_campaign_budget_org" ON "campaign_budget" ("organizationId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "campaign_budget" ADD CONSTRAINT "FK_campaign_budget_campaign" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "campaign_budget_usage" (${i}, "budgetId" uuid NOT NULL, "attributeValue" character varying(191) NOT NULL, "used" numeric(20,6) NOT NULL DEFAULT 0, CONSTRAINT "PK_campaign_budget_usage_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'campaign_budget_usage');
		// One row per value: the row the conditional increment gates on.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_campaign_budget_usage" ON "campaign_budget_usage" ("budgetId", "attributeValue") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_campaign_budget_usage_budget" ON "campaign_budget_usage" ("budgetId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "campaign_budget_usage" ADD CONSTRAINT "FK_campaign_budget_usage_budget" FOREIGN KEY ("budgetId") REFERENCES "campaign_budget"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "promotion" (${i}, "code" character varying(64), "title" character varying(255) NOT NULL, "description" text, "type" character varying(16) NOT NULL DEFAULT 'STANDARD', "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "isAutomatic" boolean NOT NULL DEFAULT false, "isCombinable" boolean NOT NULL DEFAULT true, "stackingGroup" character varying(64), "priority" integer NOT NULL DEFAULT 0, "campaignId" uuid, "channelId" uuid, "currency" character varying(3), "customerGroupId" uuid, "startsAt" TIMESTAMP, "endsAt" TIMESTAMP, "usageLimit" integer, "usageCount" integer NOT NULL DEFAULT 0, "perCustomerUsageLimit" integer, "budgetAmount" numeric(20,6), "budgetSpent" numeric(20,6) NOT NULL DEFAULT 0, "isTaxInclusive" boolean NOT NULL DEFAULT false, "metadata" jsonb, CONSTRAINT "PK_promotion_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'promotion');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_promotion_org_code" ON "promotion" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "code" IS NOT NULL AND "deletedAt" IS NULL`
		);
		// The candidate query: the automatic promotions that are running right now.
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_automatic" ON "promotion" ("organizationId", "status", "isAutomatic", "startsAt", "endsAt") WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_channel" ON "promotion" ("channelId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_group_priority" ON "promotion" ("stackingGroup", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_campaign" ON "promotion" ("campaignId") WHERE "campaignId" IS NOT NULL`
		);
		// A promotion is detached, not deleted, when its campaign goes: it has its own history.
		await queryRunner.query(
			`ALTER TABLE "promotion" ADD CONSTRAINT "FK_promotion_campaign" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "promotion" ADD CONSTRAINT "FK_promotion_channel" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "promotion" ADD CONSTRAINT "FK_promotion_customer_group" FOREIGN KEY ("customerGroupId") REFERENCES "contact_group"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "promotion_action" (${i}, "promotionId" uuid NOT NULL, "type" character varying(32) NOT NULL, "targetType" character varying(16) NOT NULL DEFAULT 'ORDER', "allocation" character varying(16) NOT NULL DEFAULT 'ACROSS', "value" numeric(20,6) NOT NULL, "currency" character varying(3), "maxQuantity" numeric(20,6), "applyToQuantity" numeric(20,6), "buyRulesMinQuantity" numeric(20,6), "isTaxInclusive" boolean NOT NULL DEFAULT false, "position" integer NOT NULL DEFAULT 0, "metadata" jsonb, CONSTRAINT "PK_promotion_action_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'promotion_action');
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_action_promotion" ON "promotion_action" ("promotionId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_action_type" ON "promotion_action" ("type", "targetType") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "promotion_action" ADD CONSTRAINT "FK_promotion_action_promotion" FOREIGN KEY ("promotionId") REFERENCES "promotion"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "coupon" (${i}, "code" character varying(64) NOT NULL, "promotionId" uuid, "batchId" character varying(64), "usageLimit" integer, "usageCount" integer NOT NULL DEFAULT 0, "perCustomerLimit" integer, "startsAt" TIMESTAMP, "endsAt" TIMESTAMP, "metadata" jsonb, CONSTRAINT "PK_coupon_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'coupon');
		// Codes are stored upper-cased, so one code is one row per organization.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_coupon_org_code" ON "coupon" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_coupon_promotion" ON "coupon" ("promotionId") WHERE "promotionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_coupon_batch" ON "coupon" ("batchId") WHERE "batchId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_coupon_window" ON "coupon" ("organizationId", "isActive", "startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "coupon" ADD CONSTRAINT "FK_coupon_promotion" FOREIGN KEY ("promotionId") REFERENCES "promotion"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "promotion_usage" (${i}, "promotionId" uuid NOT NULL, "couponId" uuid, "orderId" uuid, "cartId" uuid, "customerId" uuid, "code" character varying(64), "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "usedAt" TIMESTAMP NOT NULL DEFAULT now(), "status" character varying(16) NOT NULL DEFAULT 'RESERVED', CONSTRAINT "PK_promotion_usage_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'promotion_usage');
		// Once per order, as a schema fact: a live usage row per promotion and order.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_promotion_usage_order" ON "promotion_usage" ("promotionId", "orderId") WHERE "orderId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_usage_promotion" ON "promotion_usage" ("promotionId", "status") WHERE "deletedAt" IS NULL`
		);
		// The per-customer limit is answered from this tuple, never from a counter.
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_usage_customer" ON "promotion_usage" ("promotionId", "customerId", "status") WHERE "customerId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_usage_coupon" ON "promotion_usage" ("couponId", "status") WHERE "couponId" IS NOT NULL`
		);
		// The reservation-expiry sweep reads exactly this.
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_usage_reserved" ON "promotion_usage" ("status", "createdAt") WHERE "status" = 'RESERVED'`
		);
		await queryRunner.query(
			`ALTER TABLE "promotion_usage" ADD CONSTRAINT "FK_promotion_usage_promotion" FOREIGN KEY ("promotionId") REFERENCES "promotion"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "promotion_usage" ADD CONSTRAINT "FK_promotion_usage_coupon" FOREIGN KEY ("couponId") REFERENCES "coupon"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "promotion_usage" ADD CONSTRAINT "FK_promotion_usage_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "gift_card" (${i}, "code" character varying(64) NOT NULL, "initialAmount" numeric(20,6) NOT NULL, "balance" numeric(20,6) NOT NULL DEFAULT 0, "currency" character varying(3) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "customerId" uuid, "orderId" uuid, "expiresAt" TIMESTAMP, "pin" character varying(255), "metadata" jsonb, CONSTRAINT "PK_gift_card_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'gift_card');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_gift_card_org_code" ON "gift_card" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_gift_card_customer" ON "gift_card" ("customerId", "status") WHERE "customerId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		// The expiry sweep, and the balance lookup by code.
		await queryRunner.query(
			`CREATE INDEX "IDX_gift_card_expiry" ON "gift_card" ("status", "expiresAt") WHERE "status" = 'ACTIVE'`
		);
		await queryRunner.query(
			`ALTER TABLE "gift_card" ADD CONSTRAINT "FK_gift_card_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "gift_card_transaction" (${i}, "giftCardId" uuid NOT NULL, "orderId" uuid, "amount" numeric(20,6) NOT NULL, "balanceAfter" numeric(20,6) NOT NULL, "type" character varying(16) NOT NULL, "note" text, "occurredAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_gift_card_transaction_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'gift_card_transaction');
		await queryRunner.query(
			`CREATE INDEX "IDX_gift_card_transaction_card" ON "gift_card_transaction" ("giftCardId", "occurredAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_gift_card_transaction_order" ON "gift_card_transaction" ("orderId") WHERE "orderId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_gift_card_transaction_org_occurred" ON "gift_card_transaction" ("organizationId", "occurredAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "FK_gift_card_transaction_card" FOREIGN KEY ("giftCardId") REFERENCES "gift_card"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "gift_card_transaction" DROP CONSTRAINT "FK_gift_card_transaction_card"`
		);
		await queryRunner.query(`DROP TABLE "gift_card_transaction"`);
		await queryRunner.query(`ALTER TABLE "gift_card" DROP CONSTRAINT "FK_gift_card_customer"`);
		await queryRunner.query(`DROP TABLE "gift_card"`);
		await queryRunner.query(`ALTER TABLE "promotion_usage" DROP CONSTRAINT "FK_promotion_usage_customer"`);
		await queryRunner.query(`ALTER TABLE "promotion_usage" DROP CONSTRAINT "FK_promotion_usage_coupon"`);
		await queryRunner.query(`ALTER TABLE "promotion_usage" DROP CONSTRAINT "FK_promotion_usage_promotion"`);
		await queryRunner.query(`DROP TABLE "promotion_usage"`);
		await queryRunner.query(`ALTER TABLE "coupon" DROP CONSTRAINT "FK_coupon_promotion"`);
		await queryRunner.query(`DROP TABLE "coupon"`);
		await queryRunner.query(`ALTER TABLE "promotion_action" DROP CONSTRAINT "FK_promotion_action_promotion"`);
		await queryRunner.query(`DROP TABLE "promotion_action"`);
		await queryRunner.query(`ALTER TABLE "promotion" DROP CONSTRAINT "FK_promotion_customer_group"`);
		await queryRunner.query(`ALTER TABLE "promotion" DROP CONSTRAINT "FK_promotion_channel"`);
		await queryRunner.query(`ALTER TABLE "promotion" DROP CONSTRAINT "FK_promotion_campaign"`);
		await queryRunner.query(`DROP TABLE "promotion"`);
		await queryRunner.query(
			`ALTER TABLE "campaign_budget_usage" DROP CONSTRAINT "FK_campaign_budget_usage_budget"`
		);
		await queryRunner.query(`DROP TABLE "campaign_budget_usage"`);
		await queryRunner.query(`ALTER TABLE "campaign_budget" DROP CONSTRAINT "FK_campaign_budget_campaign"`);
		await queryRunner.query(`DROP TABLE "campaign_budget"`);
		await queryRunner.query(`DROP TABLE "campaign"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.sqliteTableStatements(queryRunner);
	}

	/**
	 * SQLite bodies, emitted through one shared builder because the dialect's only differences are
	 * its column types and its inability to add a constraint after the fact.
	 *
	 * @param queryRunner The runner to emit on.
	 */
	private async sqliteTableStatements(queryRunner: QueryRunner): Promise<void> {
		const i = this.inheritedSqlite;

		await queryRunner.query(
			`CREATE TABLE "campaign" (${i}, "identifier" varchar(64) NOT NULL, "name" varchar(255) NOT NULL, "description" text, "status" varchar(16) NOT NULL DEFAULT ('DRAFT'), "startsAt" datetime, "endsAt" datetime, "metadata" text)`
		);
		await this.baseIndexes(queryRunner, 'campaign');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_campaign_identifier" ON "campaign" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "identifier") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_campaign_window" ON "campaign" ("organizationId", "status", "startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "campaign_budget" (${i}, "campaignId" varchar NOT NULL, "type" varchar(32) NOT NULL DEFAULT ('SPEND'), "limit" numeric(20,6) NOT NULL, "used" numeric(20,6) NOT NULL DEFAULT (0), "attribute" varchar(128), "currency" varchar(3), CONSTRAINT "FK_campaign_budget_campaign" FOREIGN KEY ("campaignId") REFERENCES "campaign" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'campaign_budget');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_campaign_budget" ON "campaign_budget" ("campaignId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_campaign_budget_org" ON "campaign_budget" ("organizationId") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "campaign_budget_usage" (${i}, "budgetId" varchar NOT NULL, "attributeValue" varchar(191) NOT NULL, "used" numeric(20,6) NOT NULL DEFAULT (0), CONSTRAINT "FK_campaign_budget_usage_budget" FOREIGN KEY ("budgetId") REFERENCES "campaign_budget" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'campaign_budget_usage');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_campaign_budget_usage" ON "campaign_budget_usage" ("budgetId", "attributeValue") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_campaign_budget_usage_budget" ON "campaign_budget_usage" ("budgetId") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "promotion" (${i}, "code" varchar(64), "title" varchar(255) NOT NULL, "description" text, "type" varchar(16) NOT NULL DEFAULT ('STANDARD'), "status" varchar(16) NOT NULL DEFAULT ('DRAFT'), "isAutomatic" boolean NOT NULL DEFAULT (0), "isCombinable" boolean NOT NULL DEFAULT (1), "stackingGroup" varchar(64), "priority" integer NOT NULL DEFAULT (0), "campaignId" varchar, "channelId" varchar, "currency" varchar(3), "customerGroupId" varchar, "startsAt" datetime, "endsAt" datetime, "usageLimit" integer, "usageCount" integer NOT NULL DEFAULT (0), "perCustomerUsageLimit" integer, "budgetAmount" numeric(20,6), "budgetSpent" numeric(20,6) NOT NULL DEFAULT (0), "isTaxInclusive" boolean NOT NULL DEFAULT (0), "metadata" text, CONSTRAINT "FK_promotion_campaign" FOREIGN KEY ("campaignId") REFERENCES "campaign" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_promotion_channel" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_promotion_customer_group" FOREIGN KEY ("customerGroupId") REFERENCES "contact_group" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'promotion');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_promotion_org_code" ON "promotion" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "code" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_automatic" ON "promotion" ("organizationId", "status", "isAutomatic", "startsAt", "endsAt") WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_channel" ON "promotion" ("channelId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_group_priority" ON "promotion" ("stackingGroup", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_campaign" ON "promotion" ("campaignId") WHERE "campaignId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "promotion_action" (${i}, "promotionId" varchar NOT NULL, "type" varchar(32) NOT NULL, "targetType" varchar(16) NOT NULL DEFAULT ('ORDER'), "allocation" varchar(16) NOT NULL DEFAULT ('ACROSS'), "value" numeric(20,6) NOT NULL, "currency" varchar(3), "maxQuantity" numeric(20,6), "applyToQuantity" numeric(20,6), "buyRulesMinQuantity" numeric(20,6), "isTaxInclusive" boolean NOT NULL DEFAULT (0), "position" integer NOT NULL DEFAULT (0), "metadata" text, CONSTRAINT "FK_promotion_action_promotion" FOREIGN KEY ("promotionId") REFERENCES "promotion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'promotion_action');
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_action_promotion" ON "promotion_action" ("promotionId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_action_type" ON "promotion_action" ("type", "targetType") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "coupon" (${i}, "code" varchar(64) NOT NULL, "promotionId" varchar, "batchId" varchar(64), "usageLimit" integer, "usageCount" integer NOT NULL DEFAULT (0), "perCustomerLimit" integer, "startsAt" datetime, "endsAt" datetime, "metadata" text, CONSTRAINT "FK_coupon_promotion" FOREIGN KEY ("promotionId") REFERENCES "promotion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'coupon');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_coupon_org_code" ON "coupon" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_coupon_promotion" ON "coupon" ("promotionId") WHERE "promotionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_coupon_batch" ON "coupon" ("batchId") WHERE "batchId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_coupon_window" ON "coupon" ("organizationId", "isActive", "startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "promotion_usage" (${i}, "promotionId" varchar NOT NULL, "couponId" varchar, "orderId" varchar, "cartId" varchar, "customerId" varchar, "code" varchar(64), "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "usedAt" datetime NOT NULL DEFAULT (datetime('now')), "status" varchar(16) NOT NULL DEFAULT ('RESERVED'), CONSTRAINT "FK_promotion_usage_promotion" FOREIGN KEY ("promotionId") REFERENCES "promotion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_promotion_usage_coupon" FOREIGN KEY ("couponId") REFERENCES "coupon" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_promotion_usage_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'promotion_usage');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_promotion_usage_order" ON "promotion_usage" ("promotionId", "orderId") WHERE "orderId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_usage_promotion" ON "promotion_usage" ("promotionId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_usage_customer" ON "promotion_usage" ("promotionId", "customerId", "status") WHERE "customerId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_usage_coupon" ON "promotion_usage" ("couponId", "status") WHERE "couponId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_promotion_usage_reserved" ON "promotion_usage" ("status", "createdAt") WHERE "status" = 'RESERVED'`
		);

		await queryRunner.query(
			`CREATE TABLE "gift_card" (${i}, "code" varchar(64) NOT NULL, "initialAmount" numeric(20,6) NOT NULL, "balance" numeric(20,6) NOT NULL DEFAULT (0), "currency" varchar(3) NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('ACTIVE'), "customerId" varchar, "orderId" varchar, "expiresAt" datetime, "pin" varchar(255), "metadata" text, CONSTRAINT "FK_gift_card_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'gift_card');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_gift_card_org_code" ON "gift_card" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_gift_card_customer" ON "gift_card" ("customerId", "status") WHERE "customerId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_gift_card_expiry" ON "gift_card" ("status", "expiresAt") WHERE "status" = 'ACTIVE'`
		);

		await queryRunner.query(
			`CREATE TABLE "gift_card_transaction" (${i}, "giftCardId" varchar NOT NULL, "orderId" varchar, "amount" numeric(20,6) NOT NULL, "balanceAfter" numeric(20,6) NOT NULL, "type" varchar(16) NOT NULL, "note" text, "occurredAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_gift_card_transaction_card" FOREIGN KEY ("giftCardId") REFERENCES "gift_card" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'gift_card_transaction');
		await queryRunner.query(
			`CREATE INDEX "IDX_gift_card_transaction_card" ON "gift_card_transaction" ("giftCardId", "occurredAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_gift_card_transaction_order" ON "gift_card_transaction" ("orderId") WHERE "orderId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_gift_card_transaction_org_occurred" ON "gift_card_transaction" ("organizationId", "occurredAt") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const table of [...this.tables].reverse()) {
			await queryRunner.query(`DROP TABLE "${table}"`);
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL cannot express a filtered unique index, so every uniqueness rule that the other two
	 * dialects express with `WHERE "deletedAt" IS NULL` carries the stored generated `deletedKey` that
	 * `CreateSequenceTable1791000000000` documents for the whole set, and the nullable organization
	 * scope carries `organizationKey`. A live row takes the shared constant and collides; a deleted row
	 * takes its own id and does not. Carrying `deletedAt` itself, which this file used to do, does the
	 * opposite of what it reads as: a unique index in MySQL exempts every tuple that contains a null,
	 * and a live row is exactly the row whose `deletedAt` is null. The service enforces the same tuple
	 * inside the writing transaction, and the nightly audit reports any row that slipped through.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		const i = this.inheritedMysql;
		const base = (table: string): string =>
			`INDEX \`IDX_${table}_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_${table}_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_${table}_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_${table}_is_active\` (\`isActive\`), INDEX \`IDX_${table}_is_archived\` (\`isArchived\`), INDEX \`IDX_${table}_tenant\` (\`tenantId\`), INDEX \`IDX_${table}_organization\` (\`organizationId\`)`;

		await queryRunner.query(
			`CREATE TABLE \`campaign\` (${i}, \`identifier\` varchar(64) NOT NULL, \`name\` varchar(255) NOT NULL, \`description\` text NULL, \`status\` varchar(16) NOT NULL DEFAULT 'DRAFT', \`startsAt\` datetime NULL, \`endsAt\` datetime NULL, \`metadata\` json NULL, ${base('campaign')}, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_campaign_identifier\` ON \`campaign\` (\`organizationKey\`, \`identifier\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_campaign_window\` ON \`campaign\` (\`organizationId\`, \`status\`, \`startsAt\`, \`endsAt\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`campaign_budget\` (${i}, \`campaignId\` varchar(36) NOT NULL, \`type\` varchar(32) NOT NULL DEFAULT 'SPEND', \`limit\` decimal(20,6) NOT NULL, \`used\` decimal(20,6) NOT NULL DEFAULT 0, \`attribute\` varchar(128) NULL, \`currency\` varchar(3) NULL, ${base('campaign_budget')}, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_campaign_budget\` ON \`campaign_budget\` (\`campaignId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`campaign_budget\` ADD CONSTRAINT \`FK_campaign_budget_campaign\` FOREIGN KEY (\`campaignId\`) REFERENCES \`campaign\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`campaign_budget_usage\` (${i}, \`budgetId\` varchar(36) NOT NULL, \`attributeValue\` varchar(191) NOT NULL, \`used\` decimal(20,6) NOT NULL DEFAULT 0, ${base('campaign_budget_usage')}, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_campaign_budget_usage\` ON \`campaign_budget_usage\` (\`budgetId\`, \`attributeValue\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`campaign_budget_usage\` ADD CONSTRAINT \`FK_campaign_budget_usage_budget\` FOREIGN KEY (\`budgetId\`) REFERENCES \`campaign_budget\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`promotion\` (${i}, \`code\` varchar(64) NULL, \`title\` varchar(255) NOT NULL, \`description\` text NULL, \`type\` varchar(16) NOT NULL DEFAULT 'STANDARD', \`status\` varchar(16) NOT NULL DEFAULT 'DRAFT', \`isAutomatic\` tinyint NOT NULL DEFAULT 0, \`isCombinable\` tinyint NOT NULL DEFAULT 1, \`stackingGroup\` varchar(64) NULL, \`priority\` int NOT NULL DEFAULT 0, \`campaignId\` varchar(36) NULL, \`channelId\` varchar(36) NULL, \`currency\` varchar(3) NULL, \`customerGroupId\` varchar(36) NULL, \`startsAt\` datetime NULL, \`endsAt\` datetime NULL, \`usageLimit\` int NULL, \`usageCount\` int NOT NULL DEFAULT 0, \`perCustomerUsageLimit\` int NULL, \`budgetAmount\` decimal(20,6) NULL, \`budgetSpent\` decimal(20,6) NOT NULL DEFAULT 0, \`isTaxInclusive\` tinyint NOT NULL DEFAULT 0, \`metadata\` json NULL, ${base('promotion')}, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_promotion_org_code\` ON \`promotion\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_promotion_automatic\` ON \`promotion\` (\`organizationId\`, \`status\`, \`isAutomatic\`, \`startsAt\`, \`endsAt\`)`
		);
		await queryRunner.query(`CREATE INDEX \`IDX_promotion_channel\` ON \`promotion\` (\`channelId\`, \`status\`)`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_promotion_group_priority\` ON \`promotion\` (\`stackingGroup\`, \`priority\`)`
		);
		await queryRunner.query(`CREATE INDEX \`IDX_promotion_campaign\` ON \`promotion\` (\`campaignId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`promotion\` ADD CONSTRAINT \`FK_promotion_campaign\` FOREIGN KEY (\`campaignId\`) REFERENCES \`campaign\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`promotion\` ADD CONSTRAINT \`FK_promotion_channel\` FOREIGN KEY (\`channelId\`) REFERENCES \`channel\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`promotion\` ADD CONSTRAINT \`FK_promotion_customer_group\` FOREIGN KEY (\`customerGroupId\`) REFERENCES \`contact_group\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`promotion_action\` (${i}, \`promotionId\` varchar(36) NOT NULL, \`type\` varchar(32) NOT NULL, \`targetType\` varchar(16) NOT NULL DEFAULT 'ORDER', \`allocation\` varchar(16) NOT NULL DEFAULT 'ACROSS', \`value\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NULL, \`maxQuantity\` decimal(20,6) NULL, \`applyToQuantity\` decimal(20,6) NULL, \`buyRulesMinQuantity\` decimal(20,6) NULL, \`isTaxInclusive\` tinyint NOT NULL DEFAULT 0, \`position\` int NOT NULL DEFAULT 0, \`metadata\` json NULL, ${base('promotion_action')}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_promotion_action_promotion\` ON \`promotion_action\` (\`promotionId\`, \`position\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_promotion_action_type\` ON \`promotion_action\` (\`type\`, \`targetType\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`promotion_action\` ADD CONSTRAINT \`FK_promotion_action_promotion\` FOREIGN KEY (\`promotionId\`) REFERENCES \`promotion\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`coupon\` (${i}, \`code\` varchar(64) NOT NULL, \`promotionId\` varchar(36) NULL, \`batchId\` varchar(64) NULL, \`usageLimit\` int NULL, \`usageCount\` int NOT NULL DEFAULT 0, \`perCustomerLimit\` int NULL, \`startsAt\` datetime NULL, \`endsAt\` datetime NULL, \`metadata\` json NULL, ${base('coupon')}, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_coupon_org_code\` ON \`coupon\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
		);
		await queryRunner.query(`CREATE INDEX \`IDX_coupon_promotion\` ON \`coupon\` (\`promotionId\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_coupon_batch\` ON \`coupon\` (\`batchId\`)`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_coupon_window\` ON \`coupon\` (\`organizationId\`, \`isActive\`, \`startsAt\`, \`endsAt\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`coupon\` ADD CONSTRAINT \`FK_coupon_promotion\` FOREIGN KEY (\`promotionId\`) REFERENCES \`promotion\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`promotion_usage\` (${i}, \`promotionId\` varchar(36) NOT NULL, \`couponId\` varchar(36) NULL, \`orderId\` varchar(36) NULL, \`cartId\` varchar(36) NULL, \`customerId\` varchar(36) NULL, \`code\` varchar(64) NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`usedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`status\` varchar(16) NOT NULL DEFAULT 'RESERVED', ${base('promotion_usage')}, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_promotion_usage_order\` ON \`promotion_usage\` (\`promotionId\`, \`orderId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_promotion_usage_promotion\` ON \`promotion_usage\` (\`promotionId\`, \`status\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_promotion_usage_customer\` ON \`promotion_usage\` (\`promotionId\`, \`customerId\`, \`status\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_promotion_usage_coupon\` ON \`promotion_usage\` (\`couponId\`, \`status\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_promotion_usage_reserved\` ON \`promotion_usage\` (\`status\`, \`createdAt\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`promotion_usage\` ADD CONSTRAINT \`FK_promotion_usage_promotion\` FOREIGN KEY (\`promotionId\`) REFERENCES \`promotion\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`promotion_usage\` ADD CONSTRAINT \`FK_promotion_usage_coupon\` FOREIGN KEY (\`couponId\`) REFERENCES \`coupon\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`promotion_usage\` ADD CONSTRAINT \`FK_promotion_usage_customer\` FOREIGN KEY (\`customerId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`gift_card\` (${i}, \`code\` varchar(64) NOT NULL, \`initialAmount\` decimal(20,6) NOT NULL, \`balance\` decimal(20,6) NOT NULL DEFAULT 0, \`currency\` varchar(3) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'ACTIVE', \`customerId\` varchar(36) NULL, \`orderId\` varchar(36) NULL, \`expiresAt\` datetime NULL, \`pin\` varchar(255) NULL, \`metadata\` json NULL, ${base('gift_card')}, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_gift_card_org_code\` ON \`gift_card\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_gift_card_customer\` ON \`gift_card\` (\`customerId\`, \`status\`)`
		);
		await queryRunner.query(`CREATE INDEX \`IDX_gift_card_expiry\` ON \`gift_card\` (\`status\`, \`expiresAt\`)`);
		await queryRunner.query(
			`ALTER TABLE \`gift_card\` ADD CONSTRAINT \`FK_gift_card_customer\` FOREIGN KEY (\`customerId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`gift_card_transaction\` (${i}, \`giftCardId\` varchar(36) NOT NULL, \`orderId\` varchar(36) NULL, \`amount\` decimal(20,6) NOT NULL, \`balanceAfter\` decimal(20,6) NOT NULL, \`type\` varchar(16) NOT NULL, \`note\` text NULL, \`occurredAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ${base('gift_card_transaction')}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_gift_card_transaction_card\` ON \`gift_card_transaction\` (\`giftCardId\`, \`occurredAt\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_gift_card_transaction_order\` ON \`gift_card_transaction\` (\`orderId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_gift_card_transaction_org_occurred\` ON \`gift_card_transaction\` (\`organizationId\`, \`occurredAt\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`gift_card_transaction\` ADD CONSTRAINT \`FK_gift_card_transaction_card\` FOREIGN KEY (\`giftCardId\`) REFERENCES \`gift_card\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`gift_card_transaction\` DROP FOREIGN KEY \`FK_gift_card_transaction_card\``
		);
		await queryRunner.query(`DROP TABLE \`gift_card_transaction\``);
		await queryRunner.query(`ALTER TABLE \`gift_card\` DROP FOREIGN KEY \`FK_gift_card_customer\``);
		await queryRunner.query(`DROP TABLE \`gift_card\``);
		await queryRunner.query(`ALTER TABLE \`promotion_usage\` DROP FOREIGN KEY \`FK_promotion_usage_customer\``);
		await queryRunner.query(`ALTER TABLE \`promotion_usage\` DROP FOREIGN KEY \`FK_promotion_usage_coupon\``);
		await queryRunner.query(`ALTER TABLE \`promotion_usage\` DROP FOREIGN KEY \`FK_promotion_usage_promotion\``);
		await queryRunner.query(`DROP TABLE \`promotion_usage\``);
		await queryRunner.query(`ALTER TABLE \`coupon\` DROP FOREIGN KEY \`FK_coupon_promotion\``);
		await queryRunner.query(`DROP TABLE \`coupon\``);
		await queryRunner.query(
			`ALTER TABLE \`promotion_action\` DROP FOREIGN KEY \`FK_promotion_action_promotion\``
		);
		await queryRunner.query(`DROP TABLE \`promotion_action\``);
		await queryRunner.query(`ALTER TABLE \`promotion\` DROP FOREIGN KEY \`FK_promotion_customer_group\``);
		await queryRunner.query(`ALTER TABLE \`promotion\` DROP FOREIGN KEY \`FK_promotion_channel\``);
		await queryRunner.query(`ALTER TABLE \`promotion\` DROP FOREIGN KEY \`FK_promotion_campaign\``);
		await queryRunner.query(`DROP TABLE \`promotion\``);
		await queryRunner.query(
			`ALTER TABLE \`campaign_budget_usage\` DROP FOREIGN KEY \`FK_campaign_budget_usage_budget\``
		);
		await queryRunner.query(`DROP TABLE \`campaign_budget_usage\``);
		await queryRunner.query(`ALTER TABLE \`campaign_budget\` DROP FOREIGN KEY \`FK_campaign_budget_campaign\``);
		await queryRunner.query(`DROP TABLE \`campaign_budget\``);
		await queryRunner.query(`DROP TABLE \`campaign\``);
	}
}
