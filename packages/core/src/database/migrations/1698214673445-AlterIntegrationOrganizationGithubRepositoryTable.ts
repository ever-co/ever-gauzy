
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterIntegrationOrganizationGithubRepositoryTable1698214673445 implements MigrationInterface {

    name = 'AlterIntegrationOrganizationGithubRepositoryTable1698214673445';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
            await this.sqliteUpQueryRunner(queryRunner);
        } else {
            await this.postgresUpQueryRunner(queryRunner);
        }
    }

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> {
        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
            await this.sqliteDownQueryRunner(queryRunner);
        } else {
            await this.postgresDownQueryRunner(queryRunner);
        }
    }

    /**
    * PostgresDB Up Migration
    *
    * @param queryRunner
    */
    public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization_github_repository" ADD "issuesCount" integer`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" ADD "hasSyncEnabled" boolean DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" ADD "private" boolean DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" ADD "status" character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_04717f25bea7d9cef0d51cac50" ON "organization_github_repository" ("issuesCount") `);
        await queryRunner.query(`CREATE INDEX "IDX_34c48d11eb82ef42e89370bdc7" ON "organization_github_repository" ("hasSyncEnabled") `);
        await queryRunner.query(`CREATE INDEX "IDX_2eec784cadcb7847b64937fb58" ON "organization_github_repository" ("private") `);
        await queryRunner.query(`CREATE INDEX "IDX_59407d03d189560ac1a0a4b0eb" ON "organization_github_repository" ("status") `);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."IDX_59407d03d189560ac1a0a4b0eb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2eec784cadcb7847b64937fb58"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_34c48d11eb82ef42e89370bdc7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_04717f25bea7d9cef0d51cac50"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" DROP COLUMN "private"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" DROP COLUMN "hasSyncEnabled"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" DROP COLUMN "issuesCount"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_add7dbec156589dd0b27e2e0c4"`);
        await queryRunner.query(`DROP INDEX "IDX_9e8a77c1d330554fab9230100a"`);
        await queryRunner.query(`DROP INDEX "IDX_a146e202c19f521bf5ec69bb26"`);
        await queryRunner.query(`DROP INDEX "IDX_6eea42a69e130bbd14b7ea3659"`);
        await queryRunner.query(`DROP INDEX "IDX_ca0fa80f50baed7287a499dc2c"`);
        await queryRunner.query(`DROP INDEX "IDX_69d75a47af6bfcda545a865691"`);
        await queryRunner.query(`DROP INDEX "IDX_480158f21938444e4f62fb3185"`);
        await queryRunner.query(`DROP INDEX "IDX_ef65338e8597b9f56fd0fe3c94"`);
        await queryRunner.query(`DROP INDEX "IDX_5e97728cfda96f49cc7f95bbaf"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_github_repository" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "repositoryId" integer NOT NULL, "name" varchar NOT NULL, "fullName" varchar NOT NULL, "owner" varchar NOT NULL, "integrationId" varchar, "issuesCount" integer, "hasSyncEnabled" boolean DEFAULT (0), "private" boolean DEFAULT (0), "status" varchar, CONSTRAINT "FK_add7dbec156589dd0b27e2e0c49" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_69d75a47af6bfcda545a865691b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_480158f21938444e4f62fb31857" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_github_repository"("id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "repositoryId", "name", "fullName", "owner", "integrationId") SELECT "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "repositoryId", "name", "fullName", "owner", "integrationId" FROM "organization_github_repository"`);
        await queryRunner.query(`DROP TABLE "organization_github_repository"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_github_repository" RENAME TO "organization_github_repository"`);
        await queryRunner.query(`CREATE INDEX "IDX_add7dbec156589dd0b27e2e0c4" ON "organization_github_repository" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e8a77c1d330554fab9230100a" ON "organization_github_repository" ("owner") `);
        await queryRunner.query(`CREATE INDEX "IDX_a146e202c19f521bf5ec69bb26" ON "organization_github_repository" ("fullName") `);
        await queryRunner.query(`CREATE INDEX "IDX_6eea42a69e130bbd14b7ea3659" ON "organization_github_repository" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_ca0fa80f50baed7287a499dc2c" ON "organization_github_repository" ("repositoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_69d75a47af6bfcda545a865691" ON "organization_github_repository" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_480158f21938444e4f62fb3185" ON "organization_github_repository" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ef65338e8597b9f56fd0fe3c94" ON "organization_github_repository" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e97728cfda96f49cc7f95bbaf" ON "organization_github_repository" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_04717f25bea7d9cef0d51cac50" ON "organization_github_repository" ("issuesCount") `);
        await queryRunner.query(`CREATE INDEX "IDX_34c48d11eb82ef42e89370bdc7" ON "organization_github_repository" ("hasSyncEnabled") `);
        await queryRunner.query(`CREATE INDEX "IDX_2eec784cadcb7847b64937fb58" ON "organization_github_repository" ("private") `);
        await queryRunner.query(`CREATE INDEX "IDX_59407d03d189560ac1a0a4b0eb" ON "organization_github_repository" ("status") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_59407d03d189560ac1a0a4b0eb"`);
        await queryRunner.query(`DROP INDEX "IDX_2eec784cadcb7847b64937fb58"`);
        await queryRunner.query(`DROP INDEX "IDX_34c48d11eb82ef42e89370bdc7"`);
        await queryRunner.query(`DROP INDEX "IDX_04717f25bea7d9cef0d51cac50"`);
        await queryRunner.query(`DROP INDEX "IDX_5e97728cfda96f49cc7f95bbaf"`);
        await queryRunner.query(`DROP INDEX "IDX_ef65338e8597b9f56fd0fe3c94"`);
        await queryRunner.query(`DROP INDEX "IDX_480158f21938444e4f62fb3185"`);
        await queryRunner.query(`DROP INDEX "IDX_69d75a47af6bfcda545a865691"`);
        await queryRunner.query(`DROP INDEX "IDX_ca0fa80f50baed7287a499dc2c"`);
        await queryRunner.query(`DROP INDEX "IDX_6eea42a69e130bbd14b7ea3659"`);
        await queryRunner.query(`DROP INDEX "IDX_a146e202c19f521bf5ec69bb26"`);
        await queryRunner.query(`DROP INDEX "IDX_9e8a77c1d330554fab9230100a"`);
        await queryRunner.query(`DROP INDEX "IDX_add7dbec156589dd0b27e2e0c4"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" RENAME TO "temporary_organization_github_repository"`);
        await queryRunner.query(`CREATE TABLE "organization_github_repository" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "repositoryId" integer NOT NULL, "name" varchar NOT NULL, "fullName" varchar NOT NULL, "owner" varchar NOT NULL, "integrationId" varchar, CONSTRAINT "FK_add7dbec156589dd0b27e2e0c49" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_69d75a47af6bfcda545a865691b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_480158f21938444e4f62fb31857" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization_github_repository"("id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "repositoryId", "name", "fullName", "owner", "integrationId") SELECT "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "repositoryId", "name", "fullName", "owner", "integrationId" FROM "temporary_organization_github_repository"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_github_repository"`);
        await queryRunner.query(`CREATE INDEX "IDX_5e97728cfda96f49cc7f95bbaf" ON "organization_github_repository" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_ef65338e8597b9f56fd0fe3c94" ON "organization_github_repository" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_480158f21938444e4f62fb3185" ON "organization_github_repository" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_69d75a47af6bfcda545a865691" ON "organization_github_repository" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ca0fa80f50baed7287a499dc2c" ON "organization_github_repository" ("repositoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6eea42a69e130bbd14b7ea3659" ON "organization_github_repository" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_a146e202c19f521bf5ec69bb26" ON "organization_github_repository" ("fullName") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e8a77c1d330554fab9230100a" ON "organization_github_repository" ("owner") `);
        await queryRunner.query(`CREATE INDEX "IDX_add7dbec156589dd0b27e2e0c4" ON "organization_github_repository" ("integrationId") `);
    }
}
