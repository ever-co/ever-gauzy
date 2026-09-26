import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the cart family and the checkout session.
 *
 * The five `commerce_`-prefixed tables are the only tables in the programme that carry a domain
 * prefix. Both conditions of the naming rule hold for them: a cart has no meaning outside an online
 * purchase, and the bare name is ambiguous next to a purchase-requisition basket and a point-of-sale
 * basket. Nothing else in this migration — or in any other migration of this programme — is prefixed.
 *
 * Two columns are deliberately created **without** their foreign key, because the set that owns the
 * target table runs later and adds the constraint itself (the migration plan's rule 10):
 *
 * - `commerce_cart.orderId` → `order`, added by `AddPaymentOrderForeignKey1791000000230` in the order
 *   set, which is the set that creates `order` and which also owns the uniqueness of a completed cart.
 * - `commerce_cart_shipping_method.shippingOptionId` → `shipping_option`, added by
 *   `AddCartShippingOptionForeignKey1791000000250` in the fulfilment set.
 *
 * `commerce_cart_promotion.promotionId` / `couponId` and `commerce_cart_line.subscriptionPlanId`
 * reference tables of packages installed later than this one and carry no constraint, by the same
 * rule: a cart must be installable on its own, and a promotion or a subscription plan that is deleted
 * must not take a cart's history with it.
 *
 * The partial unique indexes below are the Postgres and SQLite form. MySQL has no filtered index, so
 * its branch carries the two documented fallbacks instead: the unique tuples are enforced by the
 * services inside their writing transactions and audited by the `schema-uniqueness-audit` job, and the
 * equivalent lookup indexes are created unfiltered. Each such index names its rule in a comment.
 */
export class CreateCartTables1791000000200 implements MigrationInterface {
	name = 'CreateCartTables1791000000200';

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
			`CREATE TABLE "commerce_cart" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "channelId" uuid NOT NULL, "regionId" uuid, "customerId" uuid, "userId" uuid, "email" character varying(255), "currency" character varying(3) NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT 2, "locale" character varying(10), "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "completedAt" TIMESTAMP, "abandonedAt" TIMESTAMP, "expiresAt" TIMESTAMP, "lastActivityAt" TIMESTAMP, "orderId" uuid, "shippingAddressId" uuid, "billingAddressId" uuid, "shippingAddressSnapshot" jsonb, "billingAddressSnapshot" jsonb, "note" text, "isTaxExempt" boolean NOT NULL DEFAULT false, "version" integer NOT NULL DEFAULT 1, "itemSubtotal" numeric(20,6) NOT NULL DEFAULT 0, "itemDiscountTotal" numeric(20,6) NOT NULL DEFAULT 0, "itemTaxTotal" numeric(20,6) NOT NULL DEFAULT 0, "shippingSubtotal" numeric(20,6) NOT NULL DEFAULT 0, "shippingDiscountTotal" numeric(20,6) NOT NULL DEFAULT 0, "shippingTaxTotal" numeric(20,6) NOT NULL DEFAULT 0, "discountTotal" numeric(20,6) NOT NULL DEFAULT 0, "taxTotal" numeric(20,6) NOT NULL DEFAULT 0, "grandTotal" numeric(20,6) NOT NULL DEFAULT 0, "paidTotal" numeric(20,6) NOT NULL DEFAULT 0, "refundedTotal" numeric(20,6) NOT NULL DEFAULT 0, "metadata" jsonb, "externalId" character varying(255), CONSTRAINT "PK_commerce_cart_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_created_by_user" ON "commerce_cart" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_updated_by_user" ON "commerce_cart" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_deleted_by_user" ON "commerce_cart" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_is_active" ON "commerce_cart" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_is_archived" ON "commerce_cart" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_tenant" ON "commerce_cart" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_organization" ON "commerce_cart" ("organizationId")`);
		// The abandonment and expiry scans read exactly this tuple.
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_activity" ON "commerce_cart" ("status", "lastActivityAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_customer" ON "commerce_cart" ("customerId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_email" ON "commerce_cart" ("email", "status") WHERE "email" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_expiry" ON "commerce_cart" ("status", "expiresAt") WHERE "status" = 'ACTIVE'`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_channel" ON "commerce_cart" ("channelId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_org_activity" ON "commerce_cart" ("organizationId", "lastActivityAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_region" ON "commerce_cart" ("regionId") WHERE "regionId" IS NOT NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_user" ON "commerce_cart" ("userId") WHERE "userId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_external" ON "commerce_cart" ("externalId") WHERE "externalId" IS NOT NULL`
		);
		// A cart becomes exactly one order, and only when it completes: the predicate is what makes a
		// second completion impossible rather than merely unlikely.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_commerce_cart_order" ON "commerce_cart" ("orderId") WHERE "orderId" IS NOT NULL AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "commerce_cart_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "cartId" uuid NOT NULL, "productId" uuid, "variantId" uuid, "sellerId" uuid, "title" character varying(255) NOT NULL, "sku" character varying(128), "thumbnail" character varying(1024), "quantity" numeric(20,6) NOT NULL, "unitPrice" numeric(20,6) NOT NULL, "originalUnitPrice" numeric(20,6) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT false, "taxCategoryId" uuid, "isDiscountable" boolean NOT NULL DEFAULT true, "requiresShipping" boolean NOT NULL DEFAULT true, "weight" numeric(12,4), "position" integer NOT NULL DEFAULT 0, "note" text, "warehouseId" uuid, "subscriptionPlanId" uuid, "metadata" jsonb, CONSTRAINT "PK_commerce_cart_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_created_by_user" ON "commerce_cart_line" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_updated_by_user" ON "commerce_cart_line" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_deleted_by_user" ON "commerce_cart_line" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_is_active" ON "commerce_cart_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_is_archived" ON "commerce_cart_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_tenant" ON "commerce_cart_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_organization" ON "commerce_cart_line" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_cart" ON "commerce_cart_line" ("cartId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_variant" ON "commerce_cart_line" ("variantId") WHERE "variantId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_org_created" ON "commerce_cart_line" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_product" ON "commerce_cart_line" ("productId") WHERE "productId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_tax_category" ON "commerce_cart_line" ("taxCategoryId") WHERE "taxCategoryId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_warehouse" ON "commerce_cart_line" ("warehouseId") WHERE "warehouseId" IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "commerce_cart_line" ADD CONSTRAINT "FK_commerce_cart_line_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "commerce_cart_shipping_method" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "cartId" uuid NOT NULL, "shippingOptionId" uuid, "name" character varying(255) NOT NULL, "amount" numeric(20,6) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT false, "data" jsonb, "isManual" boolean NOT NULL DEFAULT false, "taxCategoryId" uuid, "position" integer NOT NULL DEFAULT 0, "metadata" jsonb, CONSTRAINT "PK_commerce_cart_shipping_method_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_created_by_user" ON "commerce_cart_shipping_method" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_updated_by_user" ON "commerce_cart_shipping_method" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_deleted_by_user" ON "commerce_cart_shipping_method" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_is_active" ON "commerce_cart_shipping_method" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_is_archived" ON "commerce_cart_shipping_method" ("isArchived")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_tenant" ON "commerce_cart_shipping_method" ("tenantId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_organization" ON "commerce_cart_shipping_method" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_cart" ON "commerce_cart_shipping_method" ("cartId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_option" ON "commerce_cart_shipping_method" ("shippingOptionId") WHERE "shippingOptionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_tax_category" ON "commerce_cart_shipping_method" ("taxCategoryId") WHERE "taxCategoryId" IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "commerce_cart_shipping_method" ADD CONSTRAINT "FK_commerce_cart_shipping_method_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "commerce_cart_promotion" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "cartId" uuid NOT NULL, "promotionId" uuid, "couponId" uuid, "code" character varying(64), "amount" numeric(20,6) NOT NULL, "isAutomatic" boolean NOT NULL DEFAULT false, "appliedAt" TIMESTAMP, CONSTRAINT "PK_commerce_cart_promotion_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_created_by_user" ON "commerce_cart_promotion" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_updated_by_user" ON "commerce_cart_promotion" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_deleted_by_user" ON "commerce_cart_promotion" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_promotion_is_active" ON "commerce_cart_promotion" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_is_archived" ON "commerce_cart_promotion" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_promotion_tenant" ON "commerce_cart_promotion" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_organization" ON "commerce_cart_promotion" ("organizationId")`
		);
		// A promotion appears at most once per cart.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_commerce_cart_promotion" ON "commerce_cart_promotion" ("cartId", "promotionId") WHERE "promotionId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_cart" ON "commerce_cart_promotion" ("cartId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_promotion" ON "commerce_cart_promotion" ("promotionId") WHERE "promotionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_coupon" ON "commerce_cart_promotion" ("couponId") WHERE "couponId" IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "commerce_cart_promotion" ADD CONSTRAINT "FK_commerce_cart_promotion_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "commerce_checkout_session" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "cartId" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'STARTED', "step" character varying(64), "completedSteps" text, "data" jsonb, "expiresAt" TIMESTAMP, "operationId" uuid, CONSTRAINT "PK_commerce_checkout_session_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_created_by_user" ON "commerce_checkout_session" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_updated_by_user" ON "commerce_checkout_session" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_deleted_by_user" ON "commerce_checkout_session" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_checkout_session_is_active" ON "commerce_checkout_session" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_is_archived" ON "commerce_checkout_session" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_checkout_session_tenant" ON "commerce_checkout_session" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_organization" ON "commerce_checkout_session" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_cart" ON "commerce_checkout_session" ("cartId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_expiry" ON "commerce_checkout_session" ("status", "expiresAt") WHERE "status" IN ('STARTED','IN_PROGRESS')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_operation" ON "commerce_checkout_session" ("operationId") WHERE "operationId" IS NOT NULL`
		);
		// At most one non-terminal checkout session per cart.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_commerce_checkout_session_active" ON "commerce_checkout_session" ("cartId") WHERE "status" IN ('STARTED','IN_PROGRESS') AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "commerce_checkout_session" ADD CONSTRAINT "FK_commerce_checkout_session_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "commerce_checkout_session" DROP CONSTRAINT "FK_commerce_checkout_session_cart"`
		);
		await queryRunner.query(`DROP TABLE "commerce_checkout_session"`);
		await queryRunner.query(`ALTER TABLE "commerce_cart_promotion" DROP CONSTRAINT "FK_commerce_cart_promotion_cart"`);
		await queryRunner.query(`DROP TABLE "commerce_cart_promotion"`);
		await queryRunner.query(
			`ALTER TABLE "commerce_cart_shipping_method" DROP CONSTRAINT "FK_commerce_cart_shipping_method_cart"`
		);
		await queryRunner.query(`DROP TABLE "commerce_cart_shipping_method"`);
		await queryRunner.query(`ALTER TABLE "commerce_cart_line" DROP CONSTRAINT "FK_commerce_cart_line_cart"`);
		await queryRunner.query(`DROP TABLE "commerce_cart_line"`);
		await queryRunner.query(`DROP TABLE "commerce_cart"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "commerce_cart" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "channelId" varchar NOT NULL, "regionId" varchar, "customerId" varchar, "userId" varchar, "email" varchar(255), "currency" varchar(3) NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT (2), "locale" varchar(10), "status" varchar(16) NOT NULL DEFAULT ('ACTIVE'), "completedAt" datetime, "abandonedAt" datetime, "expiresAt" datetime, "lastActivityAt" datetime, "orderId" varchar, "shippingAddressId" varchar, "billingAddressId" varchar, "shippingAddressSnapshot" text, "billingAddressSnapshot" text, "note" text, "isTaxExempt" boolean NOT NULL DEFAULT (0), "version" integer NOT NULL DEFAULT (1), "itemSubtotal" numeric(20,6) NOT NULL DEFAULT (0), "itemDiscountTotal" numeric(20,6) NOT NULL DEFAULT (0), "itemTaxTotal" numeric(20,6) NOT NULL DEFAULT (0), "shippingSubtotal" numeric(20,6) NOT NULL DEFAULT (0), "shippingDiscountTotal" numeric(20,6) NOT NULL DEFAULT (0), "shippingTaxTotal" numeric(20,6) NOT NULL DEFAULT (0), "discountTotal" numeric(20,6) NOT NULL DEFAULT (0), "taxTotal" numeric(20,6) NOT NULL DEFAULT (0), "grandTotal" numeric(20,6) NOT NULL DEFAULT (0), "paidTotal" numeric(20,6) NOT NULL DEFAULT (0), "refundedTotal" numeric(20,6) NOT NULL DEFAULT (0), "metadata" text, "externalId" varchar(255))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_created_by_user" ON "commerce_cart" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_updated_by_user" ON "commerce_cart" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_deleted_by_user" ON "commerce_cart" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_is_active" ON "commerce_cart" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_is_archived" ON "commerce_cart" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_tenant" ON "commerce_cart" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_organization" ON "commerce_cart" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_activity" ON "commerce_cart" ("status", "lastActivityAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_customer" ON "commerce_cart" ("customerId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_email" ON "commerce_cart" ("email", "status") WHERE "email" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_expiry" ON "commerce_cart" ("status", "expiresAt") WHERE "status" = 'ACTIVE'`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_channel" ON "commerce_cart" ("channelId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_org_activity" ON "commerce_cart" ("organizationId", "lastActivityAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_region" ON "commerce_cart" ("regionId") WHERE "regionId" IS NOT NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_user" ON "commerce_cart" ("userId") WHERE "userId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_external" ON "commerce_cart" ("externalId") WHERE "externalId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_commerce_cart_order" ON "commerce_cart" ("orderId") WHERE "orderId" IS NOT NULL AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "commerce_cart_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "cartId" varchar NOT NULL, "productId" varchar, "variantId" varchar, "sellerId" varchar, "title" varchar(255) NOT NULL, "sku" varchar(128), "thumbnail" varchar(1024), "quantity" numeric(20,6) NOT NULL, "unitPrice" numeric(20,6) NOT NULL, "originalUnitPrice" numeric(20,6) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT (0), "taxCategoryId" varchar, "isDiscountable" boolean NOT NULL DEFAULT (1), "requiresShipping" boolean NOT NULL DEFAULT (1), "weight" numeric(12,4), "position" integer NOT NULL DEFAULT (0), "note" text, "warehouseId" varchar, "subscriptionPlanId" varchar, "metadata" text, CONSTRAINT "FK_commerce_cart_line_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_created_by_user" ON "commerce_cart_line" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_updated_by_user" ON "commerce_cart_line" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_deleted_by_user" ON "commerce_cart_line" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_is_active" ON "commerce_cart_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_is_archived" ON "commerce_cart_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_tenant" ON "commerce_cart_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_line_organization" ON "commerce_cart_line" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_cart" ON "commerce_cart_line" ("cartId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_variant" ON "commerce_cart_line" ("variantId") WHERE "variantId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_org_created" ON "commerce_cart_line" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_product" ON "commerce_cart_line" ("productId") WHERE "productId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_tax_category" ON "commerce_cart_line" ("taxCategoryId") WHERE "taxCategoryId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_line_warehouse" ON "commerce_cart_line" ("warehouseId") WHERE "warehouseId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "commerce_cart_shipping_method" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "cartId" varchar NOT NULL, "shippingOptionId" varchar, "name" varchar(255) NOT NULL, "amount" numeric(20,6) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT (0), "data" text, "isManual" boolean NOT NULL DEFAULT (0), "taxCategoryId" varchar, "position" integer NOT NULL DEFAULT (0), "metadata" text, CONSTRAINT "FK_commerce_cart_shipping_method_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_created_by_user" ON "commerce_cart_shipping_method" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_updated_by_user" ON "commerce_cart_shipping_method" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_deleted_by_user" ON "commerce_cart_shipping_method" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_is_active" ON "commerce_cart_shipping_method" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_is_archived" ON "commerce_cart_shipping_method" ("isArchived")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_tenant" ON "commerce_cart_shipping_method" ("tenantId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_organization" ON "commerce_cart_shipping_method" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_cart" ON "commerce_cart_shipping_method" ("cartId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_option" ON "commerce_cart_shipping_method" ("shippingOptionId") WHERE "shippingOptionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_shipping_method_tax_category" ON "commerce_cart_shipping_method" ("taxCategoryId") WHERE "taxCategoryId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "commerce_cart_promotion" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "cartId" varchar NOT NULL, "promotionId" varchar, "couponId" varchar, "code" varchar(64), "amount" numeric(20,6) NOT NULL, "isAutomatic" boolean NOT NULL DEFAULT (0), "appliedAt" datetime, CONSTRAINT "FK_commerce_cart_promotion_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_created_by_user" ON "commerce_cart_promotion" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_updated_by_user" ON "commerce_cart_promotion" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_deleted_by_user" ON "commerce_cart_promotion" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_promotion_is_active" ON "commerce_cart_promotion" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_is_archived" ON "commerce_cart_promotion" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_cart_promotion_tenant" ON "commerce_cart_promotion" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_organization" ON "commerce_cart_promotion" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_commerce_cart_promotion" ON "commerce_cart_promotion" ("cartId", "promotionId") WHERE "promotionId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_cart" ON "commerce_cart_promotion" ("cartId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_promotion" ON "commerce_cart_promotion" ("promotionId") WHERE "promotionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_cart_promotion_coupon" ON "commerce_cart_promotion" ("couponId") WHERE "couponId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "commerce_checkout_session" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "cartId" varchar NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('STARTED'), "step" varchar(64), "completedSteps" text, "data" text, "expiresAt" datetime, "operationId" varchar, CONSTRAINT "FK_commerce_checkout_session_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_created_by_user" ON "commerce_checkout_session" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_updated_by_user" ON "commerce_checkout_session" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_deleted_by_user" ON "commerce_checkout_session" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_checkout_session_is_active" ON "commerce_checkout_session" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_is_archived" ON "commerce_checkout_session" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_commerce_checkout_session_tenant" ON "commerce_checkout_session" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_organization" ON "commerce_checkout_session" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_cart" ON "commerce_checkout_session" ("cartId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_expiry" ON "commerce_checkout_session" ("status", "expiresAt") WHERE "status" IN ('STARTED','IN_PROGRESS')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_commerce_checkout_session_operation" ON "commerce_checkout_session" ("operationId") WHERE "operationId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_commerce_checkout_session_active" ON "commerce_checkout_session" ("cartId") WHERE "status" IN ('STARTED','IN_PROGRESS') AND "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "UQ_commerce_checkout_session_active"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_checkout_session_operation"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_checkout_session_expiry"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_checkout_session_cart"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_checkout_session_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_checkout_session_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_checkout_session_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_checkout_session_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_checkout_session_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_checkout_session_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_checkout_session_created_by_user"`);
		await queryRunner.query(`DROP TABLE "commerce_checkout_session"`);

		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_promotion_coupon"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_promotion_promotion"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_promotion_cart"`);
		await queryRunner.query(`DROP INDEX "UQ_commerce_cart_promotion"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_promotion_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_promotion_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_promotion_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_promotion_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_promotion_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_promotion_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_promotion_created_by_user"`);
		await queryRunner.query(`DROP TABLE "commerce_cart_promotion"`);

		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_shipping_method_tax_category"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_shipping_method_option"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_shipping_method_cart"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_shipping_method_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_shipping_method_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_shipping_method_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_shipping_method_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_shipping_method_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_shipping_method_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_shipping_method_created_by_user"`);
		await queryRunner.query(`DROP TABLE "commerce_cart_shipping_method"`);

		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_tax_category"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_product"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_org_created"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_cart"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "commerce_cart_line"`);

		await queryRunner.query(`DROP INDEX "UQ_commerce_cart_order"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_external"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_user"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_region"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_org_activity"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_channel"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_expiry"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_email"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_customer"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_activity"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_commerce_cart_created_by_user"`);
		await queryRunner.query(`DROP TABLE "commerce_cart"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`commerce_cart\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`channelId\` varchar(36) NOT NULL, \`regionId\` varchar(36) NULL, \`customerId\` varchar(36) NULL, \`userId\` varchar(36) NULL, \`email\` varchar(255) NULL, \`currency\` varchar(3) NOT NULL, \`currencyDecimals\` int NOT NULL DEFAULT 2, \`locale\` varchar(10) NULL, \`status\` varchar(16) NOT NULL DEFAULT 'ACTIVE', \`completedAt\` datetime NULL, \`abandonedAt\` datetime NULL, \`expiresAt\` datetime NULL, \`lastActivityAt\` datetime NULL, \`orderId\` varchar(36) NULL, \`shippingAddressId\` varchar(36) NULL, \`billingAddressId\` varchar(36) NULL, \`shippingAddressSnapshot\` json NULL, \`billingAddressSnapshot\` json NULL, \`note\` text NULL, \`isTaxExempt\` tinyint NOT NULL DEFAULT 0, \`version\` int NOT NULL DEFAULT 1, \`itemSubtotal\` decimal(20,6) NOT NULL DEFAULT 0, \`itemDiscountTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`itemTaxTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`shippingSubtotal\` decimal(20,6) NOT NULL DEFAULT 0, \`shippingDiscountTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`shippingTaxTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`discountTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`taxTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`grandTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`paidTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`refundedTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`metadata\` json NULL, \`externalId\` varchar(255) NULL, INDEX \`IDX_commerce_cart_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_commerce_cart_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_commerce_cart_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_commerce_cart_is_active\` (\`isActive\`), INDEX \`IDX_commerce_cart_is_archived\` (\`isArchived\`), INDEX \`IDX_commerce_cart_tenant\` (\`tenantId\`), INDEX \`IDX_commerce_cart_organization\` (\`organizationId\`), INDEX \`IDX_commerce_cart_activity\` (\`status\`, \`lastActivityAt\`), INDEX \`IDX_commerce_cart_customer\` (\`customerId\`, \`status\`), INDEX \`IDX_commerce_cart_email\` (\`email\`, \`status\`), INDEX \`IDX_commerce_cart_expiry\` (\`status\`, \`expiresAt\`), INDEX \`IDX_commerce_cart_channel\` (\`channelId\`, \`status\`), INDEX \`IDX_commerce_cart_org_activity\` (\`organizationId\`, \`lastActivityAt\`), INDEX \`IDX_commerce_cart_region\` (\`regionId\`), INDEX \`IDX_commerce_cart_user\` (\`userId\`), INDEX \`IDX_commerce_cart_external\` (\`externalId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// MySQL has no filtered index. "One order per completed cart" is enforced inside the completing
		// transaction by CommerceCartService.complete and audited by the schema-uniqueness-audit job; the
		// index below serves the lookup that enforcement performs.
		await queryRunner.query(`CREATE INDEX \`IDX_commerce_cart_order\` ON \`commerce_cart\` (\`orderId\`)`);

		await queryRunner.query(
			`CREATE TABLE \`commerce_cart_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`cartId\` varchar(36) NOT NULL, \`productId\` varchar(36) NULL, \`variantId\` varchar(36) NULL, \`sellerId\` varchar(36) NULL, \`title\` varchar(255) NOT NULL, \`sku\` varchar(128) NULL, \`thumbnail\` varchar(1024) NULL, \`quantity\` decimal(20,6) NOT NULL, \`unitPrice\` decimal(20,6) NOT NULL, \`originalUnitPrice\` decimal(20,6) NOT NULL, \`isTaxInclusive\` tinyint NOT NULL DEFAULT 0, \`taxCategoryId\` varchar(36) NULL, \`isDiscountable\` tinyint NOT NULL DEFAULT 1, \`requiresShipping\` tinyint NOT NULL DEFAULT 1, \`weight\` decimal(12,4) NULL, \`position\` int NOT NULL DEFAULT 0, \`note\` text NULL, \`warehouseId\` varchar(36) NULL, \`subscriptionPlanId\` varchar(36) NULL, \`metadata\` json NULL, INDEX \`IDX_commerce_cart_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_commerce_cart_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_commerce_cart_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_commerce_cart_line_is_active\` (\`isActive\`), INDEX \`IDX_commerce_cart_line_is_archived\` (\`isArchived\`), INDEX \`IDX_commerce_cart_line_tenant\` (\`tenantId\`), INDEX \`IDX_commerce_cart_line_organization\` (\`organizationId\`), INDEX \`IDX_commerce_cart_line_cart\` (\`cartId\`, \`position\`), INDEX \`IDX_commerce_cart_line_variant\` (\`variantId\`), INDEX \`IDX_commerce_cart_line_org_created\` (\`organizationId\`, \`createdAt\`), INDEX \`IDX_commerce_cart_line_product\` (\`productId\`), INDEX \`IDX_commerce_cart_line_tax_category\` (\`taxCategoryId\`), INDEX \`IDX_commerce_cart_line_warehouse\` (\`warehouseId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`commerce_cart_line\` ADD CONSTRAINT \`FK_commerce_cart_line_cart\` FOREIGN KEY (\`cartId\`) REFERENCES \`commerce_cart\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`commerce_cart_shipping_method\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`cartId\` varchar(36) NOT NULL, \`shippingOptionId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`amount\` decimal(20,6) NOT NULL, \`isTaxInclusive\` tinyint NOT NULL DEFAULT 0, \`data\` json NULL, \`isManual\` tinyint NOT NULL DEFAULT 0, \`taxCategoryId\` varchar(36) NULL, \`position\` int NOT NULL DEFAULT 0, \`metadata\` json NULL, INDEX \`IDX_commerce_cart_shipping_method_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_commerce_cart_shipping_method_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_commerce_cart_shipping_method_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_commerce_cart_shipping_method_is_active\` (\`isActive\`), INDEX \`IDX_commerce_cart_shipping_method_is_archived\` (\`isArchived\`), INDEX \`IDX_commerce_cart_shipping_method_tenant\` (\`tenantId\`), INDEX \`IDX_commerce_cart_shipping_method_organization\` (\`organizationId\`), INDEX \`IDX_commerce_cart_shipping_method_cart\` (\`cartId\`, \`position\`), INDEX \`IDX_commerce_cart_shipping_method_option\` (\`shippingOptionId\`), INDEX \`IDX_commerce_cart_shipping_method_tax_category\` (\`taxCategoryId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`commerce_cart_shipping_method\` ADD CONSTRAINT \`FK_commerce_cart_shipping_method_cart\` FOREIGN KEY (\`cartId\`) REFERENCES \`commerce_cart\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`commerce_cart_promotion\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`cartId\` varchar(36) NOT NULL, \`promotionId\` varchar(36) NULL, \`couponId\` varchar(36) NULL, \`code\` varchar(64) NULL, \`amount\` decimal(20,6) NOT NULL, \`isAutomatic\` tinyint NOT NULL DEFAULT 0, \`appliedAt\` datetime NULL, INDEX \`IDX_commerce_cart_promotion_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_commerce_cart_promotion_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_commerce_cart_promotion_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_commerce_cart_promotion_is_active\` (\`isActive\`), INDEX \`IDX_commerce_cart_promotion_is_archived\` (\`isArchived\`), INDEX \`IDX_commerce_cart_promotion_tenant\` (\`tenantId\`), INDEX \`IDX_commerce_cart_promotion_organization\` (\`organizationId\`), INDEX \`IDX_commerce_cart_promotion_cart\` (\`cartId\`), INDEX \`IDX_commerce_cart_promotion_promotion\` (\`promotionId\`), INDEX \`IDX_commerce_cart_promotion_coupon\` (\`couponId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// "A promotion appears at most once per cart" is enforced by CommerceCartService.applyPromotion and
		// audited by the schema-uniqueness-audit job on this dialect.
		await queryRunner.query(
			`ALTER TABLE \`commerce_cart_promotion\` ADD CONSTRAINT \`FK_commerce_cart_promotion_cart\` FOREIGN KEY (\`cartId\`) REFERENCES \`commerce_cart\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`commerce_checkout_session\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`cartId\` varchar(36) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'STARTED', \`step\` varchar(64) NULL, \`completedSteps\` text NULL, \`data\` json NULL, \`expiresAt\` datetime NULL, \`operationId\` varchar(36) NULL, INDEX \`IDX_commerce_checkout_session_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_commerce_checkout_session_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_commerce_checkout_session_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_commerce_checkout_session_is_active\` (\`isActive\`), INDEX \`IDX_commerce_checkout_session_is_archived\` (\`isArchived\`), INDEX \`IDX_commerce_checkout_session_tenant\` (\`tenantId\`), INDEX \`IDX_commerce_checkout_session_organization\` (\`organizationId\`), INDEX \`IDX_commerce_checkout_session_cart\` (\`cartId\`, \`status\`), INDEX \`IDX_commerce_checkout_session_expiry\` (\`status\`, \`expiresAt\`), INDEX \`IDX_commerce_checkout_session_operation\` (\`operationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// "At most one non-terminal checkout session per cart" is enforced by
		// CommerceCheckoutSessionService.create and audited by the schema-uniqueness-audit job here.
		await queryRunner.query(
			`ALTER TABLE \`commerce_checkout_session\` ADD CONSTRAINT \`FK_commerce_checkout_session_cart\` FOREIGN KEY (\`cartId\`) REFERENCES \`commerce_cart\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`commerce_checkout_session\` DROP FOREIGN KEY \`FK_commerce_checkout_session_cart\``
		);
		await queryRunner.query(`DROP TABLE \`commerce_checkout_session\``);
		await queryRunner.query(
			`ALTER TABLE \`commerce_cart_promotion\` DROP FOREIGN KEY \`FK_commerce_cart_promotion_cart\``
		);
		await queryRunner.query(`DROP TABLE \`commerce_cart_promotion\``);
		await queryRunner.query(
			`ALTER TABLE \`commerce_cart_shipping_method\` DROP FOREIGN KEY \`FK_commerce_cart_shipping_method_cart\``
		);
		await queryRunner.query(`DROP TABLE \`commerce_cart_shipping_method\``);
		await queryRunner.query(`ALTER TABLE \`commerce_cart_line\` DROP FOREIGN KEY \`FK_commerce_cart_line_cart\``);
		await queryRunner.query(`DROP TABLE \`commerce_cart_line\``);
		await queryRunner.query(`DROP TABLE \`commerce_cart\``);
	}
}
