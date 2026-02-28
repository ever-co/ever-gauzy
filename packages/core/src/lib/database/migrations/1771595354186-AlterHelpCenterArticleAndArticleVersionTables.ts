import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterHelpCenterArticleAndArticleVersionTables1771595354186 implements MigrationInterface {
    name = 'AlterHelpCenterArticleAndArticleVersionTables1771595354186';

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
		console.log(chalk.yellow(this.name + ' reverting changes!'));

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
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP CONSTRAINT "FK_8e523be638dfca7c9ba15e7b016"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e523be638dfca7c9ba15e7b01"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" RENAME COLUMN "projectId" TO "descriptionBinary"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article_project" ("knowledgeBaseArticleId" uuid NOT NULL, "organizationProjectId" uuid NOT NULL, CONSTRAINT "PK_aac55015b5ae4d3f7374cfdc6c2" PRIMARY KEY ("knowledgeBaseArticleId", "organizationProjectId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aa6b10a42eb64dbd9544e21989" ON "knowledge_base_article_project" ("knowledgeBaseArticleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9761422ccc68966844dca50e15" ON "knowledge_base_article_project" ("organizationProjectId") `);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" ADD "descriptionBinary" bytea`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "descriptionBinary"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "descriptionBinary" bytea`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_project" ADD CONSTRAINT "FK_aa6b10a42eb64dbd9544e21989c" FOREIGN KEY ("knowledgeBaseArticleId") REFERENCES "knowledge_base_article"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_project" ADD CONSTRAINT "FK_9761422ccc68966844dca50e159" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_project" DROP CONSTRAINT "FK_9761422ccc68966844dca50e159"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_project" DROP CONSTRAINT "FK_aa6b10a42eb64dbd9544e21989c"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "descriptionBinary"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "descriptionBinary" uuid`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" DROP COLUMN "descriptionBinary"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9761422ccc68966844dca50e15"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa6b10a42eb64dbd9544e21989"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article_project"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" RENAME COLUMN "descriptionBinary" TO "projectId"`);
        await queryRunner.query(`CREATE INDEX "IDX_8e523be638dfca7c9ba15e7b01" ON "knowledge_base_article" ("projectId") `);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD CONSTRAINT "FK_8e523be638dfca7c9ba15e7b016" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_8e523be638dfca7c9ba15e7b01"`);
        await queryRunner.query(`DROP INDEX "IDX_f5099fa8f6ff510b8c912bc58d"`);
        await queryRunner.query(`DROP INDEX "IDX_f3f05a8d9f0ba8d964da9cd582"`);
        await queryRunner.query(`DROP INDEX "IDX_2de1afe05be78b65ea1d39bdec"`);
        await queryRunner.query(`DROP INDEX "IDX_e9720156c57ff1ad841e95ace7"`);
        await queryRunner.query(`DROP INDEX "IDX_1544c43e36e1ccf7d578c70607"`);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "IDX_b400197b7501bb75fa3a90bfce"`);
        await queryRunner.query(`DROP INDEX "IDX_9f1d98022801381f86f0332de5"`);
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL DEFAULT (0), "privacy" boolean NOT NULL DEFAULT (0), "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "descriptionHtml" text, "descriptionJson" text, "isLocked" boolean NOT NULL DEFAULT (0), "color" varchar, "externalId" varchar, "parentId" varchar, "ownedById" varchar, "projectId" varchar, CONSTRAINT "FK_f5099fa8f6ff510b8c912bc58db" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f3f05a8d9f0ba8d964da9cd582a" FOREIGN KEY ("parentId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId" FROM "knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article"`);
        await queryRunner.query(`ALTER TABLE "temporary_knowledge_base_article" RENAME TO "knowledge_base_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_8e523be638dfca7c9ba15e7b01" ON "knowledge_base_article" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5099fa8f6ff510b8c912bc58d" ON "knowledge_base_article" ("ownedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_f3f05a8d9f0ba8d964da9cd582" ON "knowledge_base_article" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2de1afe05be78b65ea1d39bdec" ON "knowledge_base_article" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9720156c57ff1ad841e95ace7" ON "knowledge_base_article" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1544c43e36e1ccf7d578c70607" ON "knowledge_base_article" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b400197b7501bb75fa3a90bfce" ON "knowledge_base_article" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f1d98022801381f86f0332de5" ON "knowledge_base_article" ("deletedByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_8e523be638dfca7c9ba15e7b01"`);
        await queryRunner.query(`DROP INDEX "IDX_f5099fa8f6ff510b8c912bc58d"`);
        await queryRunner.query(`DROP INDEX "IDX_f3f05a8d9f0ba8d964da9cd582"`);
        await queryRunner.query(`DROP INDEX "IDX_2de1afe05be78b65ea1d39bdec"`);
        await queryRunner.query(`DROP INDEX "IDX_e9720156c57ff1ad841e95ace7"`);
        await queryRunner.query(`DROP INDEX "IDX_1544c43e36e1ccf7d578c70607"`);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "IDX_b400197b7501bb75fa3a90bfce"`);
        await queryRunner.query(`DROP INDEX "IDX_9f1d98022801381f86f0332de5"`);
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL DEFAULT (0), "privacy" boolean NOT NULL DEFAULT (0), "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "descriptionHtml" text, "descriptionJson" text, "isLocked" boolean NOT NULL DEFAULT (0), "color" varchar, "externalId" varchar, "parentId" varchar, "ownedById" varchar, "descriptionBinary" varchar, CONSTRAINT "FK_f5099fa8f6ff510b8c912bc58db" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f3f05a8d9f0ba8d964da9cd582a" FOREIGN KEY ("parentId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "descriptionBinary") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId" FROM "knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article"`);
        await queryRunner.query(`ALTER TABLE "temporary_knowledge_base_article" RENAME TO "knowledge_base_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_f5099fa8f6ff510b8c912bc58d" ON "knowledge_base_article" ("ownedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_f3f05a8d9f0ba8d964da9cd582" ON "knowledge_base_article" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2de1afe05be78b65ea1d39bdec" ON "knowledge_base_article" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9720156c57ff1ad841e95ace7" ON "knowledge_base_article" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1544c43e36e1ccf7d578c70607" ON "knowledge_base_article" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b400197b7501bb75fa3a90bfce" ON "knowledge_base_article" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f1d98022801381f86f0332de5" ON "knowledge_base_article" ("deletedByUserId") `);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article_project" ("knowledgeBaseArticleId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, PRIMARY KEY ("knowledgeBaseArticleId", "organizationProjectId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aa6b10a42eb64dbd9544e21989" ON "knowledge_base_article_project" ("knowledgeBaseArticleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9761422ccc68966844dca50e15" ON "knowledge_base_article_project" ("organizationProjectId") `);
        await queryRunner.query(`DROP INDEX "IDX_352f7641b71c9ef4fc5ff43a13"`);
        await queryRunner.query(`DROP INDEX "IDX_8988192a829df38557fad2e391"`);
        await queryRunner.query(`DROP INDEX "IDX_5f735ae4212db03913d45c9691"`);
        await queryRunner.query(`DROP INDEX "IDX_8e88da91c9a83d28665f2ac06b"`);
        await queryRunner.query(`DROP INDEX "IDX_a8520a586d162304e2b555c403"`);
        await queryRunner.query(`DROP INDEX "IDX_10550080f54a06e28d5eccc6ed"`);
        await queryRunner.query(`DROP INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799"`);
        await queryRunner.query(`DROP INDEX "IDX_d6f7f270eff562bc028b3785a0"`);
        await queryRunner.query(`DROP INDEX "IDX_7c3505837e5137fda591a8f052"`);
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base_article_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "descriptionHtml" text, "descriptionJson" text, "lastSavedAt" datetime NOT NULL, "articleId" varchar NOT NULL, "ownedById" varchar, "descriptionBinary" blob, CONSTRAINT "FK_352f7641b71c9ef4fc5ff43a13f" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8988192a829df38557fad2e3914" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5f735ae4212db03913d45c96918" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_10550080f54a06e28d5eccc6ed7" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f9ba7e2d3c6f5aff0ed3f327997" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d6f7f270eff562bc028b3785a0f" FOREIGN KEY ("articleId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7c3505837e5137fda591a8f0523" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_knowledge_base_article_version"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "descriptionHtml", "descriptionJson", "lastSavedAt", "articleId", "ownedById") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "descriptionHtml", "descriptionJson", "lastSavedAt", "articleId", "ownedById" FROM "knowledge_base_article_version"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article_version"`);
        await queryRunner.query(`ALTER TABLE "temporary_knowledge_base_article_version" RENAME TO "knowledge_base_article_version"`);
        await queryRunner.query(`CREATE INDEX "IDX_352f7641b71c9ef4fc5ff43a13" ON "knowledge_base_article_version" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8988192a829df38557fad2e391" ON "knowledge_base_article_version" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f735ae4212db03913d45c9691" ON "knowledge_base_article_version" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e88da91c9a83d28665f2ac06b" ON "knowledge_base_article_version" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_a8520a586d162304e2b555c403" ON "knowledge_base_article_version" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_10550080f54a06e28d5eccc6ed" ON "knowledge_base_article_version" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799" ON "knowledge_base_article_version" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d6f7f270eff562bc028b3785a0" ON "knowledge_base_article_version" ("articleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c3505837e5137fda591a8f052" ON "knowledge_base_article_version" ("ownedById") `);
        await queryRunner.query(`DROP INDEX "IDX_f5099fa8f6ff510b8c912bc58d"`);
        await queryRunner.query(`DROP INDEX "IDX_f3f05a8d9f0ba8d964da9cd582"`);
        await queryRunner.query(`DROP INDEX "IDX_2de1afe05be78b65ea1d39bdec"`);
        await queryRunner.query(`DROP INDEX "IDX_e9720156c57ff1ad841e95ace7"`);
        await queryRunner.query(`DROP INDEX "IDX_1544c43e36e1ccf7d578c70607"`);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "IDX_b400197b7501bb75fa3a90bfce"`);
        await queryRunner.query(`DROP INDEX "IDX_9f1d98022801381f86f0332de5"`);
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL DEFAULT (0), "privacy" boolean NOT NULL DEFAULT (0), "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "descriptionHtml" text, "descriptionJson" text, "isLocked" boolean NOT NULL DEFAULT (0), "color" varchar, "externalId" varchar, "parentId" varchar, "ownedById" varchar, "descriptionBinary" blob, CONSTRAINT "FK_f5099fa8f6ff510b8c912bc58db" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f3f05a8d9f0ba8d964da9cd582a" FOREIGN KEY ("parentId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "descriptionBinary") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "descriptionBinary" FROM "knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article"`);
        await queryRunner.query(`ALTER TABLE "temporary_knowledge_base_article" RENAME TO "knowledge_base_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_f5099fa8f6ff510b8c912bc58d" ON "knowledge_base_article" ("ownedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_f3f05a8d9f0ba8d964da9cd582" ON "knowledge_base_article" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2de1afe05be78b65ea1d39bdec" ON "knowledge_base_article" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9720156c57ff1ad841e95ace7" ON "knowledge_base_article" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1544c43e36e1ccf7d578c70607" ON "knowledge_base_article" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b400197b7501bb75fa3a90bfce" ON "knowledge_base_article" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f1d98022801381f86f0332de5" ON "knowledge_base_article" ("deletedByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_aa6b10a42eb64dbd9544e21989"`);
        await queryRunner.query(`DROP INDEX "IDX_9761422ccc68966844dca50e15"`);
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base_article_project" ("knowledgeBaseArticleId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, CONSTRAINT "FK_aa6b10a42eb64dbd9544e21989c" FOREIGN KEY ("knowledgeBaseArticleId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_9761422ccc68966844dca50e159" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("knowledgeBaseArticleId", "organizationProjectId"))`);
        await queryRunner.query(`INSERT INTO "temporary_knowledge_base_article_project"("knowledgeBaseArticleId", "organizationProjectId") SELECT "knowledgeBaseArticleId", "organizationProjectId" FROM "knowledge_base_article_project"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article_project"`);
        await queryRunner.query(`ALTER TABLE "temporary_knowledge_base_article_project" RENAME TO "knowledge_base_article_project"`);
        await queryRunner.query(`CREATE INDEX "IDX_aa6b10a42eb64dbd9544e21989" ON "knowledge_base_article_project" ("knowledgeBaseArticleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9761422ccc68966844dca50e15" ON "knowledge_base_article_project" ("organizationProjectId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_9761422ccc68966844dca50e15"`);
        await queryRunner.query(`DROP INDEX "IDX_aa6b10a42eb64dbd9544e21989"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_project" RENAME TO "temporary_knowledge_base_article_project"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article_project" ("knowledgeBaseArticleId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, PRIMARY KEY ("knowledgeBaseArticleId", "organizationProjectId"))`);
        await queryRunner.query(`INSERT INTO "knowledge_base_article_project"("knowledgeBaseArticleId", "organizationProjectId") SELECT "knowledgeBaseArticleId", "organizationProjectId" FROM "temporary_knowledge_base_article_project"`);
        await queryRunner.query(`DROP TABLE "temporary_knowledge_base_article_project"`);
        await queryRunner.query(`CREATE INDEX "IDX_9761422ccc68966844dca50e15" ON "knowledge_base_article_project" ("organizationProjectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aa6b10a42eb64dbd9544e21989" ON "knowledge_base_article_project" ("knowledgeBaseArticleId") `);
        await queryRunner.query(`DROP INDEX "IDX_9f1d98022801381f86f0332de5"`);
        await queryRunner.query(`DROP INDEX "IDX_b400197b7501bb75fa3a90bfce"`);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP INDEX "IDX_1544c43e36e1ccf7d578c70607"`);
        await queryRunner.query(`DROP INDEX "IDX_e9720156c57ff1ad841e95ace7"`);
        await queryRunner.query(`DROP INDEX "IDX_2de1afe05be78b65ea1d39bdec"`);
        await queryRunner.query(`DROP INDEX "IDX_f3f05a8d9f0ba8d964da9cd582"`);
        await queryRunner.query(`DROP INDEX "IDX_f5099fa8f6ff510b8c912bc58d"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" RENAME TO "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL DEFAULT (0), "privacy" boolean NOT NULL DEFAULT (0), "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "descriptionHtml" text, "descriptionJson" text, "isLocked" boolean NOT NULL DEFAULT (0), "color" varchar, "externalId" varchar, "parentId" varchar, "ownedById" varchar, "descriptionBinary" varchar, CONSTRAINT "FK_f5099fa8f6ff510b8c912bc58db" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f3f05a8d9f0ba8d964da9cd582a" FOREIGN KEY ("parentId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "descriptionBinary") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "descriptionBinary" FROM "temporary_knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_9f1d98022801381f86f0332de5" ON "knowledge_base_article" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b400197b7501bb75fa3a90bfce" ON "knowledge_base_article" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1544c43e36e1ccf7d578c70607" ON "knowledge_base_article" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9720156c57ff1ad841e95ace7" ON "knowledge_base_article" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_2de1afe05be78b65ea1d39bdec" ON "knowledge_base_article" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f3f05a8d9f0ba8d964da9cd582" ON "knowledge_base_article" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5099fa8f6ff510b8c912bc58d" ON "knowledge_base_article" ("ownedById") `);
        await queryRunner.query(`DROP INDEX "IDX_7c3505837e5137fda591a8f052"`);
        await queryRunner.query(`DROP INDEX "IDX_d6f7f270eff562bc028b3785a0"`);
        await queryRunner.query(`DROP INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799"`);
        await queryRunner.query(`DROP INDEX "IDX_10550080f54a06e28d5eccc6ed"`);
        await queryRunner.query(`DROP INDEX "IDX_a8520a586d162304e2b555c403"`);
        await queryRunner.query(`DROP INDEX "IDX_8e88da91c9a83d28665f2ac06b"`);
        await queryRunner.query(`DROP INDEX "IDX_5f735ae4212db03913d45c9691"`);
        await queryRunner.query(`DROP INDEX "IDX_8988192a829df38557fad2e391"`);
        await queryRunner.query(`DROP INDEX "IDX_352f7641b71c9ef4fc5ff43a13"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" RENAME TO "temporary_knowledge_base_article_version"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "descriptionHtml" text, "descriptionJson" text, "lastSavedAt" datetime NOT NULL, "articleId" varchar NOT NULL, "ownedById" varchar, CONSTRAINT "FK_352f7641b71c9ef4fc5ff43a13f" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8988192a829df38557fad2e3914" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5f735ae4212db03913d45c96918" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_10550080f54a06e28d5eccc6ed7" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f9ba7e2d3c6f5aff0ed3f327997" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d6f7f270eff562bc028b3785a0f" FOREIGN KEY ("articleId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7c3505837e5137fda591a8f0523" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "knowledge_base_article_version"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "descriptionHtml", "descriptionJson", "lastSavedAt", "articleId", "ownedById") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "descriptionHtml", "descriptionJson", "lastSavedAt", "articleId", "ownedById" FROM "temporary_knowledge_base_article_version"`);
        await queryRunner.query(`DROP TABLE "temporary_knowledge_base_article_version"`);
        await queryRunner.query(`CREATE INDEX "IDX_7c3505837e5137fda591a8f052" ON "knowledge_base_article_version" ("ownedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_d6f7f270eff562bc028b3785a0" ON "knowledge_base_article_version" ("articleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799" ON "knowledge_base_article_version" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_10550080f54a06e28d5eccc6ed" ON "knowledge_base_article_version" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a8520a586d162304e2b555c403" ON "knowledge_base_article_version" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e88da91c9a83d28665f2ac06b" ON "knowledge_base_article_version" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f735ae4212db03913d45c9691" ON "knowledge_base_article_version" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8988192a829df38557fad2e391" ON "knowledge_base_article_version" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_352f7641b71c9ef4fc5ff43a13" ON "knowledge_base_article_version" ("createdByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_9761422ccc68966844dca50e15"`);
        await queryRunner.query(`DROP INDEX "IDX_aa6b10a42eb64dbd9544e21989"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article_project"`);
        await queryRunner.query(`DROP INDEX "IDX_9f1d98022801381f86f0332de5"`);
        await queryRunner.query(`DROP INDEX "IDX_b400197b7501bb75fa3a90bfce"`);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP INDEX "IDX_1544c43e36e1ccf7d578c70607"`);
        await queryRunner.query(`DROP INDEX "IDX_e9720156c57ff1ad841e95ace7"`);
        await queryRunner.query(`DROP INDEX "IDX_2de1afe05be78b65ea1d39bdec"`);
        await queryRunner.query(`DROP INDEX "IDX_f3f05a8d9f0ba8d964da9cd582"`);
        await queryRunner.query(`DROP INDEX "IDX_f5099fa8f6ff510b8c912bc58d"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" RENAME TO "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL DEFAULT (0), "privacy" boolean NOT NULL DEFAULT (0), "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "descriptionHtml" text, "descriptionJson" text, "isLocked" boolean NOT NULL DEFAULT (0), "color" varchar, "externalId" varchar, "parentId" varchar, "ownedById" varchar, "projectId" varchar, CONSTRAINT "FK_f5099fa8f6ff510b8c912bc58db" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f3f05a8d9f0ba8d964da9cd582a" FOREIGN KEY ("parentId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "descriptionBinary" FROM "temporary_knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_9f1d98022801381f86f0332de5" ON "knowledge_base_article" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b400197b7501bb75fa3a90bfce" ON "knowledge_base_article" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1544c43e36e1ccf7d578c70607" ON "knowledge_base_article" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9720156c57ff1ad841e95ace7" ON "knowledge_base_article" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_2de1afe05be78b65ea1d39bdec" ON "knowledge_base_article" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f3f05a8d9f0ba8d964da9cd582" ON "knowledge_base_article" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5099fa8f6ff510b8c912bc58d" ON "knowledge_base_article" ("ownedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e523be638dfca7c9ba15e7b01" ON "knowledge_base_article" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_9f1d98022801381f86f0332de5"`);
        await queryRunner.query(`DROP INDEX "IDX_b400197b7501bb75fa3a90bfce"`);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP INDEX "IDX_1544c43e36e1ccf7d578c70607"`);
        await queryRunner.query(`DROP INDEX "IDX_e9720156c57ff1ad841e95ace7"`);
        await queryRunner.query(`DROP INDEX "IDX_2de1afe05be78b65ea1d39bdec"`);
        await queryRunner.query(`DROP INDEX "IDX_f3f05a8d9f0ba8d964da9cd582"`);
        await queryRunner.query(`DROP INDEX "IDX_f5099fa8f6ff510b8c912bc58d"`);
        await queryRunner.query(`DROP INDEX "IDX_8e523be638dfca7c9ba15e7b01"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" RENAME TO "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL DEFAULT (0), "privacy" boolean NOT NULL DEFAULT (0), "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "descriptionHtml" text, "descriptionJson" text, "isLocked" boolean NOT NULL DEFAULT (0), "color" varchar, "externalId" varchar, "parentId" varchar, "ownedById" varchar, "projectId" varchar, CONSTRAINT "FK_8e523be638dfca7c9ba15e7b016" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f5099fa8f6ff510b8c912bc58db" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f3f05a8d9f0ba8d964da9cd582a" FOREIGN KEY ("parentId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId" FROM "temporary_knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_9f1d98022801381f86f0332de5" ON "knowledge_base_article" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b400197b7501bb75fa3a90bfce" ON "knowledge_base_article" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1544c43e36e1ccf7d578c70607" ON "knowledge_base_article" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9720156c57ff1ad841e95ace7" ON "knowledge_base_article" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_2de1afe05be78b65ea1d39bdec" ON "knowledge_base_article" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f3f05a8d9f0ba8d964da9cd582" ON "knowledge_base_article" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5099fa8f6ff510b8c912bc58d" ON "knowledge_base_article" ("ownedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e523be638dfca7c9ba15e7b01" ON "knowledge_base_article" ("projectId") `);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP FOREIGN KEY \`FK_8e523be638dfca7c9ba15e7b016\``);
        await queryRunner.query(`DROP INDEX \`IDX_8e523be638dfca7c9ba15e7b01\` ON \`knowledge_base_article\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` CHANGE \`projectId\` \`descriptionBinary\` varchar(255) NULL`);
        await queryRunner.query(`CREATE TABLE \`knowledge_base_article_project\` (\`knowledgeBaseArticleId\` varchar(36) NOT NULL, \`organizationProjectId\` varchar(36) NOT NULL, INDEX \`IDX_aa6b10a42eb64dbd9544e21989\` (\`knowledgeBaseArticleId\`), INDEX \`IDX_9761422ccc68966844dca50e15\` (\`organizationProjectId\`), PRIMARY KEY (\`knowledgeBaseArticleId\`, \`organizationProjectId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` ADD \`descriptionBinary\` longblob NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP COLUMN \`descriptionBinary\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD \`descriptionBinary\` longblob NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_project\` ADD CONSTRAINT \`FK_aa6b10a42eb64dbd9544e21989c\` FOREIGN KEY (\`knowledgeBaseArticleId\`) REFERENCES \`knowledge_base_article\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_project\` ADD CONSTRAINT \`FK_9761422ccc68966844dca50e159\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_project\` DROP FOREIGN KEY \`FK_9761422ccc68966844dca50e159\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_project\` DROP FOREIGN KEY \`FK_aa6b10a42eb64dbd9544e21989c\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP COLUMN \`descriptionBinary\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD \`descriptionBinary\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` DROP COLUMN \`descriptionBinary\``);
        await queryRunner.query(`DROP INDEX \`IDX_9761422ccc68966844dca50e15\` ON \`knowledge_base_article_project\``);
        await queryRunner.query(`DROP INDEX \`IDX_aa6b10a42eb64dbd9544e21989\` ON \`knowledge_base_article_project\``);
        await queryRunner.query(`DROP TABLE \`knowledge_base_article_project\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` CHANGE \`descriptionBinary\` \`projectId\` varchar(255) NULL`);
        await queryRunner.query(`CREATE INDEX \`IDX_8e523be638dfca7c9ba15e7b01\` ON \`knowledge_base_article\` (\`projectId\`)`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD CONSTRAINT \`FK_8e523be638dfca7c9ba15e7b016\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
}
