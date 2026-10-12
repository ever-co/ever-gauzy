import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates `document_inbound_address` — the per-organization inbound email capture address.
 *
 * Replaces the previous `tenant_setting`-encoded capture token, which had no `organizationId`
 * column (the id was parsed out of the setting *name*), no index, and no uniqueness guarantee.
 *
 * 🛑 `IDX_document_inbound_address_address` is UNIQUE deliberately. An inbound message is routed
 * solely by its recipient address; two rows sharing one address would make the destination tenant
 * depend on row order, i.e. a cross-tenant delivery. This is a security control, not a hint.
 *
 * Pure DDL — no `INSERT ... SELECT`, no bind parameters, nothing to mis-infer. (The Documents seed
 * migration once reused a single bind parameter across two clauses and PostgreSQL could not infer
 * its type, which took stage down; this migration deliberately has no parameters at all.)
 */
export class CreateDocumentInboundAddress1790000006000 implements MigrationInterface {
	name = 'CreateDocumentInboundAddress1790000006000';

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
			`CREATE TABLE "document_inbound_address" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "kind" character varying(16) NOT NULL DEFAULT 'PLATFORM', "token" character varying(128), "domain" character varying(255), "localPart" character varying(64), "address" character varying(320) NOT NULL, "domainStatus" character varying(16) NOT NULL DEFAULT 'PENDING', "domainVerificationToken" character varying(128), "domainVerifiedAt" TIMESTAMP, "domainLastCheckedAt" TIMESTAMP, "webhookSecretHash" character varying(64), "senderAllowlistRaw" text, "importBodyAsNote" boolean NOT NULL DEFAULT false, "lastMessageAt" TIMESTAMP, "messageCount" integer NOT NULL DEFAULT 0, CONSTRAINT "CHK_document_inbound_address_kind_shape" CHECK ((("kind" = 'PLATFORM' AND "token" IS NOT NULL AND "domain" IS NULL AND "localPart" IS NULL) OR ("kind" = 'CUSTOM_DOMAIN' AND "token" IS NULL AND "domain" IS NOT NULL AND "localPart" IS NOT NULL))), CONSTRAINT "PK_document_inbound_address_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_createdByUserId" ON "document_inbound_address" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_updatedByUserId" ON "document_inbound_address" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_deletedByUserId" ON "document_inbound_address" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_isActive" ON "document_inbound_address" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_isArchived" ON "document_inbound_address" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_tenantId" ON "document_inbound_address" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_organizationId" ON "document_inbound_address" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_document_inbound_address_token" ON "document_inbound_address" ("token") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_document_inbound_address_tenant_org" ON "document_inbound_address" ("tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_document_inbound_address_address" ON "document_inbound_address" ("address") `
		);
		await queryRunner.query(
			`ALTER TABLE "document_inbound_address" ADD CONSTRAINT "FK_doc_inbound_addr_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "document_inbound_address" ADD CONSTRAINT "FK_doc_inbound_addr_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "document_inbound_address" ADD CONSTRAINT "FK_doc_inbound_addr_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "document_inbound_address" ADD CONSTRAINT "FK_doc_inbound_addr_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "document_inbound_address" ADD CONSTRAINT "FK_doc_inbound_addr_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "document_inbound_address" DROP CONSTRAINT "FK_doc_inbound_addr_organizationId"`
		);
		await queryRunner.query(`ALTER TABLE "document_inbound_address" DROP CONSTRAINT "FK_doc_inbound_addr_tenantId"`);
		await queryRunner.query(
			`ALTER TABLE "document_inbound_address" DROP CONSTRAINT "FK_doc_inbound_addr_deletedByUserId"`
		);
		await queryRunner.query(
			`ALTER TABLE "document_inbound_address" DROP CONSTRAINT "FK_doc_inbound_addr_updatedByUserId"`
		);
		await queryRunner.query(
			`ALTER TABLE "document_inbound_address" DROP CONSTRAINT "FK_doc_inbound_addr_createdByUserId"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_document_inbound_address_address"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_document_inbound_address_tenant_org"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_document_inbound_address_token"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_doc_inbound_addr_organizationId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_doc_inbound_addr_tenantId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_doc_inbound_addr_isArchived"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_doc_inbound_addr_isActive"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_doc_inbound_addr_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_doc_inbound_addr_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_doc_inbound_addr_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "document_inbound_address"`);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "document_inbound_address" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "kind" varchar(16) NOT NULL DEFAULT ('PLATFORM'), "token" varchar(128), "domain" varchar(255), "localPart" varchar(64), "address" varchar(320) NOT NULL, "domainStatus" varchar(16) NOT NULL DEFAULT ('PENDING'), "domainVerificationToken" varchar(128), "domainVerifiedAt" datetime, "domainLastCheckedAt" datetime, "webhookSecretHash" varchar(64), "senderAllowlistRaw" text, "importBodyAsNote" boolean NOT NULL DEFAULT (0), "lastMessageAt" datetime, "messageCount" integer NOT NULL DEFAULT (0), CONSTRAINT "CHK_document_inbound_address_kind_shape" CHECK ((("kind" = 'PLATFORM' AND "token" IS NOT NULL AND "domain" IS NULL AND "localPart" IS NULL) OR ("kind" = 'CUSTOM_DOMAIN' AND "token" IS NULL AND "domain" IS NOT NULL AND "localPart" IS NOT NULL))), CONSTRAINT "FK_doc_inbound_addr_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_doc_inbound_addr_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_doc_inbound_addr_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_doc_inbound_addr_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_doc_inbound_addr_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_createdByUserId" ON "document_inbound_address" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_updatedByUserId" ON "document_inbound_address" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_deletedByUserId" ON "document_inbound_address" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_isActive" ON "document_inbound_address" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_isArchived" ON "document_inbound_address" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_tenantId" ON "document_inbound_address" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_doc_inbound_addr_organizationId" ON "document_inbound_address" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_document_inbound_address_token" ON "document_inbound_address" ("token") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_document_inbound_address_tenant_org" ON "document_inbound_address" ("tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_document_inbound_address_address" ON "document_inbound_address" ("address") `
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_document_inbound_address_address"`);
		await queryRunner.query(`DROP INDEX "IDX_document_inbound_address_tenant_org"`);
		await queryRunner.query(`DROP INDEX "IDX_document_inbound_address_token"`);
		await queryRunner.query(`DROP INDEX "IDX_doc_inbound_addr_organizationId"`);
		await queryRunner.query(`DROP INDEX "IDX_doc_inbound_addr_tenantId"`);
		await queryRunner.query(`DROP INDEX "IDX_doc_inbound_addr_isArchived"`);
		await queryRunner.query(`DROP INDEX "IDX_doc_inbound_addr_isActive"`);
		await queryRunner.query(`DROP INDEX "IDX_doc_inbound_addr_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_doc_inbound_addr_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_doc_inbound_addr_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "document_inbound_address"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`document_inbound_address\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`kind\` varchar(16) NOT NULL DEFAULT 'PLATFORM', \`token\` varchar(128) NULL, \`domain\` varchar(255) NULL, \`localPart\` varchar(64) NULL, \`address\` varchar(320) NOT NULL, \`domainStatus\` varchar(16) NOT NULL DEFAULT 'PENDING', \`domainVerificationToken\` varchar(128) NULL, \`domainVerifiedAt\` datetime NULL, \`domainLastCheckedAt\` datetime NULL, \`webhookSecretHash\` varchar(64) NULL, \`senderAllowlistRaw\` text NULL, \`importBodyAsNote\` tinyint NOT NULL DEFAULT 0, \`lastMessageAt\` datetime NULL, \`messageCount\` int NOT NULL DEFAULT 0, INDEX \`IDX_doc_inbound_addr_createdByUserId\` (\`createdByUserId\`), INDEX \`IDX_doc_inbound_addr_updatedByUserId\` (\`updatedByUserId\`), INDEX \`IDX_doc_inbound_addr_deletedByUserId\` (\`deletedByUserId\`), INDEX \`IDX_doc_inbound_addr_isActive\` (\`isActive\`), INDEX \`IDX_doc_inbound_addr_isArchived\` (\`isArchived\`), INDEX \`IDX_doc_inbound_addr_tenantId\` (\`tenantId\`), INDEX \`IDX_doc_inbound_addr_organizationId\` (\`organizationId\`), INDEX \`IDX_document_inbound_address_token\` (\`token\`), INDEX \`IDX_document_inbound_address_tenant_org\` (\`tenantId\`, \`organizationId\`), UNIQUE INDEX \`IDX_document_inbound_address_address\` (\`address\`), CONSTRAINT \`CHK_document_inbound_address_kind_shape\` CHECK (((\`kind\` = 'PLATFORM' AND \`token\` IS NOT NULL AND \`domain\` IS NULL AND \`localPart\` IS NULL) OR (\`kind\` = 'CUSTOM_DOMAIN' AND \`token\` IS NULL AND \`domain\` IS NOT NULL AND \`localPart\` IS NOT NULL))), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`document_inbound_address\` ADD CONSTRAINT \`FK_doc_inbound_addr_createdByUserId\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`document_inbound_address\` ADD CONSTRAINT \`FK_doc_inbound_addr_updatedByUserId\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`document_inbound_address\` ADD CONSTRAINT \`FK_doc_inbound_addr_deletedByUserId\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`document_inbound_address\` ADD CONSTRAINT \`FK_doc_inbound_addr_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`document_inbound_address\` ADD CONSTRAINT \`FK_doc_inbound_addr_organizationId\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`document_inbound_address\` DROP FOREIGN KEY \`FK_doc_inbound_addr_organizationId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`document_inbound_address\` DROP FOREIGN KEY \`FK_doc_inbound_addr_tenantId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`document_inbound_address\` DROP FOREIGN KEY \`FK_doc_inbound_addr_deletedByUserId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`document_inbound_address\` DROP FOREIGN KEY \`FK_doc_inbound_addr_updatedByUserId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`document_inbound_address\` DROP FOREIGN KEY \`FK_doc_inbound_addr_createdByUserId\``
		);
		await queryRunner.query(`DROP TABLE \`document_inbound_address\``);
	}
}
