import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterActivityLogTableUsingEmployeeId1739268372038 implements MigrationInterface {
	name = 'AlterActivityLogTableUsingEmployeeId1739268372038';

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
		await queryRunner.query(`ALTER TABLE "activity_log" DROP CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(`ALTER TABLE "activity_log" RENAME COLUMN "creatorId" TO "employeeId"`);
		await queryRunner.query(`CREATE INDEX "IDX_071945a9d4a2322fde08010292" ON "activity_log" ("employeeId") `);
		await queryRunner.query(
			`ALTER TABLE "activity_log" ADD CONSTRAINT "FK_071945a9d4a2322fde08010292c" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "activity_log" DROP CONSTRAINT "FK_071945a9d4a2322fde08010292c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_071945a9d4a2322fde08010292"`);
		await queryRunner.query(`ALTER TABLE "activity_log" RENAME COLUMN "employeeId" TO "creatorId"`);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
		await queryRunner.query(
			`ALTER TABLE "activity_log" ADD CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" integer, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "creatorId" varchar, CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId" FROM "activity_log"`
		);
		await queryRunner.query(`DROP TABLE "activity_log"`);
		await queryRunner.query(`ALTER TABLE "temporary_activity_log" RENAME TO "activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
		await queryRunner.query(`DROP INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" integer, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "employeeId" varchar, CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId" FROM "activity_log"`
		);
		await queryRunner.query(`DROP TABLE "activity_log"`);
		await queryRunner.query(`ALTER TABLE "temporary_activity_log" RENAME TO "activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_071945a9d4a2322fde08010292" ON "activity_log" ("employeeId") `);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_071945a9d4a2322fde08010292"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" integer, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "employeeId" varchar, CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_071945a9d4a2322fde08010292c" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "employeeId" FROM "activity_log"`
		);
		await queryRunner.query(`DROP TABLE "activity_log"`);
		await queryRunner.query(`ALTER TABLE "temporary_activity_log" RENAME TO "activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_071945a9d4a2322fde08010292" ON "activity_log" ("employeeId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_071945a9d4a2322fde08010292"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`ALTER TABLE "activity_log" RENAME TO "temporary_activity_log"`);
		await queryRunner.query(
			`CREATE TABLE "activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" integer, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "employeeId" varchar, CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`INSERT INTO "activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "employeeId" FROM "temporary_activity_log"`
		);
		await queryRunner.query(`DROP TABLE "temporary_activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_071945a9d4a2322fde08010292" ON "activity_log" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_071945a9d4a2322fde08010292"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`ALTER TABLE "activity_log" RENAME TO "temporary_activity_log"`);
		await queryRunner.query(
			`CREATE TABLE "activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" integer, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "creatorId" varchar, CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`INSERT INTO "activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "employeeId" FROM "temporary_activity_log"`
		);
		await queryRunner.query(`DROP TABLE "temporary_activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
		await queryRunner.query(`DROP INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`ALTER TABLE "activity_log" RENAME TO "temporary_activity_log"`);
		await queryRunner.query(
			`CREATE TABLE "activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" integer, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "creatorId" varchar, CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId" FROM "temporary_activity_log"`
		);
		await queryRunner.query(`DROP TABLE "temporary_activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`activity_log\` DROP FOREIGN KEY \`FK_b6e9a5c3e1ee65a3bcb8a00de2b\``);
		await queryRunner.query(`DROP INDEX \`IDX_b6e9a5c3e1ee65a3bcb8a00de2\` ON \`activity_log\``);
		await queryRunner.query(`ALTER TABLE \`activity_log\` CHANGE \`creatorId\` \`employeeId\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_071945a9d4a2322fde08010292\` ON \`activity_log\` (\`employeeId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`activity_log\` ADD CONSTRAINT \`FK_071945a9d4a2322fde08010292c\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`activity_log\` DROP FOREIGN KEY \`FK_071945a9d4a2322fde08010292c\``);
		await queryRunner.query(`DROP INDEX \`IDX_071945a9d4a2322fde08010292\` ON \`activity_log\``);
		await queryRunner.query(`ALTER TABLE \`activity_log\` CHANGE \`employeeId\` \`creatorId\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_b6e9a5c3e1ee65a3bcb8a00de2\` ON \`activity_log\` (\`creatorId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`activity_log\` ADD CONSTRAINT \`FK_b6e9a5c3e1ee65a3bcb8a00de2b\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}
}
