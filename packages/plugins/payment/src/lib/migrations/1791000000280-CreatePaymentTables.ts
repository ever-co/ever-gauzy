import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the seven tables of the payment domain.
 *
 * The core `payment` row is **not** created here and never is: a payment is a payment whichever
 * document it settles, so this set adds the provider lifecycle *around* that row rather than a second
 * payment table beside it. What is created here is the registry of providers, the collection that
 * groups the attempts for one order or cart, the attempts themselves, the append-only captures, the
 * refunds with their governed reasons, and the log of the callbacks the providers send back.
 *
 * The signature of each table is what makes the domain's rules enforceable in the database rather than
 * only in a service. An amount is `numeric(20,6)` and never a floating point column, so a total read
 * back is the total that was written. A session's expiry index is partial on exactly the three open
 * statuses, because that is the scan the sweep runs. `(collectionId, providerId)` is unique among the
 * live statuses, which is what makes "one active attempt per pair, history retained" a fact about the
 * table rather than a hope about the service. `(providerId, eventId)` on the callback log is the entire
 * replay guard: a provider that retries a callback it never got an answer for collides with the row it
 * already wrote and is acknowledged with no side effect.
 *
 * Two columns carry an identifier into a table this package does not own and deliberately carry no
 * constraint. `refund.returnId` and `refund.claimId` point at the returns capability, whose set runs
 * **after** this one; a constraint may only be added by the set that creates its target, so the
 * columns are created bare and the returns set constrains them if it wants them. `payment_session.
 * paymentMethodTokenId` is the same shape for a different reason: its target is a kernel table, and
 * that table is not part of this package's set.
 *
 * `deletedAt` is part of every uniqueness predicate, so a soft-deleted row never collides with the
 * live row that replaced it — a provider that was replaced and a reason that was retired both stay on
 * record without blocking the row that took their place.
 *
 * All three dialects are written by hand, and the down migration reverses every statement in the
 * opposite order — a partially reverted schema is worse than an unreverted one.
 */
