import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the idempotency-key table.
 *
 * The table is the backing store for the `Idempotency-Key` request header, and the row is the lock:
 * the unique tuple `(organizationId, scope, key)` means two concurrent identical requests cannot
 * both insert, so the loser of the race is told the work is in flight instead of repeating it. The
 * table is part of the platform kernel because every retryable mutation — a checkout, a capture, a
 * refund, a fulfilment — needs the same protection.
 */
export class CreateIdempotencyKeyTable1791000000010 implements MigrationInterface {
	name = 'CreateIdempotencyKeyTable1791000000010';

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
			`CREATE TABLE "idempotency_key" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "key" character varying(255) NOT NULL, "scope" character varying(64) NOT NULL, "requestHash" character varying(64) NOT NULL, "status" character varying NOT NULL DEFAULT 'IN_PROGRESS', "responseStatus" integer, "responseBody" jsonb, "resourceType" character varying(64), "resourceId" uuid, "expiresAt" TIMESTAMP NOT NULL, "lockedAt" TIMESTAMP, CONSTRAINT "PK_idempotency_key_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_idempotency_key_created_by_user" ON "idempotency_key" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_idempotency_key_updated_by_user" ON "idempotency_key" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_idempotency_key_deleted_by_user" ON "idempotency_key" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_idempotency_key_is_active" ON "idempotency_key" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_idempotency_key_is_archived" ON "idempotency_key" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_idempotency_key_tenant" ON "idempotency_key" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_idempotency_key_organization" ON "idempotency_key" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_idempotency_expiry" ON "idempotency_key" ("expiresAt")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_idempotency_resource" ON "idempotency_key" ("resourceType", "resourceId")`
		);
		// The claim itself: one row per key scope, and the insert is what serialises two concurrent
		// identical requests. The soft-delete predicate keeps a released key reusable.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_idempotency_org_scope_key" ON "idempotency_key" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "scope", "key") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "idempotency_key"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "idempotency_key" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "key" varchar(255) NOT NULL, "scope" varchar(64) NOT NULL, "requestHash" varchar(64) NOT NULL, "status" varchar NOT NULL DEFAULT ('IN_PROGRESS'), "responseStatus" integer, "responseBody" text, "resourceType" varchar(64), "resourceId" varchar, "expiresAt" datetime NOT NULL, "lockedAt" datetime)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_idempotency_key_created_by_user" ON "idempotency_key" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_idempotency_key_updated_by_user" ON "idempotency_key" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_idempotency_key_deleted_by_user" ON "idempotency_key" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_idempotency_key_is_active" ON "idempotency_key" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_idempotency_key_is_archived" ON "idempotency_key" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_idempotency_key_tenant" ON "idempotency_key" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_idempotency_key_organization" ON "idempotency_key" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_idempotency_expiry" ON "idempotency_key" ("expiresAt")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_idempotency_resource" ON "idempotency_key" ("resourceType", "resourceId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_idempotency_org_scope_key" ON "idempotency_key" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "scope", "key") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "UQ_idempotency_org_scope_key"`);
		await queryRunner.query(`DROP INDEX "IDX_idempotency_resource"`);
		await queryRunner.query(`DROP INDEX "IDX_idempotency_expiry"`);
		await queryRunner.query(`DROP INDEX "IDX_idempotency_key_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_idempotency_key_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_idempotency_key_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_idempotency_key_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_idempotency_key_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_idempotency_key_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_idempotency_key_created_by_user"`);
		await queryRunner.query(`DROP TABLE "idempotency_key"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`idempotency_key\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`key\` varchar(255) NOT NULL, \`scope\` varchar(64) NOT NULL, \`requestHash\` varchar(64) NOT NULL, \`status\` varchar(255) NOT NULL DEFAULT 'IN_PROGRESS', \`responseStatus\` int NULL, \`responseBody\` json NULL, \`resourceType\` varchar(64) NULL, \`resourceId\` varchar(36) NULL, \`expiresAt\` datetime NOT NULL, \`lockedAt\` datetime NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_idempotency_key_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_idempotency_key_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_idempotency_key_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_idempotency_key_is_active\` (\`isActive\`), INDEX \`IDX_idempotency_key_is_archived\` (\`isArchived\`), INDEX \`IDX_idempotency_key_tenant\` (\`tenantId\`), INDEX \`IDX_idempotency_key_organization\` (\`organizationId\`), INDEX \`IDX_idempotency_expiry\` (\`expiresAt\`), INDEX \`IDX_idempotency_resource\` (\`resourceType\`, \`resourceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// The retry lock, through the two stored generated key columns declared above. `organizationKey`
		// is the one that matters most here: `organizationId` is nullable, and a unique index in MySQL
		// exempts any tuple that contains a null, so a caller with no organization escaped the lock
		// entirely and both halves of a retry inserted. `deletedKey` carries `"deletedAt" IS NULL`, in
		// the form `CreateSequenceTable1791000000000` documents for the whole set.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_idempotency_org_scope_key\` ON \`idempotency_key\` (\`organizationKey\`, \`scope\`, \`key\`, \`deletedKey\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE \`idempotency_key\``);
	}
}
