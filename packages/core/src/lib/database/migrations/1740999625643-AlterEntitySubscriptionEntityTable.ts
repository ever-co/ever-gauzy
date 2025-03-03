import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterEntitySubscriptionEntityTable1740999625643 implements MigrationInterface {
	name = 'AlterEntitySubscriptionEntityTable1740999625643';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type) {
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
		switch (queryRunner.connection.options.type) {
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
		console.log(
			chalk.yellow('Skipping PostgresDB Up Migration: This migration is implemented for SQLite databases only.')
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(
			chalk.yellow('Skipping PostgresDB Down Migration: This migration is implemented for SQLite databases only.')
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_20ab5595afd1d6f3c615901f0e"`);
		await queryRunner.query(`DROP INDEX "IDX_4d44ab2374537d23199e12af3a"`);
		await queryRunner.query(`DROP INDEX "IDX_c85c985e49dbf5cf54556dc339"`);
		await queryRunner.query(`DROP INDEX "IDX_179d37cfc5af1b922ae61ef197"`);
		await queryRunner.query(`DROP INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a"`);
		await queryRunner.query(`DROP INDEX "IDX_953e680602ea3b0cd53cc5091d"`);
		await queryRunner.query(`DROP INDEX "IDX_92007461ec4f0503e7c31f4c3c"`);
		await queryRunner.query(`DROP INDEX "IDX_acab84b45e0a2cad5ea5b03211"`);
		await queryRunner.query(`DROP INDEX "IDX_f3a3570a427438d25543b5f7c8"`);
		await queryRunner.query(`DROP INDEX "IDX_065f8f08dcb2f997e88bbf5758"`);
		await queryRunner.query(`DROP INDEX "IDX_88a397af890206ab51c876e80c"`);
		await queryRunner.query(`DROP INDEX "IDX_9c48df6f668733aba86e4fc1ee"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_entity_subscription" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "type" varchar NOT NULL, "actorType" integer, "employeeId" varchar NOT NULL, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, CONSTRAINT "FK_20ab5595afd1d6f3c615901f0ea" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4d44ab2374537d23199e12af3a6" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c85c985e49dbf5cf54556dc339e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_92007461ec4f0503e7c31f4c3cf" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_acab84b45e0a2cad5ea5b03211b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_9c48df6f668733aba86e4fc1ee0" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_entity_subscription"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "entity_subscription"`
		);
		await queryRunner.query(`DROP TABLE "entity_subscription"`);
		await queryRunner.query(`ALTER TABLE "temporary_entity_subscription" RENAME TO "entity_subscription"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_20ab5595afd1d6f3c615901f0e" ON "entity_subscription" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4d44ab2374537d23199e12af3a" ON "entity_subscription" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c85c985e49dbf5cf54556dc339" ON "entity_subscription" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_179d37cfc5af1b922ae61ef197" ON "entity_subscription" ("actorType") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a" ON "entity_subscription" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_953e680602ea3b0cd53cc5091d" ON "entity_subscription" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_92007461ec4f0503e7c31f4c3c" ON "entity_subscription" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_acab84b45e0a2cad5ea5b03211" ON "entity_subscription" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f3a3570a427438d25543b5f7c8" ON "entity_subscription" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_065f8f08dcb2f997e88bbf5758" ON "entity_subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_88a397af890206ab51c876e80c" ON "entity_subscription" ("type") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c48df6f668733aba86e4fc1ee" ON "entity_subscription" ("updatedByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_20ab5595afd1d6f3c615901f0e"`);
		await queryRunner.query(`DROP INDEX "IDX_4d44ab2374537d23199e12af3a"`);
		await queryRunner.query(`DROP INDEX "IDX_c85c985e49dbf5cf54556dc339"`);
		await queryRunner.query(`DROP INDEX "IDX_179d37cfc5af1b922ae61ef197"`);
		await queryRunner.query(`DROP INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a"`);
		await queryRunner.query(`DROP INDEX "IDX_953e680602ea3b0cd53cc5091d"`);
		await queryRunner.query(`DROP INDEX "IDX_92007461ec4f0503e7c31f4c3c"`);
		await queryRunner.query(`DROP INDEX "IDX_acab84b45e0a2cad5ea5b03211"`);
		await queryRunner.query(`DROP INDEX "IDX_f3a3570a427438d25543b5f7c8"`);
		await queryRunner.query(`DROP INDEX "IDX_065f8f08dcb2f997e88bbf5758"`);
		await queryRunner.query(`DROP INDEX "IDX_88a397af890206ab51c876e80c"`);
		await queryRunner.query(`DROP INDEX "IDX_9c48df6f668733aba86e4fc1ee"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_entity_subscription" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "type" varchar NOT NULL, "actorType" integer, "employeeId" varchar NOT NULL, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_entity_subscription"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "entity_subscription"`
		);
		await queryRunner.query(`DROP TABLE "entity_subscription"`);
		await queryRunner.query(`ALTER TABLE "temporary_entity_subscription" RENAME TO "entity_subscription"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_20ab5595afd1d6f3c615901f0e" ON "entity_subscription" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4d44ab2374537d23199e12af3a" ON "entity_subscription" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c85c985e49dbf5cf54556dc339" ON "entity_subscription" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_179d37cfc5af1b922ae61ef197" ON "entity_subscription" ("actorType") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a" ON "entity_subscription" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_953e680602ea3b0cd53cc5091d" ON "entity_subscription" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_92007461ec4f0503e7c31f4c3c" ON "entity_subscription" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_acab84b45e0a2cad5ea5b03211" ON "entity_subscription" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f3a3570a427438d25543b5f7c8" ON "entity_subscription" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_065f8f08dcb2f997e88bbf5758" ON "entity_subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_88a397af890206ab51c876e80c" ON "entity_subscription" ("type") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c48df6f668733aba86e4fc1ee" ON "entity_subscription" ("updatedByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_20ab5595afd1d6f3c615901f0e"`);
		await queryRunner.query(`DROP INDEX "IDX_4d44ab2374537d23199e12af3a"`);
		await queryRunner.query(`DROP INDEX "IDX_c85c985e49dbf5cf54556dc339"`);
		await queryRunner.query(`DROP INDEX "IDX_179d37cfc5af1b922ae61ef197"`);
		await queryRunner.query(`DROP INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a"`);
		await queryRunner.query(`DROP INDEX "IDX_953e680602ea3b0cd53cc5091d"`);
		await queryRunner.query(`DROP INDEX "IDX_92007461ec4f0503e7c31f4c3c"`);
		await queryRunner.query(`DROP INDEX "IDX_acab84b45e0a2cad5ea5b03211"`);
		await queryRunner.query(`DROP INDEX "IDX_f3a3570a427438d25543b5f7c8"`);
		await queryRunner.query(`DROP INDEX "IDX_065f8f08dcb2f997e88bbf5758"`);
		await queryRunner.query(`DROP INDEX "IDX_88a397af890206ab51c876e80c"`);
		await queryRunner.query(`DROP INDEX "IDX_9c48df6f668733aba86e4fc1ee"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_entity_subscription" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "type" varchar NOT NULL, "actorType" integer, "employeeId" varchar, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_entity_subscription"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "entity_subscription"`
		);
		await queryRunner.query(`DROP TABLE "entity_subscription"`);
		await queryRunner.query(`ALTER TABLE "temporary_entity_subscription" RENAME TO "entity_subscription"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_20ab5595afd1d6f3c615901f0e" ON "entity_subscription" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4d44ab2374537d23199e12af3a" ON "entity_subscription" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c85c985e49dbf5cf54556dc339" ON "entity_subscription" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_179d37cfc5af1b922ae61ef197" ON "entity_subscription" ("actorType") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a" ON "entity_subscription" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_953e680602ea3b0cd53cc5091d" ON "entity_subscription" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_92007461ec4f0503e7c31f4c3c" ON "entity_subscription" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_acab84b45e0a2cad5ea5b03211" ON "entity_subscription" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f3a3570a427438d25543b5f7c8" ON "entity_subscription" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_065f8f08dcb2f997e88bbf5758" ON "entity_subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_88a397af890206ab51c876e80c" ON "entity_subscription" ("type") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c48df6f668733aba86e4fc1ee" ON "entity_subscription" ("updatedByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_20ab5595afd1d6f3c615901f0e"`);
		await queryRunner.query(`DROP INDEX "IDX_4d44ab2374537d23199e12af3a"`);
		await queryRunner.query(`DROP INDEX "IDX_c85c985e49dbf5cf54556dc339"`);
		await queryRunner.query(`DROP INDEX "IDX_179d37cfc5af1b922ae61ef197"`);
		await queryRunner.query(`DROP INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a"`);
		await queryRunner.query(`DROP INDEX "IDX_953e680602ea3b0cd53cc5091d"`);
		await queryRunner.query(`DROP INDEX "IDX_92007461ec4f0503e7c31f4c3c"`);
		await queryRunner.query(`DROP INDEX "IDX_acab84b45e0a2cad5ea5b03211"`);
		await queryRunner.query(`DROP INDEX "IDX_f3a3570a427438d25543b5f7c8"`);
		await queryRunner.query(`DROP INDEX "IDX_065f8f08dcb2f997e88bbf5758"`);
		await queryRunner.query(`DROP INDEX "IDX_88a397af890206ab51c876e80c"`);
		await queryRunner.query(`DROP INDEX "IDX_9c48df6f668733aba86e4fc1ee"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_entity_subscription" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "type" varchar NOT NULL, "actorType" integer, "employeeId" varchar, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, CONSTRAINT "FK_4d44ab2374537d23199e12af3a6" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9c48df6f668733aba86e4fc1ee0" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_20ab5595afd1d6f3c615901f0ea" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_92007461ec4f0503e7c31f4c3cf" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_acab84b45e0a2cad5ea5b03211b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_c85c985e49dbf5cf54556dc339e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_entity_subscription"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "entity_subscription"`
		);
		await queryRunner.query(`DROP TABLE "entity_subscription"`);
		await queryRunner.query(`ALTER TABLE "temporary_entity_subscription" RENAME TO "entity_subscription"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_20ab5595afd1d6f3c615901f0e" ON "entity_subscription" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4d44ab2374537d23199e12af3a" ON "entity_subscription" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c85c985e49dbf5cf54556dc339" ON "entity_subscription" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_179d37cfc5af1b922ae61ef197" ON "entity_subscription" ("actorType") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a" ON "entity_subscription" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_953e680602ea3b0cd53cc5091d" ON "entity_subscription" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_92007461ec4f0503e7c31f4c3c" ON "entity_subscription" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_acab84b45e0a2cad5ea5b03211" ON "entity_subscription" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f3a3570a427438d25543b5f7c8" ON "entity_subscription" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_065f8f08dcb2f997e88bbf5758" ON "entity_subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_88a397af890206ab51c876e80c" ON "entity_subscription" ("type") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c48df6f668733aba86e4fc1ee" ON "entity_subscription" ("updatedByUserId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_9c48df6f668733aba86e4fc1ee"`);
		await queryRunner.query(`DROP INDEX "IDX_88a397af890206ab51c876e80c"`);
		await queryRunner.query(`DROP INDEX "IDX_065f8f08dcb2f997e88bbf5758"`);
		await queryRunner.query(`DROP INDEX "IDX_f3a3570a427438d25543b5f7c8"`);
		await queryRunner.query(`DROP INDEX "IDX_acab84b45e0a2cad5ea5b03211"`);
		await queryRunner.query(`DROP INDEX "IDX_92007461ec4f0503e7c31f4c3c"`);
		await queryRunner.query(`DROP INDEX "IDX_953e680602ea3b0cd53cc5091d"`);
		await queryRunner.query(`DROP INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a"`);
		await queryRunner.query(`DROP INDEX "IDX_179d37cfc5af1b922ae61ef197"`);
		await queryRunner.query(`DROP INDEX "IDX_c85c985e49dbf5cf54556dc339"`);
		await queryRunner.query(`DROP INDEX "IDX_4d44ab2374537d23199e12af3a"`);
		await queryRunner.query(`DROP INDEX "IDX_20ab5595afd1d6f3c615901f0e"`);
		await queryRunner.query(`ALTER TABLE "entity_subscription" RENAME TO "temporary_entity_subscription"`);
		await queryRunner.query(
			`CREATE TABLE "entity_subscription" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "type" varchar NOT NULL, "actorType" integer, "employeeId" varchar, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "entity_subscription"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "temporary_entity_subscription"`
		);
		await queryRunner.query(`DROP TABLE "temporary_entity_subscription"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c48df6f668733aba86e4fc1ee" ON "entity_subscription" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_88a397af890206ab51c876e80c" ON "entity_subscription" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_065f8f08dcb2f997e88bbf5758" ON "entity_subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_f3a3570a427438d25543b5f7c8" ON "entity_subscription" ("entityId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_acab84b45e0a2cad5ea5b03211" ON "entity_subscription" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_92007461ec4f0503e7c31f4c3c" ON "entity_subscription" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_953e680602ea3b0cd53cc5091d" ON "entity_subscription" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a" ON "entity_subscription" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_179d37cfc5af1b922ae61ef197" ON "entity_subscription" ("actorType") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c85c985e49dbf5cf54556dc339" ON "entity_subscription" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4d44ab2374537d23199e12af3a" ON "entity_subscription" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_20ab5595afd1d6f3c615901f0e" ON "entity_subscription" ("deletedByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_9c48df6f668733aba86e4fc1ee"`);
		await queryRunner.query(`DROP INDEX "IDX_88a397af890206ab51c876e80c"`);
		await queryRunner.query(`DROP INDEX "IDX_065f8f08dcb2f997e88bbf5758"`);
		await queryRunner.query(`DROP INDEX "IDX_f3a3570a427438d25543b5f7c8"`);
		await queryRunner.query(`DROP INDEX "IDX_acab84b45e0a2cad5ea5b03211"`);
		await queryRunner.query(`DROP INDEX "IDX_92007461ec4f0503e7c31f4c3c"`);
		await queryRunner.query(`DROP INDEX "IDX_953e680602ea3b0cd53cc5091d"`);
		await queryRunner.query(`DROP INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a"`);
		await queryRunner.query(`DROP INDEX "IDX_179d37cfc5af1b922ae61ef197"`);
		await queryRunner.query(`DROP INDEX "IDX_c85c985e49dbf5cf54556dc339"`);
		await queryRunner.query(`DROP INDEX "IDX_4d44ab2374537d23199e12af3a"`);
		await queryRunner.query(`DROP INDEX "IDX_20ab5595afd1d6f3c615901f0e"`);
		await queryRunner.query(`ALTER TABLE "entity_subscription" RENAME TO "temporary_entity_subscription"`);
		await queryRunner.query(
			`CREATE TABLE "entity_subscription" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "type" varchar NOT NULL, "actorType" integer, "employeeId" varchar NOT NULL, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "entity_subscription"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "temporary_entity_subscription"`
		);
		await queryRunner.query(`DROP TABLE "temporary_entity_subscription"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c48df6f668733aba86e4fc1ee" ON "entity_subscription" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_88a397af890206ab51c876e80c" ON "entity_subscription" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_065f8f08dcb2f997e88bbf5758" ON "entity_subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_f3a3570a427438d25543b5f7c8" ON "entity_subscription" ("entityId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_acab84b45e0a2cad5ea5b03211" ON "entity_subscription" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_92007461ec4f0503e7c31f4c3c" ON "entity_subscription" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_953e680602ea3b0cd53cc5091d" ON "entity_subscription" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a" ON "entity_subscription" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_179d37cfc5af1b922ae61ef197" ON "entity_subscription" ("actorType") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c85c985e49dbf5cf54556dc339" ON "entity_subscription" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4d44ab2374537d23199e12af3a" ON "entity_subscription" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_20ab5595afd1d6f3c615901f0e" ON "entity_subscription" ("deletedByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_9c48df6f668733aba86e4fc1ee"`);
		await queryRunner.query(`DROP INDEX "IDX_88a397af890206ab51c876e80c"`);
		await queryRunner.query(`DROP INDEX "IDX_065f8f08dcb2f997e88bbf5758"`);
		await queryRunner.query(`DROP INDEX "IDX_f3a3570a427438d25543b5f7c8"`);
		await queryRunner.query(`DROP INDEX "IDX_acab84b45e0a2cad5ea5b03211"`);
		await queryRunner.query(`DROP INDEX "IDX_92007461ec4f0503e7c31f4c3c"`);
		await queryRunner.query(`DROP INDEX "IDX_953e680602ea3b0cd53cc5091d"`);
		await queryRunner.query(`DROP INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a"`);
		await queryRunner.query(`DROP INDEX "IDX_179d37cfc5af1b922ae61ef197"`);
		await queryRunner.query(`DROP INDEX "IDX_c85c985e49dbf5cf54556dc339"`);
		await queryRunner.query(`DROP INDEX "IDX_4d44ab2374537d23199e12af3a"`);
		await queryRunner.query(`DROP INDEX "IDX_20ab5595afd1d6f3c615901f0e"`);
		await queryRunner.query(`ALTER TABLE "entity_subscription" RENAME TO "temporary_entity_subscription"`);
		await queryRunner.query(
			`CREATE TABLE "entity_subscription" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "type" varchar NOT NULL, "actorType" integer, "employeeId" varchar NOT NULL, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, CONSTRAINT "FK_c85c985e49dbf5cf54556dc339e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "entity_subscription"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "temporary_entity_subscription"`
		);
		await queryRunner.query(`DROP TABLE "temporary_entity_subscription"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c48df6f668733aba86e4fc1ee" ON "entity_subscription" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_88a397af890206ab51c876e80c" ON "entity_subscription" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_065f8f08dcb2f997e88bbf5758" ON "entity_subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_f3a3570a427438d25543b5f7c8" ON "entity_subscription" ("entityId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_acab84b45e0a2cad5ea5b03211" ON "entity_subscription" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_92007461ec4f0503e7c31f4c3c" ON "entity_subscription" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_953e680602ea3b0cd53cc5091d" ON "entity_subscription" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a" ON "entity_subscription" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_179d37cfc5af1b922ae61ef197" ON "entity_subscription" ("actorType") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c85c985e49dbf5cf54556dc339" ON "entity_subscription" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4d44ab2374537d23199e12af3a" ON "entity_subscription" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_20ab5595afd1d6f3c615901f0e" ON "entity_subscription" ("deletedByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_9c48df6f668733aba86e4fc1ee"`);
		await queryRunner.query(`DROP INDEX "IDX_88a397af890206ab51c876e80c"`);
		await queryRunner.query(`DROP INDEX "IDX_065f8f08dcb2f997e88bbf5758"`);
		await queryRunner.query(`DROP INDEX "IDX_f3a3570a427438d25543b5f7c8"`);
		await queryRunner.query(`DROP INDEX "IDX_acab84b45e0a2cad5ea5b03211"`);
		await queryRunner.query(`DROP INDEX "IDX_92007461ec4f0503e7c31f4c3c"`);
		await queryRunner.query(`DROP INDEX "IDX_953e680602ea3b0cd53cc5091d"`);
		await queryRunner.query(`DROP INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a"`);
		await queryRunner.query(`DROP INDEX "IDX_179d37cfc5af1b922ae61ef197"`);
		await queryRunner.query(`DROP INDEX "IDX_c85c985e49dbf5cf54556dc339"`);
		await queryRunner.query(`DROP INDEX "IDX_4d44ab2374537d23199e12af3a"`);
		await queryRunner.query(`DROP INDEX "IDX_20ab5595afd1d6f3c615901f0e"`);
		await queryRunner.query(`ALTER TABLE "entity_subscription" RENAME TO "temporary_entity_subscription"`);
		await queryRunner.query(
			`CREATE TABLE "entity_subscription" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "type" varchar NOT NULL, "actorType" integer, "employeeId" varchar NOT NULL, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, CONSTRAINT "FK_20ab5595afd1d6f3c615901f0ea" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4d44ab2374537d23199e12af3a6" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c85c985e49dbf5cf54556dc339e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_92007461ec4f0503e7c31f4c3cf" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_acab84b45e0a2cad5ea5b03211b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_9c48df6f668733aba86e4fc1ee0" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "entity_subscription"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "actorType", "employeeId", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "temporary_entity_subscription"`
		);
		await queryRunner.query(`DROP TABLE "temporary_entity_subscription"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c48df6f668733aba86e4fc1ee" ON "entity_subscription" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_88a397af890206ab51c876e80c" ON "entity_subscription" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_065f8f08dcb2f997e88bbf5758" ON "entity_subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_f3a3570a427438d25543b5f7c8" ON "entity_subscription" ("entityId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_acab84b45e0a2cad5ea5b03211" ON "entity_subscription" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_92007461ec4f0503e7c31f4c3c" ON "entity_subscription" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_953e680602ea3b0cd53cc5091d" ON "entity_subscription" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5ba76d22f6ce6da7ed654d6b3a" ON "entity_subscription" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_179d37cfc5af1b922ae61ef197" ON "entity_subscription" ("actorType") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c85c985e49dbf5cf54556dc339" ON "entity_subscription" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4d44ab2374537d23199e12af3a" ON "entity_subscription" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_20ab5595afd1d6f3c615901f0e" ON "entity_subscription" ("deletedByUserId") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(
			chalk.yellow('Skipping MySQL Up Migration: This migration is implemented for SQLite databases only.')
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(
			chalk.yellow('Skipping MySQL Down Migration: This migration is implemented for SQLite databases only.')
		);
	}
}
