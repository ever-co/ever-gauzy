import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterCommentTableUsingEmployeeId1739256362112 implements MigrationInterface {
	name = 'AlterCommentTableUsingEmployeeId1739256362112';

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
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b6bf60ecb9f6c398e349adff52"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "creatorId"`);
		await queryRunner.query(`ALTER TABLE "comment" ADD "employeeId" uuid`);
		await queryRunner.query(`ALTER TABLE "comment" ADD "createdById" uuid`);
		await queryRunner.query(`CREATE INDEX "IDX_7a88834dadfa6fe261268bfcee" ON "comment" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_63ac916757350d28f05c5a6a4b" ON "comment" ("createdById") `);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_7a88834dadfa6fe261268bfceef" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3" FOREIGN KEY ("resolvedById") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_63ac916757350d28f05c5a6a4ba" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_63ac916757350d28f05c5a6a4ba"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_7a88834dadfa6fe261268bfceef"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_63ac916757350d28f05c5a6a4b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7a88834dadfa6fe261268bfcee"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "createdById"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "employeeId"`);
		await queryRunner.query(`ALTER TABLE "comment" ADD "creatorId" uuid`);
		await queryRunner.query(`CREATE INDEX "IDX_b6bf60ecb9f6c398e349adff52" ON "comment" ("creatorId") `);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
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
		await queryRunner.query(
			`CREATE TABLE "temporary_comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" integer, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "creatorId" varchar, "resolvedById" varchar, "parentId" varchar, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId" FROM "comment"`
		);
		await queryRunner.query(`DROP TABLE "comment"`);
		await queryRunner.query(`ALTER TABLE "temporary_comment" RENAME TO "comment"`);
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
		await queryRunner.query(`DROP INDEX "IDX_b6bf60ecb9f6c398e349adff52"`);
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" integer, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "resolvedById" varchar, "parentId" varchar, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId" FROM "comment"`
		);
		await queryRunner.query(`DROP TABLE "comment"`);
		await queryRunner.query(`ALTER TABLE "temporary_comment" RENAME TO "comment"`);
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" integer, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "resolvedById" varchar, "parentId" varchar, "employeeId" varchar, "createdById" varchar, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId" FROM "comment"`
		);
		await queryRunner.query(`DROP TABLE "comment"`);
		await queryRunner.query(`ALTER TABLE "temporary_comment" RENAME TO "comment"`);
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7a88834dadfa6fe261268bfcee" ON "comment" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_63ac916757350d28f05c5a6a4b" ON "comment" ("createdById") `);
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(`DROP INDEX "IDX_7a88834dadfa6fe261268bfcee"`);
		await queryRunner.query(`DROP INDEX "IDX_63ac916757350d28f05c5a6a4b"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" integer, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "resolvedById" varchar, "parentId" varchar, "employeeId" varchar, "createdById" varchar, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7a88834dadfa6fe261268bfceef" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3" FOREIGN KEY ("resolvedById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_63ac916757350d28f05c5a6a4ba" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId", "employeeId", "createdById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId", "employeeId", "createdById" FROM "comment"`
		);
		await queryRunner.query(`DROP TABLE "comment"`);
		await queryRunner.query(`ALTER TABLE "temporary_comment" RENAME TO "comment"`);
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7a88834dadfa6fe261268bfcee" ON "comment" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_63ac916757350d28f05c5a6a4b" ON "comment" ("createdById") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_63ac916757350d28f05c5a6a4b"`);
		await queryRunner.query(`DROP INDEX "IDX_7a88834dadfa6fe261268bfcee"`);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(`DROP INDEX "IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(`ALTER TABLE "comment" RENAME TO "temporary_comment"`);
		await queryRunner.query(
			`CREATE TABLE "comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" integer, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "resolvedById" varchar, "parentId" varchar, "employeeId" varchar, "createdById" varchar, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId", "employeeId", "createdById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId", "employeeId", "createdById" FROM "temporary_comment"`
		);
		await queryRunner.query(`DROP TABLE "temporary_comment"`);
		await queryRunner.query(`CREATE INDEX "IDX_63ac916757350d28f05c5a6a4b" ON "comment" ("createdById") `);
		await queryRunner.query(`CREATE INDEX "IDX_7a88834dadfa6fe261268bfcee" ON "comment" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_63ac916757350d28f05c5a6a4b"`);
		await queryRunner.query(`DROP INDEX "IDX_7a88834dadfa6fe261268bfcee"`);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(`DROP INDEX "IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(`ALTER TABLE "comment" RENAME TO "temporary_comment"`);
		await queryRunner.query(
			`CREATE TABLE "comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" integer, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "resolvedById" varchar, "parentId" varchar, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId" FROM "temporary_comment"`
		);
		await queryRunner.query(`DROP TABLE "temporary_comment"`);
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(`DROP INDEX "IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(`ALTER TABLE "comment" RENAME TO "temporary_comment"`);
		await queryRunner.query(
			`CREATE TABLE "comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" integer, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "creatorId" varchar, "resolvedById" varchar, "parentId" varchar, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "resolvedById", "parentId" FROM "temporary_comment"`
		);
		await queryRunner.query(`DROP TABLE "temporary_comment"`);
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6bf60ecb9f6c398e349adff52" ON "comment" ("creatorId") `);
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
		await queryRunner.query(`ALTER TABLE "comment" RENAME TO "temporary_comment"`);
		await queryRunner.query(
			`CREATE TABLE "comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" text NOT NULL, "actorType" integer, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "creatorId" varchar, "resolvedById" varchar, "parentId" varchar, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3" FOREIGN KEY ("resolvedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "comment"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "comment", "actorType", "resolved", "resolvedAt", "editedAt", "creatorId", "resolvedById", "parentId" FROM "temporary_comment"`
		);
		await queryRunner.query(`DROP TABLE "temporary_comment"`);
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
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_b6bf60ecb9f6c398e349adff52f\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_c9409c81aa283c1aae70fd5f4c3\``);
		await queryRunner.query(`DROP INDEX \`IDX_b6bf60ecb9f6c398e349adff52\` ON \`comment\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP COLUMN \`creatorId\``);
		await queryRunner.query(`ALTER TABLE \`comment\` ADD \`employeeId\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`comment\` ADD \`createdById\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_7a88834dadfa6fe261268bfcee\` ON \`comment\` (\`employeeId\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_63ac916757350d28f05c5a6a4b\` ON \`comment\` (\`createdById\`)`);
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_7a88834dadfa6fe261268bfceef\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_c9409c81aa283c1aae70fd5f4c3\` FOREIGN KEY (\`resolvedById\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_63ac916757350d28f05c5a6a4ba\` FOREIGN KEY (\`createdById\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_63ac916757350d28f05c5a6a4ba\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_c9409c81aa283c1aae70fd5f4c3\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_7a88834dadfa6fe261268bfceef\``);
		await queryRunner.query(`DROP INDEX \`IDX_63ac916757350d28f05c5a6a4b\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_7a88834dadfa6fe261268bfcee\` ON \`comment\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP COLUMN \`createdById\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP COLUMN \`employeeId\``);
		await queryRunner.query(`ALTER TABLE \`comment\` ADD \`creatorId\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_b6bf60ecb9f6c398e349adff52\` ON \`comment\` (\`creatorId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_c9409c81aa283c1aae70fd5f4c3\` FOREIGN KEY (\`resolvedById\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_b6bf60ecb9f6c398e349adff52f\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}
}
