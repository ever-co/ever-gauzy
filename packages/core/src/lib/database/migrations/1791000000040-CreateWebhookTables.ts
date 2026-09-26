import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the outbound webhook subscription and its delivery records.
 *
 * Both tables are core: any domain that writes to the outbox may be subscribed to, so no single
 * domain owns the webhook machinery. The signature of the pair is `(organizationId, url)` on the
 * subscription — a duplicate endpoint would double-deliver every event — and `(subscriptionId,
 * eventId)` on the delivery, which is what makes the dispatcher idempotent.
 */
export class CreateWebhookTables1791000000040 implements MigrationInterface {
	name = 'CreateWebhookTables1791000000040';

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
			`CREATE TABLE "webhook_subscription" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "url" character varying(1024) NOT NULL, "secret" character varying(255) NOT NULL, "events" jsonb NOT NULL DEFAULT '[]', "channelId" uuid, "description" text, "headers" jsonb, "apiVersion" character varying(16), "failureCount" integer NOT NULL DEFAULT 0, "lastSuccessAt" TIMESTAMP, "lastFailureAt" TIMESTAMP, "disabledAt" TIMESTAMP, "metadata" jsonb, CONSTRAINT "PK_webhook_subscription_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_created_by_user" ON "webhook_subscription" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_updated_by_user" ON "webhook_subscription" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_deleted_by_user" ON "webhook_subscription" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_subscription_is_active" ON "webhook_subscription" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_is_archived" ON "webhook_subscription" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_subscription_tenant" ON "webhook_subscription" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_organization" ON "webhook_subscription" ("organizationId")`
		);
		// The dispatcher reads exactly this tuple to find who should receive an event.
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_active" ON "webhook_subscription" ("organizationId", "isActive") WHERE "isActive" = true AND "deletedAt" IS NULL`
		);
		// One subscription per endpoint per organization.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_webhook_subscription_url" ON "webhook_subscription" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "url") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_channel" ON "webhook_subscription" ("channelId") WHERE "channelId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "webhook_delivery" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "subscriptionId" uuid NOT NULL, "eventId" uuid NOT NULL, "eventName" character varying(160) NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', "status" character varying NOT NULL DEFAULT 'PENDING', "attemptCount" integer NOT NULL DEFAULT 0, "responseStatus" integer, "responseBody" text, "durationMs" integer, "nextAttemptAt" TIMESTAMP, "deliveredAt" TIMESTAMP, "lastError" text, CONSTRAINT "PK_webhook_delivery_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_delivery_created_by_user" ON "webhook_delivery" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_delivery_updated_by_user" ON "webhook_delivery" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_delivery_deleted_by_user" ON "webhook_delivery" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_is_active" ON "webhook_delivery" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_is_archived" ON "webhook_delivery" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_tenant" ON "webhook_delivery" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_organization" ON "webhook_delivery" ("organizationId")`);
		// The retry scan; the delivery worker reads due rows through this index.
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_delivery_retry" ON "webhook_delivery" ("subscriptionId", "status", "nextAttemptAt") WHERE "status" IN ('PENDING','FAILED')`
		);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_event" ON "webhook_delivery" ("eventId")`);
		// The dispatcher's idempotency: a re-run cannot create a second delivery for one event.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_webhook_delivery" ON "webhook_delivery" ("subscriptionId", "eventId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_delivery_org_created" ON "webhook_delivery" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "webhook_delivery" ADD CONSTRAINT "FK_webhook_delivery_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "webhook_subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "webhook_delivery" DROP CONSTRAINT "FK_webhook_delivery_subscription"`);
		await queryRunner.query(`DROP TABLE "webhook_delivery"`);
		await queryRunner.query(`DROP TABLE "webhook_subscription"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "webhook_subscription" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "url" varchar(1024) NOT NULL, "secret" varchar(255) NOT NULL, "events" text NOT NULL DEFAULT ('[]'), "channelId" varchar, "description" text, "headers" text, "apiVersion" varchar(16), "failureCount" integer NOT NULL DEFAULT (0), "lastSuccessAt" datetime, "lastFailureAt" datetime, "disabledAt" datetime, "metadata" text)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_created_by_user" ON "webhook_subscription" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_updated_by_user" ON "webhook_subscription" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_deleted_by_user" ON "webhook_subscription" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_subscription_is_active" ON "webhook_subscription" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_is_archived" ON "webhook_subscription" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_subscription_tenant" ON "webhook_subscription" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_organization" ON "webhook_subscription" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_active" ON "webhook_subscription" ("organizationId", "isActive") WHERE "isActive" = 1 AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_webhook_subscription_url" ON "webhook_subscription" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "url") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_subscription_channel" ON "webhook_subscription" ("channelId") WHERE "channelId" IS NOT NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "webhook_delivery" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "subscriptionId" varchar NOT NULL, "eventId" varchar NOT NULL, "eventName" varchar(160) NOT NULL, "payload" text NOT NULL DEFAULT ('{}'), "status" varchar NOT NULL DEFAULT ('PENDING'), "attemptCount" integer NOT NULL DEFAULT (0), "responseStatus" integer, "responseBody" text, "durationMs" integer, "nextAttemptAt" datetime, "deliveredAt" datetime, "lastError" text, CONSTRAINT "FK_webhook_delivery_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "webhook_subscription" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_delivery_created_by_user" ON "webhook_delivery" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_delivery_updated_by_user" ON "webhook_delivery" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_delivery_deleted_by_user" ON "webhook_delivery" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_is_active" ON "webhook_delivery" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_is_archived" ON "webhook_delivery" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_tenant" ON "webhook_delivery" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_organization" ON "webhook_delivery" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_delivery_retry" ON "webhook_delivery" ("subscriptionId", "status", "nextAttemptAt") WHERE "status" IN ('PENDING','FAILED')`
		);
		await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_event" ON "webhook_delivery" ("eventId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_webhook_delivery" ON "webhook_delivery" ("subscriptionId", "eventId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_webhook_delivery_org_created" ON "webhook_delivery" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_webhook_delivery_org_created"`);
		await queryRunner.query(`DROP INDEX "UQ_webhook_delivery"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_delivery_event"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_delivery_retry"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_delivery_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_delivery_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_delivery_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_delivery_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_delivery_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_delivery_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_delivery_created_by_user"`);
		await queryRunner.query(`DROP TABLE "webhook_delivery"`);

		await queryRunner.query(`DROP INDEX "IDX_webhook_subscription_channel"`);
		await queryRunner.query(`DROP INDEX "UQ_webhook_subscription_url"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_subscription_active"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_subscription_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_subscription_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_subscription_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_subscription_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_subscription_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_subscription_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_webhook_subscription_created_by_user"`);
		await queryRunner.query(`DROP TABLE "webhook_subscription"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no partial index, so both rules are carried by the stored generated key columns
	 * `CreateSequenceTable1791000000000` documents for the whole set: `deletedKey` for `"deletedAt" IS
	 * NULL`, and `organizationKey` for the subscription's nullable scope column, without which a
	 * subscription that belongs to no organization was held to no endpoint rule at all.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`webhook_subscription\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`url\` varchar(1024) NOT NULL, \`secret\` varchar(255) NOT NULL, \`events\` json NOT NULL, \`channelId\` varchar(36) NULL, \`description\` text NULL, \`headers\` json NULL, \`apiVersion\` varchar(16) NULL, \`failureCount\` int NOT NULL DEFAULT 0, \`lastSuccessAt\` datetime NULL, \`lastFailureAt\` datetime NULL, \`disabledAt\` datetime NULL, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_webhook_subscription_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_webhook_subscription_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_webhook_subscription_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_webhook_subscription_is_active\` (\`isActive\`), INDEX \`IDX_webhook_subscription_is_archived\` (\`isArchived\`), INDEX \`IDX_webhook_subscription_tenant\` (\`tenantId\`), INDEX \`IDX_webhook_subscription_organization\` (\`organizationId\`), INDEX \`IDX_webhook_subscription_active\` (\`organizationId\`, \`isActive\`), INDEX \`IDX_webhook_subscription_channel\` (\`channelId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// A 1024-character column cannot be indexed in full under InnoDB's key limit, so the endpoint
		// uniqueness is expressed over a prefix; two endpoints differing only past that prefix are
		// caught by the service check instead.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_webhook_subscription_url\` ON \`webhook_subscription\` (\`organizationKey\`, \`url\`(255), \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`webhook_delivery\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`subscriptionId\` varchar(36) NOT NULL, \`eventId\` varchar(36) NOT NULL, \`eventName\` varchar(160) NOT NULL, \`payload\` json NOT NULL, \`status\` varchar(255) NOT NULL DEFAULT 'PENDING', \`attemptCount\` int NOT NULL DEFAULT 0, \`responseStatus\` int NULL, \`responseBody\` text NULL, \`durationMs\` int NULL, \`nextAttemptAt\` datetime NULL, \`deliveredAt\` datetime NULL, \`lastError\` text NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_webhook_delivery_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_webhook_delivery_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_webhook_delivery_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_webhook_delivery_is_active\` (\`isActive\`), INDEX \`IDX_webhook_delivery_is_archived\` (\`isArchived\`), INDEX \`IDX_webhook_delivery_tenant\` (\`tenantId\`), INDEX \`IDX_webhook_delivery_organization\` (\`organizationId\`), INDEX \`IDX_webhook_delivery_retry\` (\`subscriptionId\`, \`status\`, \`nextAttemptAt\`), INDEX \`IDX_webhook_delivery_event\` (\`eventId\`), INDEX \`IDX_webhook_delivery_org_created\` (\`organizationId\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_webhook_delivery\` ON \`webhook_delivery\` (\`subscriptionId\`, \`eventId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`webhook_delivery\` ADD CONSTRAINT \`FK_webhook_delivery_subscription\` FOREIGN KEY (\`subscriptionId\`) REFERENCES \`webhook_subscription\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`webhook_delivery\` DROP FOREIGN KEY \`FK_webhook_delivery_subscription\``
		);
		await queryRunner.query(`DROP TABLE \`webhook_delivery\``);
		await queryRunner.query(`DROP TABLE \`webhook_subscription\``);
	}
}
