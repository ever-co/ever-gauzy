import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the canonical order aggregate: ten tables.
 *
 * The platform had no order table before this set. The order is the immutable commercial record, so the
 * shape of the set follows from that: the order carries identity, statuses, the version pointer and the
 * denormalised totals; the lines carry their own price snapshots; the addresses are copies rather than
 * references; the summary table keeps one row per committed version; the transaction table is the
 * append-only money ledger; the change and change-action tables are the only path by which a placed
 * order is modified; the credit-line table records money owed back to the buyer; and the history table
 * is the order's own timeline.
 *
 * Constraints that depend on a table created by a later set are deliberately absent here and are added
 * by that set's own migration: this set constrains everything it creates, and nothing else. In the other
 * direction, the foreign keys the platform's own tables declare towards this one —
 * `payment.orderId` and `commerce_cart.orderId` — are added by
 * `AddPaymentOrderForeignKey1791000000230`, which is the companion file of this set.
 *
 * Partial unique indexes are the Postgres and SQLite form. MySQL has no filtered index, so its branch
 * carries each predicate in a stored generated key column instead, in the form
 * `CreateSequenceTable1791000000000` documents for the whole set. Where a rule has no index on that
 * dialect the comment beside it says so, and the tuple is enforced by the service inside the writing
 * transaction and audited by the `schema-uniqueness-audit` job.
 */
