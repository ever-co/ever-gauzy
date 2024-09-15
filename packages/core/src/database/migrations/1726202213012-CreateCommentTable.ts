import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateCommentTable1726202213012 implements MigrationInterface {
	name = 'CreateCommentTable1726202213012';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(yellow(this.name + ' start running!'));

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
		await queryRunner.query(
			`CREATE TABLE "comment" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "comment" character varying NOT NULL, "actorType" character varying, "resolved" boolean, "resolvedAt" TIMESTAMP, "editedAt" TIMESTAMP, "creatorId" uuid, "resolvedById" uuid, "parentId" uuid, CONSTRAINT "PK_0b0e4bbc8415ec426f87f3a88e2" PRIMARY KEY ("id"))`
		);
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
		await queryRunner.query(
			`CREATE TABLE "comment_employee" ("commentId" uuid NOT NULL, "employeeId" uuid NOT NULL, CONSTRAINT "PK_84f5039d23d11d672d1b25ed7de" PRIMARY KEY ("commentId", "employeeId"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_3c3be7039bf788872d073e8735" ON "comment_employee" ("commentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6e1fd409e3619b83e19e841935" ON "comment_employee" ("employeeId") `);
		await queryRunner.query(
			`CREATE TABLE "comment_team" ("commentId" uuid NOT NULL, "organizationTeamId" uuid NOT NULL, CONSTRAINT "PK_33383797d72fffc0ffb16ac14b8" PRIMARY KEY ("commentId", "organizationTeamId"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_afe39187fb8616dc2e7788d7af" ON "comment_team" ("commentId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_53d72df8d6de8de0b5ba78c366" ON "comment_team" ("organizationTeamId") `
		);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "comment_employee" ADD CONSTRAINT "FK_3c3be7039bf788872d073e87351" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "comment_employee" ADD CONSTRAINT "FK_6e1fd409e3619b83e19e8419357" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "comment_team" ADD CONSTRAINT "FK_afe39187fb8616dc2e7788d7aff" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "comment_team" ADD CONSTRAINT "FK_53d72df8d6de8de0b5ba78c3669" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "comment_team" DROP CONSTRAINT "FK_53d72df8d6de8de0b5ba78c3669"`);
		await queryRunner.query(`ALTER TABLE "comment_team" DROP CONSTRAINT "FK_afe39187fb8616dc2e7788d7aff"`);
		await queryRunner.query(`ALTER TABLE "comment_employee" DROP CONSTRAINT "FK_6e1fd409e3619b83e19e8419357"`);
		await queryRunner.query(`ALTER TABLE "comment_employee" DROP CONSTRAINT "FK_3c3be7039bf788872d073e87351"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_e3aebe2bd1c53467a07109be596"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_a3422826753d4e6b079dea98342"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_53d72df8d6de8de0b5ba78c366"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_afe39187fb8616dc2e7788d7af"`);
		await queryRunner.query(`DROP TABLE "comment_team"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6e1fd409e3619b83e19e841935"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3c3be7039bf788872d073e8735"`);
		await queryRunner.query(`DROP TABLE "comment_employee"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b6bf60ecb9f6c398e349adff52"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(`DROP TABLE "comment"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" varchar NOT NULL, "actorType" varchar, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "creatorId" varchar, "resolvedById" varchar, "parentId" varchar)`
		);
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
		await queryRunner.query(
			`CREATE TABLE "comment_employee" ("commentId" varchar NOT NULL, "employeeId" varchar NOT NULL, PRIMARY KEY ("commentId", "employeeId"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_3c3be7039bf788872d073e8735" ON "comment_employee" ("commentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6e1fd409e3619b83e19e841935" ON "comment_employee" ("employeeId") `);
		await queryRunner.query(
			`CREATE TABLE "comment_team" ("commentId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, PRIMARY KEY ("commentId", "organizationTeamId"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_afe39187fb8616dc2e7788d7af" ON "comment_team" ("commentId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_53d72df8d6de8de0b5ba78c366" ON "comment_team" ("organizationTeamId") `
		);
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
			`CREATE TABLE "temporary_comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" varchar NOT NULL, "actorType" varchar, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "creatorId" varchar, "resolvedById" varchar, "parentId" varchar, CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3" FOREIGN KEY ("resolvedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
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
		await queryRunner.query(`DROP INDEX "IDX_3c3be7039bf788872d073e8735"`);
		await queryRunner.query(`DROP INDEX "IDX_6e1fd409e3619b83e19e841935"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_comment_employee" ("commentId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_3c3be7039bf788872d073e87351" FOREIGN KEY ("commentId") REFERENCES "comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6e1fd409e3619b83e19e8419357" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("commentId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_comment_employee"("commentId", "employeeId") SELECT "commentId", "employeeId" FROM "comment_employee"`
		);
		await queryRunner.query(`DROP TABLE "comment_employee"`);
		await queryRunner.query(`ALTER TABLE "temporary_comment_employee" RENAME TO "comment_employee"`);
		await queryRunner.query(`CREATE INDEX "IDX_3c3be7039bf788872d073e8735" ON "comment_employee" ("commentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6e1fd409e3619b83e19e841935" ON "comment_employee" ("employeeId") `);
		await queryRunner.query(`DROP INDEX "IDX_afe39187fb8616dc2e7788d7af"`);
		await queryRunner.query(`DROP INDEX "IDX_53d72df8d6de8de0b5ba78c366"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_comment_team" ("commentId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, CONSTRAINT "FK_afe39187fb8616dc2e7788d7aff" FOREIGN KEY ("commentId") REFERENCES "comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_53d72df8d6de8de0b5ba78c3669" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("commentId", "organizationTeamId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_comment_team"("commentId", "organizationTeamId") SELECT "commentId", "organizationTeamId" FROM "comment_team"`
		);
		await queryRunner.query(`DROP TABLE "comment_team"`);
		await queryRunner.query(`ALTER TABLE "temporary_comment_team" RENAME TO "comment_team"`);
		await queryRunner.query(`CREATE INDEX "IDX_afe39187fb8616dc2e7788d7af" ON "comment_team" ("commentId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_53d72df8d6de8de0b5ba78c366" ON "comment_team" ("organizationTeamId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_53d72df8d6de8de0b5ba78c366"`);
		await queryRunner.query(`DROP INDEX "IDX_afe39187fb8616dc2e7788d7af"`);
		await queryRunner.query(`ALTER TABLE "comment_team" RENAME TO "temporary_comment_team"`);
		await queryRunner.query(
			`CREATE TABLE "comment_team" ("commentId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, PRIMARY KEY ("commentId", "organizationTeamId"))`
		);
		await queryRunner.query(
			`INSERT INTO "comment_team"("commentId", "organizationTeamId") SELECT "commentId", "organizationTeamId" FROM "temporary_comment_team"`
		);
		await queryRunner.query(`DROP TABLE "temporary_comment_team"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_53d72df8d6de8de0b5ba78c366" ON "comment_team" ("organizationTeamId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_afe39187fb8616dc2e7788d7af" ON "comment_team" ("commentId") `);
		await queryRunner.query(`DROP INDEX "IDX_6e1fd409e3619b83e19e841935"`);
		await queryRunner.query(`DROP INDEX "IDX_3c3be7039bf788872d073e8735"`);
		await queryRunner.query(`ALTER TABLE "comment_employee" RENAME TO "temporary_comment_employee"`);
		await queryRunner.query(
			`CREATE TABLE "comment_employee" ("commentId" varchar NOT NULL, "employeeId" varchar NOT NULL, PRIMARY KEY ("commentId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "comment_employee"("commentId", "employeeId") SELECT "commentId", "employeeId" FROM "temporary_comment_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_comment_employee"`);
		await queryRunner.query(`CREATE INDEX "IDX_6e1fd409e3619b83e19e841935" ON "comment_employee" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3c3be7039bf788872d073e8735" ON "comment_employee" ("commentId") `);
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
			`CREATE TABLE "comment" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "comment" varchar NOT NULL, "actorType" varchar, "resolved" boolean, "resolvedAt" datetime, "editedAt" datetime, "creatorId" varchar, "resolvedById" varchar, "parentId" varchar)`
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
		await queryRunner.query(`DROP INDEX "IDX_53d72df8d6de8de0b5ba78c366"`);
		await queryRunner.query(`DROP INDEX "IDX_afe39187fb8616dc2e7788d7af"`);
		await queryRunner.query(`DROP TABLE "comment_team"`);
		await queryRunner.query(`DROP INDEX "IDX_6e1fd409e3619b83e19e841935"`);
		await queryRunner.query(`DROP INDEX "IDX_3c3be7039bf788872d073e8735"`);
		await queryRunner.query(`DROP TABLE "comment_employee"`);
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
		await queryRunner.query(`DROP TABLE "comment"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`comment\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`entityId\` varchar(255) NOT NULL, \`comment\` varchar(255) NOT NULL, \`actorType\` varchar(255) NULL, \`resolved\` tinyint NULL, \`resolvedAt\` datetime NULL, \`editedAt\` datetime NULL, \`creatorId\` varchar(255) NULL, \`resolvedById\` varchar(255) NULL, \`parentId\` varchar(255) NULL, INDEX \`IDX_3620aeff4ac5c977176226017e\` (\`isActive\`), INDEX \`IDX_da3cd25ed3a6ce76770f00c3da\` (\`isArchived\`), INDEX \`IDX_8f58834bed39f0f9e85f048eaf\` (\`tenantId\`), INDEX \`IDX_a3422826753d4e6b079dea9834\` (\`organizationId\`), INDEX \`IDX_097e339f6cb990306d19880a4c\` (\`entity\`), INDEX \`IDX_2950cfa146fc50334efa61a70b\` (\`entityId\`), INDEX \`IDX_eecd6e41f9acb6bf59e474d518\` (\`actorType\`), INDEX \`IDX_b6bf60ecb9f6c398e349adff52\` (\`creatorId\`), INDEX \`IDX_c9409c81aa283c1aae70fd5f4c\` (\`resolvedById\`), INDEX \`IDX_e3aebe2bd1c53467a07109be59\` (\`parentId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`comment_employee\` (\`commentId\` varchar(36) NOT NULL, \`employeeId\` varchar(36) NOT NULL, INDEX \`IDX_3c3be7039bf788872d073e8735\` (\`commentId\`), INDEX \`IDX_6e1fd409e3619b83e19e841935\` (\`employeeId\`), PRIMARY KEY (\`commentId\`, \`employeeId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`comment_team\` (\`commentId\` varchar(36) NOT NULL, \`organizationTeamId\` varchar(36) NOT NULL, INDEX \`IDX_afe39187fb8616dc2e7788d7af\` (\`commentId\`), INDEX \`IDX_53d72df8d6de8de0b5ba78c366\` (\`organizationTeamId\`), PRIMARY KEY (\`commentId\`, \`organizationTeamId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_8f58834bed39f0f9e85f048eafe\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_a3422826753d4e6b079dea98342\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_b6bf60ecb9f6c398e349adff52f\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_c9409c81aa283c1aae70fd5f4c3\` FOREIGN KEY (\`resolvedById\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_e3aebe2bd1c53467a07109be596\` FOREIGN KEY (\`parentId\`) REFERENCES \`comment\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment_employee\` ADD CONSTRAINT \`FK_3c3be7039bf788872d073e87351\` FOREIGN KEY (\`commentId\`) REFERENCES \`comment\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment_employee\` ADD CONSTRAINT \`FK_6e1fd409e3619b83e19e8419357\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment_team\` ADD CONSTRAINT \`FK_afe39187fb8616dc2e7788d7aff\` FOREIGN KEY (\`commentId\`) REFERENCES \`comment\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`comment_team\` ADD CONSTRAINT \`FK_53d72df8d6de8de0b5ba78c3669\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`comment_team\` DROP FOREIGN KEY \`FK_53d72df8d6de8de0b5ba78c3669\``);
		await queryRunner.query(`ALTER TABLE \`comment_team\` DROP FOREIGN KEY \`FK_afe39187fb8616dc2e7788d7aff\``);
		await queryRunner.query(`ALTER TABLE \`comment_employee\` DROP FOREIGN KEY \`FK_6e1fd409e3619b83e19e8419357\``);
		await queryRunner.query(`ALTER TABLE \`comment_employee\` DROP FOREIGN KEY \`FK_3c3be7039bf788872d073e87351\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_e3aebe2bd1c53467a07109be596\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_c9409c81aa283c1aae70fd5f4c3\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_b6bf60ecb9f6c398e349adff52f\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_a3422826753d4e6b079dea98342\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_8f58834bed39f0f9e85f048eafe\``);
		await queryRunner.query(`DROP INDEX \`IDX_53d72df8d6de8de0b5ba78c366\` ON \`comment_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_afe39187fb8616dc2e7788d7af\` ON \`comment_team\``);
		await queryRunner.query(`DROP TABLE \`comment_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_6e1fd409e3619b83e19e841935\` ON \`comment_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_3c3be7039bf788872d073e8735\` ON \`comment_employee\``);
		await queryRunner.query(`DROP TABLE \`comment_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_e3aebe2bd1c53467a07109be59\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_c9409c81aa283c1aae70fd5f4c\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_b6bf60ecb9f6c398e349adff52\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_eecd6e41f9acb6bf59e474d518\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_2950cfa146fc50334efa61a70b\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_097e339f6cb990306d19880a4c\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_a3422826753d4e6b079dea9834\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_8f58834bed39f0f9e85f048eaf\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_da3cd25ed3a6ce76770f00c3da\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_3620aeff4ac5c977176226017e\` ON \`comment\``);
		await queryRunner.query(`DROP TABLE \`comment\``);
	}
}
