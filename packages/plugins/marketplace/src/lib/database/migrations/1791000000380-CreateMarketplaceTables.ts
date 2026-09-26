import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the marketplace: the seller, what it offers, the per-seller split of an order's money, the
 * payouts the platform instructs and the settlements the provider reports.
 *
 * Three properties of this schema are deliberate and worth reading before changing it:
 *
 * 1. **The ledger is the truth and the payout is derived from it.** `seller_transaction` carries the
 *    five amounts of a row and their identity — `netAmount = grossAmount + taxAmount +
 *    sellerDiscountAmount − commissionAmount` — as a check constraint where the dialect supports one,
 *    and its monetary columns are append only: a correction is a reversal row, never an edit.
 * 2. **A transaction is in at most one live payout.** `UQ_seller_payout_line_tx` is what makes that a
 *    database guarantee rather than a hope about a scheduler's memory, and cancelling a payout
 *    soft-deletes its lines, which releases the unique slot for the next run.
 * 3. **The platform holds no funds.** No table here is a cash balance and no column here is a bank
 *    account: the destination of a payout is an account holder the platform verified, referenced by id,
 *    and a payout is an instruction recorded, not money moved.
 *
 * **Foreign keys across packages.** Constraints onto the kernel tables that exist (`organization_contact`,
 * `merchant`, `user`, `product`, `product_variant`, `warehouse`) are created here. Identifiers that point
 * at tables another package owns — `order`, `order_line`, `order_transaction`, `refund`,
 * `product_price` and the kernel's `payment_account_holder` — are created as indexed columns **without**
 * a constraint, which is the programme's own convention for a cross-package reference: the owning
 * package's migration adds the constraint, so this migration can run in an installation whose package
 * set is still being assembled. Each such column names the constraint it is waiting for.
 *
 * Dialect note: Postgres and SQLite get the partial unique indexes the schema specifies. MySQL has no
 * partial index, so every uniqueness the specification states as a predicate is expressed over a
 * stored generated key column, in the form `CreateSequenceTable1791000000000` documents for the whole
 * set. Three shapes occur here. Where the predicate is `"deletedAt" IS NULL`, the table's `deletedKey`
 * carries it. Where the predicate is a null guard on a column that is already in the tuple —
 * `"externalId" IS NOT NULL`, `"periodStart" IS NOT NULL` — the column stays raw and MySQL's own rule
 * that a null key part exempts the tuple is the guard. Where it is a value test that no null rule can
 * stand in for — `"status" <> 'CANCELED'` on a payout, `"kind" = 'SALE'` on a transaction — the index
 * gets a key column of its own, `notCanceledKey` and `saleKindKey`. A nullable column that is part of
 * the rule rather than its guard is folded instead: the seller's `organizationKey`, the payout's
 * `providerKeyKey`. The writing service re-checks each predicate, so the guarantee is never weaker
 * than the service that relies on it.
 */
