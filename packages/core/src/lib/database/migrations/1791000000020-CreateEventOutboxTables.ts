import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the transactional outbox and the per-consumer delivery record.
 *
 * A state change and its event are written in one transaction, so an event can never be lost by a
 * crash between the commit and the publish. Dispatch is at-least-once, and `event_delivery` is what
 * makes that safe: the unique `(eventId, consumerKey)` pair is the idempotency ledger, so a consumer
 * that tries to process the same event twice fails the insert and skips the work.
 */
export class CreateEventOutboxTables1791000000020 implements MigrationInterface {
	name = 'CreateEventOutboxTables1791000000020';

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
			`CREATE TABLE "event_outbox" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "eventId" uuid NOT NULL, "eventName" character varying(160) NOT NULL, "aggregateType" character varying(64) NOT NULL, "aggregateId" uuid NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', "headers" jsonb, "status" character varying NOT NULL DEFAULT 'PENDING', "attemptCount" integer NOT NULL DEFAULT 0, "availableAt" TIMESTAMP NOT NULL, "publishedAt" TIMESTAMP, "lastError" text, "partitionKey" character varying(128), "sequence" bigint NOT NULL DEFAULT 0, CONSTRAINT "PK_event_outbox_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_created_by_user" ON "event_outbox" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_updated_by_user" ON "event_outbox" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_deleted_by_user" ON "event_outbox" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_is_active" ON "event_outbox" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_is_archived" ON "event_outbox" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_tenant" ON "event_outbox" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_organization" ON "event_outbox" ("organizationId")`);
		// The event id is the identity every downstream record carries, so it is unique rather than
		// merely indexed: a duplicated event id would make the webhook signature ambiguous.
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_event_outbox_event" ON "event_outbox" ("eventId")`);
		// The dispatch scan reads exactly this tuple: what is waiting, and whether it is due yet.
		await queryRunner.query(
			`CREATE INDEX "IDX_event_outbox_dispatch" ON "event_outbox" ("status", "availableAt") WHERE "status" IN ('PENDING','FAILED')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_outbox_aggregate" ON "event_outbox" ("aggregateType", "aggregateId", "createdAt")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_outbox_org_created" ON "event_outbox" ("organizationId", "createdAt")`
		);
		// Per-aggregate ordering: the sequence is allocated inside the writing transaction and this
		// index is what turns two writers racing for one position into a lost insert rather than a
		// reordered partition.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_event_outbox_partition_seq" ON "event_outbox" ("partitionKey", "sequence") WHERE "partitionKey" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "event_delivery" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "eventId" uuid NOT NULL, "consumerKey" character varying(191) NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "attemptCount" integer NOT NULL DEFAULT 0, "deliveredAt" TIMESTAMP, "lastError" text, "partitionKey" character varying(128), "sequence" bigint, CONSTRAINT "PK_event_delivery_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_created_by_user" ON "event_delivery" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_updated_by_user" ON "event_delivery" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_deleted_by_user" ON "event_delivery" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_event_delivery_is_active" ON "event_delivery" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_delivery_is_archived" ON "event_delivery" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_delivery_tenant" ON "event_delivery" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_delivery_organization" ON "event_delivery" ("organizationId")`);
		// One row per (event, consumer): this unique pair is the mechanism that makes a consumer
		// idempotent, not an optimisation.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_event_delivery" ON "event_delivery" ("eventId", "consumerKey")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_retry" ON "event_delivery" ("status", "createdAt") WHERE "status" IN ('PENDING','FAILED')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_consumer" ON "event_delivery" ("consumerKey", "createdAt")`
		);
		// The order gate: a strict consumer reads the highest sequence it delivered for a partition,
		// which this index serves without joining the outbox.
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_order" ON "event_delivery" ("consumerKey", "partitionKey", "sequence") WHERE "partitionKey" IS NOT NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "event_delivery"`);
		await queryRunner.query(`DROP TABLE "event_outbox"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "event_outbox" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "eventId" varchar NOT NULL, "eventName" varchar(160) NOT NULL, "aggregateType" varchar(64) NOT NULL, "aggregateId" varchar NOT NULL, "payload" text NOT NULL DEFAULT ('{}'), "headers" text, "status" varchar NOT NULL DEFAULT ('PENDING'), "attemptCount" integer NOT NULL DEFAULT (0), "availableAt" datetime NOT NULL, "publishedAt" datetime, "lastError" text, "partitionKey" varchar(128), "sequence" integer NOT NULL DEFAULT (0))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_created_by_user" ON "event_outbox" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_updated_by_user" ON "event_outbox" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_deleted_by_user" ON "event_outbox" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_is_active" ON "event_outbox" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_is_archived" ON "event_outbox" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_tenant" ON "event_outbox" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_outbox_organization" ON "event_outbox" ("organizationId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_event_outbox_event" ON "event_outbox" ("eventId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_outbox_dispatch" ON "event_outbox" ("status", "availableAt") WHERE "status" IN ('PENDING','FAILED')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_outbox_aggregate" ON "event_outbox" ("aggregateType", "aggregateId", "createdAt")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_outbox_org_created" ON "event_outbox" ("organizationId", "createdAt")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_event_outbox_partition_seq" ON "event_outbox" ("partitionKey", "sequence") WHERE "partitionKey" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "event_delivery" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "eventId" varchar NOT NULL, "consumerKey" varchar(191) NOT NULL, "status" varchar NOT NULL DEFAULT ('PENDING'), "attemptCount" integer NOT NULL DEFAULT (0), "deliveredAt" datetime, "lastError" text, "partitionKey" varchar(128), "sequence" integer)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_created_by_user" ON "event_delivery" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_updated_by_user" ON "event_delivery" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_deleted_by_user" ON "event_delivery" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_event_delivery_is_active" ON "event_delivery" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_delivery_is_archived" ON "event_delivery" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_delivery_tenant" ON "event_delivery" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_event_delivery_organization" ON "event_delivery" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_event_delivery" ON "event_delivery" ("eventId", "consumerKey")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_retry" ON "event_delivery" ("status", "createdAt") WHERE "status" IN ('PENDING','FAILED')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_consumer" ON "event_delivery" ("consumerKey", "createdAt")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_event_delivery_order" ON "event_delivery" ("consumerKey", "partitionKey", "sequence") WHERE "partitionKey" IS NOT NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_event_delivery_order"`);
		await queryRunner.query(`DROP INDEX "IDX_event_delivery_consumer"`);
		await queryRunner.query(`DROP INDEX "IDX_event_delivery_retry"`);
		await queryRunner.query(`DROP INDEX "UQ_event_delivery"`);
		await queryRunner.query(`DROP INDEX "IDX_event_delivery_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_event_delivery_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_event_delivery_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_event_delivery_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_event_delivery_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_event_delivery_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_event_delivery_created_by_user"`);
		await queryRunner.query(`DROP TABLE "event_delivery"`);

		await queryRunner.query(`DROP INDEX "UQ_event_outbox_partition_seq"`);
		await queryRunner.query(`DROP INDEX "IDX_event_outbox_org_created"`);
		await queryRunner.query(`DROP INDEX "IDX_event_outbox_aggregate"`);
		await queryRunner.query(`DROP INDEX "IDX_event_outbox_dispatch"`);
		await queryRunner.query(`DROP INDEX "UQ_event_outbox_event"`);
		await queryRunner.query(`DROP INDEX "IDX_event_outbox_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_event_outbox_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_event_outbox_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_event_outbox_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_event_outbox_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_event_outbox_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_event_outbox_created_by_user"`);
		await queryRunner.query(`DROP TABLE "event_outbox"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`event_outbox\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`eventId\` varchar(36) NOT NULL, \`eventName\` varchar(160) NOT NULL, \`aggregateType\` varchar(64) NOT NULL, \`aggregateId\` varchar(36) NOT NULL, \`payload\` json NOT NULL, \`headers\` json NULL, \`status\` varchar(255) NOT NULL DEFAULT 'PENDING', \`attemptCount\` int NOT NULL DEFAULT 0, \`availableAt\` datetime NOT NULL, \`publishedAt\` datetime NULL, \`lastError\` text NULL, \`partitionKey\` varchar(128) NULL, \`sequence\` bigint NOT NULL DEFAULT 0, INDEX \`IDX_event_outbox_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_event_outbox_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_event_outbox_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_event_outbox_is_active\` (\`isActive\`), INDEX \`IDX_event_outbox_is_archived\` (\`isArchived\`), INDEX \`IDX_event_outbox_tenant\` (\`tenantId\`), INDEX \`IDX_event_outbox_organization\` (\`organizationId\`), INDEX \`IDX_event_outbox_dispatch\` (\`status\`, \`availableAt\`), INDEX \`IDX_event_outbox_aggregate\` (\`aggregateType\`, \`aggregateId\`, \`createdAt\`), INDEX \`IDX_event_outbox_org_created\` (\`organizationId\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_event_outbox_event\` ON \`event_outbox\` (\`eventId\`)`);
		// MySQL treats nulls as distinct in a unique index, so the "only where a partition exists" rule
		// of the filtered Postgres index holds here without a predicate.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_event_outbox_partition_seq\` ON \`event_outbox\` (\`partitionKey\`, \`sequence\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`event_delivery\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`eventId\` varchar(36) NOT NULL, \`consumerKey\` varchar(191) NOT NULL, \`status\` varchar(255) NOT NULL DEFAULT 'PENDING', \`attemptCount\` int NOT NULL DEFAULT 0, \`deliveredAt\` datetime NULL, \`lastError\` text NULL, \`partitionKey\` varchar(128) NULL, \`sequence\` bigint NULL, INDEX \`IDX_event_delivery_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_event_delivery_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_event_delivery_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_event_delivery_is_active\` (\`isActive\`), INDEX \`IDX_event_delivery_is_archived\` (\`isArchived\`), INDEX \`IDX_event_delivery_tenant\` (\`tenantId\`), INDEX \`IDX_event_delivery_organization\` (\`organizationId\`), INDEX \`IDX_event_delivery_retry\` (\`status\`, \`createdAt\`), INDEX \`IDX_event_delivery_consumer\` (\`consumerKey\`, \`createdAt\`), INDEX \`IDX_event_delivery_order\` (\`consumerKey\`, \`partitionKey\`, \`sequence\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_event_delivery\` ON \`event_delivery\` (\`eventId\`, \`consumerKey\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE \`event_delivery\``);
		await queryRunner.query(`DROP TABLE \`event_outbox\``);
	}
}