export class CreatePaymentTables1791000000280 implements MigrationInterface {
	name = 'CreatePaymentTables1791000000280';

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
		// The reason tree first: a refund cites it, and a reason cites its own parent.
		await queryRunner.query(
			`CREATE TABLE "refund_reason" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "code" character varying(64) NOT NULL, "label" character varying(255) NOT NULL, "description" text, "parentId" uuid, CONSTRAINT "PK_refund_reason_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_reason_created_by_user" ON "refund_reason" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_reason_updated_by_user" ON "refund_reason" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_reason_deleted_by_user" ON "refund_reason" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_refund_reason_is_active" ON "refund_reason" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_reason_is_archived" ON "refund_reason" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_reason_tenant" ON "refund_reason" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_reason_organization" ON "refund_reason" ("organizationId")`);
		// A reason code is the tenant's own reporting key: it has to mean one thing inside one
		// organization, and a retired reason must not block the code that replaced it.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_refund_reason_org_code" ON "refund_reason" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_reason_parent" ON "refund_reason" ("parentId") WHERE "parentId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "payment_provider" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "code" character varying(64) NOT NULL, "name" character varying(255) NOT NULL, "isEnabled" boolean NOT NULL DEFAULT true, "isTestMode" boolean NOT NULL DEFAULT false, "integrationId" uuid, "supportedCurrencies" jsonb, "supportedCountries" jsonb, "supportedPaymentMethods" jsonb, "sortOrder" integer NOT NULL DEFAULT 0, "configuration" jsonb, "metadata" jsonb, CONSTRAINT "PK_payment_provider_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_created_by_user" ON "payment_provider" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_updated_by_user" ON "payment_provider" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_deleted_by_user" ON "payment_provider" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_provider_is_active" ON "payment_provider" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_provider_is_archived" ON "payment_provider" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_provider_tenant" ON "payment_provider" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_organization" ON "payment_provider" ("organizationId")`
		);
		// The strategy key the adapter is resolved from: one registration per organization.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_payment_provider_org_code" ON "payment_provider" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "code") WHERE "deletedAt" IS NULL`
		);
		// Exactly the scan the payment step runs: the enabled providers of an organization, in the
		// order they are offered.
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_enabled" ON "payment_provider" ("organizationId", "isEnabled", "sortOrder") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_integration" ON "payment_provider" ("integrationId") WHERE "integrationId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "payment_collection" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid, "cartId" uuid, "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'NOT_PAID', "authorizedAmount" numeric(20,6) NOT NULL DEFAULT 0, "capturedAmount" numeric(20,6) NOT NULL DEFAULT 0, "refundedAmount" numeric(20,6) NOT NULL DEFAULT 0, "canceledAmount" numeric(20,6) NOT NULL DEFAULT 0, "settlementCurrency" character varying(3), "settlementAmount" numeric(20,6), "fxRate" numeric(20,10), "fxRateId" uuid, "fxCapturedAt" TIMESTAMP, "completedAt" TIMESTAMP, "metadata" jsonb, CONSTRAINT "PK_payment_collection_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_created_by_user" ON "payment_collection" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_updated_by_user" ON "payment_collection" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_deleted_by_user" ON "payment_collection" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_collection_is_active" ON "payment_collection" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_is_archived" ON "payment_collection" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_collection_tenant" ON "payment_collection" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_organization" ON "payment_collection" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_order" ON "payment_collection" ("orderId", "status") WHERE "orderId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_cart" ON "payment_collection" ("cartId", "status") WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_org_status" ON "payment_collection" ("organizationId", "status") WHERE "deletedAt" IS NULL`
		);
		// A cart has at most one live collection: two would be two answers to "what does this owe".
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_payment_collection_cart" ON "payment_collection" ("cartId") WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "payment_session" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "collectionId" uuid NOT NULL, "providerId" uuid NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'PENDING', "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "externalId" character varying(255), "paymentMethodTokenId" uuid, "clientSecret" character varying(255), "data" jsonb, "idempotencyKey" character varying(255), "expiresAt" TIMESTAMP, "authorizedAt" TIMESTAMP, "metadata" jsonb, CONSTRAINT "PK_payment_session_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_created_by_user" ON "payment_session" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_updated_by_user" ON "payment_session" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_deleted_by_user" ON "payment_session" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_session_is_active" ON "payment_session" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_session_is_archived" ON "payment_session" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_session_tenant" ON "payment_session" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_session_organization" ON "payment_session" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_collection" ON "payment_session" ("collectionId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_provider" ON "payment_session" ("providerId", "status") WHERE "deletedAt" IS NULL`
		);
		// The expiry sweep reads exactly the open statuses, so the index carries exactly those rows.
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_expiry" ON "payment_session" ("status", "expiresAt") WHERE "status" IN ('PENDING', 'PENDING_AUTHORIZATION', 'REQUIRES_MORE')`
		);
		// One active attempt per pair, history retained: the closed statuses are excluded from the
		// predicate, so a superseded attempt stays queryable while a second live one is impossible.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_payment_session_active" ON "payment_session" ("collectionId", "providerId") WHERE "status" NOT IN ('CANCELED', 'ERROR', 'EXPIRED') AND "deletedAt" IS NULL`
		);
		// The lookup key for a callback that arrives without our session id.
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_external" ON "payment_session" ("externalId") WHERE "externalId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_token" ON "payment_session" ("paymentMethodTokenId") WHERE "paymentMethodTokenId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "payment_capture" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "paymentId" uuid NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "externalId" character varying(255), "capturedAt" TIMESTAMP NOT NULL DEFAULT now(), "metadata" jsonb, CONSTRAINT "PK_payment_capture_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_capture_created_by_user" ON "payment_capture" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_capture_updated_by_user" ON "payment_capture" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_capture_deleted_by_user" ON "payment_capture" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_capture_is_active" ON "payment_capture" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_capture_is_archived" ON "payment_capture" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_capture_tenant" ON "payment_capture" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_capture_organization" ON "payment_capture" ("organizationId")`);
		// The sum a refund is measured against, in the order it is summed.
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_capture_payment" ON "payment_capture" ("paymentId", "capturedAt") WHERE "deletedAt" IS NULL`
		);
		// A replayed provider callback cannot write a second capture for one movement.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_payment_capture_external" ON "payment_capture" ("externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "refund" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "orderId" uuid NOT NULL, "paymentId" uuid, "returnId" uuid, "claimId" uuid, "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "reasonId" uuid, "reason" character varying(255), "status" character varying(16) NOT NULL DEFAULT 'PENDING', "externalId" character varying(255), "refundedAt" TIMESTAMP, "note" text, "metadata" jsonb, CONSTRAINT "PK_refund_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_refund_created_by_user" ON "refund" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_updated_by_user" ON "refund" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_deleted_by_user" ON "refund" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_is_active" ON "refund" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_is_archived" ON "refund" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_tenant" ON "refund" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_organization" ON "refund" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_order" ON "refund" ("orderId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_payment" ON "refund" ("paymentId", "status") WHERE "paymentId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_return" ON "refund" ("returnId") WHERE "returnId" IS NOT NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_refund_claim" ON "refund" ("claimId") WHERE "claimId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_refund_external" ON "refund" ("externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "payment_webhook_event" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "providerId" uuid NOT NULL, "eventId" character varying(255) NOT NULL, "type" character varying(128) NOT NULL, "payload" jsonb NOT NULL, "signature" character varying(512), "receivedAt" TIMESTAMP NOT NULL DEFAULT now(), "processedAt" TIMESTAMP, "status" character varying(16) NOT NULL DEFAULT 'RECEIVED', "lastError" text, "attemptCount" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_payment_webhook_event_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_created_by_user" ON "payment_webhook_event" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_updated_by_user" ON "payment_webhook_event" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_deleted_by_user" ON "payment_webhook_event" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_is_active" ON "payment_webhook_event" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_is_archived" ON "payment_webhook_event" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_webhook_event_tenant" ON "payment_webhook_event" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_organization" ON "payment_webhook_event" ("organizationId")`
		);
		// The replay guard: a provider's event id is unique inside the registration that signed it.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_payment_webhook_event" ON "payment_webhook_event" ("providerId", "eventId") WHERE "deletedAt" IS NULL`
		);
		// The retry scan reads the two statuses that still have work to do, oldest first.
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_retry" ON "payment_webhook_event" ("status", "receivedAt") WHERE "status" IN ('RECEIVED', 'FAILED')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_type" ON "payment_webhook_event" ("providerId", "type", "receivedAt")`
		);

		/*
		 * Foreign keys. Every table this package owns exists by now, so the constraints among them are
		 * added here; the two into the returns capability and the one into the kernel's instrument
		 * tables are deliberately absent, having no target yet.
		 */
		await queryRunner.query(
			`ALTER TABLE "refund_reason" ADD CONSTRAINT "FK_refund_reason_parent" FOREIGN KEY ("parentId") REFERENCES "refund_reason"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "payment_provider" ADD CONSTRAINT "FK_payment_provider_integration" FOREIGN KEY ("integrationId") REFERENCES "integration"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "payment_collection" ADD CONSTRAINT "FK_payment_collection_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payment_collection" ADD CONSTRAINT "FK_payment_collection_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "payment_session" ADD CONSTRAINT "FK_payment_session_collection" FOREIGN KEY ("collectionId") REFERENCES "payment_collection"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		// A provider with attempts against it is not hard-deletable: the history of what was tried is
		// what makes a failed payment diagnosable.
		await queryRunner.query(
			`ALTER TABLE "payment_session" ADD CONSTRAINT "FK_payment_session_provider" FOREIGN KEY ("providerId") REFERENCES "payment_provider"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "payment_capture" ADD CONSTRAINT "FK_payment_capture_payment" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		// A refund is anchored to its order and must not be orphaned from it.
		await queryRunner.query(
			`ALTER TABLE "refund" ADD CONSTRAINT "FK_refund_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "refund" ADD CONSTRAINT "FK_refund_payment" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "refund" ADD CONSTRAINT "FK_refund_reason" FOREIGN KEY ("reasonId") REFERENCES "refund_reason"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "payment_webhook_event" ADD CONSTRAINT "FK_payment_webhook_event_provider" FOREIGN KEY ("providerId") REFERENCES "payment_provider"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "payment_webhook_event" DROP CONSTRAINT "FK_payment_webhook_event_provider"`
		);
		await queryRunner.query(`ALTER TABLE "refund" DROP CONSTRAINT "FK_refund_reason"`);
		await queryRunner.query(`ALTER TABLE "refund" DROP CONSTRAINT "FK_refund_payment"`);
		await queryRunner.query(`ALTER TABLE "refund" DROP CONSTRAINT "FK_refund_order"`);
		await queryRunner.query(`ALTER TABLE "payment_capture" DROP CONSTRAINT "FK_payment_capture_payment"`);
		await queryRunner.query(`ALTER TABLE "payment_session" DROP CONSTRAINT "FK_payment_session_provider"`);
		await queryRunner.query(`ALTER TABLE "payment_session" DROP CONSTRAINT "FK_payment_session_collection"`);
		await queryRunner.query(`ALTER TABLE "payment_collection" DROP CONSTRAINT "FK_payment_collection_cart"`);
		await queryRunner.query(`ALTER TABLE "payment_collection" DROP CONSTRAINT "FK_payment_collection_order"`);
		await queryRunner.query(`ALTER TABLE "payment_provider" DROP CONSTRAINT "FK_payment_provider_integration"`);
		await queryRunner.query(`ALTER TABLE "refund_reason" DROP CONSTRAINT "FK_refund_reason_parent"`);

		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_type"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_retry"`);
		await queryRunner.query(`DROP INDEX "UQ_payment_webhook_event"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_created_by_user"`);
		await queryRunner.query(`DROP TABLE "payment_webhook_event"`);

		await queryRunner.query(`DROP INDEX "UQ_refund_external"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_claim"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_return"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_payment"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_order"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_created_by_user"`);
		await queryRunner.query(`DROP TABLE "refund"`);

		await queryRunner.query(`DROP INDEX "UQ_payment_capture_external"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_payment"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_created_by_user"`);
		await queryRunner.query(`DROP TABLE "payment_capture"`);

		await queryRunner.query(`DROP INDEX "IDX_payment_session_token"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_external"`);
		await queryRunner.query(`DROP INDEX "UQ_payment_session_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_expiry"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_provider"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_collection"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_created_by_user"`);
		await queryRunner.query(`DROP TABLE "payment_session"`);

		await queryRunner.query(`DROP INDEX "UQ_payment_collection_cart"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_org_status"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_cart"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_order"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_created_by_user"`);
		await queryRunner.query(`DROP TABLE "payment_collection"`);

		await queryRunner.query(`DROP INDEX "IDX_payment_provider_integration"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_enabled"`);
		await queryRunner.query(`DROP INDEX "UQ_payment_provider_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_created_by_user"`);
		await queryRunner.query(`DROP TABLE "payment_provider"`);

		await queryRunner.query(`DROP INDEX "IDX_refund_reason_parent"`);
		await queryRunner.query(`DROP INDEX "UQ_refund_reason_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_created_by_user"`);
		await queryRunner.query(`DROP TABLE "refund_reason"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a constraint to an existing table, so every foreign key is declared inline with
	 * the table that owns it, and the order below is the dependency order: a constraint names a target
	 * that already exists by the time the statement runs.
	 *
	 * The two columns that would point at the returns capability carry no constraint here, in this
	 * dialect as in the others, because the tables they name are created by a set that runs after this
	 * one — SQLite would accept the forward reference at `CREATE TABLE` time and fail on the first write
	 * that used it, which is the worst possible moment to discover an ordering mistake.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "refund_reason" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "code" varchar(64) NOT NULL, "label" varchar(255) NOT NULL, "description" text, "parentId" varchar, CONSTRAINT "FK_refund_reason_parent" FOREIGN KEY ("parentId") REFERENCES "refund_reason" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_reason_created_by_user" ON "refund_reason" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_reason_updated_by_user" ON "refund_reason" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_reason_deleted_by_user" ON "refund_reason" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_refund_reason_is_active" ON "refund_reason" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_reason_is_archived" ON "refund_reason" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_reason_tenant" ON "refund_reason" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_reason_organization" ON "refund_reason" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_refund_reason_org_code" ON "refund_reason" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_reason_parent" ON "refund_reason" ("parentId") WHERE "parentId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "payment_provider" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "code" varchar(64) NOT NULL, "name" varchar(255) NOT NULL, "isEnabled" boolean NOT NULL DEFAULT (1), "isTestMode" boolean NOT NULL DEFAULT (0), "integrationId" varchar, "supportedCurrencies" text, "supportedCountries" text, "supportedPaymentMethods" text, "sortOrder" integer NOT NULL DEFAULT 0, "configuration" text, "metadata" text, CONSTRAINT "FK_payment_provider_integration" FOREIGN KEY ("integrationId") REFERENCES "integration" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_created_by_user" ON "payment_provider" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_updated_by_user" ON "payment_provider" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_deleted_by_user" ON "payment_provider" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_provider_is_active" ON "payment_provider" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_provider_is_archived" ON "payment_provider" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_provider_tenant" ON "payment_provider" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_organization" ON "payment_provider" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_payment_provider_org_code" ON "payment_provider" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_enabled" ON "payment_provider" ("organizationId", "isEnabled", "sortOrder") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_provider_integration" ON "payment_provider" ("integrationId") WHERE "integrationId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "payment_collection" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar, "cartId" varchar, "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "status" varchar(32) NOT NULL DEFAULT ('NOT_PAID'), "authorizedAmount" numeric(20,6) NOT NULL DEFAULT 0, "capturedAmount" numeric(20,6) NOT NULL DEFAULT 0, "refundedAmount" numeric(20,6) NOT NULL DEFAULT 0, "canceledAmount" numeric(20,6) NOT NULL DEFAULT 0, "settlementCurrency" varchar(3), "settlementAmount" numeric(20,6), "fxRate" numeric(20,10), "fxRateId" varchar, "fxCapturedAt" datetime, "completedAt" datetime, "metadata" text, CONSTRAINT "FK_payment_collection_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_payment_collection_cart" FOREIGN KEY ("cartId") REFERENCES "commerce_cart" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_created_by_user" ON "payment_collection" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_updated_by_user" ON "payment_collection" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_deleted_by_user" ON "payment_collection" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_collection_is_active" ON "payment_collection" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_is_archived" ON "payment_collection" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_collection_tenant" ON "payment_collection" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_organization" ON "payment_collection" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_order" ON "payment_collection" ("orderId", "status") WHERE "orderId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_cart" ON "payment_collection" ("cartId", "status") WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_collection_org_status" ON "payment_collection" ("organizationId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_payment_collection_cart" ON "payment_collection" ("cartId") WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "payment_session" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "collectionId" varchar NOT NULL, "providerId" varchar NOT NULL, "status" varchar(32) NOT NULL DEFAULT ('PENDING'), "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "externalId" varchar(255), "paymentMethodTokenId" varchar, "clientSecret" varchar(255), "data" text, "idempotencyKey" varchar(255), "expiresAt" datetime, "authorizedAt" datetime, "metadata" text, CONSTRAINT "FK_payment_session_collection" FOREIGN KEY ("collectionId") REFERENCES "payment_collection" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_payment_session_provider" FOREIGN KEY ("providerId") REFERENCES "payment_provider" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_created_by_user" ON "payment_session" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_updated_by_user" ON "payment_session" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_deleted_by_user" ON "payment_session" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_session_is_active" ON "payment_session" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_session_is_archived" ON "payment_session" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_session_tenant" ON "payment_session" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_session_organization" ON "payment_session" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_collection" ON "payment_session" ("collectionId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_provider" ON "payment_session" ("providerId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_expiry" ON "payment_session" ("status", "expiresAt") WHERE "status" IN ('PENDING', 'PENDING_AUTHORIZATION', 'REQUIRES_MORE')`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_payment_session_active" ON "payment_session" ("collectionId", "providerId") WHERE "status" NOT IN ('CANCELED', 'ERROR', 'EXPIRED') AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_external" ON "payment_session" ("externalId") WHERE "externalId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_session_token" ON "payment_session" ("paymentMethodTokenId") WHERE "paymentMethodTokenId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "payment_capture" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "paymentId" varchar NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "externalId" varchar(255), "capturedAt" datetime NOT NULL DEFAULT (datetime('now')), "metadata" text, CONSTRAINT "FK_payment_capture_payment" FOREIGN KEY ("paymentId") REFERENCES "payment" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_capture_created_by_user" ON "payment_capture" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_capture_updated_by_user" ON "payment_capture" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_capture_deleted_by_user" ON "payment_capture" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_capture_is_active" ON "payment_capture" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_capture_is_archived" ON "payment_capture" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_capture_tenant" ON "payment_capture" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_payment_capture_organization" ON "payment_capture" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_capture_payment" ON "payment_capture" ("paymentId", "capturedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_payment_capture_external" ON "payment_capture" ("externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "refund" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "orderId" varchar NOT NULL, "paymentId" varchar, "returnId" varchar, "claimId" varchar, "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "reasonId" varchar, "reason" varchar(255), "status" varchar(16) NOT NULL DEFAULT ('PENDING'), "externalId" varchar(255), "refundedAt" datetime, "note" text, "metadata" text, CONSTRAINT "FK_refund_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_refund_payment" FOREIGN KEY ("paymentId") REFERENCES "payment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_refund_reason" FOREIGN KEY ("reasonId") REFERENCES "refund_reason" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_refund_created_by_user" ON "refund" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_updated_by_user" ON "refund" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_deleted_by_user" ON "refund" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_is_active" ON "refund" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_is_archived" ON "refund" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_tenant" ON "refund" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_organization" ON "refund" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_order" ON "refund" ("orderId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_payment" ON "refund" ("paymentId", "status") WHERE "paymentId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_return" ON "refund" ("returnId") WHERE "returnId" IS NOT NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_refund_claim" ON "refund" ("claimId") WHERE "claimId" IS NOT NULL`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_refund_external" ON "refund" ("externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "payment_webhook_event" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "providerId" varchar NOT NULL, "eventId" varchar(255) NOT NULL, "type" varchar(128) NOT NULL, "payload" text NOT NULL, "signature" varchar(512), "receivedAt" datetime NOT NULL DEFAULT (datetime('now')), "processedAt" datetime, "status" varchar(16) NOT NULL DEFAULT ('RECEIVED'), "lastError" text, "attemptCount" integer NOT NULL DEFAULT 0, CONSTRAINT "FK_payment_webhook_event_provider" FOREIGN KEY ("providerId") REFERENCES "payment_provider" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_created_by_user" ON "payment_webhook_event" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_updated_by_user" ON "payment_webhook_event" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_deleted_by_user" ON "payment_webhook_event" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_is_active" ON "payment_webhook_event" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_is_archived" ON "payment_webhook_event" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payment_webhook_event_tenant" ON "payment_webhook_event" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_organization" ON "payment_webhook_event" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_payment_webhook_event" ON "payment_webhook_event" ("providerId", "eventId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_retry" ON "payment_webhook_event" ("status", "receivedAt") WHERE "status" IN ('RECEIVED', 'FAILED')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payment_webhook_event_type" ON "payment_webhook_event" ("providerId", "type", "receivedAt")`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * SQLite drops a table's indexes and its foreign keys with the table, but the explicit reversal is
	 * kept in the same order as the other dialects so the three downs read alike.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_type"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_retry"`);
		await queryRunner.query(`DROP INDEX "UQ_payment_webhook_event"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_webhook_event_created_by_user"`);
		await queryRunner.query(`DROP TABLE "payment_webhook_event"`);

		await queryRunner.query(`DROP INDEX "UQ_refund_external"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_claim"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_return"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_payment"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_order"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_created_by_user"`);
		await queryRunner.query(`DROP TABLE "refund"`);

		await queryRunner.query(`DROP INDEX "UQ_payment_capture_external"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_payment"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_capture_created_by_user"`);
		await queryRunner.query(`DROP TABLE "payment_capture"`);

		await queryRunner.query(`DROP INDEX "IDX_payment_session_token"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_external"`);
		await queryRunner.query(`DROP INDEX "UQ_payment_session_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_expiry"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_provider"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_collection"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_session_created_by_user"`);
		await queryRunner.query(`DROP TABLE "payment_session"`);

		await queryRunner.query(`DROP INDEX "UQ_payment_collection_cart"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_org_status"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_cart"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_order"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_collection_created_by_user"`);
		await queryRunner.query(`DROP TABLE "payment_collection"`);

		await queryRunner.query(`DROP INDEX "IDX_payment_provider_integration"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_enabled"`);
		await queryRunner.query(`DROP INDEX "UQ_payment_provider_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_payment_provider_created_by_user"`);
		await queryRunner.query(`DROP TABLE "payment_provider"`);

		await queryRunner.query(`DROP INDEX "IDX_refund_reason_parent"`);
		await queryRunner.query(`DROP INDEX "UQ_refund_reason_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_reason_created_by_user"`);
		await queryRunner.query(`DROP TABLE "refund_reason"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no partial index, so the predicates that make a unique index business-scoped are
	 * carried by the stored generated key columns `CreateSequenceTable1791000000000` documents for the
	 * whole set: `deletedKey` for `"deletedAt" IS NULL`, one per table however many rules use it, and
	 * `organizationKey` for the nullable scope column. Including `deletedAt` itself in the key, which
	 * is what this file used to do, expresses nothing at all — a unique index in MySQL exempts every
	 * tuple that contains a null, and `deletedAt` is null on exactly the rows the rule is about.
	 *
	 * `UQ_payment_session_active` needs one of its own. `status NOT IN ('CANCELED', 'ERROR', 'EXPIRED')`
	 * is not a nullability predicate, so MySQL's null rule cannot stand in for it and the generated
	 * `openStatusKey` encodes it directly: a session in one of the three closed statuses takes its own
	 * id and can never collide, which is what excluding it from a partial index does. The session
	 * service still checks the rule inside the writing transaction; the index is now the floor under it
	 * rather than a statement that only reads like one.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`refund_reason\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`code\` varchar(64) NOT NULL, \`label\` varchar(255) NOT NULL, \`description\` text NULL, \`parentId\` varchar(36) NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_refund_reason_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_refund_reason_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_refund_reason_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_refund_reason_is_active\` (\`isActive\`), INDEX \`IDX_refund_reason_is_archived\` (\`isArchived\`), INDEX \`IDX_refund_reason_tenant\` (\`tenantId\`), INDEX \`IDX_refund_reason_organization\` (\`organizationId\`), INDEX \`IDX_refund_reason_parent\` (\`parentId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_refund_reason_org_code\` ON \`refund_reason\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`payment_provider\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`code\` varchar(64) NOT NULL, \`name\` varchar(255) NOT NULL, \`isEnabled\` tinyint NOT NULL DEFAULT 1, \`isTestMode\` tinyint NOT NULL DEFAULT 0, \`integrationId\` varchar(36) NULL, \`supportedCurrencies\` json NULL, \`supportedCountries\` json NULL, \`supportedPaymentMethods\` json NULL, \`sortOrder\` int NOT NULL DEFAULT 0, \`configuration\` json NULL, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_payment_provider_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_payment_provider_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_payment_provider_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_payment_provider_is_active\` (\`isActive\`), INDEX \`IDX_payment_provider_is_archived\` (\`isArchived\`), INDEX \`IDX_payment_provider_tenant\` (\`tenantId\`), INDEX \`IDX_payment_provider_organization\` (\`organizationId\`), INDEX \`IDX_payment_provider_enabled\` (\`organizationId\`, \`isEnabled\`, \`sortOrder\`), INDEX \`IDX_payment_provider_integration\` (\`integrationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_payment_provider_org_code\` ON \`payment_provider\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`payment_collection\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NULL, \`cartId\` varchar(36) NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`status\` varchar(32) NOT NULL DEFAULT 'NOT_PAID', \`authorizedAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`capturedAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`refundedAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`canceledAmount\` decimal(20,6) NOT NULL DEFAULT 0, \`settlementCurrency\` varchar(3) NULL, \`settlementAmount\` decimal(20,6) NULL, \`fxRate\` decimal(20,10) NULL, \`fxRateId\` varchar(36) NULL, \`fxCapturedAt\` datetime NULL, \`completedAt\` datetime NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_payment_collection_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_payment_collection_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_payment_collection_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_payment_collection_is_active\` (\`isActive\`), INDEX \`IDX_payment_collection_is_archived\` (\`isArchived\`), INDEX \`IDX_payment_collection_tenant\` (\`tenantId\`), INDEX \`IDX_payment_collection_organization\` (\`organizationId\`), INDEX \`IDX_payment_collection_order\` (\`orderId\`, \`status\`), INDEX \`IDX_payment_collection_cart\` (\`cartId\`, \`status\`), INDEX \`IDX_payment_collection_org_status\` (\`organizationId\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_payment_collection_cart\` ON \`payment_collection\` (\`cartId\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`payment_session\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`collectionId\` varchar(36) NOT NULL, \`providerId\` varchar(36) NOT NULL, \`status\` varchar(32) NOT NULL DEFAULT 'PENDING', \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`externalId\` varchar(255) NULL, \`paymentMethodTokenId\` varchar(36) NULL, \`clientSecret\` varchar(255) NULL, \`data\` json NULL, \`idempotencyKey\` varchar(255) NULL, \`expiresAt\` datetime NULL, \`authorizedAt\` datetime NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`openStatusKey\` varchar(36) GENERATED ALWAYS AS (IF(\`status\` NOT IN ('CANCELED', 'ERROR', 'EXPIRED'), '0', \`id\`)) STORED, INDEX \`IDX_payment_session_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_payment_session_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_payment_session_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_payment_session_is_active\` (\`isActive\`), INDEX \`IDX_payment_session_is_archived\` (\`isArchived\`), INDEX \`IDX_payment_session_tenant\` (\`tenantId\`), INDEX \`IDX_payment_session_organization\` (\`organizationId\`), INDEX \`IDX_payment_session_collection\` (\`collectionId\`, \`status\`), INDEX \`IDX_payment_session_provider\` (\`providerId\`, \`status\`), INDEX \`IDX_payment_session_expiry\` (\`status\`, \`expiresAt\`), INDEX \`IDX_payment_session_external\` (\`externalId\`), INDEX \`IDX_payment_session_token\` (\`paymentMethodTokenId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// The status predicate of the Postgres index cannot be expressed here; see the note above.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_payment_session_active\` ON \`payment_session\` (\`collectionId\`, \`providerId\`, \`openStatusKey\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`payment_capture\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`paymentId\` varchar(36) NOT NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`externalId\` varchar(255) NULL, \`capturedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_payment_capture_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_payment_capture_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_payment_capture_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_payment_capture_is_active\` (\`isActive\`), INDEX \`IDX_payment_capture_is_archived\` (\`isArchived\`), INDEX \`IDX_payment_capture_tenant\` (\`tenantId\`), INDEX \`IDX_payment_capture_organization\` (\`organizationId\`), INDEX \`IDX_payment_capture_payment\` (\`paymentId\`, \`capturedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_payment_capture_external\` ON \`payment_capture\` (\`externalId\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`refund\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`orderId\` varchar(36) NOT NULL, \`paymentId\` varchar(36) NULL, \`returnId\` varchar(36) NULL, \`claimId\` varchar(36) NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`reasonId\` varchar(36) NULL, \`reason\` varchar(255) NULL, \`status\` varchar(16) NOT NULL DEFAULT 'PENDING', \`externalId\` varchar(255) NULL, \`refundedAt\` datetime NULL, \`note\` text NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_refund_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_refund_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_refund_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_refund_is_active\` (\`isActive\`), INDEX \`IDX_refund_is_archived\` (\`isArchived\`), INDEX \`IDX_refund_tenant\` (\`tenantId\`), INDEX \`IDX_refund_organization\` (\`organizationId\`), INDEX \`IDX_refund_order\` (\`orderId\`, \`status\`), INDEX \`IDX_refund_payment\` (\`paymentId\`, \`status\`), INDEX \`IDX_refund_return\` (\`returnId\`), INDEX \`IDX_refund_claim\` (\`claimId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_refund_external\` ON \`refund\` (\`externalId\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`payment_webhook_event\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`providerId\` varchar(36) NOT NULL, \`eventId\` varchar(255) NOT NULL, \`type\` varchar(128) NOT NULL, \`payload\` json NOT NULL, \`signature\` varchar(512) NULL, \`receivedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`processedAt\` datetime NULL, \`status\` varchar(16) NOT NULL DEFAULT 'RECEIVED', \`lastError\` text NULL, \`attemptCount\` int NOT NULL DEFAULT 0, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_payment_webhook_event_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_payment_webhook_event_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_payment_webhook_event_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_payment_webhook_event_is_active\` (\`isActive\`), INDEX \`IDX_payment_webhook_event_is_archived\` (\`isArchived\`), INDEX \`IDX_payment_webhook_event_tenant\` (\`tenantId\`), INDEX \`IDX_payment_webhook_event_organization\` (\`organizationId\`), INDEX \`IDX_payment_webhook_event_retry\` (\`status\`, \`receivedAt\`), INDEX \`IDX_payment_webhook_event_type\` (\`providerId\`, \`type\`, \`receivedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_payment_webhook_event\` ON \`payment_webhook_event\` (\`providerId\`, \`eventId\`, \`deletedKey\`)`
		);

		/*
		 * Foreign keys. Every table this package owns exists by now, so the constraints among them are
		 * added here; the two into the returns capability and the one into the kernel's instrument
		 * tables are deliberately absent, having no target yet.
		 */
		await queryRunner.query(
			`ALTER TABLE \`refund_reason\` ADD CONSTRAINT \`FK_refund_reason_parent\` FOREIGN KEY (\`parentId\`) REFERENCES \`refund_reason\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment_provider\` ADD CONSTRAINT \`FK_payment_provider_integration\` FOREIGN KEY (\`integrationId\`) REFERENCES \`integration\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment_collection\` ADD CONSTRAINT \`FK_payment_collection_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment_collection\` ADD CONSTRAINT \`FK_payment_collection_cart\` FOREIGN KEY (\`cartId\`) REFERENCES \`commerce_cart\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment_session\` ADD CONSTRAINT \`FK_payment_session_collection\` FOREIGN KEY (\`collectionId\`) REFERENCES \`payment_collection\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment_session\` ADD CONSTRAINT \`FK_payment_session_provider\` FOREIGN KEY (\`providerId\`) REFERENCES \`payment_provider\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment_capture\` ADD CONSTRAINT \`FK_payment_capture_payment\` FOREIGN KEY (\`paymentId\`) REFERENCES \`payment\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`refund\` ADD CONSTRAINT \`FK_refund_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`refund\` ADD CONSTRAINT \`FK_refund_payment\` FOREIGN KEY (\`paymentId\`) REFERENCES \`payment\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`refund\` ADD CONSTRAINT \`FK_refund_reason\` FOREIGN KEY (\`reasonId\`) REFERENCES \`refund_reason\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment_webhook_event\` ADD CONSTRAINT \`FK_payment_webhook_event_provider\` FOREIGN KEY (\`providerId\`) REFERENCES \`payment_provider\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`payment_webhook_event\` DROP FOREIGN KEY \`FK_payment_webhook_event_provider\``
		);
		await queryRunner.query(`ALTER TABLE \`refund\` DROP FOREIGN KEY \`FK_refund_reason\``);
		await queryRunner.query(`ALTER TABLE \`refund\` DROP FOREIGN KEY \`FK_refund_payment\``);
		await queryRunner.query(`ALTER TABLE \`refund\` DROP FOREIGN KEY \`FK_refund_order\``);
		await queryRunner.query(`ALTER TABLE \`payment_capture\` DROP FOREIGN KEY \`FK_payment_capture_payment\``);
		await queryRunner.query(`ALTER TABLE \`payment_session\` DROP FOREIGN KEY \`FK_payment_session_provider\``);
		await queryRunner.query(`ALTER TABLE \`payment_session\` DROP FOREIGN KEY \`FK_payment_session_collection\``);
		await queryRunner.query(`ALTER TABLE \`payment_collection\` DROP FOREIGN KEY \`FK_payment_collection_cart\``);
		await queryRunner.query(`ALTER TABLE \`payment_collection\` DROP FOREIGN KEY \`FK_payment_collection_order\``);
		await queryRunner.query(`ALTER TABLE \`payment_provider\` DROP FOREIGN KEY \`FK_payment_provider_integration\``);
		await queryRunner.query(`ALTER TABLE \`refund_reason\` DROP FOREIGN KEY \`FK_refund_reason_parent\``);

		await queryRunner.query(`DROP INDEX \`UQ_payment_webhook_event\` ON \`payment_webhook_event\``);
		await queryRunner.query(`DROP TABLE \`payment_webhook_event\``);

		await queryRunner.query(`DROP INDEX \`UQ_refund_external\` ON \`refund\``);
		await queryRunner.query(`DROP TABLE \`refund\``);

		await queryRunner.query(`DROP INDEX \`UQ_payment_capture_external\` ON \`payment_capture\``);
		await queryRunner.query(`DROP TABLE \`payment_capture\``);

		await queryRunner.query(`DROP INDEX \`UQ_payment_session_active\` ON \`payment_session\``);
		await queryRunner.query(`DROP TABLE \`payment_session\``);

		await queryRunner.query(`DROP INDEX \`UQ_payment_collection_cart\` ON \`payment_collection\``);
		await queryRunner.query(`DROP TABLE \`payment_collection\``);

		await queryRunner.query(`DROP INDEX \`UQ_payment_provider_org_code\` ON \`payment_provider\``);
		await queryRunner.query(`DROP TABLE \`payment_provider\``);

		await queryRunner.query(`DROP INDEX \`UQ_refund_reason_org_code\` ON \`refund_reason\``);
		await queryRunner.query(`DROP TABLE \`refund_reason\``);
	}
}
