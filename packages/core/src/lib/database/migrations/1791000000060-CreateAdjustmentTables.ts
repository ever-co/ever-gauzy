import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the money-adjustment ledger and the governed reason codes it cites.
 *
 * The two tables are one migration because neither is meaningful alone: every signed monetary
 * modification of a document is a row in `adjustment`, and every manual one of those cites a code from
 * `adjustment_reason`. The code is stored on the adjustment as text rather than as a foreign key, so a
 * historical adjustment survives the retirement of the reason it cites — the reason table is what makes
 * a code legitimate, not what keeps the ledger readable.
 */
export class CreateAdjustmentTables1791000000060 implements MigrationInterface {
	name = 'CreateAdjustmentTables1791000000060';

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
			`CREATE TABLE "adjustment" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "ownerType" character varying(32) NOT NULL DEFAULT 'CART_LINE', "ownerId" uuid NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT false, "type" character varying(32) NOT NULL DEFAULT 'MANUAL', "code" character varying(64), "referenceType" character varying(64), "referenceId" uuid, "description" character varying(255), "providerId" uuid, "reasonCode" character varying(64), "metadata" jsonb, CONSTRAINT "PK_adjustment_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_created_by_user" ON "adjustment" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_updated_by_user" ON "adjustment" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_deleted_by_user" ON "adjustment" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_is_active" ON "adjustment" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_is_archived" ON "adjustment" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_tenant" ON "adjustment" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_organization" ON "adjustment" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_reason_code" ON "adjustment" ("reasonCode")`);
		// The ledger is read three ways: every adjustment of one owner (totals, reversals), by code
		// (which coupons actually paid out), and by type over a period (the finance report).
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_owner" ON "adjustment" ("ownerType", "ownerId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_code" ON "adjustment" ("code") WHERE "code" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_org_type" ON "adjustment" ("organizationId", "type", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE TABLE "adjustment_reason" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "code" character varying(64) NOT NULL, "label" character varying(255) NOT NULL, "description" text, "appliesTo" character varying(32) NOT NULL DEFAULT 'MANUAL', "requiresApproval" boolean NOT NULL DEFAULT false, "isSystem" boolean NOT NULL DEFAULT false, "sortOrder" integer NOT NULL DEFAULT 0, "metadata" jsonb, CONSTRAINT "PK_adjustment_reason_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_created_by_user" ON "adjustment_reason" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_updated_by_user" ON "adjustment_reason" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_deleted_by_user" ON "adjustment_reason" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_reason_is_active" ON "adjustment_reason" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_is_archived" ON "adjustment_reason" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_reason_tenant" ON "adjustment_reason" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_organization" ON "adjustment_reason" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_adjustment_reason_org_code" ON "adjustment_reason" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_org_type" ON "adjustment_reason" ("organizationId", "appliesTo", "isActive") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "adjustment_reason"`);
		await queryRunner.query(`DROP TABLE "adjustment"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "adjustment" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "ownerType" varchar NOT NULL DEFAULT ('CART_LINE'), "ownerId" varchar NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT (0), "type" varchar NOT NULL DEFAULT ('MANUAL'), "code" varchar, "referenceType" varchar, "referenceId" varchar, "description" varchar, "providerId" varchar, "reasonCode" varchar, "metadata" text)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_created_by_user" ON "adjustment" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_updated_by_user" ON "adjustment" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_deleted_by_user" ON "adjustment" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_is_active" ON "adjustment" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_is_archived" ON "adjustment" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_tenant" ON "adjustment" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_organization" ON "adjustment" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_reason_code" ON "adjustment" ("reasonCode")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_owner" ON "adjustment" ("ownerType", "ownerId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_code" ON "adjustment" ("code") WHERE "code" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_org_type" ON "adjustment" ("organizationId", "type", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE TABLE "adjustment_reason" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "code" varchar NOT NULL, "label" varchar NOT NULL, "description" text, "appliesTo" varchar NOT NULL DEFAULT ('MANUAL'), "requiresApproval" boolean NOT NULL DEFAULT (0), "isSystem" boolean NOT NULL DEFAULT (0), "sortOrder" integer NOT NULL DEFAULT (0), "metadata" text)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_created_by_user" ON "adjustment_reason" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_updated_by_user" ON "adjustment_reason" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_deleted_by_user" ON "adjustment_reason" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_reason_is_active" ON "adjustment_reason" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_is_archived" ON "adjustment_reason" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_adjustment_reason_tenant" ON "adjustment_reason" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_organization" ON "adjustment_reason" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_adjustment_reason_org_code" ON "adjustment_reason" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_adjustment_reason_org_type" ON "adjustment_reason" ("organizationId", "appliesTo", "isActive") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_adjustment_reason_org_type"`);
		await queryRunner.query(`DROP INDEX "UQ_adjustment_reason_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_reason_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_reason_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_reason_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_reason_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_reason_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_reason_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_reason_created_by_user"`);
		await queryRunner.query(`DROP TABLE "adjustment_reason"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_org_type"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_code"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_owner"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_reason_code"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_adjustment_created_by_user"`);
		await queryRunner.query(`DROP TABLE "adjustment"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`adjustment\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`ownerType\` varchar(32) NOT NULL DEFAULT 'CART_LINE', \`ownerId\` varchar(36) NOT NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`isTaxInclusive\` tinyint NOT NULL DEFAULT 0, \`type\` varchar(32) NOT NULL DEFAULT 'MANUAL', \`code\` varchar(64) NULL, \`referenceType\` varchar(64) NULL, \`referenceId\` varchar(36) NULL, \`description\` varchar(255) NULL, \`providerId\` varchar(36) NULL, \`reasonCode\` varchar(64) NULL, \`metadata\` json NULL, INDEX \`IDX_adjustment_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_adjustment_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_adjustment_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_adjustment_is_active\` (\`isActive\`), INDEX \`IDX_adjustment_is_archived\` (\`isArchived\`), INDEX \`IDX_adjustment_tenant\` (\`tenantId\`), INDEX \`IDX_adjustment_organization\` (\`organizationId\`), INDEX \`IDX_adjustment_reason_code\` (\`reasonCode\`), INDEX \`IDX_adjustment_owner\` (\`ownerType\`, \`ownerId\`), INDEX \`IDX_adjustment_code\` (\`code\`), INDEX \`IDX_adjustment_org_type\` (\`organizationId\`, \`type\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`adjustment_reason\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`code\` varchar(64) NOT NULL, \`label\` varchar(255) NOT NULL, \`description\` text NULL, \`appliesTo\` varchar(32) NOT NULL DEFAULT 'MANUAL', \`requiresApproval\` tinyint NOT NULL DEFAULT 0, \`isSystem\` tinyint NOT NULL DEFAULT 0, \`sortOrder\` int NOT NULL DEFAULT 0, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_adjustment_reason_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_adjustment_reason_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_adjustment_reason_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_adjustment_reason_is_active\` (\`isActive\`), INDEX \`IDX_adjustment_reason_is_archived\` (\`isArchived\`), INDEX \`IDX_adjustment_reason_tenant\` (\`tenantId\`), INDEX \`IDX_adjustment_reason_organization\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// MySQL has no partial index, so the rule is carried by the two stored generated key columns
		// declared above: `organizationKey` folds the nullable scope column, and `deletedKey` is `'0'`
		// while the row is live and the row's own id once it is deleted. Naming `deletedAt` itself here
		// would enforce nothing, because a null key part exempts the whole tuple on this dialect.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_adjustment_reason_org_code\` ON \`adjustment_reason\` (\`organizationKey\`, \`code\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_adjustment_reason_org_type\` ON \`adjustment_reason\` (\`organizationId\`, \`appliesTo\`, \`isActive\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE \`adjustment_reason\``);
		await queryRunner.query(`DROP TABLE \`adjustment\``);
	}
}
