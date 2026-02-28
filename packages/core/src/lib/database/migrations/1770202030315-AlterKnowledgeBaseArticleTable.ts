import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterKnowledgeBaseArticleTable1770202030315 implements MigrationInterface {
    name = 'AlterKnowledgeBaseArticleTable1770202030315';

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
        await queryRunner.query(`CREATE TABLE "tag_help_center_article" ("knowledgeBaseArticleId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_28213ff2d493e16613c8ca7b1e9" PRIMARY KEY ("knowledgeBaseArticleId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_47e686041c8087564cc5d57423" ON "tag_help_center_article" ("knowledgeBaseArticleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aa0fcfd3de83ecd3548e376518" ON "tag_help_center_article" ("tagId") `);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "descriptionHtml" text`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "descriptionJson" jsonb`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "isLocked" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "color" character varying`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "externalId" character varying`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "parentId" uuid`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "ownedById" uuid`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "projectId" uuid`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ALTER COLUMN "draft" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ALTER COLUMN "privacy" SET DEFAULT false`);
        await queryRunner.query(`CREATE INDEX "IDX_f3f05a8d9f0ba8d964da9cd582" ON "knowledge_base_article" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5099fa8f6ff510b8c912bc58d" ON "knowledge_base_article" ("ownedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e523be638dfca7c9ba15e7b01" ON "knowledge_base_article" ("projectId") `);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD CONSTRAINT "FK_f3f05a8d9f0ba8d964da9cd582a" FOREIGN KEY ("parentId") REFERENCES "knowledge_base_article"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD CONSTRAINT "FK_f5099fa8f6ff510b8c912bc58db" FOREIGN KEY ("ownedById") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD CONSTRAINT "FK_8e523be638dfca7c9ba15e7b016" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tag_help_center_article" ADD CONSTRAINT "FK_47e686041c8087564cc5d57423e" FOREIGN KEY ("knowledgeBaseArticleId") REFERENCES "knowledge_base_article"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "tag_help_center_article" ADD CONSTRAINT "FK_aa0fcfd3de83ecd3548e3765188" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "tag_help_center_article" DROP CONSTRAINT "FK_aa0fcfd3de83ecd3548e3765188"`);
        await queryRunner.query(`ALTER TABLE "tag_help_center_article" DROP CONSTRAINT "FK_47e686041c8087564cc5d57423e"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP CONSTRAINT "FK_8e523be638dfca7c9ba15e7b016"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP CONSTRAINT "FK_f5099fa8f6ff510b8c912bc58db"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP CONSTRAINT "FK_f3f05a8d9f0ba8d964da9cd582a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e523be638dfca7c9ba15e7b01"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f5099fa8f6ff510b8c912bc58d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f3f05a8d9f0ba8d964da9cd582"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ALTER COLUMN "privacy" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ALTER COLUMN "draft" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "projectId"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "ownedById"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "parentId"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "externalId"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "color"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "isLocked"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "descriptionJson"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "descriptionHtml"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa0fcfd3de83ecd3548e376518"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_47e686041c8087564cc5d57423"`);
        await queryRunner.query(`DROP TABLE "tag_help_center_article"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "tag_help_center_article" ("knowledgeBaseArticleId" varchar NOT NULL, "tagId" varchar NOT NULL, PRIMARY KEY ("knowledgeBaseArticleId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_47e686041c8087564cc5d57423" ON "tag_help_center_article" ("knowledgeBaseArticleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aa0fcfd3de83ecd3548e376518" ON "tag_help_center_article" ("tagId") `);
        await queryRunner.query(`DROP INDEX "IDX_9f1d98022801381f86f0332de5"`);
        await queryRunner.query(`DROP INDEX "IDX_b400197b7501bb75fa3a90bfce"`);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP INDEX "IDX_1544c43e36e1ccf7d578c70607"`);
        await queryRunner.query(`DROP INDEX "IDX_e9720156c57ff1ad841e95ace7"`);
        await queryRunner.query(`DROP INDEX "IDX_2de1afe05be78b65ea1d39bdec"`);
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL, "privacy" boolean NOT NULL, "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "descriptionHtml" text, "descriptionJson" text, "isLocked" boolean NOT NULL DEFAULT (0), "color" varchar, "externalId" varchar, "parentId" varchar, "ownedById" varchar, "projectId" varchar, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article"`);
        await queryRunner.query(`ALTER TABLE "temporary_knowledge_base_article" RENAME TO "knowledge_base_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_9f1d98022801381f86f0332de5" ON "knowledge_base_article" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b400197b7501bb75fa3a90bfce" ON "knowledge_base_article" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1544c43e36e1ccf7d578c70607" ON "knowledge_base_article" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9720156c57ff1ad841e95ace7" ON "knowledge_base_article" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_2de1afe05be78b65ea1d39bdec" ON "knowledge_base_article" ("updatedByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_9f1d98022801381f86f0332de5"`);
        await queryRunner.query(`DROP INDEX "IDX_b400197b7501bb75fa3a90bfce"`);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP INDEX "IDX_1544c43e36e1ccf7d578c70607"`);
        await queryRunner.query(`DROP INDEX "IDX_e9720156c57ff1ad841e95ace7"`);
        await queryRunner.query(`DROP INDEX "IDX_2de1afe05be78b65ea1d39bdec"`);
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL DEFAULT (0), "privacy" boolean NOT NULL DEFAULT (0), "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "descriptionHtml" text, "descriptionJson" text, "isLocked" boolean NOT NULL DEFAULT (0), "color" varchar, "externalId" varchar, "parentId" varchar, "ownedById" varchar, "projectId" varchar, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId" FROM "knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article"`);
        await queryRunner.query(`ALTER TABLE "temporary_knowledge_base_article" RENAME TO "knowledge_base_article"`);
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
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL DEFAULT (0), "privacy" boolean NOT NULL DEFAULT (0), "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "descriptionHtml" text, "descriptionJson" text, "isLocked" boolean NOT NULL DEFAULT (0), "color" varchar, "externalId" varchar, "parentId" varchar, "ownedById" varchar, "projectId" varchar, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f3f05a8d9f0ba8d964da9cd582a" FOREIGN KEY ("parentId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f5099fa8f6ff510b8c912bc58db" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8e523be638dfca7c9ba15e7b016" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId" FROM "knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article"`);
        await queryRunner.query(`ALTER TABLE "temporary_knowledge_base_article" RENAME TO "knowledge_base_article"`);
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
        await queryRunner.query(`DROP INDEX "IDX_47e686041c8087564cc5d57423"`);
        await queryRunner.query(`DROP INDEX "IDX_aa0fcfd3de83ecd3548e376518"`);
        await queryRunner.query(`CREATE TABLE "temporary_tag_help_center_article" ("knowledgeBaseArticleId" varchar NOT NULL, "tagId" varchar NOT NULL, CONSTRAINT "FK_47e686041c8087564cc5d57423e" FOREIGN KEY ("knowledgeBaseArticleId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_aa0fcfd3de83ecd3548e3765188" FOREIGN KEY ("tagId") REFERENCES "tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("knowledgeBaseArticleId", "tagId"))`);
        await queryRunner.query(`INSERT INTO "temporary_tag_help_center_article"("knowledgeBaseArticleId", "tagId") SELECT "knowledgeBaseArticleId", "tagId" FROM "tag_help_center_article"`);
        await queryRunner.query(`DROP TABLE "tag_help_center_article"`);
        await queryRunner.query(`ALTER TABLE "temporary_tag_help_center_article" RENAME TO "tag_help_center_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_47e686041c8087564cc5d57423" ON "tag_help_center_article" ("knowledgeBaseArticleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aa0fcfd3de83ecd3548e376518" ON "tag_help_center_article" ("tagId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_aa0fcfd3de83ecd3548e376518"`);
        await queryRunner.query(`DROP INDEX "IDX_47e686041c8087564cc5d57423"`);
        await queryRunner.query(`ALTER TABLE "tag_help_center_article" RENAME TO "temporary_tag_help_center_article"`);
        await queryRunner.query(`CREATE TABLE "tag_help_center_article" ("knowledgeBaseArticleId" varchar NOT NULL, "tagId" varchar NOT NULL, PRIMARY KEY ("knowledgeBaseArticleId", "tagId"))`);
        await queryRunner.query(`INSERT INTO "tag_help_center_article"("knowledgeBaseArticleId", "tagId") SELECT "knowledgeBaseArticleId", "tagId" FROM "temporary_tag_help_center_article"`);
        await queryRunner.query(`DROP TABLE "temporary_tag_help_center_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_aa0fcfd3de83ecd3548e376518" ON "tag_help_center_article" ("tagId") `);
        await queryRunner.query(`CREATE INDEX "IDX_47e686041c8087564cc5d57423" ON "tag_help_center_article" ("knowledgeBaseArticleId") `);
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
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" RENAME TO "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL DEFAULT (0), "privacy" boolean NOT NULL DEFAULT (0), "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "descriptionHtml" text, "descriptionJson" text, "isLocked" boolean NOT NULL DEFAULT (0), "color" varchar, "externalId" varchar, "parentId" varchar, "ownedById" varchar, "projectId" varchar, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId" FROM "temporary_knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "temporary_knowledge_base_article"`);
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
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" RENAME TO "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL, "privacy" boolean NOT NULL, "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "descriptionHtml" text, "descriptionJson" text, "isLocked" boolean NOT NULL DEFAULT (0), "color" varchar, "externalId" varchar, "parentId" varchar, "ownedById" varchar, "projectId" varchar, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "descriptionHtml", "descriptionJson", "isLocked", "color", "externalId", "parentId", "ownedById", "projectId" FROM "temporary_knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_2de1afe05be78b65ea1d39bdec" ON "knowledge_base_article" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9720156c57ff1ad841e95ace7" ON "knowledge_base_article" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1544c43e36e1ccf7d578c70607" ON "knowledge_base_article" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b400197b7501bb75fa3a90bfce" ON "knowledge_base_article" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f1d98022801381f86f0332de5" ON "knowledge_base_article" ("deletedByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_2de1afe05be78b65ea1d39bdec"`);
        await queryRunner.query(`DROP INDEX "IDX_e9720156c57ff1ad841e95ace7"`);
        await queryRunner.query(`DROP INDEX "IDX_1544c43e36e1ccf7d578c70607"`);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "IDX_b400197b7501bb75fa3a90bfce"`);
        await queryRunner.query(`DROP INDEX "IDX_9f1d98022801381f86f0332de5"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" RENAME TO "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL, "privacy" boolean NOT NULL, "index" integer NOT NULL, "categoryId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, CONSTRAINT "FK_9f1d98022801381f86f0332de56" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "temporary_knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_2de1afe05be78b65ea1d39bdec" ON "knowledge_base_article" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9720156c57ff1ad841e95ace7" ON "knowledge_base_article" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1544c43e36e1ccf7d578c70607" ON "knowledge_base_article" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b400197b7501bb75fa3a90bfce" ON "knowledge_base_article" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f1d98022801381f86f0332de5" ON "knowledge_base_article" ("deletedByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_aa0fcfd3de83ecd3548e376518"`);
        await queryRunner.query(`DROP INDEX "IDX_47e686041c8087564cc5d57423"`);
        await queryRunner.query(`DROP TABLE "tag_help_center_article"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE \`tag_help_center_article\` (\`knowledgeBaseArticleId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_47e686041c8087564cc5d57423\` (\`knowledgeBaseArticleId\`), INDEX \`IDX_aa0fcfd3de83ecd3548e376518\` (\`tagId\`), PRIMARY KEY (\`knowledgeBaseArticleId\`, \`tagId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD \`descriptionHtml\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD \`descriptionJson\` json NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD \`isLocked\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD \`color\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD \`externalId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD \`parentId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD \`ownedById\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD \`projectId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` CHANGE \`draft\` \`draft\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` CHANGE \`privacy\` \`privacy\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`CREATE INDEX \`IDX_f3f05a8d9f0ba8d964da9cd582\` ON \`knowledge_base_article\` (\`parentId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_f5099fa8f6ff510b8c912bc58d\` ON \`knowledge_base_article\` (\`ownedById\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_8e523be638dfca7c9ba15e7b01\` ON \`knowledge_base_article\` (\`projectId\`)`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD CONSTRAINT \`FK_f3f05a8d9f0ba8d964da9cd582a\` FOREIGN KEY (\`parentId\`) REFERENCES \`knowledge_base_article\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD CONSTRAINT \`FK_f5099fa8f6ff510b8c912bc58db\` FOREIGN KEY (\`ownedById\`) REFERENCES \`employee\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD CONSTRAINT \`FK_8e523be638dfca7c9ba15e7b016\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`tag_help_center_article\` ADD CONSTRAINT \`FK_47e686041c8087564cc5d57423e\` FOREIGN KEY (\`knowledgeBaseArticleId\`) REFERENCES \`knowledge_base_article\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`tag_help_center_article\` ADD CONSTRAINT \`FK_aa0fcfd3de83ecd3548e3765188\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`tag_help_center_article\` DROP FOREIGN KEY \`FK_aa0fcfd3de83ecd3548e3765188\``);
        await queryRunner.query(`ALTER TABLE \`tag_help_center_article\` DROP FOREIGN KEY \`FK_47e686041c8087564cc5d57423e\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP FOREIGN KEY \`FK_8e523be638dfca7c9ba15e7b016\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP FOREIGN KEY \`FK_f5099fa8f6ff510b8c912bc58db\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP FOREIGN KEY \`FK_f3f05a8d9f0ba8d964da9cd582a\``);
        await queryRunner.query(`DROP INDEX \`IDX_8e523be638dfca7c9ba15e7b01\` ON \`knowledge_base_article\``);
        await queryRunner.query(`DROP INDEX \`IDX_f5099fa8f6ff510b8c912bc58d\` ON \`knowledge_base_article\``);
        await queryRunner.query(`DROP INDEX \`IDX_f3f05a8d9f0ba8d964da9cd582\` ON \`knowledge_base_article\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` CHANGE \`privacy\` \`privacy\` tinyint NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` CHANGE \`draft\` \`draft\` tinyint NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP COLUMN \`projectId\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP COLUMN \`ownedById\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP COLUMN \`parentId\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP COLUMN \`externalId\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP COLUMN \`color\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP COLUMN \`isLocked\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP COLUMN \`descriptionJson\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP COLUMN \`descriptionHtml\``);
        await queryRunner.query(`DROP INDEX \`IDX_aa0fcfd3de83ecd3548e376518\` ON \`tag_help_center_article\``);
        await queryRunner.query(`DROP INDEX \`IDX_47e686041c8087564cc5d57423\` ON \`tag_help_center_article\``);
        await queryRunner.query(`DROP TABLE \`tag_help_center_article\``);
    }
}
