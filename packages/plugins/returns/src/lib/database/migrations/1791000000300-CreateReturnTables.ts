import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the returns, claims and exchanges tables.
 *
 * Three flows, seven tables, one package, because they answer one question — goods that were
 * delivered and should not have been, or arrived wrong — and they share the reason codes, the
 * numbering series, the receiving step and the stock decision.
 *
 * The signature of each table is what makes the domain's rules enforceable in the database rather
 * than only in a service. A return number is unique inside an organization, so a customer can quote
 * one and mean exactly one document. A claim may have two lines about the same order line — one
 * damaged, one missing — which is why the claim line pair carries no unique constraint while the
 * return line pair does. A licence to return the same order line twice is bounded by the lines
 * themselves, whose quantities are checked against the fulfilled quantity of the order.
 *
 * The foreign keys into tables this plugin does not own (`order`, `order_line`, `warehouse`,
 * `shipping_option`, `product_variant`) are created here as well: the tables are owned by the order,
 * catalogue and warehouse capabilities, but the constraint belongs to the relationship, and a return
 * pointing at an order that does not exist is a defect whichever package wrote it.
 *
 * All three dialects are written by hand, and the down migration reverses every statement in the
 * opposite order — a partially reverted schema is worse than an unreverted one.
 */
export class CreateReturnTables1791000000300 implements MigrationInterface {
	name = 'CreateReturnTables1791000000300';

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
		// The reason tree comes first: it is referenced by a return and by a return line.
		await queryRunner.query(
			`CREATE TABLE "order_return_reason" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "code" character varying(64) NOT NULL, "label" character varying(255) NOT NULL, "description" text, "parentId" uuid, CONSTRAINT "PK_order_return_reason_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_reason_created_by_user" ON "order_return_reason" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_reason_updated_by_user" ON "order_return_reason" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_reason_deleted_by_user" ON "order_return_reason" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_reason_is_active" ON "order_return_reason" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_reason_is_archived" ON "order_return_reason" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_reason_tenant" ON "order_return_reason" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_reason_organization" ON "order_return_reason" ("organizationId")`
		);
		// A reason code is the tenant's own reporting key and means one thing inside one organization.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_return_reason_org_code" ON "order_return_reason" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_reason_parent" ON "order_return_reason" ("parentId") WHERE "parentId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_return" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid, "number" character varying(64) NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'OPEN', "warehouseId" uuid, "reasonId" uuid, "reason" character varying(255), "refundAmount" numeric(20,6), "currency" character varying(3) NOT NULL, "requestedAt" TIMESTAMP, "approvedAt" TIMESTAMP, "receivedAt" TIMESTAMP, "canceledAt" TIMESTAMP, "closedAt" TIMESTAMP, "claimId" uuid, "exchangeId" uuid, "shippingOptionId" uuid, "noNotification" boolean NOT NULL DEFAULT false, "note" text, "metadata" jsonb, CONSTRAINT "PK_order_return_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_created_by_user" ON "order_return" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_updated_by_user" ON "order_return" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_deleted_by_user" ON "order_return" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_is_active" ON "order_return" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_is_archived" ON "order_return" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_tenant" ON "order_return" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_organization" ON "order_return" ("organizationId")`);
		// One return number per organization: a customer quoting a number means one document.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_return_number" ON "order_return" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "number") WHERE "deletedAt" IS NULL`
		);
		// The two scans the domain actually runs: the returns of an order, and the open queue.
		await queryRunner.query(
			`CREATE INDEX "IDX_return_order" ON "order_return" ("orderId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_status" ON "order_return" ("organizationId", "status", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_warehouse" ON "order_return" ("warehouseId", "status") WHERE "warehouseId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_claim" ON "order_return" ("claimId") WHERE "claimId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_exchange" ON "order_return" ("exchangeId") WHERE "exchangeId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_order" ON "order_return" ("orderId") WHERE "orderId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_shipping_option" ON "order_return" ("shippingOptionId") WHERE "shippingOptionId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_return_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "returnId" uuid NOT NULL, "orderLineId" uuid, "quantity" numeric(20,6) NOT NULL, "receivedQuantity" numeric(20,6) NOT NULL DEFAULT 0, "damagedQuantity" numeric(20,6) NOT NULL DEFAULT 0, "reasonId" uuid, "restock" boolean NOT NULL DEFAULT true, "warehouseId" uuid, "note" text, "metadata" jsonb, CONSTRAINT "PK_order_return_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_created_by_user" ON "order_return_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_updated_by_user" ON "order_return_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_deleted_by_user" ON "order_return_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_line_is_active" ON "order_return_line" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_is_archived" ON "order_return_line" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_line_tenant" ON "order_return_line" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_organization" ON "order_return_line" ("organizationId")`
		);
		// One line per returned order line: a second partial return of the same line is a second
		// return, which keeps the ceiling check unambiguous.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_return_line" ON "order_return_line" ("returnId", "orderLineId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_line_order_line" ON "order_return_line" ("orderLineId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_line_warehouse" ON "order_return_line" ("warehouseId") WHERE "warehouseId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_reason" ON "order_return_line" ("reasonId") WHERE "reasonId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_claim" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid, "number" character varying(64) NOT NULL, "type" character varying(16) NOT NULL DEFAULT 'REFUND', "status" character varying(16) NOT NULL DEFAULT 'OPEN', "refundAmount" numeric(20,6), "currency" character varying(3) NOT NULL, "returnId" uuid, "reason" character varying(255), "note" text, "canceledAt" TIMESTAMP, "metadata" jsonb, CONSTRAINT "PK_order_claim_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_created_by_user" ON "order_claim" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_updated_by_user" ON "order_claim" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_deleted_by_user" ON "order_claim" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_is_active" ON "order_claim" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_is_archived" ON "order_claim" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_tenant" ON "order_claim" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_organization" ON "order_claim" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_claim_number" ON "order_claim" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_order" ON "order_claim" ("orderId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_status" ON "order_claim" ("organizationId", "status", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_return" ON "order_claim" ("returnId") WHERE "returnId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_claim_order" ON "order_claim" ("orderId") WHERE "orderId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_claim_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "claimId" uuid NOT NULL, "orderLineId" uuid, "variantId" uuid, "quantity" numeric(20,6) NOT NULL, "reason" character varying(32) NOT NULL DEFAULT 'OTHER', "isAdditionalItem" boolean NOT NULL DEFAULT false, "note" text, "metadata" jsonb, CONSTRAINT "PK_order_claim_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_claim_line_created_by_user" ON "order_claim_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_claim_line_updated_by_user" ON "order_claim_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_claim_line_deleted_by_user" ON "order_claim_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_line_is_active" ON "order_claim_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_line_is_archived" ON "order_claim_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_line_tenant" ON "order_claim_line" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_claim_line_organization" ON "order_claim_line" ("organizationId")`
		);
		// Deliberately not unique on the pair: one damaged unit and one missing unit of the same
		// order line are two lines with two reasons, and collapsing them would lose that.
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_line_claim" ON "order_claim_line" ("claimId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_line_order_line" ON "order_claim_line" ("orderLineId") WHERE "orderLineId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_line_variant" ON "order_claim_line" ("variantId") WHERE "variantId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_exchange" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid, "number" character varying(64) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'OPEN', "differenceDue" numeric(20,6), "currency" character varying(3) NOT NULL, "returnId" uuid, "allowBackorder" boolean NOT NULL DEFAULT false, "note" text, "canceledAt" TIMESTAMP, "metadata" jsonb, CONSTRAINT "PK_order_exchange_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_created_by_user" ON "order_exchange" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_updated_by_user" ON "order_exchange" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_deleted_by_user" ON "order_exchange" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_is_active" ON "order_exchange" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_is_archived" ON "order_exchange" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_tenant" ON "order_exchange" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_organization" ON "order_exchange" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_exchange_number" ON "order_exchange" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_order" ON "order_exchange" ("orderId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_status" ON "order_exchange" ("organizationId", "status", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_return" ON "order_exchange" ("returnId") WHERE "returnId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_order" ON "order_exchange" ("orderId") WHERE "orderId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_exchange_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "exchangeId" uuid NOT NULL, "orderLineId" uuid, "variantId" uuid NOT NULL, "quantity" numeric(20,6) NOT NULL, "unitPrice" numeric(20,6) NOT NULL, "note" text, "metadata" jsonb, CONSTRAINT "PK_order_exchange_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_line_created_by_user" ON "order_exchange_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_line_updated_by_user" ON "order_exchange_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_line_deleted_by_user" ON "order_exchange_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_line_is_active" ON "order_exchange_line" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_line_is_archived" ON "order_exchange_line" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_line_tenant" ON "order_exchange_line" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_line_organization" ON "order_exchange_line" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_line_exchange" ON "order_exchange_line" ("exchangeId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_line_order_line" ON "order_exchange_line" ("orderLineId") WHERE "orderLineId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_line_variant" ON "order_exchange_line" ("variantId")`
		);

		/*
		 * Foreign keys. Every table exists by now, so the two circular pairs a return has with a claim
		 * and with an exchange can be created in either direction.
		 */
		await queryRunner.query(
			`ALTER TABLE "order_return_reason" ADD CONSTRAINT "FK_order_return_reason_parent" FOREIGN KEY ("parentId") REFERENCES "order_return_reason"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "order_return" ADD CONSTRAINT "FK_order_return_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_return" ADD CONSTRAINT "FK_order_return_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_return" ADD CONSTRAINT "FK_order_return_reason" FOREIGN KEY ("reasonId") REFERENCES "order_return_reason"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_return" ADD CONSTRAINT "FK_order_return_claim" FOREIGN KEY ("claimId") REFERENCES "order_claim"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_return" ADD CONSTRAINT "FK_order_return_exchange" FOREIGN KEY ("exchangeId") REFERENCES "order_exchange"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_return" ADD CONSTRAINT "FK_order_return_shipping_option" FOREIGN KEY ("shippingOptionId") REFERENCES "shipping_option"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "order_return_line" ADD CONSTRAINT "FK_order_return_line_return" FOREIGN KEY ("returnId") REFERENCES "order_return"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_return_line" ADD CONSTRAINT "FK_order_return_line_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_return_line" ADD CONSTRAINT "FK_order_return_line_reason" FOREIGN KEY ("reasonId") REFERENCES "order_return_reason"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_return_line" ADD CONSTRAINT "FK_order_return_line_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "order_claim" ADD CONSTRAINT "FK_order_claim_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_claim" ADD CONSTRAINT "FK_order_claim_return" FOREIGN KEY ("returnId") REFERENCES "order_return"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "order_claim_line" ADD CONSTRAINT "FK_order_claim_line_claim" FOREIGN KEY ("claimId") REFERENCES "order_claim"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_claim_line" ADD CONSTRAINT "FK_order_claim_line_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_claim_line" ADD CONSTRAINT "FK_order_claim_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "order_exchange" ADD CONSTRAINT "FK_order_exchange_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_exchange" ADD CONSTRAINT "FK_order_exchange_return" FOREIGN KEY ("returnId") REFERENCES "order_return"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "order_exchange_line" ADD CONSTRAINT "FK_order_exchange_line_exchange" FOREIGN KEY ("exchangeId") REFERENCES "order_exchange"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_exchange_line" ADD CONSTRAINT "FK_order_exchange_line_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_exchange_line" ADD CONSTRAINT "FK_order_exchange_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "order_exchange_line" DROP CONSTRAINT "FK_order_exchange_line_variant"`
		);
		await queryRunner.query(
			`ALTER TABLE "order_exchange_line" DROP CONSTRAINT "FK_order_exchange_line_order_line"`
		);
		await queryRunner.query(
			`ALTER TABLE "order_exchange_line" DROP CONSTRAINT "FK_order_exchange_line_exchange"`
		);
		await queryRunner.query(`ALTER TABLE "order_exchange" DROP CONSTRAINT "FK_order_exchange_return"`);
		await queryRunner.query(`ALTER TABLE "order_exchange" DROP CONSTRAINT "FK_order_exchange_order"`);
		await queryRunner.query(`ALTER TABLE "order_claim_line" DROP CONSTRAINT "FK_order_claim_line_variant"`);
		await queryRunner.query(`ALTER TABLE "order_claim_line" DROP CONSTRAINT "FK_order_claim_line_order_line"`);
		await queryRunner.query(`ALTER TABLE "order_claim_line" DROP CONSTRAINT "FK_order_claim_line_claim"`);
		await queryRunner.query(`ALTER TABLE "order_claim" DROP CONSTRAINT "FK_order_claim_return"`);
		await queryRunner.query(`ALTER TABLE "order_claim" DROP CONSTRAINT "FK_order_claim_order"`);
		await queryRunner.query(`ALTER TABLE "order_return_line" DROP CONSTRAINT "FK_order_return_line_warehouse"`);
		await queryRunner.query(`ALTER TABLE "order_return_line" DROP CONSTRAINT "FK_order_return_line_reason"`);
		await queryRunner.query(`ALTER TABLE "order_return_line" DROP CONSTRAINT "FK_order_return_line_order_line"`);
		await queryRunner.query(`ALTER TABLE "order_return_line" DROP CONSTRAINT "FK_order_return_line_return"`);
		await queryRunner.query(`ALTER TABLE "order_return" DROP CONSTRAINT "FK_order_return_shipping_option"`);
		await queryRunner.query(`ALTER TABLE "order_return" DROP CONSTRAINT "FK_order_return_exchange"`);
		await queryRunner.query(`ALTER TABLE "order_return" DROP CONSTRAINT "FK_order_return_claim"`);
		await queryRunner.query(`ALTER TABLE "order_return" DROP CONSTRAINT "FK_order_return_reason"`);
		await queryRunner.query(`ALTER TABLE "order_return" DROP CONSTRAINT "FK_order_return_warehouse"`);
		await queryRunner.query(`ALTER TABLE "order_return" DROP CONSTRAINT "FK_order_return_order"`);
		await queryRunner.query(`ALTER TABLE "order_return_reason" DROP CONSTRAINT "FK_order_return_reason_parent"`);

		await queryRunner.query(`DROP INDEX "IDX_exchange_line_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_line_order_line"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_line_exchange"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_exchange_line"`);

		await queryRunner.query(`DROP INDEX "IDX_order_exchange_order"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_return"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_status"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_order"`);
		await queryRunner.query(`DROP INDEX "UQ_exchange_number"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_exchange"`);

		await queryRunner.query(`DROP INDEX "IDX_claim_line_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_claim_line_order_line"`);
		await queryRunner.query(`DROP INDEX "IDX_claim_line_claim"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_claim_line"`);

		await queryRunner.query(`DROP INDEX "IDX_order_claim_order"`);
		await queryRunner.query(`DROP INDEX "IDX_claim_return"`);
		await queryRunner.query(`DROP INDEX "IDX_claim_status"`);
		await queryRunner.query(`DROP INDEX "IDX_claim_order"`);
		await queryRunner.query(`DROP INDEX "UQ_claim_number"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_claim"`);

		await queryRunner.query(`DROP INDEX "IDX_order_return_line_reason"`);
		await queryRunner.query(`DROP INDEX "IDX_return_line_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_return_line_order_line"`);
		await queryRunner.query(`DROP INDEX "UQ_return_line"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_return_line"`);

		await queryRunner.query(`DROP INDEX "IDX_order_return_shipping_option"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_order"`);
		await queryRunner.query(`DROP INDEX "IDX_return_exchange"`);
		await queryRunner.query(`DROP INDEX "IDX_return_claim"`);
		await queryRunner.query(`DROP INDEX "IDX_return_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_return_status"`);
		await queryRunner.query(`DROP INDEX "IDX_return_order"`);
		await queryRunner.query(`DROP INDEX "UQ_return_number"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_return"`);

		await queryRunner.query(`DROP INDEX "IDX_return_reason_parent"`);
		await queryRunner.query(`DROP INDEX "UQ_return_reason_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_return_reason"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a constraint to an existing table, so every foreign key is declared inline
	 * with the table that owns it. Forward references are resolved when the constraint is used rather
	 * than when it is declared, which is what lets the two circular pairs exist.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "order_return_reason" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "code" varchar(64) NOT NULL, "label" varchar(255) NOT NULL, "description" text, "parentId" varchar, CONSTRAINT "FK_order_return_reason_parent" FOREIGN KEY ("parentId") REFERENCES "order_return_reason" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_reason_created_by_user" ON "order_return_reason" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_reason_updated_by_user" ON "order_return_reason" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_reason_deleted_by_user" ON "order_return_reason" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_reason_is_active" ON "order_return_reason" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_reason_is_archived" ON "order_return_reason" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_reason_tenant" ON "order_return_reason" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_reason_organization" ON "order_return_reason" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_return_reason_org_code" ON "order_return_reason" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_reason_parent" ON "order_return_reason" ("parentId") WHERE "parentId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_return" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar, "number" varchar(64) NOT NULL, "status" varchar(32) NOT NULL DEFAULT ('OPEN'), "warehouseId" varchar, "reasonId" varchar, "reason" varchar(255), "refundAmount" numeric(20,6), "currency" varchar(3) NOT NULL, "requestedAt" datetime, "approvedAt" datetime, "receivedAt" datetime, "canceledAt" datetime, "closedAt" datetime, "claimId" varchar, "exchangeId" varchar, "shippingOptionId" varchar, "noNotification" boolean NOT NULL DEFAULT (0), "note" text, "metadata" text, CONSTRAINT "FK_order_return_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_order_return_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_order_return_reason" FOREIGN KEY ("reasonId") REFERENCES "order_return_reason" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_order_return_claim" FOREIGN KEY ("claimId") REFERENCES "order_claim" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_order_return_exchange" FOREIGN KEY ("exchangeId") REFERENCES "order_exchange" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_order_return_shipping_option" FOREIGN KEY ("shippingOptionId") REFERENCES "shipping_option" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_created_by_user" ON "order_return" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_updated_by_user" ON "order_return" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_deleted_by_user" ON "order_return" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_is_active" ON "order_return" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_is_archived" ON "order_return" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_tenant" ON "order_return" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_organization" ON "order_return" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_return_number" ON "order_return" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_order" ON "order_return" ("orderId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_status" ON "order_return" ("organizationId", "status", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_warehouse" ON "order_return" ("warehouseId", "status") WHERE "warehouseId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_claim" ON "order_return" ("claimId") WHERE "claimId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_exchange" ON "order_return" ("exchangeId") WHERE "exchangeId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_order" ON "order_return" ("orderId") WHERE "orderId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_shipping_option" ON "order_return" ("shippingOptionId") WHERE "shippingOptionId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_return_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "returnId" varchar NOT NULL, "orderLineId" varchar, "quantity" numeric(20,6) NOT NULL, "receivedQuantity" numeric(20,6) NOT NULL DEFAULT (0), "damagedQuantity" numeric(20,6) NOT NULL DEFAULT (0), "reasonId" varchar, "restock" boolean NOT NULL DEFAULT (1), "warehouseId" varchar, "note" text, "metadata" text, CONSTRAINT "FK_order_return_line_return" FOREIGN KEY ("returnId") REFERENCES "order_return" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_order_return_line_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_order_return_line_reason" FOREIGN KEY ("reasonId") REFERENCES "order_return_reason" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_order_return_line_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_created_by_user" ON "order_return_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_updated_by_user" ON "order_return_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_deleted_by_user" ON "order_return_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_line_is_active" ON "order_return_line" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_is_archived" ON "order_return_line" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_return_line_tenant" ON "order_return_line" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_organization" ON "order_return_line" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_return_line" ON "order_return_line" ("returnId", "orderLineId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_line_order_line" ON "order_return_line" ("orderLineId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_return_line_warehouse" ON "order_return_line" ("warehouseId") WHERE "warehouseId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_return_line_reason" ON "order_return_line" ("reasonId") WHERE "reasonId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_claim" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar, "number" varchar(64) NOT NULL, "type" varchar(16) NOT NULL DEFAULT ('REFUND'), "status" varchar(16) NOT NULL DEFAULT ('OPEN'), "refundAmount" numeric(20,6), "currency" varchar(3) NOT NULL, "returnId" varchar, "reason" varchar(255), "note" text, "canceledAt" datetime, "metadata" text, CONSTRAINT "FK_order_claim_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_order_claim_return" FOREIGN KEY ("returnId") REFERENCES "order_return" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_created_by_user" ON "order_claim" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_updated_by_user" ON "order_claim" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_deleted_by_user" ON "order_claim" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_is_active" ON "order_claim" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_is_archived" ON "order_claim" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_tenant" ON "order_claim" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_organization" ON "order_claim" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_claim_number" ON "order_claim" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_order" ON "order_claim" ("orderId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_status" ON "order_claim" ("organizationId", "status", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_return" ON "order_claim" ("returnId") WHERE "returnId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_claim_order" ON "order_claim" ("orderId") WHERE "orderId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_claim_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "claimId" varchar NOT NULL, "orderLineId" varchar, "variantId" varchar, "quantity" numeric(20,6) NOT NULL, "reason" varchar(32) NOT NULL DEFAULT ('OTHER'), "isAdditionalItem" boolean NOT NULL DEFAULT (0), "note" text, "metadata" text, CONSTRAINT "FK_order_claim_line_claim" FOREIGN KEY ("claimId") REFERENCES "order_claim" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_order_claim_line_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_order_claim_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_claim_line_created_by_user" ON "order_claim_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_claim_line_updated_by_user" ON "order_claim_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_claim_line_deleted_by_user" ON "order_claim_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_line_is_active" ON "order_claim_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_line_is_archived" ON "order_claim_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_claim_line_tenant" ON "order_claim_line" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_claim_line_organization" ON "order_claim_line" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_line_claim" ON "order_claim_line" ("claimId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_line_order_line" ON "order_claim_line" ("orderLineId") WHERE "orderLineId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_claim_line_variant" ON "order_claim_line" ("variantId") WHERE "variantId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_exchange" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar, "number" varchar(64) NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('OPEN'), "differenceDue" numeric(20,6), "currency" varchar(3) NOT NULL, "returnId" varchar, "allowBackorder" boolean NOT NULL DEFAULT (0), "note" text, "canceledAt" datetime, "metadata" text, CONSTRAINT "FK_order_exchange_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_order_exchange_return" FOREIGN KEY ("returnId") REFERENCES "order_return" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_created_by_user" ON "order_exchange" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_updated_by_user" ON "order_exchange" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_deleted_by_user" ON "order_exchange" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_is_active" ON "order_exchange" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_is_archived" ON "order_exchange" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_tenant" ON "order_exchange" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_organization" ON "order_exchange" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_exchange_number" ON "order_exchange" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_order" ON "order_exchange" ("orderId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_status" ON "order_exchange" ("organizationId", "status", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_return" ON "order_exchange" ("returnId") WHERE "returnId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_order" ON "order_exchange" ("orderId") WHERE "orderId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "order_exchange_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "exchangeId" varchar NOT NULL, "orderLineId" varchar, "variantId" varchar NOT NULL, "quantity" numeric(20,6) NOT NULL, "unitPrice" numeric(20,6) NOT NULL, "note" text, "metadata" text, CONSTRAINT "FK_order_exchange_line_exchange" FOREIGN KEY ("exchangeId") REFERENCES "order_exchange" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_order_exchange_line_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_order_exchange_line_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_line_created_by_user" ON "order_exchange_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_line_updated_by_user" ON "order_exchange_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_line_deleted_by_user" ON "order_exchange_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_line_is_active" ON "order_exchange_line" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_line_is_archived" ON "order_exchange_line" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_order_exchange_line_tenant" ON "order_exchange_line" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_order_exchange_line_organization" ON "order_exchange_line" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_line_exchange" ON "order_exchange_line" ("exchangeId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_exchange_line_order_line" ON "order_exchange_line" ("orderLineId") WHERE "orderLineId" IS NOT NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_exchange_line_variant" ON "order_exchange_line" ("variantId")`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_exchange_line_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_line_order_line"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_line_exchange"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_exchange_line"`);

		await queryRunner.query(`DROP INDEX "IDX_order_exchange_order"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_return"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_status"`);
		await queryRunner.query(`DROP INDEX "IDX_exchange_order"`);
		await queryRunner.query(`DROP INDEX "UQ_exchange_number"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_exchange_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_exchange"`);

		await queryRunner.query(`DROP INDEX "IDX_claim_line_variant"`);
		await queryRunner.query(`DROP INDEX "IDX_claim_line_order_line"`);
		await queryRunner.query(`DROP INDEX "IDX_claim_line_claim"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_claim_line"`);

		await queryRunner.query(`DROP INDEX "IDX_order_claim_order"`);
		await queryRunner.query(`DROP INDEX "IDX_claim_return"`);
		await queryRunner.query(`DROP INDEX "IDX_claim_status"`);
		await queryRunner.query(`DROP INDEX "IDX_claim_order"`);
		await queryRunner.query(`DROP INDEX "UQ_claim_number"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_claim_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_claim"`);

		await queryRunner.query(`DROP INDEX "IDX_order_return_line_reason"`);
		await queryRunner.query(`DROP INDEX "IDX_return_line_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_return_line_order_line"`);
		await queryRunner.query(`DROP INDEX "UQ_return_line"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_return_line"`);

		await queryRunner.query(`DROP INDEX "IDX_order_return_shipping_option"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_order"`);
		await queryRunner.query(`DROP INDEX "IDX_return_exchange"`);
		await queryRunner.query(`DROP INDEX "IDX_return_claim"`);
		await queryRunner.query(`DROP INDEX "IDX_return_warehouse"`);
		await queryRunner.query(`DROP INDEX "IDX_return_status"`);
		await queryRunner.query(`DROP INDEX "IDX_return_order"`);
		await queryRunner.query(`DROP INDEX "UQ_return_number"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_return"`);

		await queryRunner.query(`DROP INDEX "IDX_return_reason_parent"`);
		await queryRunner.query(`DROP INDEX "UQ_return_reason_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_order_return_reason_created_by_user"`);
		await queryRunner.query(`DROP TABLE "order_return_reason"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no partial index, so the predicates that make a unique index business-scoped are
	 * carried by the stored generated key columns `CreateSequenceTable1791000000000` documents for the
	 * whole set: `deletedKey` for `"deletedAt" IS NULL`, and `organizationKey` for the nullable scope
	 * column that the numbering rules are per. Including `deletedAt` itself in the key, which this file
	 * used to do, expresses nothing — a unique index in MySQL exempts every tuple that contains a null.
	 *
	 * `order_return_line.orderLineId` stays raw, on every dialect: a return line that references no
	 * order line is an unsolicited item, and a return may carry several of them.
	 * null-exempt: order_return_line.orderLineId
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`order_return_reason\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`code\` varchar(64) NOT NULL, \`label\` varchar(255) NOT NULL, \`description\` text NULL, \`parentId\` varchar(36) NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_order_return_reason_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_return_reason_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_return_reason_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_return_reason_is_active\` (\`isActive\`), INDEX \`IDX_order_return_reason_is_archived\` (\`isArchived\`), INDEX \`IDX_order_return_reason_tenant\` (\`tenantId\`), INDEX \`IDX_order_return_reason_organization\` (\`organizationId\`), INDEX \`IDX_return_reason_parent\` (\`parentId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_return_reason_org_code\` ON \`order_return_reason\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_return\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NULL, \`number\` varchar(64) NOT NULL, \`status\` varchar(32) NOT NULL DEFAULT 'OPEN', \`warehouseId\` varchar(36) NULL, \`reasonId\` varchar(36) NULL, \`reason\` varchar(255) NULL, \`refundAmount\` decimal(20,6) NULL, \`currency\` varchar(3) NOT NULL, \`requestedAt\` datetime NULL, \`approvedAt\` datetime NULL, \`receivedAt\` datetime NULL, \`canceledAt\` datetime NULL, \`closedAt\` datetime NULL, \`claimId\` varchar(36) NULL, \`exchangeId\` varchar(36) NULL, \`shippingOptionId\` varchar(36) NULL, \`noNotification\` tinyint NOT NULL DEFAULT 0, \`note\` text NULL, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_order_return_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_return_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_return_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_return_is_active\` (\`isActive\`), INDEX \`IDX_order_return_is_archived\` (\`isArchived\`), INDEX \`IDX_order_return_tenant\` (\`tenantId\`), INDEX \`IDX_order_return_organization\` (\`organizationId\`), INDEX \`IDX_return_order\` (\`orderId\`, \`status\`), INDEX \`IDX_return_status\` (\`organizationId\`, \`status\`, \`createdAt\`), INDEX \`IDX_return_warehouse\` (\`warehouseId\`, \`status\`), INDEX \`IDX_return_claim\` (\`claimId\`), INDEX \`IDX_return_exchange\` (\`exchangeId\`), INDEX \`IDX_order_return_order\` (\`orderId\`), INDEX \`IDX_order_return_shipping_option\` (\`shippingOptionId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_return_number\` ON \`order_return\` (\`organizationKey\`, \`number\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_return_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`returnId\` varchar(36) NOT NULL, \`orderLineId\` varchar(36) NULL, \`quantity\` decimal(20,6) NOT NULL, \`receivedQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`damagedQuantity\` decimal(20,6) NOT NULL DEFAULT 0, \`reasonId\` varchar(36) NULL, \`restock\` tinyint NOT NULL DEFAULT 1, \`warehouseId\` varchar(36) NULL, \`note\` text NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_order_return_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_return_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_return_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_return_line_is_active\` (\`isActive\`), INDEX \`IDX_order_return_line_is_archived\` (\`isArchived\`), INDEX \`IDX_order_return_line_tenant\` (\`tenantId\`), INDEX \`IDX_order_return_line_organization\` (\`organizationId\`), INDEX \`IDX_return_line_order_line\` (\`orderLineId\`), INDEX \`IDX_return_line_warehouse\` (\`warehouseId\`), INDEX \`IDX_order_return_line_reason\` (\`reasonId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_return_line\` ON \`order_return_line\` (\`returnId\`, \`orderLineId\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_claim\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NULL, \`number\` varchar(64) NOT NULL, \`type\` varchar(16) NOT NULL DEFAULT 'REFUND', \`status\` varchar(16) NOT NULL DEFAULT 'OPEN', \`refundAmount\` decimal(20,6) NULL, \`currency\` varchar(3) NOT NULL, \`returnId\` varchar(36) NULL, \`reason\` varchar(255) NULL, \`note\` text NULL, \`canceledAt\` datetime NULL, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_order_claim_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_claim_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_claim_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_claim_is_active\` (\`isActive\`), INDEX \`IDX_order_claim_is_archived\` (\`isArchived\`), INDEX \`IDX_order_claim_tenant\` (\`tenantId\`), INDEX \`IDX_order_claim_organization\` (\`organizationId\`), INDEX \`IDX_claim_order\` (\`orderId\`, \`status\`), INDEX \`IDX_claim_status\` (\`organizationId\`, \`status\`, \`createdAt\`), INDEX \`IDX_claim_return\` (\`returnId\`), INDEX \`IDX_order_claim_order\` (\`orderId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_claim_number\` ON \`order_claim\` (\`organizationKey\`, \`number\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_claim_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`claimId\` varchar(36) NOT NULL, \`orderLineId\` varchar(36) NULL, \`variantId\` varchar(36) NULL, \`quantity\` decimal(20,6) NOT NULL, \`reason\` varchar(32) NOT NULL DEFAULT 'OTHER', \`isAdditionalItem\` tinyint NOT NULL DEFAULT 0, \`note\` text NULL, \`metadata\` json NULL, INDEX \`IDX_order_claim_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_claim_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_claim_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_claim_line_is_active\` (\`isActive\`), INDEX \`IDX_order_claim_line_is_archived\` (\`isArchived\`), INDEX \`IDX_order_claim_line_tenant\` (\`tenantId\`), INDEX \`IDX_order_claim_line_organization\` (\`organizationId\`), INDEX \`IDX_claim_line_claim\` (\`claimId\`), INDEX \`IDX_claim_line_order_line\` (\`orderLineId\`), INDEX \`IDX_claim_line_variant\` (\`variantId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_exchange\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NULL, \`number\` varchar(64) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'OPEN', \`differenceDue\` decimal(20,6) NULL, \`currency\` varchar(3) NOT NULL, \`returnId\` varchar(36) NULL, \`allowBackorder\` tinyint NOT NULL DEFAULT 0, \`note\` text NULL, \`canceledAt\` datetime NULL, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_order_exchange_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_exchange_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_exchange_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_exchange_is_active\` (\`isActive\`), INDEX \`IDX_order_exchange_is_archived\` (\`isArchived\`), INDEX \`IDX_order_exchange_tenant\` (\`tenantId\`), INDEX \`IDX_order_exchange_organization\` (\`organizationId\`), INDEX \`IDX_exchange_order\` (\`orderId\`, \`status\`), INDEX \`IDX_exchange_status\` (\`organizationId\`, \`status\`, \`createdAt\`), INDEX \`IDX_exchange_return\` (\`returnId\`), INDEX \`IDX_order_exchange_order\` (\`orderId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_exchange_number\` ON \`order_exchange\` (\`organizationKey\`, \`number\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`order_exchange_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`exchangeId\` varchar(36) NOT NULL, \`orderLineId\` varchar(36) NULL, \`variantId\` varchar(36) NOT NULL, \`quantity\` decimal(20,6) NOT NULL, \`unitPrice\` decimal(20,6) NOT NULL, \`note\` text NULL, \`metadata\` json NULL, INDEX \`IDX_order_exchange_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_order_exchange_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_order_exchange_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_order_exchange_line_is_active\` (\`isActive\`), INDEX \`IDX_order_exchange_line_is_archived\` (\`isArchived\`), INDEX \`IDX_order_exchange_line_tenant\` (\`tenantId\`), INDEX \`IDX_order_exchange_line_organization\` (\`organizationId\`), INDEX \`IDX_exchange_line_exchange\` (\`exchangeId\`), INDEX \`IDX_exchange_line_order_line\` (\`orderLineId\`), INDEX \`IDX_exchange_line_variant\` (\`variantId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);

		/*
		 * Foreign keys. The two self-referencing and circular pairs are added after every table exists.
		 */
		await queryRunner.query(
			`ALTER TABLE \`order_return_reason\` ADD CONSTRAINT \`FK_order_return_reason_parent\` FOREIGN KEY (\`parentId\`) REFERENCES \`order_return_reason\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_return\` ADD CONSTRAINT \`FK_order_return_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_return\` ADD CONSTRAINT \`FK_order_return_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_return\` ADD CONSTRAINT \`FK_order_return_reason\` FOREIGN KEY (\`reasonId\`) REFERENCES \`order_return_reason\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_return\` ADD CONSTRAINT \`FK_order_return_claim\` FOREIGN KEY (\`claimId\`) REFERENCES \`order_claim\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_return\` ADD CONSTRAINT \`FK_order_return_exchange\` FOREIGN KEY (\`exchangeId\`) REFERENCES \`order_exchange\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_return\` ADD CONSTRAINT \`FK_order_return_shipping_option\` FOREIGN KEY (\`shippingOptionId\`) REFERENCES \`shipping_option\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_return_line\` ADD CONSTRAINT \`FK_order_return_line_return\` FOREIGN KEY (\`returnId\`) REFERENCES \`order_return\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_return_line\` ADD CONSTRAINT \`FK_order_return_line_order_line\` FOREIGN KEY (\`orderLineId\`) REFERENCES \`order_line\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_return_line\` ADD CONSTRAINT \`FK_order_return_line_reason\` FOREIGN KEY (\`reasonId\`) REFERENCES \`order_return_reason\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_return_line\` ADD CONSTRAINT \`FK_order_return_line_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_claim\` ADD CONSTRAINT \`FK_order_claim_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_claim\` ADD CONSTRAINT \`FK_order_claim_return\` FOREIGN KEY (\`returnId\`) REFERENCES \`order_return\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_claim_line\` ADD CONSTRAINT \`FK_order_claim_line_claim\` FOREIGN KEY (\`claimId\`) REFERENCES \`order_claim\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_claim_line\` ADD CONSTRAINT \`FK_order_claim_line_order_line\` FOREIGN KEY (\`orderLineId\`) REFERENCES \`order_line\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_claim_line\` ADD CONSTRAINT \`FK_order_claim_line_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_exchange\` ADD CONSTRAINT \`FK_order_exchange_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_exchange\` ADD CONSTRAINT \`FK_order_exchange_return\` FOREIGN KEY (\`returnId\`) REFERENCES \`order_return\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_exchange_line\` ADD CONSTRAINT \`FK_order_exchange_line_exchange\` FOREIGN KEY (\`exchangeId\`) REFERENCES \`order_exchange\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_exchange_line\` ADD CONSTRAINT \`FK_order_exchange_line_order_line\` FOREIGN KEY (\`orderLineId\`) REFERENCES \`order_line\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`order_exchange_line\` ADD CONSTRAINT \`FK_order_exchange_line_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`order_exchange_line\` DROP FOREIGN KEY \`FK_order_exchange_line_variant\``
		);
		await queryRunner.query(
			`ALTER TABLE \`order_exchange_line\` DROP FOREIGN KEY \`FK_order_exchange_line_order_line\``
		);
		await queryRunner.query(
			`ALTER TABLE \`order_exchange_line\` DROP FOREIGN KEY \`FK_order_exchange_line_exchange\``
		);
		await queryRunner.query(`ALTER TABLE \`order_exchange\` DROP FOREIGN KEY \`FK_order_exchange_return\``);
		await queryRunner.query(`ALTER TABLE \`order_exchange\` DROP FOREIGN KEY \`FK_order_exchange_order\``);
		await queryRunner.query(`ALTER TABLE \`order_claim_line\` DROP FOREIGN KEY \`FK_order_claim_line_variant\``);
		await queryRunner.query(
			`ALTER TABLE \`order_claim_line\` DROP FOREIGN KEY \`FK_order_claim_line_order_line\``
		);
		await queryRunner.query(`ALTER TABLE \`order_claim_line\` DROP FOREIGN KEY \`FK_order_claim_line_claim\``);
		await queryRunner.query(`ALTER TABLE \`order_claim\` DROP FOREIGN KEY \`FK_order_claim_return\``);
		await queryRunner.query(`ALTER TABLE \`order_claim\` DROP FOREIGN KEY \`FK_order_claim_order\``);
		await queryRunner.query(`ALTER TABLE \`order_return_line\` DROP FOREIGN KEY \`FK_order_return_line_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`order_return_line\` DROP FOREIGN KEY \`FK_order_return_line_reason\``);
		await queryRunner.query(
			`ALTER TABLE \`order_return_line\` DROP FOREIGN KEY \`FK_order_return_line_order_line\``
		);
		await queryRunner.query(`ALTER TABLE \`order_return_line\` DROP FOREIGN KEY \`FK_order_return_line_return\``);
		await queryRunner.query(
			`ALTER TABLE \`order_return\` DROP FOREIGN KEY \`FK_order_return_shipping_option\``
		);
		await queryRunner.query(`ALTER TABLE \`order_return\` DROP FOREIGN KEY \`FK_order_return_exchange\``);
		await queryRunner.query(`ALTER TABLE \`order_return\` DROP FOREIGN KEY \`FK_order_return_claim\``);
		await queryRunner.query(`ALTER TABLE \`order_return\` DROP FOREIGN KEY \`FK_order_return_reason\``);
		await queryRunner.query(`ALTER TABLE \`order_return\` DROP FOREIGN KEY \`FK_order_return_warehouse\``);
		await queryRunner.query(`ALTER TABLE \`order_return\` DROP FOREIGN KEY \`FK_order_return_order\``);
		await queryRunner.query(
			`ALTER TABLE \`order_return_reason\` DROP FOREIGN KEY \`FK_order_return_reason_parent\``
		);

		await queryRunner.query(`DROP TABLE \`order_exchange_line\``);
		await queryRunner.query(`DROP TABLE \`order_exchange\``);
		await queryRunner.query(`DROP TABLE \`order_claim_line\``);
		await queryRunner.query(`DROP TABLE \`order_claim\``);
		await queryRunner.query(`DROP TABLE \`order_return_line\``);
		await queryRunner.query(`DROP TABLE \`order_return\``);
		await queryRunner.query(`DROP TABLE \`order_return_reason\``);
	}
}
