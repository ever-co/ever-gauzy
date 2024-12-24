import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterActorTypeInCommentAndActivityLogEntities1727284713380 implements MigrationInterface {
	name = 'AlterActorTypeInCommentAndActivityLogEntities1727284713380';

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
		await queryRunner.query(`DROP INDEX "public"."IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`ALTER TABLE "activity_log" DROP COLUMN "actorType"`);
		await queryRunner.query(`ALTER TABLE "activity_log" ADD "actorType" integer`);
		await queryRunner.query(`DROP INDEX "public"."IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "actorType"`);
		await queryRunner.query(`ALTER TABLE "comment" ADD "actorType" integer`);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "actorType"`);
		await queryRunner.query(`ALTER TABLE "comment" ADD "actorType" character varying`);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`ALTER TABLE "activity_log" DROP COLUMN "actorType"`);
		await queryRunner.query(`ALTER TABLE "activity_log" ADD "actorType" character varying`);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" varchar, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "creatorId" varchar, CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId" FROM "activity_log"`
		);
		await queryRunner.query(`DROP TABLE "activity_log"`);
		await queryRunner.query(`ALTER TABLE "temporary_activity_log" RENAME TO "activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(`DROP INDEX "IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "IDX_b6bf60ecb9f6c398e349adff52"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" varchar, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "creatorId" varchar, "resolvedById" varchar, "parentId" varchar, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3" FOREIGN KEY ("resolvedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId" FROM "comment"`
		);
		await queryRunner.query(`DROP TABLE "comment"`);
		await queryRunner.query(`ALTER TABLE "temporary_comment" RENAME TO "comment"`);
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6bf60ecb9f6c398e349adff52" ON "comment" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" integer, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "creatorId" varchar, CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId" FROM "activity_log"`
		);
		await queryRunner.query(`DROP TABLE "activity_log"`);
		await queryRunner.query(`ALTER TABLE "temporary_activity_log" RENAME TO "activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(`DROP INDEX "IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "IDX_b6bf60ecb9f6c398e349adff52"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" integer, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "creatorId" varchar, "resolvedById" varchar, "parentId" varchar, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3" FOREIGN KEY ("resolvedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId" FROM "comment"`
		);
		await queryRunner.query(`DROP TABLE "comment"`);
		await queryRunner.query(`ALTER TABLE "temporary_comment" RENAME TO "comment"`);
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6bf60ecb9f6c398e349adff52" ON "comment" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_b6bf60ecb9f6c398e349adff52"`);
		await queryRunner.query(`DROP INDEX "IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(`ALTER TABLE "comment" RENAME TO "temporary_comment"`);
		await queryRunner.query(
			`CREATE TABLE "comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" varchar, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "creatorId" varchar, "resolvedById" varchar, "parentId" varchar, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3" FOREIGN KEY ("resolvedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId" FROM "temporary_comment"`
		);
		await queryRunner.query(`DROP TABLE "temporary_comment"`);
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6bf60ecb9f6c398e349adff52" ON "comment" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(`ALTER TABLE "activity_log" RENAME TO "temporary_activity_log"`);
		await queryRunner.query(
			`CREATE TABLE "activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" varchar, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "creatorId" varchar, CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId" FROM "temporary_activity_log"`
		);
		await queryRunner.query(`DROP TABLE "temporary_activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_b6bf60ecb9f6c398e349adff52"`);
		await queryRunner.query(`DROP INDEX "IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(`ALTER TABLE "comment" RENAME TO "temporary_comment"`);
		await queryRunner.query(
			`CREATE TABLE "comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" varchar, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "creatorId" varchar, "resolvedById" varchar, "parentId" varchar, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3" FOREIGN KEY ("resolvedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId" FROM "temporary_comment"`
		);
		await queryRunner.query(`DROP TABLE "temporary_comment"`);
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6bf60ecb9f6c398e349adff52" ON "comment" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(`ALTER TABLE "activity_log" RENAME TO "temporary_activity_log"`);
		await queryRunner.query(
			`CREATE TABLE "activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" varchar, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "creatorId" varchar, CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId" FROM "temporary_activity_log"`
		);
		await queryRunner.query(`DROP TABLE "temporary_activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`IDX_691ba0d5b57cd5adea2c9cc285\` ON \`activity_log\``);
		await queryRunner.query(`ALTER TABLE \`activity_log\` DROP COLUMN \`actorType\``);
		await queryRunner.query(`ALTER TABLE \`activity_log\` ADD \`actorType\` int NULL`);
		await queryRunner.query(`DROP INDEX \`IDX_eecd6e41f9acb6bf59e474d518\` ON \`comment\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP COLUMN \`actorType\``);
		await queryRunner.query(`ALTER TABLE \`comment\` ADD \`actorType\` int NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_691ba0d5b57cd5adea2c9cc285\` ON \`activity_log\` (\`actorType\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_eecd6e41f9acb6bf59e474d518\` ON \`comment\` (\`actorType\`)`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`IDX_eecd6e41f9acb6bf59e474d518\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_691ba0d5b57cd5adea2c9cc285\` ON \`activity_log\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP COLUMN \`actorType\``);
		await queryRunner.query(`ALTER TABLE \`comment\` ADD \`actorType\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_eecd6e41f9acb6bf59e474d518\` ON \`comment\` (\`actorType\`)`);
		await queryRunner.query(`ALTER TABLE \`activity_log\` DROP COLUMN \`actorType\``);
		await queryRunner.query(`ALTER TABLE \`activity_log\` ADD \`actorType\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_691ba0d5b57cd5adea2c9cc285\` ON \`activity_log\` (\`actorType\`)`);
	}
}