export class CreateMarketplaceTables1791000000380 implements MigrationInterface {
	name = 'CreateMarketplaceTables1791000000380';

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
			`CREATE TABLE "seller" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "code" character varying(64) NOT NULL, "name" character varying(255) NOT NULL, "legalName" character varying(255), "email" character varying(255), "phone" character varying(32), "contactId" uuid NOT NULL, "merchantId" uuid, "userId" uuid, "channelIds" jsonb, "regionIds" jsonb, "status" character varying NOT NULL DEFAULT 'DRAFT', "submittedAt" TIMESTAMP, "activatedAt" TIMESTAMP, "suspendedAt" TIMESTAMP, "suspensionReason" character varying(255), "rejectedAt" TIMESTAMP, "rejectionReason" character varying(255), "offboardedAt" TIMESTAMP, "businessVerificationStatus" character varying NOT NULL DEFAULT 'UNVERIFIED', "taxVerificationStatus" character varying NOT NULL DEFAULT 'UNVERIFIED', "payoutAccountStatus" character varying NOT NULL DEFAULT 'UNVERIFIED', "verificationProvider" character varying(64), "verificationReference" character varying(255), "verifiedAt" TIMESTAMP, "verificationExpiresAt" TIMESTAMP, "payoutAccountReference" character varying(255), "payoutAccountHolderId" uuid, "taxId" character varying(64), "vatNumber" character varying(64), "taxCountryCode" character varying(2), "taxRegistrationScheme" character varying, "taxCollectionMode" character varying NOT NULL DEFAULT 'SELLER_REMITS', "defaultCommissionRate" numeric(9,6), "commissionBasis" character varying, "commissionTiers" jsonb, "fixedFeePerItem" numeric(20,6), "fixedFeeCurrency" character varying(3), "commissionOnShipping" boolean NOT NULL DEFAULT true, "chargeShippingCost" boolean NOT NULL DEFAULT false, "allowNegativeNet" boolean NOT NULL DEFAULT false, "payoutMode" character varying NOT NULL DEFAULT 'PROVIDER_TRANSFER', "payoutSchedule" character varying NOT NULL DEFAULT 'MANUAL', "payoutCurrency" character varying(3), "payoutThreshold" numeric(20,6) NOT NULL DEFAULT 0, "reservePercent" numeric(9,6) NOT NULL DEFAULT 0, "reserveHoldDays" integer NOT NULL DEFAULT 0, "payoutHoldDays" integer NOT NULL DEFAULT 0, "externalId" character varying(255), "metadata" jsonb, CONSTRAINT "PK_seller_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'seller');
		// One seller account per code, per party and per upstream key, inside one organization.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_org_code" ON "seller" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_org_contact" ON "seller" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "contactId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_org_external" ON "seller" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_org_status" ON "seller" ("organizationId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_seller_contact" ON "seller" ("contactId")`);
		await queryRunner.query(`CREATE INDEX "IDX_seller_merchant" ON "seller" ("merchantId") WHERE "merchantId" IS NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_seller_user" ON "seller" ("userId") WHERE "userId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_verification" ON "seller" ("organizationId", "businessVerificationStatus", "payoutAccountStatus", "verificationExpiresAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_payout_holder" ON "seller" ("payoutAccountHolderId") WHERE "payoutAccountHolderId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "seller_offering" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "sellerId" uuid NOT NULL, "variantId" uuid NOT NULL, "productId" uuid, "sellerSku" character varying(128), "title" character varying(255), "condition" character varying NOT NULL DEFAULT 'NEW', "priceAmount" numeric(20,6), "priceCurrency" character varying(3), "productPriceId" uuid, "commissionRate" numeric(9,6), "commissionBasis" character varying, "commissionTiers" jsonb, "status" character varying NOT NULL DEFAULT 'DRAFT', "channelIds" jsonb, "regionIds" jsonb, "availableFrom" TIMESTAMP, "availableTo" TIMESTAMP, "maxQuantityPerOrder" integer, "fulfilmentMode" character varying NOT NULL DEFAULT 'PLATFORM', "fulfilmentWarehouseId" uuid, "handlingDays" integer, "isFeatured" boolean NOT NULL DEFAULT false, "allowNegativeNet" boolean, "approvedAt" TIMESTAMP, "approvedByUserId" uuid, "rejectionReason" character varying(255), "externalId" character varying(255), "metadata" jsonb, CONSTRAINT "PK_seller_offering_id" PRIMARY KEY ("id"), CONSTRAINT "CHK_seller_offering_window" CHECK ("availableFrom" IS NULL OR "availableTo" IS NULL OR "availableFrom" < "availableTo"))`
		);
		await this.baseIndexes(queryRunner, 'seller_offering');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_offering" ON "seller_offering" ("sellerId", "variantId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_offering_sku" ON "seller_offering" ("sellerId", "sellerSku") WHERE "sellerSku" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_offering_external" ON "seller_offering" ("sellerId", "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_variant" ON "seller_offering" ("variantId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_window" ON "seller_offering" ("variantId", "status", "availableFrom", "availableTo") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_seller" ON "seller_offering" ("sellerId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_product" ON "seller_offering" ("productId") WHERE "productId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_price" ON "seller_offering" ("productPriceId") WHERE "productPriceId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_wh" ON "seller_offering" ("fulfilmentWarehouseId") WHERE "fulfilmentWarehouseId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "seller_transaction" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "sellerId" uuid NOT NULL, "orderId" uuid NOT NULL, "orderLineId" uuid, "orderTransactionId" uuid, "kind" character varying NOT NULL DEFAULT 'SALE', "status" character varying NOT NULL DEFAULT 'PENDING', "currency" character varying(3) NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT 2, "grossAmount" numeric(20,6) NOT NULL DEFAULT 0, "taxAmount" numeric(20,6) NOT NULL DEFAULT 0, "sellerDiscountAmount" numeric(20,6) NOT NULL DEFAULT 0, "platformDiscountAmount" numeric(20,6) NOT NULL DEFAULT 0, "commissionBasis" character varying NOT NULL, "commissionBasisAmount" numeric(20,6) NOT NULL DEFAULT 0, "commissionRate" numeric(9,6) NOT NULL DEFAULT 0, "commissionAmount" numeric(20,6) NOT NULL DEFAULT 0, "netAmount" numeric(20,6) NOT NULL DEFAULT 0, "commissionOn" character varying NOT NULL DEFAULT 'LINE', "occurredAt" TIMESTAMP NOT NULL DEFAULT now(), "settleableAt" TIMESTAMP, "settledAt" TIMESTAMP, "paidAt" TIMESTAMP, "holdReason" character varying(64), "reversesTransactionId" uuid, "refundId" uuid, "description" character varying(255), "externalId" character varying(255), "metadata" jsonb, CONSTRAINT "PK_seller_transaction_id" PRIMARY KEY ("id"), CONSTRAINT "CHK_seller_tx_net_identity" CHECK ("netAmount" = "grossAmount" + "taxAmount" + "sellerDiscountAmount" - "commissionAmount"), CONSTRAINT "CHK_seller_tx_discount_sign" CHECK ("sellerDiscountAmount" <= 0 AND "platformDiscountAmount" <= 0), CONSTRAINT "CHK_seller_tx_rate_range" CHECK ("commissionRate" >= 0 AND "commissionRate" <= 1))`
		);
		await this.baseIndexes(queryRunner, 'seller_transaction');
		// One sale row per seller-owned order line, and one live reversal per (row, refund): a doubled
		// refund handler is a constraint violation rather than a double debit.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_tx_sale" ON "seller_transaction" ("orderLineId", "kind") WHERE "kind" = 'SALE' AND "orderLineId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_tx_reversal" ON "seller_transaction" ("reversesTransactionId", "refundId") WHERE "reversesTransactionId" IS NOT NULL AND "refundId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_seller" ON "seller_transaction" ("sellerId", "status", "occurredAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_settleable" ON "seller_transaction" ("sellerId", "status", "settleableAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_order" ON "seller_transaction" ("orderId", "occurredAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_line" ON "seller_transaction" ("orderLineId") WHERE "orderLineId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_ordertx" ON "seller_transaction" ("orderTransactionId") WHERE "orderTransactionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_reverses" ON "seller_transaction" ("reversesTransactionId") WHERE "reversesTransactionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_refund" ON "seller_transaction" ("refundId") WHERE "refundId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_org" ON "seller_transaction" ("organizationId", "occurredAt") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "seller_payout" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "sellerId" uuid NOT NULL, "number" character varying(64) NOT NULL, "status" character varying NOT NULL DEFAULT 'DRAFT', "payoutMode" character varying NOT NULL, "currency" character varying(3) NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT 2, "netAmount" numeric(20,6) NOT NULL DEFAULT 0, "feeAmount" numeric(20,6) NOT NULL DEFAULT 0, "reserveAmount" numeric(20,6) NOT NULL DEFAULT 0, "paidAmount" numeric(20,6) NOT NULL DEFAULT 0, "settlementCurrency" character varying(3), "fxRate" numeric(20,10), "settlementAmount" numeric(20,6), "fxCapturedAt" TIMESTAMP, "periodStart" TIMESTAMP, "periodEnd" TIMESTAMP, "scheduledAt" TIMESTAMP, "isFinal" boolean NOT NULL DEFAULT false, "approvedAt" TIMESTAMP, "approvedByUserId" uuid, "paidAt" TIMESTAMP, "failedAt" TIMESTAMP, "canceledAt" TIMESTAMP, "providerKey" character varying(64), "providerReference" character varying(255), "providerTransferId" character varying(255), "payoutAccountReference" character varying(255), "failureCode" character varying(64), "failureReason" character varying(255), "reconcilesSettlementId" uuid, "note" text, "externalId" character varying(255), "metadata" jsonb, CONSTRAINT "PK_seller_payout_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'seller_payout');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_payout_number" ON "seller_payout" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_payout_providerref" ON "seller_payout" (COALESCE("providerKey", ''), "providerTransferId") WHERE "providerTransferId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		// A scheduler that runs twice for one period cannot pay it twice.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_payout_period" ON "seller_payout" ("sellerId", "currency", "periodStart", "periodEnd") WHERE "periodStart" IS NOT NULL AND "periodEnd" IS NOT NULL AND "status" <> 'CANCELED' AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_payout_seller" ON "seller_payout" ("sellerId", "status", "scheduledAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_payout_org_status" ON "seller_payout" ("organizationId", "status", "scheduledAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_payout_settlement" ON "seller_payout" ("reconcilesSettlementId") WHERE "reconcilesSettlementId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "seller_payout_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "sellerPayoutId" uuid NOT NULL, "sellerTransactionId" uuid NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "note" character varying(255), "metadata" jsonb, CONSTRAINT "PK_seller_payout_line_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'seller_payout_line');
		// A transaction can be in at most one live payout line: the double-payment guarantee.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_payout_line_tx" ON "seller_payout_line" ("sellerTransactionId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_payout_line_payout" ON "seller_payout_line" ("sellerPayoutId") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "seller_settlement" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "sellerId" uuid NOT NULL, "payoutAccountHolderId" uuid, "payoutId" uuid, "providerKey" character varying(64) NOT NULL, "status" character varying NOT NULL DEFAULT 'OPEN', "currency" character varying(3) NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT 2, "grossAmount" numeric(20,6) NOT NULL DEFAULT 0, "commissionAmount" numeric(20,6) NOT NULL DEFAULT 0, "feeAmount" numeric(20,6) NOT NULL DEFAULT 0, "netAmount" numeric(20,6) NOT NULL DEFAULT 0, "settlementCurrency" character varying(3), "fxRate" numeric(20,10), "settlementAmount" numeric(20,6), "fxCapturedAt" TIMESTAMP, "periodStart" TIMESTAMP, "periodEnd" TIMESTAMP, "providerReportId" character varying(255), "externalReference" character varying(255), "discrepancyAmount" numeric(20,6) NOT NULL DEFAULT 0, "reconciledAt" TIMESTAMP, "reconciledByUserId" uuid, "closedAt" TIMESTAMP, "note" text, "metadata" jsonb, CONSTRAINT "PK_seller_settlement_id" PRIMARY KEY ("id"))`
		);
		await this.baseIndexes(queryRunner, 'seller_settlement');
		// A replayed provider report cannot create a second settlement.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_settlement_report" ON "seller_settlement" ("providerKey", "providerReportId") WHERE "providerReportId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_settlement_period" ON "seller_settlement" ("sellerId", "providerKey", "currency", "periodStart", "periodEnd") WHERE "periodStart" IS NOT NULL AND "periodEnd" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_settlement_seller" ON "seller_settlement" ("sellerId", "status", "periodEnd") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_settlement_payout" ON "seller_settlement" ("payoutId") WHERE "payoutId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_settlement_holder" ON "seller_settlement" ("payoutAccountHolderId") WHERE "payoutAccountHolderId" IS NOT NULL`
		);

		/*
		 | Constraints onto the kernel tables this migration can rely on. The on-delete rule of each one
		 | is part of the model: a seller with ledger rows is restricted rather than cascaded, a party
		 | reference is restricted, and a convenience link is set to null.
		 */
		await queryRunner.query(
			`ALTER TABLE "seller" ADD CONSTRAINT "FK_seller_contact" FOREIGN KEY ("contactId") REFERENCES "organization_contact"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller" ADD CONSTRAINT "FK_seller_merchant" FOREIGN KEY ("merchantId") REFERENCES "merchant"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller" ADD CONSTRAINT "FK_seller_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_offering" ADD CONSTRAINT "FK_seller_offering_seller" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_offering" ADD CONSTRAINT "FK_seller_offering_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_offering" ADD CONSTRAINT "FK_seller_offering_product" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_offering" ADD CONSTRAINT "FK_seller_offering_warehouse" FOREIGN KEY ("fulfilmentWarehouseId") REFERENCES "warehouse"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_offering" ADD CONSTRAINT "FK_seller_offering_approved_by" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_transaction" ADD CONSTRAINT "FK_seller_transaction_seller" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_transaction" ADD CONSTRAINT "FK_seller_transaction_reverses" FOREIGN KEY ("reversesTransactionId") REFERENCES "seller_transaction"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_payout" ADD CONSTRAINT "FK_seller_payout_seller" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_payout" ADD CONSTRAINT "FK_seller_payout_approved_by" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_payout" ADD CONSTRAINT "FK_seller_payout_settlement" FOREIGN KEY ("reconcilesSettlementId") REFERENCES "seller_settlement"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_payout_line" ADD CONSTRAINT "FK_seller_payout_line_payout" FOREIGN KEY ("sellerPayoutId") REFERENCES "seller_payout"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_payout_line" ADD CONSTRAINT "FK_seller_payout_line_transaction" FOREIGN KEY ("sellerTransactionId") REFERENCES "seller_transaction"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_settlement" ADD CONSTRAINT "FK_seller_settlement_seller" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_settlement" ADD CONSTRAINT "FK_seller_settlement_payout" FOREIGN KEY ("payoutId") REFERENCES "seller_payout"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "seller_settlement" ADD CONSTRAINT "FK_seller_settlement_reconciled_by" FOREIGN KEY ("reconciledByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "seller_settlement" DROP CONSTRAINT "FK_seller_settlement_reconciled_by"`);
		await queryRunner.query(`ALTER TABLE "seller_settlement" DROP CONSTRAINT "FK_seller_settlement_payout"`);
		await queryRunner.query(`ALTER TABLE "seller_settlement" DROP CONSTRAINT "FK_seller_settlement_seller"`);
		await queryRunner.query(`ALTER TABLE "seller_payout_line" DROP CONSTRAINT "FK_seller_payout_line_transaction"`);
		await queryRunner.query(`ALTER TABLE "seller_payout_line" DROP CONSTRAINT "FK_seller_payout_line_payout"`);
		await queryRunner.query(`ALTER TABLE "seller_payout" DROP CONSTRAINT "FK_seller_payout_settlement"`);
		await queryRunner.query(`ALTER TABLE "seller_payout" DROP CONSTRAINT "FK_seller_payout_approved_by"`);
		await queryRunner.query(`ALTER TABLE "seller_payout" DROP CONSTRAINT "FK_seller_payout_seller"`);
		await queryRunner.query(`ALTER TABLE "seller_transaction" DROP CONSTRAINT "FK_seller_transaction_reverses"`);
		await queryRunner.query(`ALTER TABLE "seller_transaction" DROP CONSTRAINT "FK_seller_transaction_seller"`);
		await queryRunner.query(`ALTER TABLE "seller_offering" DROP CONSTRAINT "FK_seller_offering_approved_by"`);
		await queryRunner.query(`ALTER TABLE "seller_offering" DROP CONSTRAINT "FK_seller_offering_warehouse"`);
		await queryRunner.query(`ALTER TABLE "seller_offering" DROP CONSTRAINT "FK_seller_offering_product"`);
		await queryRunner.query(`ALTER TABLE "seller_offering" DROP CONSTRAINT "FK_seller_offering_variant"`);
		await queryRunner.query(`ALTER TABLE "seller_offering" DROP CONSTRAINT "FK_seller_offering_seller"`);
		await queryRunner.query(`ALTER TABLE "seller" DROP CONSTRAINT "FK_seller_user"`);
		await queryRunner.query(`ALTER TABLE "seller" DROP CONSTRAINT "FK_seller_merchant"`);
		await queryRunner.query(`ALTER TABLE "seller" DROP CONSTRAINT "FK_seller_contact"`);

		await queryRunner.query(`DROP TABLE "seller_settlement"`);
		await queryRunner.query(`DROP TABLE "seller_payout_line"`);
		await queryRunner.query(`DROP TABLE "seller_payout"`);
		await queryRunner.query(`DROP TABLE "seller_transaction"`);
		await queryRunner.query(`DROP TABLE "seller_offering"`);
		await queryRunner.query(`DROP TABLE "seller"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "seller" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "code" varchar(64) NOT NULL, "name" varchar(255) NOT NULL, "legalName" varchar(255), "email" varchar(255), "phone" varchar(32), "contactId" varchar NOT NULL, "merchantId" varchar, "userId" varchar, "channelIds" text, "regionIds" text, "status" varchar NOT NULL DEFAULT ('DRAFT'), "submittedAt" datetime, "activatedAt" datetime, "suspendedAt" datetime, "suspensionReason" varchar(255), "rejectedAt" datetime, "rejectionReason" varchar(255), "offboardedAt" datetime, "businessVerificationStatus" varchar NOT NULL DEFAULT ('UNVERIFIED'), "taxVerificationStatus" varchar NOT NULL DEFAULT ('UNVERIFIED'), "payoutAccountStatus" varchar NOT NULL DEFAULT ('UNVERIFIED'), "verificationProvider" varchar(64), "verificationReference" varchar(255), "verifiedAt" datetime, "verificationExpiresAt" datetime, "payoutAccountReference" varchar(255), "payoutAccountHolderId" varchar, "taxId" varchar(64), "vatNumber" varchar(64), "taxCountryCode" varchar(2), "taxRegistrationScheme" varchar, "taxCollectionMode" varchar NOT NULL DEFAULT ('SELLER_REMITS'), "defaultCommissionRate" numeric(9,6), "commissionBasis" varchar, "commissionTiers" text, "fixedFeePerItem" numeric(20,6), "fixedFeeCurrency" varchar(3), "commissionOnShipping" boolean NOT NULL DEFAULT (1), "chargeShippingCost" boolean NOT NULL DEFAULT (0), "allowNegativeNet" boolean NOT NULL DEFAULT (0), "payoutMode" varchar NOT NULL DEFAULT ('PROVIDER_TRANSFER'), "payoutSchedule" varchar NOT NULL DEFAULT ('MANUAL'), "payoutCurrency" varchar(3), "payoutThreshold" numeric(20,6) NOT NULL DEFAULT (0), "reservePercent" numeric(9,6) NOT NULL DEFAULT (0), "reserveHoldDays" integer NOT NULL DEFAULT (0), "payoutHoldDays" integer NOT NULL DEFAULT (0), "externalId" varchar(255), "metadata" text, CONSTRAINT "FK_seller_contact" FOREIGN KEY ("contactId") REFERENCES "organization_contact" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_seller_merchant" FOREIGN KEY ("merchantId") REFERENCES "merchant" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_seller_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'seller');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_org_code" ON "seller" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_org_contact" ON "seller" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "contactId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_org_external" ON "seller" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_org_status" ON "seller" ("organizationId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_seller_contact" ON "seller" ("contactId")`);
		await queryRunner.query(`CREATE INDEX "IDX_seller_merchant" ON "seller" ("merchantId") WHERE "merchantId" IS NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_seller_user" ON "seller" ("userId") WHERE "userId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_verification" ON "seller" ("organizationId", "businessVerificationStatus", "payoutAccountStatus", "verificationExpiresAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_payout_holder" ON "seller" ("payoutAccountHolderId") WHERE "payoutAccountHolderId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "seller_offering" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "sellerId" varchar NOT NULL, "variantId" varchar NOT NULL, "productId" varchar, "sellerSku" varchar(128), "title" varchar(255), "condition" varchar NOT NULL DEFAULT ('NEW'), "priceAmount" numeric(20,6), "priceCurrency" varchar(3), "productPriceId" varchar, "commissionRate" numeric(9,6), "commissionBasis" varchar, "commissionTiers" text, "status" varchar NOT NULL DEFAULT ('DRAFT'), "channelIds" text, "regionIds" text, "availableFrom" datetime, "availableTo" datetime, "maxQuantityPerOrder" integer, "fulfilmentMode" varchar NOT NULL DEFAULT ('PLATFORM'), "fulfilmentWarehouseId" varchar, "handlingDays" integer, "isFeatured" boolean NOT NULL DEFAULT (0), "allowNegativeNet" boolean, "approvedAt" datetime, "approvedByUserId" varchar, "rejectionReason" varchar(255), "externalId" varchar(255), "metadata" text, CONSTRAINT "CHK_seller_offering_window" CHECK ("availableFrom" IS NULL OR "availableTo" IS NULL OR "availableFrom" < "availableTo"), CONSTRAINT "FK_seller_offering_seller" FOREIGN KEY ("sellerId") REFERENCES "seller" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_seller_offering_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_seller_offering_product" FOREIGN KEY ("productId") REFERENCES "product" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_seller_offering_warehouse" FOREIGN KEY ("fulfilmentWarehouseId") REFERENCES "warehouse" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_seller_offering_approved_by" FOREIGN KEY ("approvedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'seller_offering');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_offering" ON "seller_offering" ("sellerId", "variantId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_offering_sku" ON "seller_offering" ("sellerId", "sellerSku") WHERE "sellerSku" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_offering_external" ON "seller_offering" ("sellerId", "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_variant" ON "seller_offering" ("variantId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_window" ON "seller_offering" ("variantId", "status", "availableFrom", "availableTo") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_seller" ON "seller_offering" ("sellerId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_product" ON "seller_offering" ("productId") WHERE "productId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_price" ON "seller_offering" ("productPriceId") WHERE "productPriceId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_offering_wh" ON "seller_offering" ("fulfilmentWarehouseId") WHERE "fulfilmentWarehouseId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "seller_transaction" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "sellerId" varchar NOT NULL, "orderId" varchar NOT NULL, "orderLineId" varchar, "orderTransactionId" varchar, "kind" varchar NOT NULL DEFAULT ('SALE'), "status" varchar NOT NULL DEFAULT ('PENDING'), "currency" varchar(3) NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT (2), "grossAmount" numeric(20,6) NOT NULL DEFAULT (0), "taxAmount" numeric(20,6) NOT NULL DEFAULT (0), "sellerDiscountAmount" numeric(20,6) NOT NULL DEFAULT (0), "platformDiscountAmount" numeric(20,6) NOT NULL DEFAULT (0), "commissionBasis" varchar NOT NULL, "commissionBasisAmount" numeric(20,6) NOT NULL DEFAULT (0), "commissionRate" numeric(9,6) NOT NULL DEFAULT (0), "commissionAmount" numeric(20,6) NOT NULL DEFAULT (0), "netAmount" numeric(20,6) NOT NULL DEFAULT (0), "commissionOn" varchar NOT NULL DEFAULT ('LINE'), "occurredAt" datetime NOT NULL DEFAULT (datetime('now')), "settleableAt" datetime, "settledAt" datetime, "paidAt" datetime, "holdReason" varchar(64), "reversesTransactionId" varchar, "refundId" varchar, "description" varchar(255), "externalId" varchar(255), "metadata" text, CONSTRAINT "CHK_seller_tx_net_identity" CHECK ("netAmount" = "grossAmount" + "taxAmount" + "sellerDiscountAmount" - "commissionAmount"), CONSTRAINT "CHK_seller_tx_discount_sign" CHECK ("sellerDiscountAmount" <= 0 AND "platformDiscountAmount" <= 0), CONSTRAINT "CHK_seller_tx_rate_range" CHECK ("commissionRate" >= 0 AND "commissionRate" <= 1), CONSTRAINT "FK_seller_transaction_seller" FOREIGN KEY ("sellerId") REFERENCES "seller" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_seller_transaction_reverses" FOREIGN KEY ("reversesTransactionId") REFERENCES "seller_transaction" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'seller_transaction');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_tx_sale" ON "seller_transaction" ("orderLineId", "kind") WHERE "kind" = 'SALE' AND "orderLineId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_tx_reversal" ON "seller_transaction" ("reversesTransactionId", "refundId") WHERE "reversesTransactionId" IS NOT NULL AND "refundId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_seller" ON "seller_transaction" ("sellerId", "status", "occurredAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_settleable" ON "seller_transaction" ("sellerId", "status", "settleableAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_order" ON "seller_transaction" ("orderId", "occurredAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_line" ON "seller_transaction" ("orderLineId") WHERE "orderLineId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_ordertx" ON "seller_transaction" ("orderTransactionId") WHERE "orderTransactionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_reverses" ON "seller_transaction" ("reversesTransactionId") WHERE "reversesTransactionId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_refund" ON "seller_transaction" ("refundId") WHERE "refundId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_tx_org" ON "seller_transaction" ("organizationId", "occurredAt") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "seller_payout" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "sellerId" varchar NOT NULL, "number" varchar(64) NOT NULL, "status" varchar NOT NULL DEFAULT ('DRAFT'), "payoutMode" varchar NOT NULL, "currency" varchar(3) NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT (2), "netAmount" numeric(20,6) NOT NULL DEFAULT (0), "feeAmount" numeric(20,6) NOT NULL DEFAULT (0), "reserveAmount" numeric(20,6) NOT NULL DEFAULT (0), "paidAmount" numeric(20,6) NOT NULL DEFAULT (0), "settlementCurrency" varchar(3), "fxRate" numeric(20,10), "settlementAmount" numeric(20,6), "fxCapturedAt" datetime, "periodStart" datetime, "periodEnd" datetime, "scheduledAt" datetime, "isFinal" boolean NOT NULL DEFAULT (0), "approvedAt" datetime, "approvedByUserId" varchar, "paidAt" datetime, "failedAt" datetime, "canceledAt" datetime, "providerKey" varchar(64), "providerReference" varchar(255), "providerTransferId" varchar(255), "payoutAccountReference" varchar(255), "failureCode" varchar(64), "failureReason" varchar(255), "reconcilesSettlementId" varchar, "note" text, "externalId" varchar(255), "metadata" text, CONSTRAINT "FK_seller_payout_seller" FOREIGN KEY ("sellerId") REFERENCES "seller" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_seller_payout_approved_by" FOREIGN KEY ("approvedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_seller_payout_settlement" FOREIGN KEY ("reconcilesSettlementId") REFERENCES "seller_settlement" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'seller_payout');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_payout_number" ON "seller_payout" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_payout_providerref" ON "seller_payout" (COALESCE("providerKey", ''), "providerTransferId") WHERE "providerTransferId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_payout_period" ON "seller_payout" ("sellerId", "currency", "periodStart", "periodEnd") WHERE "periodStart" IS NOT NULL AND "periodEnd" IS NOT NULL AND "status" <> 'CANCELED' AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_payout_seller" ON "seller_payout" ("sellerId", "status", "scheduledAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_payout_org_status" ON "seller_payout" ("organizationId", "status", "scheduledAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_payout_settlement" ON "seller_payout" ("reconcilesSettlementId") WHERE "reconcilesSettlementId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "seller_payout_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "sellerPayoutId" varchar NOT NULL, "sellerTransactionId" varchar NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "note" varchar(255), "metadata" text, CONSTRAINT "FK_seller_payout_line_payout" FOREIGN KEY ("sellerPayoutId") REFERENCES "seller_payout" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_seller_payout_line_transaction" FOREIGN KEY ("sellerTransactionId") REFERENCES "seller_transaction" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'seller_payout_line');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_payout_line_tx" ON "seller_payout_line" ("sellerTransactionId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_payout_line_payout" ON "seller_payout_line" ("sellerPayoutId") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "seller_settlement" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "sellerId" varchar NOT NULL, "payoutAccountHolderId" varchar, "payoutId" varchar, "providerKey" varchar(64) NOT NULL, "status" varchar NOT NULL DEFAULT ('OPEN'), "currency" varchar(3) NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT (2), "grossAmount" numeric(20,6) NOT NULL DEFAULT (0), "commissionAmount" numeric(20,6) NOT NULL DEFAULT (0), "feeAmount" numeric(20,6) NOT NULL DEFAULT (0), "netAmount" numeric(20,6) NOT NULL DEFAULT (0), "settlementCurrency" varchar(3), "fxRate" numeric(20,10), "settlementAmount" numeric(20,6), "fxCapturedAt" datetime, "periodStart" datetime, "periodEnd" datetime, "providerReportId" varchar(255), "externalReference" varchar(255), "discrepancyAmount" numeric(20,6) NOT NULL DEFAULT (0), "reconciledAt" datetime, "reconciledByUserId" varchar, "closedAt" datetime, "note" text, "metadata" text, CONSTRAINT "FK_seller_settlement_seller" FOREIGN KEY ("sellerId") REFERENCES "seller" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_seller_settlement_payout" FOREIGN KEY ("payoutId") REFERENCES "seller_payout" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_seller_settlement_reconciled_by" FOREIGN KEY ("reconciledByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await this.baseIndexes(queryRunner, 'seller_settlement');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_settlement_report" ON "seller_settlement" ("providerKey", "providerReportId") WHERE "providerReportId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_seller_settlement_period" ON "seller_settlement" ("sellerId", "providerKey", "currency", "periodStart", "periodEnd") WHERE "periodStart" IS NOT NULL AND "periodEnd" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_settlement_seller" ON "seller_settlement" ("sellerId", "status", "periodEnd") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_settlement_payout" ON "seller_settlement" ("payoutId") WHERE "payoutId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_seller_settlement_holder" ON "seller_settlement" ("payoutAccountHolderId") WHERE "payoutAccountHolderId" IS NOT NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "seller_settlement"`);
		await queryRunner.query(`DROP TABLE "seller_payout_line"`);
		await queryRunner.query(`DROP TABLE "seller_payout"`);
		await queryRunner.query(`DROP TABLE "seller_transaction"`);
		await queryRunner.query(`DROP TABLE "seller_offering"`);
		await queryRunner.query(`DROP TABLE "seller"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`seller\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`code\` varchar(64) NOT NULL, \`name\` varchar(255) NOT NULL, \`legalName\` varchar(255) NULL, \`email\` varchar(255) NULL, \`phone\` varchar(32) NULL, \`contactId\` varchar(36) NOT NULL, \`merchantId\` varchar(36) NULL, \`userId\` varchar(36) NULL, \`channelIds\` json NULL, \`regionIds\` json NULL, \`status\` varchar(255) NOT NULL DEFAULT 'DRAFT', \`submittedAt\` datetime NULL, \`activatedAt\` datetime NULL, \`suspendedAt\` datetime NULL, \`suspensionReason\` varchar(255) NULL, \`rejectedAt\` datetime NULL, \`rejectionReason\` varchar(255) NULL, \`offboardedAt\` datetime NULL, \`businessVerificationStatus\` varchar(255) NOT NULL DEFAULT 'UNVERIFIED', \`taxVerificationStatus\` varchar(255) NOT NULL DEFAULT 'UNVERIFIED', \`payoutAccountStatus\` varchar(255) NOT NULL DEFAULT 'UNVERIFIED', \`verificationProvider\` varchar(64) NULL, \`verificationReference\` varchar(255) NULL, \`verifiedAt\` datetime NULL, \`verificationExpiresAt\` datetime NULL, \`payoutAccountReference\` varchar(255) NULL, \`payoutAccountHolderId\` varchar(36) NULL, \`taxId\` varchar(64) NULL, \`vatNumber\` varchar(64) NULL, \`taxCountryCode\` varchar(2) NULL, \`taxRegistrationScheme\` varchar(255) NULL, \`taxCollectionMode\` varchar(255) NOT NULL DEFAULT 'SELLER_REMITS', \`defaultCommissionRate\` decimal(9,6) NULL, \`commissionBasis\` varchar(255) NULL, \`commissionTiers\` json NULL, \`fixedFeePerItem\` decimal(20,6) NULL, \`fixedFeeCurrency\` varchar(3) NULL, \`commissionOnShipping\` tinyint NOT NULL DEFAULT 1, \`chargeShippingCost\` tinyint NOT NULL DEFAULT 0, \`allowNegativeNet\` tinyint NOT NULL DEFAULT 0, \`payoutMode\` varchar(255) NOT NULL DEFAULT 'PROVIDER_TRANSFER', \`payoutSchedule\` varchar(255) NOT NULL DEFAULT 'MANUAL', \`payoutCurrency\` varchar(3) NULL, \`payoutThreshold\` decimal(20,6) NOT NULL DEFAULT 0, \`reservePercent\` decimal(9,6) NOT NULL DEFAULT 0, \`reserveHoldDays\` int NOT NULL DEFAULT 0, \`payoutHoldDays\` int NOT NULL DEFAULT 0, \`externalId\` varchar(255) NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, INDEX \`IDX_seller_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_seller_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_seller_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_seller_is_active\` (\`isActive\`), INDEX \`IDX_seller_is_archived\` (\`isArchived\`), INDEX \`IDX_seller_tenant\` (\`tenantId\`), INDEX \`IDX_seller_organization\` (\`organizationId\`), INDEX \`IDX_seller_org_status\` (\`organizationId\`, \`status\`), INDEX \`IDX_seller_contact\` (\`contactId\`), INDEX \`IDX_seller_merchant\` (\`merchantId\`), INDEX \`IDX_seller_user\` (\`userId\`), INDEX \`IDX_seller_verification\` (\`organizationId\`, \`businessVerificationStatus\`, \`payoutAccountStatus\`, \`verificationExpiresAt\`), INDEX \`IDX_seller_payout_holder\` (\`payoutAccountHolderId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_org_code\` ON \`seller\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_org_contact\` ON \`seller\` (\`organizationKey\`, \`contactId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_org_external\` ON \`seller\` (\`organizationKey\`, \`externalId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller\` ADD CONSTRAINT \`FK_seller_contact\` FOREIGN KEY (\`contactId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller\` ADD CONSTRAINT \`FK_seller_merchant\` FOREIGN KEY (\`merchantId\`) REFERENCES \`merchant\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller\` ADD CONSTRAINT \`FK_seller_user\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`seller_offering\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`sellerId\` varchar(36) NOT NULL, \`variantId\` varchar(36) NOT NULL, \`productId\` varchar(36) NULL, \`sellerSku\` varchar(128) NULL, \`title\` varchar(255) NULL, \`condition\` varchar(255) NOT NULL DEFAULT 'NEW', \`priceAmount\` decimal(20,6) NULL, \`priceCurrency\` varchar(3) NULL, \`productPriceId\` varchar(36) NULL, \`commissionRate\` decimal(9,6) NULL, \`commissionBasis\` varchar(255) NULL, \`commissionTiers\` json NULL, \`status\` varchar(255) NOT NULL DEFAULT 'DRAFT', \`channelIds\` json NULL, \`regionIds\` json NULL, \`availableFrom\` datetime NULL, \`availableTo\` datetime NULL, \`maxQuantityPerOrder\` int NULL, \`fulfilmentMode\` varchar(255) NOT NULL DEFAULT 'PLATFORM', \`fulfilmentWarehouseId\` varchar(36) NULL, \`handlingDays\` int NULL, \`isFeatured\` tinyint NOT NULL DEFAULT 0, \`allowNegativeNet\` tinyint NULL, \`approvedAt\` datetime NULL, \`approvedByUserId\` varchar(36) NULL, \`rejectionReason\` varchar(255) NULL, \`externalId\` varchar(255) NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_seller_offering_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_seller_offering_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_seller_offering_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_seller_offering_is_active\` (\`isActive\`), INDEX \`IDX_seller_offering_is_archived\` (\`isArchived\`), INDEX \`IDX_seller_offering_tenant\` (\`tenantId\`), INDEX \`IDX_seller_offering_organization\` (\`organizationId\`), INDEX \`IDX_seller_offering_variant\` (\`variantId\`, \`status\`), INDEX \`IDX_seller_offering_window\` (\`variantId\`, \`status\`, \`availableFrom\`, \`availableTo\`), INDEX \`IDX_seller_offering_seller\` (\`sellerId\`, \`status\`), INDEX \`IDX_seller_offering_product\` (\`productId\`), INDEX \`IDX_seller_offering_price\` (\`productPriceId\`), INDEX \`IDX_seller_offering_wh\` (\`fulfilmentWarehouseId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_offering\` ON \`seller_offering\` (\`sellerId\`, \`variantId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_offering_sku\` ON \`seller_offering\` (\`sellerId\`, \`sellerSku\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_offering_external\` ON \`seller_offering\` (\`sellerId\`, \`externalId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_offering\` ADD CONSTRAINT \`FK_seller_offering_seller\` FOREIGN KEY (\`sellerId\`) REFERENCES \`seller\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_offering\` ADD CONSTRAINT \`FK_seller_offering_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_offering\` ADD CONSTRAINT \`FK_seller_offering_product\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_offering\` ADD CONSTRAINT \`FK_seller_offering_warehouse\` FOREIGN KEY (\`fulfilmentWarehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_offering\` ADD CONSTRAINT \`FK_seller_offering_approved_by\` FOREIGN KEY (\`approvedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`seller_transaction\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`sellerId\` varchar(36) NOT NULL, \`orderId\` varchar(36) NOT NULL, \`orderLineId\` varchar(36) NULL, \`orderTransactionId\` varchar(36) NULL, \`kind\` varchar(255) NOT NULL DEFAULT 'SALE', \`status\` varchar(255) NOT NULL DEFAULT 'PENDING', \`currency\` varchar(3) NOT NULL, \`currencyDecimals\` int NOT NULL DEFAULT 2, \`grossAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`taxAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`sellerDiscountAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`platformDiscountAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`commissionBasis\` varchar(255) NOT NULL, \`commissionBasisAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`commissionRate\` decimal(9,6) NOT NULL DEFAULT 0, \`commissionAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`netAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`commissionOn\` varchar(255) NOT NULL DEFAULT 'LINE', \`occurredAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`settleableAt\` datetime NULL, \`settledAt\` datetime NULL, \`paidAt\` datetime NULL, \`holdReason\` varchar(64) NULL, \`reversesTransactionId\` varchar(36) NULL, \`refundId\` varchar(36) NULL, \`description\` varchar(255) NULL, \`externalId\` varchar(255) NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`saleKindKey\` varchar(36) GENERATED ALWAYS AS (IF(\`kind\` = 'SALE', '0', \`id\`)) STORED, INDEX \`IDX_seller_tx_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_seller_tx_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_seller_tx_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_seller_tx_is_active\` (\`isActive\`), INDEX \`IDX_seller_tx_is_archived\` (\`isArchived\`), INDEX \`IDX_seller_tx_tenant\` (\`tenantId\`), INDEX \`IDX_seller_tx_organization\` (\`organizationId\`), INDEX \`IDX_seller_tx_seller\` (\`sellerId\`, \`status\`, \`occurredAt\`), INDEX \`IDX_seller_tx_settleable\` (\`sellerId\`, \`status\`, \`settleableAt\`), INDEX \`IDX_seller_tx_order\` (\`orderId\`, \`occurredAt\`), INDEX \`IDX_seller_tx_line\` (\`orderLineId\`), INDEX \`IDX_seller_tx_ordertx\` (\`orderTransactionId\`), INDEX \`IDX_seller_tx_reverses\` (\`reversesTransactionId\`), INDEX \`IDX_seller_tx_refund\` (\`refundId\`), INDEX \`IDX_seller_tx_org\` (\`organizationId\`, \`occurredAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_tx_sale\` ON \`seller_transaction\` (\`orderLineId\`, \`kind\`, \`saleKindKey\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_tx_reversal\` ON \`seller_transaction\` (\`reversesTransactionId\`, \`refundId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_transaction\` ADD CONSTRAINT \`FK_seller_transaction_seller\` FOREIGN KEY (\`sellerId\`) REFERENCES \`seller\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_transaction\` ADD CONSTRAINT \`FK_seller_transaction_reverses\` FOREIGN KEY (\`reversesTransactionId\`) REFERENCES \`seller_transaction\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`seller_payout\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`sellerId\` varchar(36) NOT NULL, \`number\` varchar(64) NOT NULL, \`status\` varchar(255) NOT NULL DEFAULT 'DRAFT', \`payoutMode\` varchar(255) NOT NULL, \`currency\` varchar(3) NOT NULL, \`currencyDecimals\` int NOT NULL DEFAULT 2, \`netAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`feeAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`reserveAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`paidAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`settlementCurrency\` varchar(3) NULL, \`fxRate\` decimal(20,10) NULL, \`settlementAmount\` decimal(20,6) NULL, \`fxCapturedAt\` datetime NULL, \`periodStart\` datetime NULL, \`periodEnd\` datetime NULL, \`scheduledAt\` datetime NULL, \`isFinal\` tinyint NOT NULL DEFAULT 0, \`approvedAt\` datetime NULL, \`approvedByUserId\` varchar(36) NULL, \`paidAt\` datetime NULL, \`failedAt\` datetime NULL, \`canceledAt\` datetime NULL, \`providerKey\` varchar(64) NULL, \`providerReference\` varchar(255) NULL, \`providerTransferId\` varchar(255) NULL, \`payoutAccountReference\` varchar(255) NULL, \`failureCode\` varchar(64) NULL, \`failureReason\` varchar(255) NULL, \`reconcilesSettlementId\` varchar(36) NULL, \`note\` text NULL, \`externalId\` varchar(255) NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`notCanceledKey\` varchar(36) GENERATED ALWAYS AS (IF(\`status\` <> 'CANCELED', '0', \`id\`)) STORED, \`providerKeyKey\` varchar(64) GENERATED ALWAYS AS (IFNULL(\`providerKey\`, '')) STORED, INDEX \`IDX_seller_payout_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_seller_payout_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_seller_payout_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_seller_payout_is_active\` (\`isActive\`), INDEX \`IDX_seller_payout_is_archived\` (\`isArchived\`), INDEX \`IDX_seller_payout_tenant\` (\`tenantId\`), INDEX \`IDX_seller_payout_organization\` (\`organizationId\`), INDEX \`IDX_seller_payout_seller\` (\`sellerId\`, \`status\`, \`scheduledAt\`), INDEX \`IDX_seller_payout_org_status\` (\`organizationId\`, \`status\`, \`scheduledAt\`), INDEX \`IDX_seller_payout_settlement\` (\`reconcilesSettlementId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_payout_number\` ON \`seller_payout\` (\`organizationKey\`, \`number\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_payout_providerref\` ON \`seller_payout\` (\`providerKeyKey\`, \`providerTransferId\`, \`deletedKey\`)`
		);
		// `notCanceledKey` carries `status <> 'CANCELED'`: a canceled payout takes its own id and can
		// never collide, which is exactly what the Postgres predicate does by excluding it from the index,
		// so the guarantee that a period is paid once holds for every payout that is not canceled.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_payout_period\` ON \`seller_payout\` (\`sellerId\`, \`currency\`, \`periodStart\`, \`periodEnd\`, \`notCanceledKey\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_payout\` ADD CONSTRAINT \`FK_seller_payout_seller\` FOREIGN KEY (\`sellerId\`) REFERENCES \`seller\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_payout\` ADD CONSTRAINT \`FK_seller_payout_approved_by\` FOREIGN KEY (\`approvedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`seller_settlement\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`sellerId\` varchar(36) NOT NULL, \`payoutAccountHolderId\` varchar(36) NULL, \`payoutId\` varchar(36) NULL, \`providerKey\` varchar(64) NOT NULL, \`status\` varchar(255) NOT NULL DEFAULT 'OPEN', \`currency\` varchar(3) NOT NULL, \`currencyDecimals\` int NOT NULL DEFAULT 2, \`grossAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`commissionAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`feeAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`netAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`settlementCurrency\` varchar(3) NULL, \`fxRate\` decimal(20,10) NULL, \`settlementAmount\` decimal(20,6) NULL, \`fxCapturedAt\` datetime NULL, \`periodStart\` datetime NULL, \`periodEnd\` datetime NULL, \`providerReportId\` varchar(255) NULL, \`externalReference\` varchar(255) NULL, \`discrepancyAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`reconciledAt\` datetime NULL, \`reconciledByUserId\` varchar(36) NULL, \`closedAt\` datetime NULL, \`note\` text NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_seller_settlement_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_seller_settlement_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_seller_settlement_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_seller_settlement_is_active\` (\`isActive\`), INDEX \`IDX_seller_settlement_is_archived\` (\`isArchived\`), INDEX \`IDX_seller_settlement_tenant\` (\`tenantId\`), INDEX \`IDX_seller_settlement_organization\` (\`organizationId\`), INDEX \`IDX_seller_settlement_seller\` (\`sellerId\`, \`status\`, \`periodEnd\`), INDEX \`IDX_seller_settlement_payout\` (\`payoutId\`), INDEX \`IDX_seller_settlement_holder\` (\`payoutAccountHolderId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_settlement_report\` ON \`seller_settlement\` (\`providerKey\`, \`providerReportId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_settlement_period\` ON \`seller_settlement\` (\`sellerId\`, \`providerKey\`, \`currency\`, \`periodStart\`, \`periodEnd\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_settlement\` ADD CONSTRAINT \`FK_seller_settlement_seller\` FOREIGN KEY (\`sellerId\`) REFERENCES \`seller\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_settlement\` ADD CONSTRAINT \`FK_seller_settlement_payout\` FOREIGN KEY (\`payoutId\`) REFERENCES \`seller_payout\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_settlement\` ADD CONSTRAINT \`FK_seller_settlement_reconciled_by\` FOREIGN KEY (\`reconciledByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_payout\` ADD CONSTRAINT \`FK_seller_payout_settlement\` FOREIGN KEY (\`reconcilesSettlementId\`) REFERENCES \`seller_settlement\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`seller_payout_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`sellerPayoutId\` varchar(36) NOT NULL, \`sellerTransactionId\` varchar(36) NOT NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`note\` varchar(255) NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_seller_payout_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_seller_payout_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_seller_payout_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_seller_payout_line_is_active\` (\`isActive\`), INDEX \`IDX_seller_payout_line_is_archived\` (\`isArchived\`), INDEX \`IDX_seller_payout_line_tenant\` (\`tenantId\`), INDEX \`IDX_seller_payout_line_organization\` (\`organizationId\`), INDEX \`IDX_seller_payout_line_payout\` (\`sellerPayoutId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_seller_payout_line_tx\` ON \`seller_payout_line\` (\`sellerTransactionId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_payout_line\` ADD CONSTRAINT \`FK_seller_payout_line_payout\` FOREIGN KEY (\`sellerPayoutId\`) REFERENCES \`seller_payout\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`seller_payout_line\` ADD CONSTRAINT \`FK_seller_payout_line_transaction\` FOREIGN KEY (\`sellerTransactionId\`) REFERENCES \`seller_transaction\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`seller_payout_line\` DROP FOREIGN KEY \`FK_seller_payout_line_transaction\``);
		await queryRunner.query(`ALTER TABLE \`seller_payout_line\` DROP FOREIGN KEY \`FK_seller_payout_line_payout\``);
		await queryRunner.query(`ALTER TABLE \`seller_payout\` DROP FOREIGN KEY \`FK_seller_payout_settlement\``);
		await queryRunner.query(`ALTER TABLE \`seller_settlement\` DROP FOREIGN KEY \`FK_seller_settlement_reconciled_by\``);
		await queryRunner.query(`ALTER TABLE \`seller_settlement\` DROP FOREIGN KEY \`FK_seller_settlement_payout\``);
		await queryRunner.query(`ALTER TABLE \`seller_settlement\` DROP FOREIGN KEY \`FK_seller_settlement_seller\``);
		await queryRunner.query(`ALTER TABLE \`seller_payout\` DROP FOREIGN KEY \`FK_seller_payout_approved_by\``);
		await queryRunner.query(`ALTER TABLE \`seller_payout\` DROP FOREIGN KEY \`FK_seller_payout_seller\``);
		await queryRunner.query(`ALTER TABLE \`seller_transaction\` DROP FOREIGN KEY \`FK_seller_transaction_reverses\``);
		await queryRunner.query(`ALTER TABLE \`seller_transaction\` DROP FOREIGN KEY \`FK_seller_transaction_seller\``);
		await queryRunner.query(`ALTER TABLE \`seller_offering\` DROP FOREIGN KEY \`FK_seller_offering_approved_by\``);
		await queryRunner.query(`ALTER TABLE \`seller_offering\` DROP FOREIGN KEY \`FK_seller_offering_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`seller_offering\` DROP FOREIGN KEY \`FK_seller_offering_product\``);
		await queryRunner.query(`ALTER TABLE \`seller_offering\` DROP FOREIGN KEY \`FK_seller_offering_variant\``);
		await queryRunner.query(`ALTER TABLE \`seller_offering\` DROP FOREIGN KEY \`FK_seller_offering_seller\``);
		await queryRunner.query(`ALTER TABLE \`seller\` DROP FOREIGN KEY \`FK_seller_user\``);
		await queryRunner.query(`ALTER TABLE \`seller\` DROP FOREIGN KEY \`FK_seller_merchant\``);
		await queryRunner.query(`ALTER TABLE \`seller\` DROP FOREIGN KEY \`FK_seller_contact\``);

		await queryRunner.query(`DROP TABLE \`seller_payout_line\``);
		await queryRunner.query(`DROP TABLE \`seller_settlement\``);
		await queryRunner.query(`DROP TABLE \`seller_payout\``);
		await queryRunner.query(`DROP TABLE \`seller_transaction\``);
		await queryRunner.query(`DROP TABLE \`seller_offering\``);
		await queryRunner.query(`DROP TABLE \`seller\``);
	}

	/**
	 * The indices every tenant-scoped table carries: the four actor columns, the two flags and the two
	 * scoping columns. Written once because repeating them per table is how one table ends up missing
	 * one.
	 *
	 * @param queryRunner
	 * @param table The table to index.
	 */
	private async baseIndexes(queryRunner: QueryRunner, table: string): Promise<void> {
		await queryRunner.query(`CREATE INDEX "IDX_${table}_created_by_user" ON "${table}" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_${table}_updated_by_user" ON "${table}" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_${table}_deleted_by_user" ON "${table}" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_${table}_is_active" ON "${table}" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_${table}_is_archived" ON "${table}" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_${table}_tenant" ON "${table}" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_${table}_organization" ON "${table}" ("organizationId")`);
	}
}
