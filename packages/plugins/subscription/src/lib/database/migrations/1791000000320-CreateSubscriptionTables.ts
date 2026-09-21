import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the subscription tables: plans, the subscriptions on them, each subscription's recurring
 * lines, and one row per billing cycle.
 *
 * Four tables, one package, because they answer one question — sell the same thing again on a
 * schedule. The signature of each table is what makes the domain's rules enforceable in the database
 * rather than only in a service:
 *
 * - a plan code means one plan inside one organization, so the unique key is scoped to the
 *   organization and restricted to the rows that are not soft-deleted;
 * - a plan is attached to a product or to one variant, never to both, which is a check constraint
 *   rather than a convention;
 * - one billing row per `(subscription, periodStart)` is what makes a retried billing run idempotent
 *   — it is the whole reason the unique key exists, because a second worker racing the first must not
 *   be able to create a second cycle for one period;
 * - one row per `(subscription, variant)` in the line set is what makes "how many of this does the
 *   customer get" answerable exactly once.
 *
 * The foreign keys into tables this plugin does not own (`product`, `product_variant`,
 * `organization_contact`, `order`, `payment_account_holder`, `payment_method_token`) are created
 * here as well: those tables belong to the catalogue, party, order and payment capabilities, but the
 * constraint belongs to the relationship, and a subscription pointing at a customer that does not
 * exist is a defect whichever package wrote it. Nothing in this package reads or writes those tables.
 *
 * All three dialects are written by hand, and the down migration reverses every statement in the
 * opposite order — a partially reverted schema is worse than an unreverted one.
 */
