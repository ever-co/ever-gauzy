import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateIntegrationOrganizationGithubRepositoryTable1697716380119 implements MigrationInterface {

    name = 'CreateIntegrationOrganizationGithubRepositoryTable1697716380119';

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
        await queryRunner.query(`DROP INDEX "public"."IDX_60f6ebb4ab539087ce5f4266ca"`);
        await queryRunner.query(`ALTER TABLE "organization_project" RENAME COLUMN "externalRepositoryId" TO "repositoryId"`);
        await queryRunner.query(`CREATE TABLE "organization_github_repository" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "tenantId" uuid, "organizationId" uuid, "repositoryId" integer NOT NULL, "name" character varying NOT NULL, "fullName" character varying NOT NULL, "owner" character varying NOT NULL, "integrationId" uuid, CONSTRAINT "PK_7aa9f2bb334f439e229b0aadbfa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5e97728cfda96f49cc7f95bbaf" ON "organization_github_repository" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_ef65338e8597b9f56fd0fe3c94" ON "organization_github_repository" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_480158f21938444e4f62fb3185" ON "organization_github_repository" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_69d75a47af6bfcda545a865691" ON "organization_github_repository" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ca0fa80f50baed7287a499dc2c" ON "organization_github_repository" ("repositoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6eea42a69e130bbd14b7ea3659" ON "organization_github_repository" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_a146e202c19f521bf5ec69bb26" ON "organization_github_repository" ("fullName") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e8a77c1d330554fab9230100a" ON "organization_github_repository" ("owner") `);
        await queryRunner.query(`CREATE INDEX "IDX_add7dbec156589dd0b27e2e0c4" ON "organization_github_repository" ("integrationId") `);
        await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "repositoryId"`);
        await queryRunner.query(`ALTER TABLE "organization_project" ADD "repositoryId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_904ae0b765faef6ba2db8b1e69" ON "organization_project" ("repositoryId") `);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" ADD CONSTRAINT "FK_480158f21938444e4f62fb31857" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" ADD CONSTRAINT "FK_69d75a47af6bfcda545a865691b" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" ADD CONSTRAINT "FK_add7dbec156589dd0b27e2e0c49" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_project" ADD CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization_project" DROP CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" DROP CONSTRAINT "FK_add7dbec156589dd0b27e2e0c49"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" DROP CONSTRAINT "FK_69d75a47af6bfcda545a865691b"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" DROP CONSTRAINT "FK_480158f21938444e4f62fb31857"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_904ae0b765faef6ba2db8b1e69"`);
        await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "repositoryId"`);
        await queryRunner.query(`ALTER TABLE "organization_project" ADD "repositoryId" integer`);
        await queryRunner.query(`DROP INDEX "public"."IDX_add7dbec156589dd0b27e2e0c4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e8a77c1d330554fab9230100a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a146e202c19f521bf5ec69bb26"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6eea42a69e130bbd14b7ea3659"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ca0fa80f50baed7287a499dc2c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_69d75a47af6bfcda545a865691"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_480158f21938444e4f62fb3185"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ef65338e8597b9f56fd0fe3c94"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e97728cfda96f49cc7f95bbaf"`);
        await queryRunner.query(`DROP TABLE "organization_github_repository"`);
        await queryRunner.query(`ALTER TABLE "organization_project" RENAME COLUMN "repositoryId" TO "externalRepositoryId"`);
        await queryRunner.query(`CREATE INDEX "IDX_60f6ebb4ab539087ce5f4266ca" ON "organization_project" ("externalRepositoryId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_60f6ebb4ab539087ce5f4266ca"`);
        await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
        await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
        await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
        await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
        await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
        await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
        await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
        await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
        await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
        await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
        await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" integer, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "externalRepositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag" FROM "organization_project"`);
        await queryRunner.query(`DROP TABLE "organization_project"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_project" RENAME TO "organization_project"`);
        await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `);
        await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `);
        await queryRunner.query(`CREATE TABLE "organization_github_repository" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "repositoryId" integer NOT NULL, "name" varchar NOT NULL, "fullName" varchar NOT NULL, "owner" varchar NOT NULL, "integrationId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_5e97728cfda96f49cc7f95bbaf" ON "organization_github_repository" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_ef65338e8597b9f56fd0fe3c94" ON "organization_github_repository" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_480158f21938444e4f62fb3185" ON "organization_github_repository" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_69d75a47af6bfcda545a865691" ON "organization_github_repository" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ca0fa80f50baed7287a499dc2c" ON "organization_github_repository" ("repositoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6eea42a69e130bbd14b7ea3659" ON "organization_github_repository" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_a146e202c19f521bf5ec69bb26" ON "organization_github_repository" ("fullName") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e8a77c1d330554fab9230100a" ON "organization_github_repository" ("owner") `);
        await queryRunner.query(`CREATE INDEX "IDX_add7dbec156589dd0b27e2e0c4" ON "organization_github_repository" ("integrationId") `);
        await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
        await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
        await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
        await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
        await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
        await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
        await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
        await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
        await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
        await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
        await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag" FROM "organization_project"`);
        await queryRunner.query(`DROP TABLE "organization_project"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_project" RENAME TO "organization_project"`);
        await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `);
        await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_904ae0b765faef6ba2db8b1e69" ON "organization_project" ("repositoryId") `);
        await queryRunner.query(`DROP INDEX "IDX_5e97728cfda96f49cc7f95bbaf"`);
        await queryRunner.query(`DROP INDEX "IDX_ef65338e8597b9f56fd0fe3c94"`);
        await queryRunner.query(`DROP INDEX "IDX_480158f21938444e4f62fb3185"`);
        await queryRunner.query(`DROP INDEX "IDX_69d75a47af6bfcda545a865691"`);
        await queryRunner.query(`DROP INDEX "IDX_ca0fa80f50baed7287a499dc2c"`);
        await queryRunner.query(`DROP INDEX "IDX_6eea42a69e130bbd14b7ea3659"`);
        await queryRunner.query(`DROP INDEX "IDX_a146e202c19f521bf5ec69bb26"`);
        await queryRunner.query(`DROP INDEX "IDX_9e8a77c1d330554fab9230100a"`);
        await queryRunner.query(`DROP INDEX "IDX_add7dbec156589dd0b27e2e0c4"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_github_repository" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "repositoryId" integer NOT NULL, "name" varchar NOT NULL, "fullName" varchar NOT NULL, "owner" varchar NOT NULL, "integrationId" varchar, CONSTRAINT "FK_480158f21938444e4f62fb31857" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_69d75a47af6bfcda545a865691b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_add7dbec156589dd0b27e2e0c49" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_github_repository"("id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "repositoryId", "name", "fullName", "owner", "integrationId") SELECT "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "repositoryId", "name", "fullName", "owner", "integrationId" FROM "organization_github_repository"`);
        await queryRunner.query(`DROP TABLE "organization_github_repository"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_github_repository" RENAME TO "organization_github_repository"`);
        await queryRunner.query(`CREATE INDEX "IDX_5e97728cfda96f49cc7f95bbaf" ON "organization_github_repository" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_ef65338e8597b9f56fd0fe3c94" ON "organization_github_repository" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_480158f21938444e4f62fb3185" ON "organization_github_repository" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_69d75a47af6bfcda545a865691" ON "organization_github_repository" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ca0fa80f50baed7287a499dc2c" ON "organization_github_repository" ("repositoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6eea42a69e130bbd14b7ea3659" ON "organization_github_repository" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_a146e202c19f521bf5ec69bb26" ON "organization_github_repository" ("fullName") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e8a77c1d330554fab9230100a" ON "organization_github_repository" ("owner") `);
        await queryRunner.query(`CREATE INDEX "IDX_add7dbec156589dd0b27e2e0c4" ON "organization_github_repository" ("integrationId") `);
        await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
        await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
        await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
        await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
        await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
        await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
        await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
        await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
        await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
        await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
        await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
        await queryRunner.query(`DROP INDEX "IDX_904ae0b765faef6ba2db8b1e69"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag" FROM "organization_project"`);
        await queryRunner.query(`DROP TABLE "organization_project"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_project" RENAME TO "organization_project"`);
        await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `);
        await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_904ae0b765faef6ba2db8b1e69" ON "organization_project" ("repositoryId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_904ae0b765faef6ba2db8b1e69"`);
        await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
        await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
        await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
        await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
        await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
        await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
        await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
        await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
        await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
        await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
        await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
        await queryRunner.query(`ALTER TABLE "organization_project" RENAME TO "temporary_organization_project"`);
        await queryRunner.query(`CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag" FROM "temporary_organization_project"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_project"`);
        await queryRunner.query(`CREATE INDEX "IDX_904ae0b765faef6ba2db8b1e69" ON "organization_project" ("repositoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
        await queryRunner.query(`DROP INDEX "IDX_add7dbec156589dd0b27e2e0c4"`);
        await queryRunner.query(`DROP INDEX "IDX_9e8a77c1d330554fab9230100a"`);
        await queryRunner.query(`DROP INDEX "IDX_a146e202c19f521bf5ec69bb26"`);
        await queryRunner.query(`DROP INDEX "IDX_6eea42a69e130bbd14b7ea3659"`);
        await queryRunner.query(`DROP INDEX "IDX_ca0fa80f50baed7287a499dc2c"`);
        await queryRunner.query(`DROP INDEX "IDX_69d75a47af6bfcda545a865691"`);
        await queryRunner.query(`DROP INDEX "IDX_480158f21938444e4f62fb3185"`);
        await queryRunner.query(`DROP INDEX "IDX_ef65338e8597b9f56fd0fe3c94"`);
        await queryRunner.query(`DROP INDEX "IDX_5e97728cfda96f49cc7f95bbaf"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository" RENAME TO "temporary_organization_github_repository"`);
        await queryRunner.query(`CREATE TABLE "organization_github_repository" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "repositoryId" integer NOT NULL, "name" varchar NOT NULL, "fullName" varchar NOT NULL, "owner" varchar NOT NULL, "integrationId" varchar)`);
        await queryRunner.query(`INSERT INTO "organization_github_repository"("id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "repositoryId", "name", "fullName", "owner", "integrationId") SELECT "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "repositoryId", "name", "fullName", "owner", "integrationId" FROM "temporary_organization_github_repository"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_github_repository"`);
        await queryRunner.query(`CREATE INDEX "IDX_add7dbec156589dd0b27e2e0c4" ON "organization_github_repository" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e8a77c1d330554fab9230100a" ON "organization_github_repository" ("owner") `);
        await queryRunner.query(`CREATE INDEX "IDX_a146e202c19f521bf5ec69bb26" ON "organization_github_repository" ("fullName") `);
        await queryRunner.query(`CREATE INDEX "IDX_6eea42a69e130bbd14b7ea3659" ON "organization_github_repository" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_ca0fa80f50baed7287a499dc2c" ON "organization_github_repository" ("repositoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_69d75a47af6bfcda545a865691" ON "organization_github_repository" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_480158f21938444e4f62fb3185" ON "organization_github_repository" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ef65338e8597b9f56fd0fe3c94" ON "organization_github_repository" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e97728cfda96f49cc7f95bbaf" ON "organization_github_repository" ("isActive") `);
        await queryRunner.query(`DROP INDEX "IDX_904ae0b765faef6ba2db8b1e69"`);
        await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
        await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
        await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
        await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
        await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
        await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
        await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
        await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
        await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
        await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
        await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
        await queryRunner.query(`ALTER TABLE "organization_project" RENAME TO "temporary_organization_project"`);
        await queryRunner.query(`CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" integer, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag" FROM "temporary_organization_project"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_project"`);
        await queryRunner.query(`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
        await queryRunner.query(`DROP INDEX "IDX_add7dbec156589dd0b27e2e0c4"`);
        await queryRunner.query(`DROP INDEX "IDX_9e8a77c1d330554fab9230100a"`);
        await queryRunner.query(`DROP INDEX "IDX_a146e202c19f521bf5ec69bb26"`);
        await queryRunner.query(`DROP INDEX "IDX_6eea42a69e130bbd14b7ea3659"`);
        await queryRunner.query(`DROP INDEX "IDX_ca0fa80f50baed7287a499dc2c"`);
        await queryRunner.query(`DROP INDEX "IDX_69d75a47af6bfcda545a865691"`);
        await queryRunner.query(`DROP INDEX "IDX_480158f21938444e4f62fb3185"`);
        await queryRunner.query(`DROP INDEX "IDX_ef65338e8597b9f56fd0fe3c94"`);
        await queryRunner.query(`DROP INDEX "IDX_5e97728cfda96f49cc7f95bbaf"`);
        await queryRunner.query(`DROP TABLE "organization_github_repository"`);
        await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
        await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
        await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
        await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
        await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
        await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
        await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
        await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
        await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
        await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
        await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
        await queryRunner.query(`ALTER TABLE "organization_project" RENAME TO "temporary_organization_project"`);
        await queryRunner.query(`CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "externalRepositoryId" integer, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "externalRepositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag" FROM "temporary_organization_project"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_project"`);
        await queryRunner.query(`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
        await queryRunner.query(`CREATE INDEX "IDX_60f6ebb4ab539087ce5f4266ca" ON "organization_project" ("externalRepositoryId") `);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> { }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }
}
