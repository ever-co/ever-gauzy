import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the entitlement, activation and licence-key tables.
 *
 * Three tables, one package, because they answer one question — what did this purchase grant, and who
 * is using it — and because they share the lifecycle that question is answered through. The signature
 * of each table is what makes the domain's rules enforceable in the database rather than only in a
 * service:
 *
 * - a right carries a number unique inside its organization, so a customer quoting one means exactly
 *   one right;
 * - a licence key is stored as a digest unique inside its organization, so a database dump does not
 *   hand out working credentials and one indexed probe finds a key;
 * - at most one **live** activation exists per `(entitlement, device)`, which is what makes a retried
 *   first run idempotent — the constraint is partial on the live status, because a released or
 *   revoked activation stays as history and a re-activation is deliberately a new row;
 * - `endsAt` is null exactly for a perpetual right, and a check constraint keeps it after `startsAt`,
 *   because a boolean that has to agree with a date is a second source of truth for one fact.
 *
 * The foreign keys into tables this plugin does not own (`order`, `order_line`, `subscription`,
 * `product`, `product_variant`, `organization_contact`, `user`) are created here as well: the tables
 * belong to the order, catalogue and kernel capabilities, but the constraint belongs to the
 * relationship, and an entitlement pointing at an order that does not exist is a defect whichever
 * package wrote it. Their targets are all created by earlier migration sets, which is why the
 * constraint may be declared here.
 *
 * All three dialects are written by hand, and the down migration reverses every statement in the
 * opposite order — a partially reverted schema is worse than an unreverted one.
 */