export class CreateSubscriptionTables1791000000320 implements MigrationInterface {
	name = 'CreateSubscriptionTables1791000000320';

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
		// The plan comes first: a subscription is meaningless without the terms it was sold on.
		await queryRunner.query(
			`CREATE TABLE "subscription_plan" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "code" character varying(64) NOT NULL, "description" text, "productId" uuid, "variantId" uuid, "billingPeriod" character varying(16) NOT NULL DEFAULT 'MONTHLY', "billingInterval" integer NOT NULL DEFAULT 1, "maxBillingCycles" integer, "trialDays" integer, "setupFee" numeric(20,6), "discountPercentage" numeric(9,6), "currency" character varying(3) NOT NULL, "metadata" jsonb, CONSTRAINT "CHK_subscription_plan_target_xor" CHECK ((("productId" IS NULL) OR ("variantId" IS NULL))), CONSTRAINT "CHK_subscription_plan_interval" CHECK (("billingInterval" >= 1)), CONSTRAINT "CHK_subscription_plan_discount" CHECK (("discountPercentage" IS NULL OR ("discountPercentage" >= 0 AND "discountPercentage" <= 1))), CONSTRAINT "PK_subscription_plan_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_created_by_user" ON "subscription_plan" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_updated_by_user" ON "subscription_plan" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_deleted_by_user" ON "subscription_plan" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_plan_is_active" ON "subscription_plan" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_plan_is_archived" ON "subscription_plan" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_plan_tenant" ON "subscription_plan" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_organization" ON "subscription_plan" ("organizationId")`
		);
		// A plan code means one plan inside one organization, and a retired code may be reused.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_subscription_plan_org_code" ON "subscription_plan" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "code") WHERE "deletedAt" IS NULL`
		);
		// The listing a tenant reads first: its active plans, grouped by cadence.
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_active" ON "subscription_plan" ("organizationId", "isActive", "billingPeriod") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_product" ON "subscription_plan" ("productId") WHERE "productId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_variant" ON "subscription_plan" ("variantId") WHERE "variantId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "subscription" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "planId" uuid NOT NULL, "customerId" uuid NOT NULL, "originOrderId" uuid, "paymentAccountHolderId" uuid, "paymentMethodTokenId" uuid, "status" character varying(16) NOT NULL DEFAULT 'PENDING', "quantity" numeric(20,6) NOT NULL DEFAULT 1, "currentPeriodStart" TIMESTAMP, "currentPeriodEnd" TIMESTAMP, "nextBillingAt" TIMESTAMP, "billingCycleCount" integer NOT NULL DEFAULT 0, "pausedUntil" TIMESTAMP, "canceledAt" TIMESTAMP, "cancelReason" character varying(255), "currency" character varying(3) NOT NULL, "metadata" jsonb, CONSTRAINT "CHK_subscription_period_order" CHECK (("currentPeriodStart" IS NULL OR "currentPeriodEnd" IS NULL OR "currentPeriodStart" < "currentPeriodEnd")), CONSTRAINT "PK_subscription_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_created_by_user" ON "subscription" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_updated_by_user" ON "subscription" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_deleted_by_user" ON "subscription" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_is_active" ON "subscription" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_is_archived" ON "subscription" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_tenant" ON "subscription" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_organization" ON "subscription" ("organizationId")`);
		// The due-billing scan, and the state it scans for: the index is a covering one because
		// `nextBillingAt` is non-null exactly while the subscription is active.
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_due" ON "subscription" ("status", "nextBillingAt") WHERE "status" = 'ACTIVE'`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_customer" ON "subscription" ("customerId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan" ON "subscription" ("planId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_org_status" ON "subscription" ("organizationId", "status") WHERE "deletedAt" IS NULL`
		);
		// The pause scan: a paused subscription resumes itself when its pause runs out.
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_paused" ON "subscription" ("status", "pausedUntil") WHERE "status" = 'PAUSED'`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_origin_order" ON "subscription" ("originOrderId") WHERE "originOrderId" IS NOT NULL`
		);
		// The payer a renewal charges, and the lookup that finds every subscription on one instrument.
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_payment_method" ON "subscription" ("paymentAccountHolderId", "paymentMethodTokenId") WHERE "paymentAccountHolderId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "subscription_item" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "subscriptionId" uuid NOT NULL, "variantId" uuid NOT NULL, "quantity" numeric(20,6) NOT NULL DEFAULT 1, "unitPrice" numeric(20,6) NOT NULL, "position" integer NOT NULL DEFAULT 0, "metadata" jsonb, CONSTRAINT "CHK_subscription_item_quantity" CHECK (("quantity" >= 0)), CONSTRAINT "CHK_subscription_item_price" CHECK (("unitPrice" >= 0)), CONSTRAINT "PK_subscription_item_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_item_created_by_user" ON "subscription_item" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_item_updated_by_user" ON "subscription_item" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_item_deleted_by_user" ON "subscription_item" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_item_is_active" ON "subscription_item" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_item_is_archived" ON "subscription_item" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_item_tenant" ON "subscription_item" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_item_organization" ON "subscription_item" ("organizationId")`
		);
		// One line per variant per subscription; a removed line keeps its row and stops colliding.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_subscription_item" ON "subscription_item" ("subscriptionId", "variantId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_item_variant" ON "subscription_item" ("variantId")`);

		await queryRunner.query(
			`CREATE TABLE "subscription_billing" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "subscriptionId" uuid NOT NULL, "orderId" uuid, "periodStart" TIMESTAMP NOT NULL, "periodEnd" TIMESTAMP NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'PENDING', "dueAt" TIMESTAMP, "paidAt" TIMESTAMP, "attemptCount" integer NOT NULL DEFAULT 0, "lastError" text, "nextRetryAt" TIMESTAMP, "metadata" jsonb, CONSTRAINT "CHK_subscription_billing_period" CHECK (("periodStart" < "periodEnd")), CONSTRAINT "CHK_subscription_billing_amount" CHECK (("amount" >= 0)), CONSTRAINT "PK_subscription_billing_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_created_by_user" ON "subscription_billing" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_updated_by_user" ON "subscription_billing" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_deleted_by_user" ON "subscription_billing" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_is_active" ON "subscription_billing" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_is_archived" ON "subscription_billing" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_billing_tenant" ON "subscription_billing" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_organization" ON "subscription_billing" ("organizationId")`
		);
		// One row per period: this key is what makes billing a period twice impossible rather than
		// merely unlikely, because two workers cannot both insert it.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_subscription_billing_period" ON "subscription_billing" ("subscriptionId", "periodStart") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_due" ON "subscription_billing" ("status", "dueAt") WHERE "status" IN ('PENDING', 'FAILED')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_order" ON "subscription_billing" ("orderId") WHERE "orderId" IS NOT NULL`
		);
		// The dunning scan: only a failed cycle carries a retry instant, so it is an index seek.
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_retry" ON "subscription_billing" ("status", "nextRetryAt") WHERE "nextRetryAt" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_org_created" ON "subscription_billing" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);

		/*
		 * Foreign keys. Every table exists by now, so the order between them no longer matters.
		 */
		await queryRunner.query(
			`ALTER TABLE "subscription_plan" ADD CONSTRAINT "FK_subscription_plan_product" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription_plan" ADD CONSTRAINT "FK_subscription_plan_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "subscription" ADD CONSTRAINT "FK_subscription_plan" FOREIGN KEY ("planId") REFERENCES "subscription_plan"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription" ADD CONSTRAINT "FK_subscription_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription" ADD CONSTRAINT "FK_subscription_origin_order" FOREIGN KEY ("originOrderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription" ADD CONSTRAINT "FK_subscription_account_holder" FOREIGN KEY ("paymentAccountHolderId") REFERENCES "payment_account_holder"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription" ADD CONSTRAINT "FK_subscription_payment_token" FOREIGN KEY ("paymentMethodTokenId") REFERENCES "payment_method_token"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "subscription_item" ADD CONSTRAINT "FK_subscription_item_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription_item" ADD CONSTRAINT "FK_subscription_item_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "subscription_billing" ADD CONSTRAINT "FK_subscription_billing_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription_billing" ADD CONSTRAINT "FK_subscription_billing_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "subscription_billing" DROP CONSTRAINT "FK_subscription_billing_order"`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription_billing" DROP CONSTRAINT "FK_subscription_billing_subscription"`
		);
		await queryRunner.query(`ALTER TABLE "subscription_item" DROP CONSTRAINT "FK_subscription_item_variant"`);
		await queryRunner.query(`ALTER TABLE "subscription_item" DROP CONSTRAINT "FK_subscription_item_subscription"`);
		await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_subscription_payment_token"`);
		await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_subscription_account_holder"`);
		await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_subscription_origin_order"`);
		await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_subscription_customer"`);
		await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_subscription_plan"`);
		await queryRunner.query(`ALTER TABLE "subscription_plan" DROP CONSTRAINT "FK_subscription_plan_variant"`);
		await queryRunner.query(`ALTER TABLE "subscription_plan" DROP CONSTRAINT "FK_subscription_plan_product"`);

		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_org_created"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_retry"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_order"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_due"`);
		await queryRunner.query(`DROP INDEX "UQ_subscription_billing_period"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_created_by_user"`);
		await queryRunner.query(`DROP TABLE "subscription_billing"`);

		await queryRunner.query(`DROP INDEX "IDX_subscription_item_variant"`);
		await queryRunner.query(`DROP INDEX "UQ_subscription_item"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_created_by_user"`);
		await queryRunner.query(`DROP TABLE "subscription_item"`);

		await queryRunner.query(`DROP INDEX "IDX_subscription_payment_method"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_origin_order"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_paused"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_org_status"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_customer"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_due"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_created_by_user"`);
		await queryRunner.query(`DROP TABLE "subscription"`);

		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_product"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_active"`);
		await queryRunner.query(`DROP INDEX "UQ_subscription_plan_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_created_by_user"`);
		await queryRunner.query(`DROP TABLE "subscription_plan"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a constraint to an existing table, so every foreign key is declared inline
	 * with the table that owns it. Forward targets are resolved when the constraint is used rather
	 * than when it is declared, which is what lets the line and the cycle tables point at
	 * `subscription` while it is being created beside them.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "subscription_plan" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "description" text, "productId" varchar, "variantId" varchar, "billingPeriod" varchar(16) NOT NULL DEFAULT ('MONTHLY'), "billingInterval" integer NOT NULL DEFAULT (1), "maxBillingCycles" integer, "trialDays" integer, "setupFee" numeric(20,6), "discountPercentage" numeric(9,6), "currency" varchar(3) NOT NULL, "metadata" text, CONSTRAINT "CHK_subscription_plan_target_xor" CHECK ((("productId" IS NULL) OR ("variantId" IS NULL))), CONSTRAINT "CHK_subscription_plan_interval" CHECK (("billingInterval" >= 1)), CONSTRAINT "CHK_subscription_plan_discount" CHECK (("discountPercentage" IS NULL OR ("discountPercentage" >= 0 AND "discountPercentage" <= 1))), CONSTRAINT "FK_subscription_plan_product" FOREIGN KEY ("productId") REFERENCES "product" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_subscription_plan_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_created_by_user" ON "subscription_plan" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_updated_by_user" ON "subscription_plan" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_deleted_by_user" ON "subscription_plan" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_plan_is_active" ON "subscription_plan" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_plan_is_archived" ON "subscription_plan" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_plan_tenant" ON "subscription_plan" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_organization" ON "subscription_plan" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_subscription_plan_org_code" ON "subscription_plan" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_active" ON "subscription_plan" ("organizationId", "isActive", "billingPeriod") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_product" ON "subscription_plan" ("productId") WHERE "productId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan_variant" ON "subscription_plan" ("variantId") WHERE "variantId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "subscription" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "planId" varchar NOT NULL, "customerId" varchar NOT NULL, "originOrderId" varchar, "paymentAccountHolderId" varchar, "paymentMethodTokenId" varchar, "status" varchar(16) NOT NULL DEFAULT ('PENDING'), "quantity" numeric(20,6) NOT NULL DEFAULT (1), "currentPeriodStart" datetime, "currentPeriodEnd" datetime, "nextBillingAt" datetime, "billingCycleCount" integer NOT NULL DEFAULT (0), "pausedUntil" datetime, "canceledAt" datetime, "cancelReason" varchar(255), "currency" varchar(3) NOT NULL, "metadata" text, CONSTRAINT "CHK_subscription_period_order" CHECK (("currentPeriodStart" IS NULL OR "currentPeriodEnd" IS NULL OR "currentPeriodStart" < "currentPeriodEnd")), CONSTRAINT "FK_subscription_plan" FOREIGN KEY ("planId") REFERENCES "subscription_plan" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_subscription_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_subscription_origin_order" FOREIGN KEY ("originOrderId") REFERENCES "order" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_subscription_account_holder" FOREIGN KEY ("paymentAccountHolderId") REFERENCES "payment_account_holder" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_subscription_payment_token" FOREIGN KEY ("paymentMethodTokenId") REFERENCES "payment_method_token" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_created_by_user" ON "subscription" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_updated_by_user" ON "subscription" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_deleted_by_user" ON "subscription" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_is_active" ON "subscription" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_is_archived" ON "subscription" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_tenant" ON "subscription" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_organization" ON "subscription" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_due" ON "subscription" ("status", "nextBillingAt") WHERE "status" = 'ACTIVE'`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_customer" ON "subscription" ("customerId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_plan" ON "subscription" ("planId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_org_status" ON "subscription" ("organizationId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_paused" ON "subscription" ("status", "pausedUntil") WHERE "status" = 'PAUSED'`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_origin_order" ON "subscription" ("originOrderId") WHERE "originOrderId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_payment_method" ON "subscription" ("paymentAccountHolderId", "paymentMethodTokenId") WHERE "paymentAccountHolderId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "subscription_item" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "subscriptionId" varchar NOT NULL, "variantId" varchar NOT NULL, "quantity" numeric(20,6) NOT NULL DEFAULT (1), "unitPrice" numeric(20,6) NOT NULL, "position" integer NOT NULL DEFAULT (0), "metadata" text, CONSTRAINT "CHK_subscription_item_quantity" CHECK (("quantity" >= 0)), CONSTRAINT "CHK_subscription_item_price" CHECK (("unitPrice" >= 0)), CONSTRAINT "FK_subscription_item_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "subscription" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_subscription_item_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_item_created_by_user" ON "subscription_item" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_item_updated_by_user" ON "subscription_item" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_item_deleted_by_user" ON "subscription_item" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_item_is_active" ON "subscription_item" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_item_is_archived" ON "subscription_item" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_item_tenant" ON "subscription_item" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_item_organization" ON "subscription_item" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_subscription_item" ON "subscription_item" ("subscriptionId", "variantId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_item_variant" ON "subscription_item" ("variantId")`);

		await queryRunner.query(
			`CREATE TABLE "subscription_billing" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "subscriptionId" varchar NOT NULL, "orderId" varchar, "periodStart" datetime NOT NULL, "periodEnd" datetime NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('PENDING'), "dueAt" datetime, "paidAt" datetime, "attemptCount" integer NOT NULL DEFAULT (0), "lastError" text, "nextRetryAt" datetime, "metadata" text, CONSTRAINT "CHK_subscription_billing_period" CHECK (("periodStart" < "periodEnd")), CONSTRAINT "CHK_subscription_billing_amount" CHECK (("amount" >= 0)), CONSTRAINT "FK_subscription_billing_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "subscription" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_subscription_billing_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_created_by_user" ON "subscription_billing" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_updated_by_user" ON "subscription_billing" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_deleted_by_user" ON "subscription_billing" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_is_active" ON "subscription_billing" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_is_archived" ON "subscription_billing" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_subscription_billing_tenant" ON "subscription_billing" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_organization" ON "subscription_billing" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_subscription_billing_period" ON "subscription_billing" ("subscriptionId", "periodStart") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_due" ON "subscription_billing" ("status", "dueAt") WHERE "status" IN ('PENDING', 'FAILED')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_order" ON "subscription_billing" ("orderId") WHERE "orderId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_retry" ON "subscription_billing" ("status", "nextRetryAt") WHERE "nextRetryAt" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_subscription_billing_org_created" ON "subscription_billing" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_org_created"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_retry"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_order"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_due"`);
		await queryRunner.query(`DROP INDEX "UQ_subscription_billing_period"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_billing_created_by_user"`);
		await queryRunner.query(`DROP TABLE "subscription_billing"`);

		await queryRunner.query(`DROP INDEX "IDX_subscription_item_variant"`);
		await queryRunner.query(`DROP INDEX "UQ_subscription_item"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_item_created_by_user"`);
		await queryRunner.query(`DROP TABLE "subscription_item"`);

		await queryRunner.query(`DROP INDEX "IDX_subscription_payment_method"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_origin_order"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_paused"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_org_status"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_customer"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_due"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_created_by_user"`);
		await queryRunner.query(`DROP TABLE "subscription"`);

		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_product"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_active"`);
		await queryRunner.query(`DROP INDEX "UQ_subscription_plan_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_subscription_plan_created_by_user"`);
		await queryRunner.query(`DROP TABLE "subscription_plan"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no partial index, so the predicates that make a unique key business-scoped are carried
	 * by the stored generated key columns `CreateSequenceTable1791000000000` documents for the whole
	 * set: `deletedKey` for `"deletedAt" IS NULL`, and `organizationKey` for the plan's nullable scope
	 * column. Including `deletedAt` itself in the key, which this file used to do, expresses nothing —
	 * a unique index in MySQL exempts every tuple that contains a null, and `deletedAt` is null on
	 * exactly the live rows. The service checks the code's uniqueness on every write as well, so the
	 * constraint and the audit agree.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`subscription_plan\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NOT NULL, \`description\` text NULL, \`productId\` varchar(36) NULL, \`variantId\` varchar(36) NULL, \`billingPeriod\` varchar(16) NOT NULL DEFAULT 'MONTHLY', \`billingInterval\` int NOT NULL DEFAULT 1, \`maxBillingCycles\` int NULL, \`trialDays\` int NULL, \`setupFee\` decimal(20,6) NULL, \`discountPercentage\` decimal(9,6) NULL, \`currency\` varchar(3) NOT NULL, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_subscription_plan_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_subscription_plan_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_subscription_plan_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_subscription_plan_is_active\` (\`isActive\`), INDEX \`IDX_subscription_plan_is_archived\` (\`isArchived\`), INDEX \`IDX_subscription_plan_tenant\` (\`tenantId\`), INDEX \`IDX_subscription_plan_organization\` (\`organizationId\`), INDEX \`IDX_subscription_plan_active\` (\`organizationId\`, \`isActive\`, \`billingPeriod\`), INDEX \`IDX_subscription_plan_product\` (\`productId\`), INDEX \`IDX_subscription_plan_variant\` (\`variantId\`), CONSTRAINT \`CHK_subscription_plan_target_xor\` CHECK (((\`productId\` IS NULL) OR (\`variantId\` IS NULL))), CONSTRAINT \`CHK_subscription_plan_interval\` CHECK ((\`billingInterval\` >= 1)), CONSTRAINT \`CHK_subscription_plan_discount\` CHECK ((\`discountPercentage\` IS NULL OR (\`discountPercentage\` >= 0 AND \`discountPercentage\` <= 1))), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_subscription_plan_org_code\` ON \`subscription_plan\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`subscription\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`planId\` varchar(36) NOT NULL, \`customerId\` varchar(36) NOT NULL, \`originOrderId\` varchar(36) NULL, \`paymentAccountHolderId\` varchar(36) NULL, \`paymentMethodTokenId\` varchar(36) NULL, \`status\` varchar(16) NOT NULL DEFAULT 'PENDING', \`quantity\` decimal(20,6) NOT NULL DEFAULT 1, \`currentPeriodStart\` datetime NULL, \`currentPeriodEnd\` datetime NULL, \`nextBillingAt\` datetime NULL, \`billingCycleCount\` int NOT NULL DEFAULT 0, \`pausedUntil\` datetime NULL, \`canceledAt\` datetime NULL, \`cancelReason\` varchar(255) NULL, \`currency\` varchar(3) NOT NULL, \`metadata\` json NULL, INDEX \`IDX_subscription_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_subscription_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_subscription_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_subscription_is_active\` (\`isActive\`), INDEX \`IDX_subscription_is_archived\` (\`isArchived\`), INDEX \`IDX_subscription_tenant\` (\`tenantId\`), INDEX \`IDX_subscription_organization\` (\`organizationId\`), INDEX \`IDX_subscription_due\` (\`status\`, \`nextBillingAt\`), INDEX \`IDX_subscription_customer\` (\`customerId\`, \`status\`), INDEX \`IDX_subscription_plan\` (\`planId\`, \`status\`), INDEX \`IDX_subscription_org_status\` (\`organizationId\`, \`status\`), INDEX \`IDX_subscription_paused\` (\`status\`, \`pausedUntil\`), INDEX \`IDX_subscription_origin_order\` (\`originOrderId\`), INDEX \`IDX_subscription_payment_method\` (\`paymentAccountHolderId\`, \`paymentMethodTokenId\`), CONSTRAINT \`CHK_subscription_period_order\` CHECK ((\`currentPeriodStart\` IS NULL OR \`currentPeriodEnd\` IS NULL OR \`currentPeriodStart\` < \`currentPeriodEnd\`)), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);

		await queryRunner.query(
			`CREATE TABLE \`subscription_item\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`subscriptionId\` varchar(36) NOT NULL, \`variantId\` varchar(36) NOT NULL, \`quantity\` decimal(20,6) NOT NULL DEFAULT 1, \`unitPrice\` decimal(20,6) NOT NULL, \`position\` int NOT NULL DEFAULT 0, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_subscription_item_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_subscription_item_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_subscription_item_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_subscription_item_is_active\` (\`isActive\`), INDEX \`IDX_subscription_item_is_archived\` (\`isArchived\`), INDEX \`IDX_subscription_item_tenant\` (\`tenantId\`), INDEX \`IDX_subscription_item_organization\` (\`organizationId\`), INDEX \`IDX_subscription_item_variant\` (\`variantId\`), CONSTRAINT \`CHK_subscription_item_quantity\` CHECK ((\`quantity\` >= 0)), CONSTRAINT \`CHK_subscription_item_price\` CHECK ((\`unitPrice\` >= 0)), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_subscription_item\` ON \`subscription_item\` (\`subscriptionId\`, \`variantId\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`subscription_billing\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`subscriptionId\` varchar(36) NOT NULL, \`orderId\` varchar(36) NULL, \`periodStart\` datetime NOT NULL, \`periodEnd\` datetime NOT NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'PENDING', \`dueAt\` datetime NULL, \`paidAt\` datetime NULL, \`attemptCount\` int NOT NULL DEFAULT 0, \`lastError\` text NULL, \`nextRetryAt\` datetime NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_subscription_billing_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_subscription_billing_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_subscription_billing_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_subscription_billing_is_active\` (\`isActive\`), INDEX \`IDX_subscription_billing_is_archived\` (\`isArchived\`), INDEX \`IDX_subscription_billing_tenant\` (\`tenantId\`), INDEX \`IDX_subscription_billing_organization\` (\`organizationId\`), INDEX \`IDX_subscription_billing_due\` (\`status\`, \`dueAt\`), INDEX \`IDX_subscription_billing_order\` (\`orderId\`), INDEX \`IDX_subscription_billing_retry\` (\`status\`, \`nextRetryAt\`), INDEX \`IDX_subscription_billing_org_created\` (\`organizationId\`, \`createdAt\`), CONSTRAINT \`CHK_subscription_billing_period\` CHECK ((\`periodStart\` < \`periodEnd\`)), CONSTRAINT \`CHK_subscription_billing_amount\` CHECK ((\`amount\` >= 0)), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_subscription_billing_period\` ON \`subscription_billing\` (\`subscriptionId\`, \`periodStart\`, \`deletedKey\`)`
		);

		/*
		 * Foreign keys. Every table exists by now, so the order between them no longer matters.
		 */
		await queryRunner.query(
			`ALTER TABLE \`subscription_plan\` ADD CONSTRAINT \`FK_subscription_plan_product\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription_plan\` ADD CONSTRAINT \`FK_subscription_plan_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription\` ADD CONSTRAINT \`FK_subscription_plan\` FOREIGN KEY (\`planId\`) REFERENCES \`subscription_plan\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription\` ADD CONSTRAINT \`FK_subscription_customer\` FOREIGN KEY (\`customerId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription\` ADD CONSTRAINT \`FK_subscription_origin_order\` FOREIGN KEY (\`originOrderId\`) REFERENCES \`order\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription\` ADD CONSTRAINT \`FK_subscription_account_holder\` FOREIGN KEY (\`paymentAccountHolderId\`) REFERENCES \`payment_account_holder\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription\` ADD CONSTRAINT \`FK_subscription_payment_token\` FOREIGN KEY (\`paymentMethodTokenId\`) REFERENCES \`payment_method_token\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription_item\` ADD CONSTRAINT \`FK_subscription_item_subscription\` FOREIGN KEY (\`subscriptionId\`) REFERENCES \`subscription\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription_item\` ADD CONSTRAINT \`FK_subscription_item_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription_billing\` ADD CONSTRAINT \`FK_subscription_billing_subscription\` FOREIGN KEY (\`subscriptionId\`) REFERENCES \`subscription\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription_billing\` ADD CONSTRAINT \`FK_subscription_billing_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`subscription_billing\` DROP FOREIGN KEY \`FK_subscription_billing_order\``
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription_billing\` DROP FOREIGN KEY \`FK_subscription_billing_subscription\``
		);
		await queryRunner.query(`ALTER TABLE \`subscription_item\` DROP FOREIGN KEY \`FK_subscription_item_variant\``);
		await queryRunner.query(
			`ALTER TABLE \`subscription_item\` DROP FOREIGN KEY \`FK_subscription_item_subscription\``
		);
		await queryRunner.query(`ALTER TABLE \`subscription\` DROP FOREIGN KEY \`FK_subscription_payment_token\``);
		await queryRunner.query(`ALTER TABLE \`subscription\` DROP FOREIGN KEY \`FK_subscription_account_holder\``);
		await queryRunner.query(`ALTER TABLE \`subscription\` DROP FOREIGN KEY \`FK_subscription_origin_order\``);
		await queryRunner.query(`ALTER TABLE \`subscription\` DROP FOREIGN KEY \`FK_subscription_customer\``);
		await queryRunner.query(`ALTER TABLE \`subscription\` DROP FOREIGN KEY \`FK_subscription_plan\``);
		await queryRunner.query(`ALTER TABLE \`subscription_plan\` DROP FOREIGN KEY \`FK_subscription_plan_variant\``);
		await queryRunner.query(`ALTER TABLE \`subscription_plan\` DROP FOREIGN KEY \`FK_subscription_plan_product\``);

		await queryRunner.query(`DROP TABLE \`subscription_billing\``);
		await queryRunner.query(`DROP TABLE \`subscription_item\``);
		await queryRunner.query(`DROP TABLE \`subscription\``);
		await queryRunner.query(`DROP TABLE \`subscription_plan\``);
	}
}