export class CreateOrderTables1791000000220 implements MigrationInterface {
	name = 'CreateOrderTables1791000000220';

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
			`CREATE TABLE "order" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "number" character varying(64) NOT NULL, "displayId" character varying(64), "channelId" uuid NOT NULL, "regionId" uuid, "customerId" uuid, "userId" uuid, "email" character varying(255), "phone" character varying(32), "currency" character varying(3) NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT 2, "locale" character varying(10), "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "paymentStatus" character varying(32) NOT NULL DEFAULT 'NOT_PAID', "fulfillmentStatus" character varying(32) NOT NULL DEFAULT 'NOT_FULFILLED', "isDraft" boolean NOT NULL DEFAULT false, "isTest" boolean NOT NULL DEFAULT false, "cartId" uuid, "parentOrderId" uuid, "invoiceId" uuid, "quoteInvoiceId" uuid, "source" character varying(64), "shippingAddressId" uuid, "billingAddressId" uuid, "sellerCount" integer NOT NULL DEFAULT 0, "itemSubtotal" numeric(20,6) NOT NULL DEFAULT 0, "itemDiscountTotal" numeric(20,6) NOT NULL DEFAULT 0, "itemTaxTotal" numeric(20,6) NOT NULL DEFAULT 0, "shippingSubtotal" numeric(20,6) NOT NULL DEFAULT 0, "shippingDiscountTotal" numeric(20,6) NOT NULL DEFAULT 0, "shippingTaxTotal" numeric(20,6) NOT NULL DEFAULT 0, "discountTotal" numeric(20,6) NOT NULL DEFAULT 0, "taxTotal" numeric(20,6) NOT NULL DEFAULT 0, "grandTotal" numeric(20,6) NOT NULL DEFAULT 0, "paidTotal" numeric(20,6) NOT NULL DEFAULT 0, "refundedTotal" numeric(20,6) NOT NULL DEFAULT 0, "creditTotal" numeric(20,6) NOT NULL DEFAULT 0, "outstandingTotal" numeric(20,6) NOT NULL DEFAULT 0, "version" integer NOT NULL DEFAULT 1, "placedAt" TIMESTAMP, "completedAt" TIMESTAMP, "canceledAt" TIMESTAMP, "cancelReason" character varying(255), "purchaseOrderNumber" character varying(64), "metadata" jsonb, "externalId" character varying(255), CONSTRAINT "PK_order_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_created_by_user" ON "order" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_updated_by_user" ON "order" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_deleted_by_user" ON "order" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_is_active" ON "order" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_is_archived" ON "order" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_tenant" ON "order" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_organization" ON "order" ("organizationId")`);
		// The business key: a number is unique inside its channel, and the predicate is what lets a
		// deleted order release its number without ever letting two live orders collide.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_order_number" ON "order" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "channelId", "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_customer_history" ON "order" ("customerId", "placedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_org_status_placed" ON "order" ("organizationId", "status", "placedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_org_placed" ON "order" ("organizationId", "placedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_payment_status" ON "order" ("organizationId", "paymentStatus", "placedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_fulfillment_status" ON "order" ("organizationId", "fulfillmentStatus", "placedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_email" ON "order" ("email", "placedAt") WHERE "email" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_channel_number" ON "order" ("channelId", "number")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_invoice" ON "order" ("invoiceId") WHERE "invoiceId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_parent" ON "order" ("parentOrderId") WHERE "parentOrderId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_cart" ON "order" ("cartId") WHERE "cartId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_address" ON "order" ("shippingAddressId") WHERE "shippingAddressId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_billing_address" ON "order" ("billingAddressId") WHERE "billingAddressId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_region" ON "order" ("regionId") WHERE "regionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_external" ON "order" ("externalId") WHERE "externalId" IS NOT NULL`
		);
		// One upstream order maps to one order; an import run twice cannot double-place it.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_order_org_external" ON "order" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "order" ADD CONSTRAINT "FK_order_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order" ADD CONSTRAINT "FK_order_parent" FOREIGN KEY ("parentOrderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "order_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid NOT NULL, "productId" uuid, "variantId" uuid, "sellerId" uuid, "invoiceItemId" uuid, "title" character varying(255) NOT NULL, "sku" character varying(128), "barcode" character varying(64), "thumbnail" character varying(1024), "quantity" numeric(20,6) NOT NULL, "unitPrice" numeric(20,6) NOT NULL, "originalUnitPrice" numeric(20,6) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT false, "isDiscountable" boolean NOT NULL DEFAULT true, "requiresShipping" boolean NOT NULL DEFAULT true, "taxCategoryId" uuid, "weight" numeric(12,4), "position" integer NOT NULL DEFAULT 0, "note" text, "warehouseId" uuid, "subscriptionId" uuid, "fulfilledQuantity" numeric(20,6) NOT NULL DEFAULT 0, "shippedQuantity" numeric(20,6) NOT NULL DEFAULT 0, "deliveredQuantity" numeric(20,6) NOT NULL DEFAULT 0, "returnRequestedQuantity" numeric(20,6) NOT NULL DEFAULT 0, "returnReceivedQuantity" numeric(20,6) NOT NULL DEFAULT 0, "returnDismissedQuantity" numeric(20,6) NOT NULL DEFAULT 0, "writtenOffQuantity" numeric(20,6) NOT NULL DEFAULT 0, "metadata" jsonb, CONSTRAINT "PK_order_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_created_by_user" ON "order_line" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_updated_by_user" ON "order_line" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_deleted_by_user" ON "order_line" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_is_active" ON "order_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_is_archived" ON "order_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_tenant" ON "order_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_organization" ON "order_line" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_order" ON "order_line" ("orderId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_variant" ON "order_line" ("variantId") WHERE "variantId" IS NOT NULL`
		);
		// The picking query: what of this order still has to be shipped.
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_picking" ON "order_line" ("orderId", "requiresShipping", "fulfilledQuantity") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_org_created" ON "order_line" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_product" ON "order_line" ("productId") WHERE "productId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_tax_category" ON "order_line" ("taxCategoryId") WHERE "taxCategoryId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_warehouse" ON "order_line" ("warehouseId") WHERE "warehouseId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_invoice_item" ON "order_line" ("invoiceItemId") WHERE "invoiceItemId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_seller" ON "order_line" ("sellerId") WHERE "sellerId" IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "order_line" ADD CONSTRAINT "FK_order_line_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "order_address" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid NOT NULL, "type" character varying(16) NOT NULL, "sourceAddressId" uuid, "contactName" character varying(255), "company" character varying(255), "firstName" character varying(128), "lastName" character varying(128), "phone" character varying(32), "email" character varying(255), "line1" character varying(255) NOT NULL, "line2" character varying(255), "city" character varying(128) NOT NULL, "province" character varying(128), "provinceCode" character varying(16), "postalCode" character varying(32), "countryCode" character varying(2) NOT NULL, "countryId" uuid, "latitude" numeric(10,6), "longitude" numeric(10,6), CONSTRAINT "PK_order_address_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_created_by_user" ON "order_address" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_updated_by_user" ON "order_address" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_deleted_by_user" ON "order_address" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_is_active" ON "order_address" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_is_archived" ON "order_address" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_tenant" ON "order_address" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_organization" ON "order_address" ("organizationId")`);
		// An order has at most one billing and one shipping address.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_order_address_type" ON "order_address" ("orderId", "type") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_address_order" ON "order_address" ("orderId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_address_country" ON "order_address" ("countryId") WHERE "countryId" IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "order_address" ADD CONSTRAINT "FK_order_address_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "order_shipping_method" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid NOT NULL, "shippingOptionId" uuid, "name" character varying(255) NOT NULL, "amount" numeric(20,6) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT false, "taxCategoryId" uuid, "data" jsonb, "position" integer NOT NULL DEFAULT 0, "metadata" jsonb, CONSTRAINT "PK_order_shipping_method_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_created_by_user" ON "order_shipping_method" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_updated_by_user" ON "order_shipping_method" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_deleted_by_user" ON "order_shipping_method" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_shipping_method_is_active" ON "order_shipping_method" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_is_archived" ON "order_shipping_method" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_shipping_method_tenant" ON "order_shipping_method" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_organization" ON "order_shipping_method" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_order" ON "order_shipping_method" ("orderId", "position") WHERE "deletedAt" IS NULL`
		);
		// The constraint on shippingOptionId is added by the fulfilment set, which creates the option it
		// points at; this index serves the lookup the referential check will need.
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_option" ON "order_shipping_method" ("shippingOptionId") WHERE "shippingOptionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_tax_category" ON "order_shipping_method" ("taxCategoryId") WHERE "taxCategoryId" IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "order_shipping_method" ADD CONSTRAINT "FK_order_shipping_method_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "order_summary" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid NOT NULL, "version" integer NOT NULL, "totals" jsonb NOT NULL, "currency" character varying(3) NOT NULL, "reason" character varying(255), CONSTRAINT "PK_order_summary_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_created_by_user" ON "order_summary" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_updated_by_user" ON "order_summary" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_deleted_by_user" ON "order_summary" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_is_active" ON "order_summary" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_is_archived" ON "order_summary" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_tenant" ON "order_summary" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_organization" ON "order_summary" ("organizationId")`);
		// One row per version: a version is never written twice and never skipped.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_order_summary_version" ON "order_summary" ("orderId", "version") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_summary_order" ON "order_summary" ("orderId", "version") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "order_summary" ADD CONSTRAINT "FK_order_summary_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "order_transaction" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "type" character varying(16) NOT NULL, "referenceType" character varying(64), "referenceId" uuid, "description" character varying(255), "occurredAt" TIMESTAMP, "metadata" jsonb, CONSTRAINT "PK_order_transaction_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_created_by_user" ON "order_transaction" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_updated_by_user" ON "order_transaction" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_deleted_by_user" ON "order_transaction" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_is_active" ON "order_transaction" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_is_archived" ON "order_transaction" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_tenant" ON "order_transaction" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_organization" ON "order_transaction" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_transaction_order" ON "order_transaction" ("orderId", "occurredAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_transaction_type" ON "order_transaction" ("orderId", "type") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_transaction_reference" ON "order_transaction" ("referenceType", "referenceId") WHERE "referenceId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_transaction_org_occurred" ON "order_transaction" ("organizationId", "occurredAt") WHERE "deletedAt" IS NULL`
		);
		// RESTRICT, not CASCADE: an accounting record blocks the deletion of the order it settles.
		await queryRunner.query(
			`ALTER TABLE "order_transaction" ADD CONSTRAINT "FK_order_transaction_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "order_change" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid NOT NULL, "version" integer NOT NULL, "changeType" character varying(16) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'PENDING', "returnId" uuid, "claimId" uuid, "exchangeId" uuid, "subscriptionId" uuid, "requestedByUserId" uuid, "confirmedByUserId" uuid, "requestedAt" TIMESTAMP, "confirmedAt" TIMESTAMP, "declinedAt" TIMESTAMP, "canceledAt" TIMESTAMP, "note" text, "priceChange" numeric(20,6), "isSettled" boolean NOT NULL DEFAULT false, "metadata" jsonb, CONSTRAINT "PK_order_change_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_created_by_user" ON "order_change" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_updated_by_user" ON "order_change" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_deleted_by_user" ON "order_change" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_is_active" ON "order_change" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_is_archived" ON "order_change" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_tenant" ON "order_change" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_organization" ON "order_change" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_order" ON "order_change" ("orderId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_version" ON "order_change" ("orderId", "version") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_pending" ON "order_change" ("orderId", "createdAt") WHERE "status" IN ('PENDING','REQUESTED','CONFIRMED') AND "deletedAt" IS NULL`
		);
		// The exclusivity rule: at most one change per order may be non-terminal. The index is the
		// database-side expression of it on this dialect; the service takes the order row for update as
		// well, because an index alone cannot refuse a request with a useful answer.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_order_change_active" ON "order_change" ("orderId") WHERE "status" IN ('PENDING','REQUESTED','CONFIRMED') AND "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_return" ON "order_change" ("returnId") WHERE "returnId" IS NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_claim" ON "order_change" ("claimId") WHERE "claimId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_exchange" ON "order_change" ("exchangeId") WHERE "exchangeId" IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "order_change" ADD CONSTRAINT "FK_order_change_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "order_change_action" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "changeId" uuid NOT NULL, "action" character varying(32) NOT NULL, "details" jsonb, "amount" numeric(20,6), "referenceType" character varying(64), "referenceId" uuid, "ordering" integer NOT NULL DEFAULT 0, "applied" boolean NOT NULL DEFAULT false, "appliedAt" TIMESTAMP, CONSTRAINT "PK_order_change_action_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_action_created_by_user" ON "order_change_action" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_action_updated_by_user" ON "order_change_action" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_action_deleted_by_user" ON "order_change_action" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_action_is_active" ON "order_change_action" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_action_is_archived" ON "order_change_action" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_action_tenant" ON "order_change_action" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_action_organization" ON "order_change_action" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_action_change" ON "order_change_action" ("changeId", "ordering") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_action_type" ON "order_change_action" ("action") WHERE "deletedAt" IS NULL`
		);
		// An action is either applied or not; a half-applied change is not a state the ledger can express.
		await queryRunner.query(
			`ALTER TABLE "order_change_action" ADD CONSTRAINT "CHK_order_change_action_applied_at" CHECK (("applied" = true AND "appliedAt" IS NOT NULL) OR ("applied" = false AND "appliedAt" IS NULL))`
		);
		await queryRunner.query(
			`ALTER TABLE "order_change_action" ADD CONSTRAINT "FK_order_change_action_change" FOREIGN KEY ("changeId") REFERENCES "order_change"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "order_credit_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid NOT NULL, "version" integer NOT NULL, "referenceType" character varying(64), "referenceId" uuid, "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "description" character varying(255), CONSTRAINT "PK_order_credit_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_created_by_user" ON "order_credit_line" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_updated_by_user" ON "order_credit_line" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_deleted_by_user" ON "order_credit_line" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_is_active" ON "order_credit_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_is_archived" ON "order_credit_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_tenant" ON "order_credit_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_organization" ON "order_credit_line" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_credit_line_order" ON "order_credit_line" ("orderId", "version") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "order_credit_line" ADD CONSTRAINT "FK_order_credit_line_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "order_history" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid NOT NULL, "action" character varying(64) NOT NULL, "title" character varying(255), "description" text, "userId" uuid, "metadata" jsonb, CONSTRAINT "PK_order_history_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_created_by_user" ON "order_history" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_updated_by_user" ON "order_history" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_deleted_by_user" ON "order_history" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_is_active" ON "order_history" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_is_archived" ON "order_history" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_tenant" ON "order_history" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_organization" ON "order_history" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_history_order" ON "order_history" ("orderId", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_history_action" ON "order_history" ("action", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_user" ON "order_history" ("userId") WHERE "userId" IS NOT NULL`);
		await queryRunner.query(
			`ALTER TABLE "order_history" ADD CONSTRAINT "FK_order_history_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "order_history" DROP CONSTRAINT "FK_order_history_order"`);
		await queryRunner.query(`DROP TABLE "order_history"`);
		await queryRunner.query(`ALTER TABLE "order_credit_line" DROP CONSTRAINT "FK_order_credit_line_order"`);
		await queryRunner.query(`DROP TABLE "order_credit_line"`);
		await queryRunner.query(`ALTER TABLE "order_change_action" DROP CONSTRAINT "FK_order_change_action_change"`);
		await queryRunner.query(`ALTER TABLE "order_change_action" DROP CONSTRAINT "CHK_order_change_action_applied_at"`);
		await queryRunner.query(`DROP TABLE "order_change_action"`);
		await queryRunner.query(`ALTER TABLE "order_change" DROP CONSTRAINT "FK_order_change_order"`);
		await queryRunner.query(`DROP TABLE "order_change"`);
		await queryRunner.query(`ALTER TABLE "order_transaction" DROP CONSTRAINT "FK_order_transaction_order"`);
		await queryRunner.query(`DROP TABLE "order_transaction"`);
		await queryRunner.query(`ALTER TABLE "order_summary" DROP CONSTRAINT "FK_order_summary_order"`);
		await queryRunner.query(`DROP TABLE "order_summary"`);
		await queryRunner.query(
			`ALTER TABLE "order_shipping_method" DROP CONSTRAINT "FK_order_shipping_method_order"`
		);
		await queryRunner.query(`DROP TABLE "order_shipping_method"`);
		await queryRunner.query(`ALTER TABLE "order_address" DROP CONSTRAINT "FK_order_address_order"`);
		await queryRunner.query(`DROP TABLE "order_address"`);
		await queryRunner.query(`ALTER TABLE "order_line" DROP CONSTRAINT "FK_order_line_order"`);
		await queryRunner.query(`DROP TABLE "order_line"`);
		await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "FK_order_parent"`);
		await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "FK_order_cart"`);
		await queryRunner.query(`DROP TABLE "order"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "order" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar(64) NOT NULL, "displayId" varchar(64), "channelId" varchar NOT NULL, "regionId" varchar, "customerId" varchar, "userId" varchar, "email" varchar(255), "phone" varchar(32), "currency" varchar(3) NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT (2), "locale" varchar(10), "status" varchar(16) NOT NULL DEFAULT ('DRAFT'), "paymentStatus" varchar(32) NOT NULL DEFAULT ('NOT_PAID'), "fulfillmentStatus" varchar(32) NOT NULL DEFAULT ('NOT_FULFILLED'), "isDraft" boolean NOT NULL DEFAULT (0), "isTest" boolean NOT NULL DEFAULT (0), "cartId" varchar, "parentOrderId" varchar, "invoiceId" varchar, "quoteInvoiceId" varchar, "source" varchar(64), "shippingAddressId" varchar, "billingAddressId" varchar, "sellerCount" integer NOT NULL DEFAULT (0), "itemSubtotal" numeric(20,6) NOT NULL DEFAULT (0), "itemDiscountTotal" numeric(20,6) NOT NULL DEFAULT (0), "itemTaxTotal" numeric(20,6) NOT NULL DEFAULT (0), "shippingSubtotal" numeric(20,6) NOT NULL DEFAULT (0), "shippingDiscountTotal" numeric(20,6) NOT NULL DEFAULT (0), "shippingTaxTotal" numeric(20,6) NOT NULL DEFAULT (0), "discountTotal" numeric(20,6) NOT NULL DEFAULT (0), "taxTotal" numeric(20,6) NOT NULL DEFAULT (0), "grandTotal" numeric(20,6) NOT NULL DEFAULT (0), "paidTotal" numeric(20,6) NOT NULL DEFAULT (0), "refundedTotal" numeric(20,6) NOT NULL DEFAULT (0), "creditTotal" numeric(20,6) NOT NULL DEFAULT (0), "outstandingTotal" numeric(20,6) NOT NULL DEFAULT (0), "version" integer NOT NULL DEFAULT (1), "placedAt" datetime, "completedAt" datetime, "canceledAt" datetime, "cancelReason" varchar(255), "purchaseOrderNumber" varchar(64), "metadata" text, "externalId" varchar(255), CONSTRAINT "FK_order_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_order_parent" FOREIGN KEY ("parentOrderId") REFERENCES "order" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_created_by_user" ON "order" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_updated_by_user" ON "order" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_deleted_by_user" ON "order" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_is_active" ON "order" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_is_archived" ON "order" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_tenant" ON "order" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_organization" ON "order" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_order_number" ON "order" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "channelId", "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_customer_history" ON "order" ("customerId", "placedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_org_status_placed" ON "order" ("organizationId", "status", "placedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_org_placed" ON "order" ("organizationId", "placedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_payment_status" ON "order" ("organizationId", "paymentStatus", "placedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_fulfillment_status" ON "order" ("organizationId", "fulfillmentStatus", "placedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_email" ON "order" ("email", "placedAt") WHERE "email" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_channel_number" ON "order" ("channelId", "number")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_invoice" ON "order" ("invoiceId") WHERE "invoiceId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_parent" ON "order" ("parentOrderId") WHERE "parentOrderId" IS NOT NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_cart" ON "order" ("cartId") WHERE "cartId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_address" ON "order" ("shippingAddressId") WHERE "shippingAddressId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_billing_address" ON "order" ("billingAddressId") WHERE "billingAddressId" IS NOT NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_region" ON "order" ("regionId") WHERE "regionId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_external" ON "order" ("externalId") WHERE "externalId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_order_org_external" ON "order" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar NOT NULL, "productId" varchar, "variantId" varchar, "sellerId" varchar, "invoiceItemId" varchar, "title" varchar(255) NOT NULL, "sku" varchar(128), "barcode" varchar(64), "thumbnail" varchar(1024), "quantity" numeric(20,6) NOT NULL, "unitPrice" numeric(20,6) NOT NULL, "originalUnitPrice" numeric(20,6) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT (0), "isDiscountable" boolean NOT NULL DEFAULT (1), "requiresShipping" boolean NOT NULL DEFAULT (1), "taxCategoryId" varchar, "weight" numeric(12,4), "position" integer NOT NULL DEFAULT (0), "note" text, "warehouseId" varchar, "subscriptionId" varchar, "fulfilledQuantity" numeric(20,6) NOT NULL DEFAULT (0), "shippedQuantity" numeric(20,6) NOT NULL DEFAULT (0), "deliveredQuantity" numeric(20,6) NOT NULL DEFAULT (0), "returnRequestedQuantity" numeric(20,6) NOT NULL DEFAULT (0), "returnReceivedQuantity" numeric(20,6) NOT NULL DEFAULT (0), "returnDismissedQuantity" numeric(20,6) NOT NULL DEFAULT (0), "writtenOffQuantity" numeric(20,6) NOT NULL DEFAULT (0), "metadata" text, CONSTRAINT "FK_order_line_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_created_by_user" ON "order_line" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_updated_by_user" ON "order_line" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_deleted_by_user" ON "order_line" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_is_active" ON "order_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_is_archived" ON "order_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_tenant" ON "order_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_line_organization" ON "order_line" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_order" ON "order_line" ("orderId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_variant" ON "order_line" ("variantId") WHERE "variantId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_picking" ON "order_line" ("orderId", "requiresShipping", "fulfilledQuantity") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_org_created" ON "order_line" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_product" ON "order_line" ("productId") WHERE "productId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_tax_category" ON "order_line" ("taxCategoryId") WHERE "taxCategoryId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_warehouse" ON "order_line" ("warehouseId") WHERE "warehouseId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_invoice_item" ON "order_line" ("invoiceItemId") WHERE "invoiceItemId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_line_seller" ON "order_line" ("sellerId") WHERE "sellerId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_address" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar NOT NULL, "type" varchar(16) NOT NULL, "sourceAddressId" varchar, "contactName" varchar(255), "company" varchar(255), "firstName" varchar(128), "lastName" varchar(128), "phone" varchar(32), "email" varchar(255), "line1" varchar(255) NOT NULL, "line2" varchar(255), "city" varchar(128) NOT NULL, "province" varchar(128), "provinceCode" varchar(16), "postalCode" varchar(32), "countryCode" varchar(2) NOT NULL, "countryId" varchar, "latitude" numeric(10,6), "longitude" numeric(10,6), CONSTRAINT "FK_order_address_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_created_by_user" ON "order_address" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_updated_by_user" ON "order_address" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_deleted_by_user" ON "order_address" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_is_active" ON "order_address" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_is_archived" ON "order_address" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_tenant" ON "order_address" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_address_organization" ON "order_address" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_order_address_type" ON "order_address" ("orderId", "type") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_address_order" ON "order_address" ("orderId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_address_country" ON "order_address" ("countryId") WHERE "countryId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_shipping_method" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar NOT NULL, "shippingOptionId" varchar, "name" varchar(255) NOT NULL, "amount" numeric(20,6) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT (0), "taxCategoryId" varchar, "data" text, "position" integer NOT NULL DEFAULT (0), "metadata" text, CONSTRAINT "FK_order_shipping_method_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_created_by_user" ON "order_shipping_method" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_updated_by_user" ON "order_shipping_method" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_deleted_by_user" ON "order_shipping_method" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_shipping_method_is_active" ON "order_shipping_method" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_is_archived" ON "order_shipping_method" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_shipping_method_tenant" ON "order_shipping_method" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_organization" ON "order_shipping_method" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_order" ON "order_shipping_method" ("orderId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_option" ON "order_shipping_method" ("shippingOptionId") WHERE "shippingOptionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_shipping_method_tax_category" ON "order_shipping_method" ("taxCategoryId") WHERE "taxCategoryId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_summary" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar NOT NULL, "version" integer NOT NULL, "totals" text NOT NULL, "currency" varchar(3) NOT NULL, "reason" varchar(255), CONSTRAINT "FK_order_summary_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_created_by_user" ON "order_summary" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_updated_by_user" ON "order_summary" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_deleted_by_user" ON "order_summary" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_is_active" ON "order_summary" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_is_archived" ON "order_summary" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_tenant" ON "order_summary" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_summary_organization" ON "order_summary" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_order_summary_version" ON "order_summary" ("orderId", "version") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_summary_order" ON "order_summary" ("orderId", "version") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_transaction" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "type" varchar(16) NOT NULL, "referenceType" varchar(64), "referenceId" varchar, "description" varchar(255), "occurredAt" datetime, "metadata" text, CONSTRAINT "FK_order_transaction_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_created_by_user" ON "order_transaction" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_updated_by_user" ON "order_transaction" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_deleted_by_user" ON "order_transaction" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_is_active" ON "order_transaction" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_is_archived" ON "order_transaction" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_tenant" ON "order_transaction" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_transaction_organization" ON "order_transaction" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_transaction_order" ON "order_transaction" ("orderId", "occurredAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_transaction_type" ON "order_transaction" ("orderId", "type") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_transaction_reference" ON "order_transaction" ("referenceType", "referenceId") WHERE "referenceId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_transaction_org_occurred" ON "order_transaction" ("organizationId", "occurredAt") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_change" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar NOT NULL, "version" integer NOT NULL, "changeType" varchar(16) NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('PENDING'), "returnId" varchar, "claimId" varchar, "exchangeId" varchar, "subscriptionId" varchar, "requestedByUserId" varchar, "confirmedByUserId" varchar, "requestedAt" datetime, "confirmedAt" datetime, "declinedAt" datetime, "canceledAt" datetime, "note" text, "priceChange" numeric(20,6), "isSettled" boolean NOT NULL DEFAULT (0), "metadata" text, CONSTRAINT "FK_order_change_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_created_by_user" ON "order_change" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_updated_by_user" ON "order_change" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_deleted_by_user" ON "order_change" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_is_active" ON "order_change" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_is_archived" ON "order_change" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_tenant" ON "order_change" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_organization" ON "order_change" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_order" ON "order_change" ("orderId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_version" ON "order_change" ("orderId", "version") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_pending" ON "order_change" ("orderId", "createdAt") WHERE "status" IN ('PENDING','REQUESTED','CONFIRMED') AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_order_change_active" ON "order_change" ("orderId") WHERE "status" IN ('PENDING','REQUESTED','CONFIRMED') AND "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_return" ON "order_change" ("returnId") WHERE "returnId" IS NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_claim" ON "order_change" ("claimId") WHERE "claimId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_exchange" ON "order_change" ("exchangeId") WHERE "exchangeId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_change_action" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "changeId" varchar NOT NULL, "action" varchar(32) NOT NULL, "details" text, "amount" numeric(20,6), "referenceType" varchar(64), "referenceId" varchar, "ordering" integer NOT NULL DEFAULT (0), "applied" boolean NOT NULL DEFAULT (0), "appliedAt" datetime, CONSTRAINT "FK_order_change_action_change" FOREIGN KEY ("changeId") REFERENCES "order_change" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_action_created_by_user" ON "order_change_action" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_action_updated_by_user" ON "order_change_action" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_action_deleted_by_user" ON "order_change_action" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_action_is_active" ON "order_change_action" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_action_is_archived" ON "order_change_action" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_action_tenant" ON "order_change_action" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_change_action_organization" ON "order_change_action" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_action_change" ON "order_change_action" ("changeId", "ordering") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_change_action_type" ON "order_change_action" ("action") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_credit_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar NOT NULL, "version" integer NOT NULL, "referenceType" varchar(64), "referenceId" varchar, "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "description" varchar(255), CONSTRAINT "FK_order_credit_line_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_created_by_user" ON "order_credit_line" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_updated_by_user" ON "order_credit_line" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_deleted_by_user" ON "order_credit_line" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_is_active" ON "order_credit_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_is_archived" ON "order_credit_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_tenant" ON "order_credit_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_credit_line_organization" ON "order_credit_line" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_credit_line_order" ON "order_credit_line" ("orderId", "version") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_history" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar NOT NULL, "action" varchar(64) NOT NULL, "title" varchar(255), "description" text, "userId" varchar, "metadata" text, CONSTRAINT "FK_order_history_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_created_by_user" ON "order_history" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_updated_by_user" ON "order_history" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_deleted_by_user" ON "order_history" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_is_active" ON "order_history" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_is_archived" ON "order_history" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_tenant" ON "order_history" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_organization" ON "order_history" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_history_order" ON "order_history" ("orderId", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_history_action" ON "order_history" ("action", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_history_user" ON "order_history" ("userId") WHERE "userId" IS NOT NULL`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_order_history_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_history_action"`);
		await queryRunner.query(`DROP INDEX "IDX_order_history_order"`);
		await queryRunner.query(`DROP INDEX "IDX_order_history_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_history_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_history_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_history_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_history_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_history_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_history_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_history"`);

		await queryRunner.query(`DROP INDEX "IDX_order_credit_line_order"`);
		await queryRunner.query(`DROP INDEX "IDX_order_credit_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_credit_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_credit_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_credit_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_credit_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_credit_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_credit_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_credit_line"`);

		await queryRunner.query(`DROP INDEX "IDX_order_change_action_type"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_action_change"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_action_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_action_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_action_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_action_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_action_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_action_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_action_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_change_action"`);

		await queryRunner.query(`DROP INDEX "IDX_order_change_exchange"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_claim"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_return"`);
		await queryRunner.query(`DROP INDEX "UQ_order_change_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_pending"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_version"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_order"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_change_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_change"`);

		await queryRunner.query(`DROP INDEX "IDX_order_transaction_org_occurred"`);
		await queryRunner.query(`DROP INDEX "IDX_order_transaction_reference"`);
		await queryRunner.query(`DROP INDEX "IDX_order_transaction_type"`);
		await queryRunner.query(`DROP INDEX "IDX_order_transaction_order"`);
		await queryRunner.query(`DROP INDEX "IDX_order_transaction_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_transaction_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_transaction_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_transaction_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_transaction_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_transaction_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_transaction_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_transaction"`);

		await queryRunner.query(`DROP INDEX "IDX_order_summary_order"`);
		await queryRunner.query(`DROP INDEX "UQ_order_summary_version"`);
		await queryRunner.query(`DROP INDEX "IDX_order_summary_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_summary_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_summary_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_summary_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_summary_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_summary_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_summary_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_summary"`);

		await queryRunner.query(`DROP INDEX "IDX_order_shipping_method_tax_category"`);
		await queryRunner.query(`DROP INDEX "IDX_order_shipping_method_option"`);
		await queryRunner.query(`DROP INDEX "IDX_order_shipping_method_order"`);
		await queryRunner.query(`DROP INDEX "IDX_order_shipping_method_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_shipping_method_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_shipping_method_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_shipping_method_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_shipping_method_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_shipping_method_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_shipping_method_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_shipping_method"`);

		await queryRunner.query(`DROP INDEX "IDX_order_address_country"`);
		await queryRunner.query(`DROP INDEX "IDX_order_address_order"`);
		await queryRunner.query(`DROP INDEX "UQ_order_address_type"`);
		await queryRunner.query(`DROP INDEX "IDX_order_address_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_address_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_address_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_address_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_address_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_address_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_address_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_address"`);

		await queryRunner.query(`DROP INDEX "IDX_order_line_seller"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_invoice_item"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_tax_category"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_product"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_org_created"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_picking"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_order"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_line"`);

		await queryRunner.query(`DROP INDEX "UQ_order_org_external"`);
		await queryRunner.query(`DROP INDEX "IDX_order_external"`);
		await queryRunner.query(`DROP INDEX "IDX_order_region"`);
		await queryRunner.query(`DROP INDEX "IDX_order_billing_address"`);
		await queryRunner.query(`DROP INDEX "IDX_order_shipping_address"`);
		await queryRunner.query(`DROP INDEX "IDX_order_cart"`);
		await queryRunner.query(`DROP INDEX "IDX_order_parent"`);
		await queryRunner.query(`DROP INDEX "IDX_order_invoice"`);
		await queryRunner.query(`DROP INDEX "IDX_order_channel_number"`);
		await queryRunner.query(`DROP INDEX "IDX_order_email"`);
		await queryRunner.query(`DROP INDEX "IDX_order_fulfillment_status"`);
		await queryRunner.query(`DROP INDEX "IDX_order_payment_status"`);
		await queryRunner.query(`DROP INDEX "IDX_order_org_placed"`);
		await queryRunner.query(`DROP INDEX "IDX_order_org_status_placed"`);
		await queryRunner.query(`DROP INDEX "IDX_order_customer_history"`);
		await queryRunner.query(`DROP INDEX "UQ_order_number"`);
		await queryRunner.query(`DROP INDEX "IDX_order_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`order\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`number\` varchar(64) NOT NULL, \`displayId\` varchar(64) NULL, \`channelId\` varchar(36) NOT NULL, \`regionId\` varchar(36) NULL, \`customerId\` varchar(36) NULL, \`userId\` varchar(36) NULL, \`email\` varchar(255) NULL, \`phone\` varchar(32) NULL, \`currency\` varchar(3) NOT NULL, \`currencyDecimals\` int NOT NULL DEFAULT 2, \`locale\` varchar(10) NULL, \`status\` varchar(16) NOT NULL DEFAULT 'DRAFT', \`paymentStatus\` varchar(32) NOT NULL DEFAULT 'NOT_PAID', \`fulfillmentStatus\` varchar(32) NOT NULL DEFAULT 'NOT_FULFILLED', \`isDraft\` tinyint NOT NULL DEFAULT 0, \`isTest\` tinyint NOT NULL DEFAULT 0, \`cartId\` varchar(36) NULL, \`parentOrderId\` varchar(36) NULL, \`invoiceId\` varchar(36) NULL, \`quoteInvoiceId\` varchar(36) NULL, \`source\` varchar(64) NULL, \`shippingAddressId\` varchar(36) NULL, \`billingAddressId\` varchar(36) NULL, \`sellerCount\` int NOT NULL DEFAULT 0, \`itemSubtotal\` decimal(20,6) NOT NULL DEFAULT 0, \`itemDiscountTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`itemTaxTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`shippingSubtotal\` decimal(20,6) NOT NULL DEFAULT 0, \`shippingDiscountTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`shippingTaxTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`discountTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`taxTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`grandTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`paidTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`refundedTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`creditTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`outstandingTotal\` decimal(20,6) NOT NULL DEFAULT 0, \`version\` int NOT NULL DEFAULT 1, \`placedAt\` datetime NULL, \`completedAt\` datetime NULL, \`canceledAt\` datetime NULL, \`cancelReason\` varchar(255) NULL, \`purchaseOrderNumber\` varchar(64) NULL, \`metadata\` json NULL, \`externalId\` varchar(255) NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_order_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_is_active\` (\`isActive\`), INDEX \`IDX_order_is_archived\` (\`isArchived\`), INDEX \`IDX_order_tenant\` (\`tenantId\`), INDEX \`IDX_order_organization\` (\`organizationId\`), INDEX \`IDX_order_number\` (\`organizationId\`, \`channelId\`, \`number\`), INDEX \`IDX_order_customer_history\` (\`customerId\`, \`placedAt\`), INDEX \`IDX_order_org_status_placed\` (\`organizationId\`, \`status\`, \`placedAt\`), INDEX \`IDX_order_org_placed\` (\`organizationId\`, \`placedAt\`), INDEX \`IDX_order_payment_status\` (\`organizationId\`, \`paymentStatus\`, \`placedAt\`), INDEX \`IDX_order_fulfillment_status\` (\`organizationId\`, \`fulfillmentStatus\`, \`placedAt\`), INDEX \`IDX_order_email\` (\`email\`, \`placedAt\`), INDEX \`IDX_order_channel_number\` (\`channelId\`, \`number\`), INDEX \`IDX_order_invoice\` (\`invoiceId\`), INDEX \`IDX_order_parent\` (\`parentOrderId\`), INDEX \`IDX_order_cart\` (\`cartId\`), INDEX \`IDX_order_shipping_address\` (\`shippingAddressId\`), INDEX \`IDX_order_billing_address\` (\`billingAddressId\`), INDEX \`IDX_order_region\` (\`regionId\`), INDEX \`IDX_order_external\` (\`externalId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// MySQL has no filtered index, so both rules are carried by the generated key columns declared
		// above: `deletedKey` for `"deletedAt" IS NULL`, `organizationKey` for the nullable scope column.
		// `externalId` stays raw, because it is already a member of its tuple and MySQL's rule that a null
		// key part exempts the tuple is exactly the `WHERE "externalId" IS NOT NULL` of the other two
		// dialects. The writing service still checks both rules first; the indexes are the floor under it.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_order_number\` ON \`order\` (\`organizationKey\`, \`channelId\`, \`number\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_order_org_external\` ON \`order\` (\`organizationKey\`, \`externalId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`order\` ADD CONSTRAINT \`FK_order_cart\` FOREIGN KEY (\`cartId\`) REFERENCES \`commerce_cart\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order\` ADD CONSTRAINT \`FK_order_parent\` FOREIGN KEY (\`parentOrderId\`) REFERENCES \`order\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NOT NULL, \`productId\` varchar(36) NULL, \`variantId\` varchar(36) NULL, \`sellerId\` varchar(36) NULL, \`invoiceItemId\` varchar(36) NULL, \`title\` varchar(255) NOT NULL, \`sku\` varchar(128) NULL, \`barcode\` varchar(64) NULL, \`thumbnail\` varchar(1024) NULL, \`quantity\` decimal(20,6) NOT NULL, \`unitPrice\` decimal(20,6) NOT NULL, \`originalUnitPrice\` decimal(20,6) NOT NULL, \`isTaxInclusive\` tinyint NOT NULL DEFAULT 0, \`isDiscountable\` tinyint NOT NULL DEFAULT 1, \`requiresShipping\` tinyint NOT NULL DEFAULT 1, \`taxCategoryId\` varchar(36) NULL, \`weight\` decimal(12,4) NULL, \`position\` int NOT NULL DEFAULT 0, \`note\` text NULL, \`warehouseId\` varchar(36) NULL, \`subscriptionId\` varchar(36) NULL, \`fulfilledQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`shippedQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`deliveredQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`returnRequestedQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`returnReceivedQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`returnDismissedQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`writtenOffQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`metadata\` json NULL, INDEX \`IDX_order_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_line_is_active\` (\`isActive\`), INDEX \`IDX_order_line_is_archived\` (\`isArchived\`), INDEX \`IDX_order_line_tenant\` (\`tenantId\`), INDEX \`IDX_order_line_organization\` (\`organizationId\`), INDEX \`IDX_order_line_order\` (\`orderId\`, \`position\`), INDEX \`IDX_order_line_variant\` (\`variantId\`), INDEX \`IDX_order_line_picking\` (\`orderId\`, \`requiresShipping\`, \`fulfilledQuantity\`), INDEX \`IDX_order_line_org_created\` (\`organizationId\`, \`createdAt\`), INDEX \`IDX_order_line_product\` (\`productId\`), INDEX \`IDX_order_line_tax_category\` (\`taxCategoryId\`), INDEX \`IDX_order_line_warehouse\` (\`warehouseId\`), INDEX \`IDX_order_line_invoice_item\` (\`invoiceItemId\`), INDEX \`IDX_order_line_seller\` (\`sellerId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_line\` ADD CONSTRAINT \`FK_order_line_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_address\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NOT NULL, \`type\` varchar(16) NOT NULL, \`sourceAddressId\` varchar(36) NULL, \`contactName\` varchar(255) NULL, \`company\` varchar(255) NULL, \`firstName\` varchar(128) NULL, \`lastName\` varchar(128) NULL, \`phone\` varchar(32) NULL, \`email\` varchar(255) NULL, \`line1\` varchar(255) NOT NULL, \`line2\` varchar(255) NULL, \`city\` varchar(128) NOT NULL, \`province\` varchar(128) NULL, \`provinceCode\` varchar(16) NULL, \`postalCode\` varchar(32) NULL, \`countryCode\` varchar(2) NOT NULL, \`countryId\` varchar(36) NULL, \`latitude\` decimal(10,6) NULL, \`longitude\` decimal(10,6) NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_order_address_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_address_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_address_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_address_is_active\` (\`isActive\`), INDEX \`IDX_order_address_is_archived\` (\`isArchived\`), INDEX \`IDX_order_address_tenant\` (\`tenantId\`), INDEX \`IDX_order_address_organization\` (\`organizationId\`), INDEX \`IDX_order_address_order\` (\`orderId\`), INDEX \`IDX_order_address_country\` (\`countryId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// "One billing and one shipping address per order" is enforced by the service and audited by the
		// schema-uniqueness-audit job on this dialect.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_order_address_type\` ON \`order_address\` (\`orderId\`, \`type\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_address\` ADD CONSTRAINT \`FK_order_address_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_shipping_method\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NOT NULL, \`shippingOptionId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`amount\` decimal(20,6) NOT NULL, \`isTaxInclusive\` tinyint NOT NULL DEFAULT 0, \`taxCategoryId\` varchar(36) NULL, \`data\` json NULL, \`position\` int NOT NULL DEFAULT 0, \`metadata\` json NULL, INDEX \`IDX_order_shipping_method_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_shipping_method_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_shipping_method_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_shipping_method_is_active\` (\`isActive\`), INDEX \`IDX_order_shipping_method_is_archived\` (\`isArchived\`), INDEX \`IDX_order_shipping_method_tenant\` (\`tenantId\`), INDEX \`IDX_order_shipping_method_organization\` (\`organizationId\`), INDEX \`IDX_order_shipping_method_order\` (\`orderId\`, \`position\`), INDEX \`IDX_order_shipping_method_option\` (\`shippingOptionId\`), INDEX \`IDX_order_shipping_method_tax_category\` (\`taxCategoryId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_shipping_method\` ADD CONSTRAINT \`FK_order_shipping_method_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_summary\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NOT NULL, \`version\` int NOT NULL, \`totals\` json NOT NULL, \`currency\` varchar(3) NOT NULL, \`reason\` varchar(255) NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_order_summary_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_summary_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_summary_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_summary_is_active\` (\`isActive\`), INDEX \`IDX_order_summary_is_archived\` (\`isArchived\`), INDEX \`IDX_order_summary_tenant\` (\`tenantId\`), INDEX \`IDX_order_summary_organization\` (\`organizationId\`), INDEX \`IDX_order_summary_order\` (\`orderId\`, \`version\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_order_summary_version\` ON \`order_summary\` (\`orderId\`, \`version\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_summary\` ADD CONSTRAINT \`FK_order_summary_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_transaction\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NOT NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`type\` varchar(16) NOT NULL, \`referenceType\` varchar(64) NULL, \`referenceId\` varchar(36) NULL, \`description\` varchar(255) NULL, \`occurredAt\` datetime NULL, \`metadata\` json NULL, INDEX \`IDX_order_transaction_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_transaction_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_transaction_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_transaction_is_active\` (\`isActive\`), INDEX \`IDX_order_transaction_is_archived\` (\`isArchived\`), INDEX \`IDX_order_transaction_tenant\` (\`tenantId\`), INDEX \`IDX_order_transaction_organization\` (\`organizationId\`), INDEX \`IDX_order_transaction_order\` (\`orderId\`, \`occurredAt\`), INDEX \`IDX_order_transaction_type\` (\`orderId\`, \`type\`), INDEX \`IDX_order_transaction_reference\` (\`referenceType\`, \`referenceId\`), INDEX \`IDX_order_transaction_org_occurred\` (\`organizationId\`, \`occurredAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_transaction\` ADD CONSTRAINT \`FK_order_transaction_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_change\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NOT NULL, \`version\` int NOT NULL, \`changeType\` varchar(16) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'PENDING', \`returnId\` varchar(36) NULL, \`claimId\` varchar(36) NULL, \`exchangeId\` varchar(36) NULL, \`subscriptionId\` varchar(36) NULL, \`requestedByUserId\` varchar(36) NULL, \`confirmedByUserId\` varchar(36) NULL, \`requestedAt\` datetime NULL, \`confirmedAt\` datetime NULL, \`declinedAt\` datetime NULL, \`canceledAt\` datetime NULL, \`note\` text NULL, \`priceChange\` decimal(20,6) NULL, \`isSettled\` tinyint NOT NULL DEFAULT 0, \`metadata\` json NULL, INDEX \`IDX_order_change_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_change_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_change_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_change_is_active\` (\`isActive\`), INDEX \`IDX_order_change_is_archived\` (\`isArchived\`), INDEX \`IDX_order_change_tenant\` (\`tenantId\`), INDEX \`IDX_order_change_organization\` (\`organizationId\`), INDEX \`IDX_order_change_order\` (\`orderId\`, \`status\`), INDEX \`IDX_order_change_version\` (\`orderId\`, \`version\`), INDEX \`IDX_order_change_pending\` (\`orderId\`, \`createdAt\`), INDEX \`IDX_order_change_return\` (\`returnId\`), INDEX \`IDX_order_change_claim\` (\`claimId\`), INDEX \`IDX_order_change_exchange\` (\`exchangeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// The exclusivity rule is not carried by an index on this dialect: it is enforced by taking the
		// order row for update inside the creating transaction, and audited by the schema-uniqueness-audit
		// job. A generated key over the three open statuses would express it, in the same form the rest of
		// this set uses, and no such index is created here yet — this is a gap in the MySQL branch rather
		// than something the dialect cannot say.
		await queryRunner.query(
			`ALTER TABLE \`order_change\` ADD CONSTRAINT \`FK_order_change_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_change_action\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`changeId\` varchar(36) NOT NULL, \`action\` varchar(32) NOT NULL, \`details\` json NULL, \`amount\` decimal(20,6) NULL, \`referenceType\` varchar(64) NULL, \`referenceId\` varchar(36) NULL, \`ordering\` int NOT NULL DEFAULT 0, \`applied\` tinyint NOT NULL DEFAULT 0, \`appliedAt\` datetime NULL, INDEX \`IDX_order_change_action_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_change_action_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_change_action_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_change_action_is_active\` (\`isActive\`), INDEX \`IDX_order_change_action_is_archived\` (\`isArchived\`), INDEX \`IDX_order_change_action_tenant\` (\`tenantId\`), INDEX \`IDX_order_change_action_organization\` (\`organizationId\`), INDEX \`IDX_order_change_action_change\` (\`changeId\`, \`ordering\`), INDEX \`IDX_order_change_action_type\` (\`action\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_change_action\` ADD CONSTRAINT \`CHK_order_change_action_applied_at\` CHECK ((\`applied\` = 1 AND \`appliedAt\` IS NOT NULL) OR (\`applied\` = 0 AND \`appliedAt\` IS NULL))`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_change_action\` ADD CONSTRAINT \`FK_order_change_action_change\` FOREIGN KEY (\`changeId\`) REFERENCES \`order_change\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_credit_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NOT NULL, \`version\` int NOT NULL, \`referenceType\` varchar(64) NULL, \`referenceId\` varchar(36) NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`description\` varchar(255) NULL, INDEX \`IDX_order_credit_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_credit_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_credit_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_credit_line_is_active\` (\`isActive\`), INDEX \`IDX_order_credit_line_is_archived\` (\`isArchived\`), INDEX \`IDX_order_credit_line_tenant\` (\`tenantId\`), INDEX \`IDX_order_credit_line_organization\` (\`organizationId\`), INDEX \`IDX_order_credit_line_order\` (\`orderId\`, \`version\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_credit_line\` ADD CONSTRAINT \`FK_order_credit_line_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_history\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NOT NULL, \`action\` varchar(64) NOT NULL, \`title\` varchar(255) NULL, \`description\` text NULL, \`userId\` varchar(36) NULL, \`metadata\` json NULL, INDEX \`IDX_order_history_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_history_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_history_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_history_is_active\` (\`isActive\`), INDEX \`IDX_order_history_is_archived\` (\`isArchived\`), INDEX \`IDX_order_history_tenant\` (\`tenantId\`), INDEX \`IDX_order_history_organization\` (\`organizationId\`), INDEX \`IDX_order_history_order\` (\`orderId\`, \`createdAt\`), INDEX \`IDX_order_history_action\` (\`action\`, \`createdAt\`), INDEX \`IDX_order_history_user\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_history\` ADD CONSTRAINT \`FK_order_history_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`order_history\` DROP FOREIGN KEY \`FK_order_history_order\``);
		await queryRunner.query(`DROP TABLE \`order_history\``);
		await queryRunner.query(`ALTER TABLE \`order_credit_line\` DROP FOREIGN KEY \`FK_order_credit_line_order\``);
		await queryRunner.query(`DROP TABLE \`order_credit_line\``);
		await queryRunner.query(`ALTER TABLE \`order_change_action\` DROP FOREIGN KEY \`FK_order_change_action_change\``);
		await queryRunner.query(`DROP TABLE \`order_change_action\``);
		await queryRunner.query(`ALTER TABLE \`order_change\` DROP FOREIGN KEY \`FK_order_change_order\``);
		await queryRunner.query(`DROP TABLE \`order_change\``);
		await queryRunner.query(`ALTER TABLE \`order_transaction\` DROP FOREIGN KEY \`FK_order_transaction_order\``);
		await queryRunner.query(`DROP TABLE \`order_transaction\``);
		await queryRunner.query(`ALTER TABLE \`order_summary\` DROP FOREIGN KEY \`FK_order_summary_order\``);
		await queryRunner.query(`DROP TABLE \`order_summary\``);
		await queryRunner.query(
			`ALTER TABLE \`order_shipping_method\` DROP FOREIGN KEY \`FK_order_shipping_method_order\``
		);
		await queryRunner.query(`DROP TABLE \`order_shipping_method\``);
		await queryRunner.query(`ALTER TABLE \`order_address\` DROP FOREIGN KEY \`FK_order_address_order\``);
		await queryRunner.query(`DROP TABLE \`order_address\``);
		await queryRunner.query(`ALTER TABLE \`order_line\` DROP FOREIGN KEY \`FK_order_line_order\``);
		await queryRunner.query(`DROP TABLE \`order_line\``);
		await queryRunner.query(`ALTER TABLE \`order\` DROP FOREIGN KEY \`FK_order_parent\``);
		await queryRunner.query(`ALTER TABLE \`order\` DROP FOREIGN KEY \`FK_order_cart\``);
		await queryRunner.query(`DROP TABLE \`order\``);
	}
}