export class CreateEntitlementTables1791000000360 implements MigrationInterface {
	name = 'CreateEntitlementTables1791000000360';

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
		// The right itself comes first: everything else in this domain points at it.
		await queryRunner.query(
			`CREATE TABLE "entitlement" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "customerId" uuid, "orderId" uuid, "orderLineId" uuid, "subscriptionId" uuid, "productId" uuid, "variantId" uuid, "number" character varying(32) NOT NULL, "kind" character varying(16) NOT NULL DEFAULT 'LICENCE', "quantity" int NOT NULL DEFAULT 1, "startsAt" TIMESTAMP NOT NULL DEFAULT now(), "endsAt" TIMESTAMP, "gracePeriodDays" int NOT NULL DEFAULT 0, "activationLimit" int, "activationCount" int NOT NULL DEFAULT 0, "status" character varying(16) NOT NULL DEFAULT 'PENDING', "revokedAt" TIMESTAMP, "revokedByUserId" uuid, "revokedReason" character varying(255), "suspendedReason" character varying(255), "metadata" jsonb, CONSTRAINT "CHK_entitlement_term_order" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"), CONSTRAINT "PK_entitlement_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_created_by_user" ON "entitlement" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_updated_by_user" ON "entitlement" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_deleted_by_user" ON "entitlement" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_is_active" ON "entitlement" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_is_archived" ON "entitlement" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_tenant" ON "entitlement" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_organization" ON "entitlement" ("organizationId")`);
		// One number per organization: a customer quoting a number means one right.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_entitlement_number" ON "entitlement" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "number") WHERE "deletedAt" IS NULL`
		);
		// The two scans the domain actually runs: a customer's live rights, and the rights of one line.
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_customer_status" ON "entitlement" ("customerId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_order_line" ON "entitlement" ("orderLineId") WHERE "orderLineId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_variant_status" ON "entitlement" ("variantId", "status") WHERE "variantId" IS NOT NULL`
		);
		// The expiry sweep reads exactly this: the rights that are still in force, by when they end.
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_term" ON "entitlement" ("status", "endsAt") WHERE "status" = 'ACTIVE'`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_order" ON "entitlement" ("orderId") WHERE "orderId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_subscription" ON "entitlement" ("subscriptionId") WHERE "subscriptionId" IS NOT NULL`
		);

		// The credential a customer holds, stored so that a dump does not hand out working licences.
		await queryRunner.query(
			`CREATE TABLE "entitlement_key" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entitlementId" uuid NOT NULL, "keyHash" character varying(64) NOT NULL, "keyCiphertext" character varying(512), "keyPrefix" character varying(16), "format" character varying(64) NOT NULL DEFAULT 'UUID', "status" character varying(16) NOT NULL DEFAULT 'ISSUED', "assignedAt" TIMESTAMP, "assignedToEmail" character varying(320), "assignedToCustomerId" uuid, "activationLimit" int, "activationCount" int NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP, "revokedAt" TIMESTAMP, "revokedByUserId" uuid, "metadata" jsonb, CONSTRAINT "PK_entitlement_key_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_created_by_user" ON "entitlement_key" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_updated_by_user" ON "entitlement_key" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_deleted_by_user" ON "entitlement_key" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_key_is_active" ON "entitlement_key" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_key_is_archived" ON "entitlement_key" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_key_tenant" ON "entitlement_key" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_organization" ON "entitlement_key" ("organizationId")`
		);
		// The digest is the lookup column and the key is the identity: one key, one organization.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_entitlement_key_hash" ON "entitlement_key" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "keyHash") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_entitlement" ON "entitlement_key" ("entitlementId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_assigned" ON "entitlement_key" ("assignedToCustomerId", "status") WHERE "assignedToCustomerId" IS NOT NULL`
		);
		// The expiry sweep reads this: issued credentials, by when they lapse.
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_expiry" ON "entitlement_key" ("status", "expiresAt") WHERE "status" IN ('ISSUED', 'ACTIVATED')`
		);

		// One device, instance or named user occupying a slot of a right.
		await queryRunner.query(
			`CREATE TABLE "entitlement_activation" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entitlementId" uuid NOT NULL, "entitlementKeyId" uuid, "deviceId" character varying(255) NOT NULL, "deviceName" character varying(255), "fingerprint" character varying(255), "seatReference" character varying(255), "activatedByCustomerId" uuid, "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "activatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastSeenAt" TIMESTAMP, "deactivatedAt" TIMESTAMP, "revokedAt" TIMESTAMP, "revokedByUserId" uuid, "revocationReason" character varying(255), "ipAddress" character varying(64), "userAgent" character varying(512), "metadata" jsonb, CONSTRAINT "PK_entitlement_activation_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_created_by_user" ON "entitlement_activation" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_updated_by_user" ON "entitlement_activation" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_deleted_by_user" ON "entitlement_activation" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_is_active" ON "entitlement_activation" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_is_archived" ON "entitlement_activation" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_activation_tenant" ON "entitlement_activation" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_organization" ON "entitlement_activation" ("organizationId")`
		);
		// At most one LIVE activation per right and device; the partial predicate is what lets a
		// released or revoked row stay as history while the next activation is a new row.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_entitlement_activation_device" ON "entitlement_activation" ("entitlementId", "deviceId") WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_entitlement" ON "entitlement_activation" ("entitlementId", "status") WHERE "deletedAt" IS NULL`
		);
		// The dormancy release reads this: the live activations, by when they were last seen.
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_dormant" ON "entitlement_activation" ("status", "lastSeenAt") WHERE "status" = 'ACTIVE'`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_key" ON "entitlement_activation" ("entitlementKeyId") WHERE "entitlementKeyId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_customer" ON "entitlement_activation" ("activatedByCustomerId") WHERE "activatedByCustomerId" IS NOT NULL`
		);

		/*
		 * Foreign keys. Every table exists by now, so the pair between a key and the activation that
		 * consumed it can be created in either direction.
		 */
		await queryRunner.query(
			`ALTER TABLE "entitlement" ADD CONSTRAINT "FK_entitlement_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement" ADD CONSTRAINT "FK_entitlement_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement" ADD CONSTRAINT "FK_entitlement_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement" ADD CONSTRAINT "FK_entitlement_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "subscription"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement" ADD CONSTRAINT "FK_entitlement_product" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement" ADD CONSTRAINT "FK_entitlement_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement" ADD CONSTRAINT "FK_entitlement_revoked_by" FOREIGN KEY ("revokedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "entitlement_key" ADD CONSTRAINT "FK_entitlement_key_entitlement" FOREIGN KEY ("entitlementId") REFERENCES "entitlement"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement_key" ADD CONSTRAINT "FK_entitlement_key_assigned_to" FOREIGN KEY ("assignedToCustomerId") REFERENCES "organization_contact"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement_key" ADD CONSTRAINT "FK_entitlement_key_revoked_by" FOREIGN KEY ("revokedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "entitlement_activation" ADD CONSTRAINT "FK_entitlement_activation_entitlement" FOREIGN KEY ("entitlementId") REFERENCES "entitlement"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement_activation" ADD CONSTRAINT "FK_entitlement_activation_key" FOREIGN KEY ("entitlementKeyId") REFERENCES "entitlement_key"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement_activation" ADD CONSTRAINT "FK_entitlement_activation_customer" FOREIGN KEY ("activatedByCustomerId") REFERENCES "organization_contact"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement_activation" ADD CONSTRAINT "FK_entitlement_activation_revoked_by" FOREIGN KEY ("revokedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "entitlement_activation" DROP CONSTRAINT "FK_entitlement_activation_revoked_by"`
		);
		await queryRunner.query(
			`ALTER TABLE "entitlement_activation" DROP CONSTRAINT "FK_entitlement_activation_customer"`
		);
		await queryRunner.query(`ALTER TABLE "entitlement_activation" DROP CONSTRAINT "FK_entitlement_activation_key"`);
		await queryRunner.query(
			`ALTER TABLE "entitlement_activation" DROP CONSTRAINT "FK_entitlement_activation_entitlement"`
		);
		await queryRunner.query(`ALTER TABLE "entitlement_key" DROP CONSTRAINT "FK_entitlement_key_revoked_by"`);
		await queryRunner.query(`ALTER TABLE "entitlement_key" DROP CONSTRAINT "FK_entitlement_key_assigned_to"`);
		await queryRunner.query(`ALTER TABLE "entitlement_key" DROP CONSTRAINT "FK_entitlement_key_entitlement"`);
		await queryRunner.query(`ALTER TABLE "entitlement" DROP CONSTRAINT "FK_entitlement_revoked_by"`);
		await queryRunner.query(`ALTER TABLE "entitlement" DROP CONSTRAINT "FK_entitlement_variant"`);
		await queryRunner.query(`ALTER TABLE "entitlement" DROP CONSTRAINT "FK_entitlement_product"`);
		await queryRunner.query(`ALTER TABLE "entitlement" DROP CONSTRAINT "FK_entitlement_subscription"`);
		await queryRunner.query(`ALTER TABLE "entitlement" DROP CONSTRAINT "FK_entitlement_order_line"`);
		await queryRunner.query(`ALTER TABLE "entitlement" DROP CONSTRAINT "FK_entitlement_order"`);
		await queryRunner.query(`ALTER TABLE "entitlement" DROP CONSTRAINT "FK_entitlement_customer"`);

		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_customer"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_key"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_dormant"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_entitlement"`);
		await queryRunner.query(`DROP INDEX "UQ_entitlement_activation_device"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_created_by_user"`);
		await queryRunner.query(`DROP TABLE "entitlement_activation"`);

		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_expiry"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_assigned"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_entitlement"`);
		await queryRunner.query(`DROP INDEX "UQ_entitlement_key_hash"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_created_by_user"`);
		await queryRunner.query(`DROP TABLE "entitlement_key"`);

		await queryRunner.query(`DROP INDEX "IDX_entitlement_subscription"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_order"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_term"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_variant_status"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_order_line"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_customer_status"`);
		await queryRunner.query(`DROP INDEX "UQ_entitlement_number"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_created_by_user"`);
		await queryRunner.query(`DROP TABLE "entitlement"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a constraint to an existing table, so every foreign key is declared inline
	 * with the table that owns it. Forward references are resolved when the constraint is used rather
	 * than when it is declared, which is what lets the pair between a key and its activation exist at
	 * all. Partial indexes are supported, so the live-device rule is the same index it is on Postgres.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "entitlement" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "customerId" varchar, "orderId" varchar, "orderLineId" varchar, "subscriptionId" varchar, "productId" varchar, "variantId" varchar, "number" varchar(32) NOT NULL, "kind" varchar(16) NOT NULL DEFAULT ('LICENCE'), "quantity" integer NOT NULL DEFAULT (1), "startsAt" datetime NOT NULL DEFAULT (datetime('now')), "endsAt" datetime, "gracePeriodDays" integer NOT NULL DEFAULT (0), "activationLimit" integer, "activationCount" integer NOT NULL DEFAULT (0), "status" varchar(16) NOT NULL DEFAULT ('PENDING'), "revokedAt" datetime, "revokedByUserId" varchar, "revokedReason" varchar(255), "suspendedReason" varchar(255), "metadata" text, CONSTRAINT "CHK_entitlement_term_order" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"), CONSTRAINT "FK_entitlement_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_entitlement_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_entitlement_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_entitlement_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "subscription" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_entitlement_product" FOREIGN KEY ("productId") REFERENCES "product" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_entitlement_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_entitlement_revoked_by" FOREIGN KEY ("revokedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_created_by_user" ON "entitlement" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_updated_by_user" ON "entitlement" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_deleted_by_user" ON "entitlement" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_is_active" ON "entitlement" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_is_archived" ON "entitlement" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_tenant" ON "entitlement" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_organization" ON "entitlement" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_entitlement_number" ON "entitlement" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "number") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_customer_status" ON "entitlement" ("customerId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_order_line" ON "entitlement" ("orderLineId") WHERE "orderLineId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_variant_status" ON "entitlement" ("variantId", "status") WHERE "variantId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_term" ON "entitlement" ("status", "endsAt") WHERE "status" = 'ACTIVE'`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_order" ON "entitlement" ("orderId") WHERE "orderId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_subscription" ON "entitlement" ("subscriptionId") WHERE "subscriptionId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "entitlement_key" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entitlementId" varchar NOT NULL, "keyHash" varchar(64) NOT NULL, "keyCiphertext" varchar(512), "keyPrefix" varchar(16), "format" varchar(64) NOT NULL DEFAULT ('UUID'), "status" varchar(16) NOT NULL DEFAULT ('ISSUED'), "assignedAt" datetime, "assignedToEmail" varchar(320), "assignedToCustomerId" varchar, "activationLimit" integer, "activationCount" integer NOT NULL DEFAULT (0), "expiresAt" datetime, "revokedAt" datetime, "revokedByUserId" varchar, "metadata" text, CONSTRAINT "FK_entitlement_key_entitlement" FOREIGN KEY ("entitlementId") REFERENCES "entitlement" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_entitlement_key_assigned_to" FOREIGN KEY ("assignedToCustomerId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_entitlement_key_revoked_by" FOREIGN KEY ("revokedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_created_by_user" ON "entitlement_key" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_updated_by_user" ON "entitlement_key" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_deleted_by_user" ON "entitlement_key" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_key_is_active" ON "entitlement_key" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_key_is_archived" ON "entitlement_key" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_entitlement_key_tenant" ON "entitlement_key" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_organization" ON "entitlement_key" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_entitlement_key_hash" ON "entitlement_key" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "keyHash") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_entitlement" ON "entitlement_key" ("entitlementId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_assigned" ON "entitlement_key" ("assignedToCustomerId", "status") WHERE "assignedToCustomerId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_key_expiry" ON "entitlement_key" ("status", "expiresAt") WHERE "status" IN ('ISSUED', 'ACTIVATED')`
		);

		await queryRunner.query(
			`CREATE TABLE "entitlement_activation" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entitlementId" varchar NOT NULL, "entitlementKeyId" varchar, "deviceId" varchar(255) NOT NULL, "deviceName" varchar(255), "fingerprint" varchar(255), "seatReference" varchar(255), "activatedByCustomerId" varchar, "status" varchar(16) NOT NULL DEFAULT ('ACTIVE'), "activatedAt" datetime NOT NULL DEFAULT (datetime('now')), "lastSeenAt" datetime, "deactivatedAt" datetime, "revokedAt" datetime, "revokedByUserId" varchar, "revocationReason" varchar(255), "ipAddress" varchar(64), "userAgent" varchar(512), "metadata" text, CONSTRAINT "FK_entitlement_activation_entitlement" FOREIGN KEY ("entitlementId") REFERENCES "entitlement" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_entitlement_activation_key" FOREIGN KEY ("entitlementKeyId") REFERENCES "entitlement_key" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_entitlement_activation_customer" FOREIGN KEY ("activatedByCustomerId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_entitlement_activation_revoked_by" FOREIGN KEY ("revokedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_created_by_user" ON "entitlement_activation" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_updated_by_user" ON "entitlement_activation" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_deleted_by_user" ON "entitlement_activation" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_is_active" ON "entitlement_activation" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_is_archived" ON "entitlement_activation" ("isArchived")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_tenant" ON "entitlement_activation" ("tenantId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_organization" ON "entitlement_activation" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_entitlement_activation_device" ON "entitlement_activation" ("entitlementId", "deviceId") WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_entitlement" ON "entitlement_activation" ("entitlementId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_dormant" ON "entitlement_activation" ("status", "lastSeenAt") WHERE "status" = 'ACTIVE'`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_key" ON "entitlement_activation" ("entitlementKeyId") WHERE "entitlementKeyId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_entitlement_activation_customer" ON "entitlement_activation" ("activatedByCustomerId") WHERE "activatedByCustomerId" IS NOT NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_customer"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_key"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_dormant"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_entitlement"`);
		await queryRunner.query(`DROP INDEX "UQ_entitlement_activation_device"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_activation_created_by_user"`);
		await queryRunner.query(`DROP TABLE "entitlement_activation"`);

		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_expiry"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_assigned"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_entitlement"`);
		await queryRunner.query(`DROP INDEX "UQ_entitlement_key_hash"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_key_created_by_user"`);
		await queryRunner.query(`DROP TABLE "entitlement_key"`);

		await queryRunner.query(`DROP INDEX "IDX_entitlement_subscription"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_order"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_term"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_variant_status"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_order_line"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_customer_status"`);
		await queryRunner.query(`DROP INDEX "UQ_entitlement_number"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_entitlement_created_by_user"`);
		await queryRunner.query(`DROP TABLE "entitlement"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no partial index. Where the predicate only excludes soft-deleted rows, the key carries
	 * the stored generated `deletedKey` that `CreateSequenceTable1791000000000` documents for the whole
	 * set, and the nullable scope column is folded into `organizationKey`; carrying `deletedAt` itself,
	 * which this file used to do, carries no rule at all, because a unique index in MySQL exempts every
	 * tuple that contains a null. Where the predicate is the business rule itself — at most one **live**
	 * activation per right and device — the index stays non-unique and the rule is enforced by the
	 * service inside the transaction that takes the entitlement's row lock, and reported by the
	 * `schema-uniqueness-audit` job.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`entitlement\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`customerId\` varchar(36) NULL, \`orderId\` varchar(36) NULL, \`orderLineId\` varchar(36) NULL, \`subscriptionId\` varchar(36) NULL, \`productId\` varchar(36) NULL, \`variantId\` varchar(36) NULL, \`number\` varchar(32) NOT NULL, \`kind\` varchar(16) NOT NULL DEFAULT 'LICENCE', \`quantity\` int NOT NULL DEFAULT 1, \`startsAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, \`endsAt\` datetime NULL, \`gracePeriodDays\` int NOT NULL DEFAULT 0, \`activationLimit\` int NULL, \`activationCount\` int NOT NULL DEFAULT 0, \`status\` varchar(16) NOT NULL DEFAULT 'PENDING', \`revokedAt\` datetime NULL, \`revokedByUserId\` varchar(36) NULL, \`revokedReason\` varchar(255) NULL, \`suspendedReason\` varchar(255) NULL, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_entitlement_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_entitlement_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_entitlement_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_entitlement_is_active\` (\`isActive\`), INDEX \`IDX_entitlement_is_archived\` (\`isArchived\`), INDEX \`IDX_entitlement_tenant\` (\`tenantId\`), INDEX \`IDX_entitlement_organization\` (\`organizationId\`), INDEX \`IDX_entitlement_customer_status\` (\`customerId\`, \`status\`), INDEX \`IDX_entitlement_order_line\` (\`orderLineId\`), INDEX \`IDX_entitlement_variant_status\` (\`variantId\`, \`status\`), INDEX \`IDX_entitlement_term\` (\`status\`, \`endsAt\`), INDEX \`IDX_entitlement_order\` (\`orderId\`), INDEX \`IDX_entitlement_subscription\` (\`subscriptionId\`), CONSTRAINT \`CHK_entitlement_term_order\` CHECK (\`endsAt\` IS NULL OR \`endsAt\` > \`startsAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_entitlement_number\` ON \`entitlement\` (\`organizationKey\`, \`number\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`entitlement_key\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`entitlementId\` varchar(36) NOT NULL, \`keyHash\` varchar(64) NOT NULL, \`keyCiphertext\` varchar(512) NULL, \`keyPrefix\` varchar(16) NULL, \`format\` varchar(64) NOT NULL DEFAULT 'UUID', \`status\` varchar(16) NOT NULL DEFAULT 'ISSUED', \`assignedAt\` datetime NULL, \`assignedToEmail\` varchar(320) NULL, \`assignedToCustomerId\` varchar(36) NULL, \`activationLimit\` int NULL, \`activationCount\` int NOT NULL DEFAULT 0, \`expiresAt\` datetime NULL, \`revokedAt\` datetime NULL, \`revokedByUserId\` varchar(36) NULL, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_entitlement_key_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_entitlement_key_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_entitlement_key_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_entitlement_key_is_active\` (\`isActive\`), INDEX \`IDX_entitlement_key_is_archived\` (\`isArchived\`), INDEX \`IDX_entitlement_key_tenant\` (\`tenantId\`), INDEX \`IDX_entitlement_key_organization\` (\`organizationId\`), INDEX \`IDX_entitlement_key_entitlement\` (\`entitlementId\`, \`status\`), INDEX \`IDX_entitlement_key_assigned\` (\`assignedToCustomerId\`, \`status\`), INDEX \`IDX_entitlement_key_expiry\` (\`status\`, \`expiresAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_entitlement_key_hash\` ON \`entitlement_key\` (\`organizationKey\`, \`keyHash\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`entitlement_activation\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`entitlementId\` varchar(36) NOT NULL, \`entitlementKeyId\` varchar(36) NULL, \`deviceId\` varchar(255) NOT NULL, \`deviceName\` varchar(255) NULL, \`fingerprint\` varchar(255) NULL, \`seatReference\` varchar(255) NULL, \`activatedByCustomerId\` varchar(36) NULL, \`status\` varchar(16) NOT NULL DEFAULT 'ACTIVE', \`activatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, \`lastSeenAt\` datetime NULL, \`deactivatedAt\` datetime NULL, \`revokedAt\` datetime NULL, \`revokedByUserId\` varchar(36) NULL, \`revocationReason\` varchar(255) NULL, \`ipAddress\` varchar(64) NULL, \`userAgent\` varchar(512) NULL, \`metadata\` json NULL, INDEX \`IDX_entitlement_activation_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_entitlement_activation_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_entitlement_activation_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_entitlement_activation_is_active\` (\`isActive\`), INDEX \`IDX_entitlement_activation_is_archived\` (\`isArchived\`), INDEX \`IDX_entitlement_activation_tenant\` (\`tenantId\`), INDEX \`IDX_entitlement_activation_organization\` (\`organizationId\`), INDEX \`IDX_entitlement_activation_entitlement\` (\`entitlementId\`, \`status\`), INDEX \`IDX_entitlement_activation_dormant\` (\`status\`, \`lastSeenAt\`), INDEX \`IDX_entitlement_activation_key\` (\`entitlementKeyId\`), INDEX \`IDX_entitlement_activation_customer\` (\`activatedByCustomerId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// The live-device rule is not carried by an index on this dialect: the service enforces it under
		// the entitlement's row lock and the schema-uniqueness-audit job reports a violation it finds.
		await queryRunner.query(
			`CREATE INDEX \`IDX_entitlement_activation_device\` ON \`entitlement_activation\` (\`entitlementId\`, \`deviceId\`, \`status\`)`
		);

		/*
		 * Foreign keys. Every table exists by now, so the pair between a key and the activation that
		 * consumed it can be created in either direction.
		 */
		await queryRunner.query(
			`ALTER TABLE \`entitlement\` ADD CONSTRAINT \`FK_entitlement_customer\` FOREIGN KEY (\`customerId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement\` ADD CONSTRAINT \`FK_entitlement_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement\` ADD CONSTRAINT \`FK_entitlement_order_line\` FOREIGN KEY (\`orderLineId\`) REFERENCES \`order_line\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement\` ADD CONSTRAINT \`FK_entitlement_subscription\` FOREIGN KEY (\`subscriptionId\`) REFERENCES \`subscription\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement\` ADD CONSTRAINT \`FK_entitlement_product\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement\` ADD CONSTRAINT \`FK_entitlement_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement\` ADD CONSTRAINT \`FK_entitlement_revoked_by\` FOREIGN KEY (\`revokedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement_key\` ADD CONSTRAINT \`FK_entitlement_key_entitlement\` FOREIGN KEY (\`entitlementId\`) REFERENCES \`entitlement\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement_key\` ADD CONSTRAINT \`FK_entitlement_key_assigned_to\` FOREIGN KEY (\`assignedToCustomerId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement_key\` ADD CONSTRAINT \`FK_entitlement_key_revoked_by\` FOREIGN KEY (\`revokedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement_activation\` ADD CONSTRAINT \`FK_entitlement_activation_entitlement\` FOREIGN KEY (\`entitlementId\`) REFERENCES \`entitlement\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement_activation\` ADD CONSTRAINT \`FK_entitlement_activation_key\` FOREIGN KEY (\`entitlementKeyId\`) REFERENCES \`entitlement_key\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement_activation\` ADD CONSTRAINT \`FK_entitlement_activation_customer\` FOREIGN KEY (\`activatedByCustomerId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement_activation\` ADD CONSTRAINT \`FK_entitlement_activation_revoked_by\` FOREIGN KEY (\`revokedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`entitlement_activation\` DROP FOREIGN KEY \`FK_entitlement_activation_revoked_by\``
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement_activation\` DROP FOREIGN KEY \`FK_entitlement_activation_customer\``
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement_activation\` DROP FOREIGN KEY \`FK_entitlement_activation_key\``
		);
		await queryRunner.query(
			`ALTER TABLE \`entitlement_activation\` DROP FOREIGN KEY \`FK_entitlement_activation_entitlement\``
		);
		await queryRunner.query(`ALTER TABLE \`entitlement_key\` DROP FOREIGN KEY \`FK_entitlement_key_revoked_by\``);
		await queryRunner.query(`ALTER TABLE \`entitlement_key\` DROP FOREIGN KEY \`FK_entitlement_key_assigned_to\``);
		await queryRunner.query(`ALTER TABLE \`entitlement_key\` DROP FOREIGN KEY \`FK_entitlement_key_entitlement\``);
		await queryRunner.query(`ALTER TABLE \`entitlement\` DROP FOREIGN KEY \`FK_entitlement_revoked_by\``);
		await queryRunner.query(`ALTER TABLE \`entitlement\` DROP FOREIGN KEY \`FK_entitlement_variant\``);
		await queryRunner.query(`ALTER TABLE \`entitlement\` DROP FOREIGN KEY \`FK_entitlement_product\``);
		await queryRunner.query(`ALTER TABLE \`entitlement\` DROP FOREIGN KEY \`FK_entitlement_subscription\``);
		await queryRunner.query(`ALTER TABLE \`entitlement\` DROP FOREIGN KEY \`FK_entitlement_order_line\``);
		await queryRunner.query(`ALTER TABLE \`entitlement\` DROP FOREIGN KEY \`FK_entitlement_order\``);
		await queryRunner.query(`ALTER TABLE \`entitlement\` DROP FOREIGN KEY \`FK_entitlement_customer\``);

		await queryRunner.query(`DROP TABLE \`entitlement_activation\``);
		await queryRunner.query(`DROP TABLE \`entitlement_key\``);
		await queryRunner.query(`DROP TABLE \`entitlement\``);
	}
}
