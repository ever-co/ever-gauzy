import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateKnowledgeBaseArticleVersionTable1770214889980 implements MigrationInterface {
    name = 'CreateKnowledgeBaseArticleVersionTable1770214889980';

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
        await queryRunner.query(`CREATE TABLE "knowledge_base_article_version" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "descriptionHtml" text, "descriptionJson" jsonb, "lastSavedAt" TIMESTAMP NOT NULL DEFAULT now(), "articleId" uuid NOT NULL, "ownedById" uuid, CONSTRAINT "PK_a9757ae276dddb558665985105f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_352f7641b71c9ef4fc5ff43a13" ON "knowledge_base_article_version" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8988192a829df38557fad2e391" ON "knowledge_base_article_version" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f735ae4212db03913d45c9691" ON "knowledge_base_article_version" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e88da91c9a83d28665f2ac06b" ON "knowledge_base_article_version" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_a8520a586d162304e2b555c403" ON "knowledge_base_article_version" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_10550080f54a06e28d5eccc6ed" ON "knowledge_base_article_version" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799" ON "knowledge_base_article_version" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d6f7f270eff562bc028b3785a0" ON "knowledge_base_article_version" ("articleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c3505837e5137fda591a8f052" ON "knowledge_base_article_version" ("ownedById") `);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" ADD CONSTRAINT "FK_352f7641b71c9ef4fc5ff43a13f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" ADD CONSTRAINT "FK_8988192a829df38557fad2e3914" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" ADD CONSTRAINT "FK_5f735ae4212db03913d45c96918" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" ADD CONSTRAINT "FK_10550080f54a06e28d5eccc6ed7" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" ADD CONSTRAINT "FK_f9ba7e2d3c6f5aff0ed3f327997" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" ADD CONSTRAINT "FK_d6f7f270eff562bc028b3785a0f" FOREIGN KEY ("articleId") REFERENCES "knowledge_base_article"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" ADD CONSTRAINT "FK_7c3505837e5137fda591a8f0523" FOREIGN KEY ("ownedById") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" DROP CONSTRAINT "FK_7c3505837e5137fda591a8f0523"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" DROP CONSTRAINT "FK_d6f7f270eff562bc028b3785a0f"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" DROP CONSTRAINT "FK_f9ba7e2d3c6f5aff0ed3f327997"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" DROP CONSTRAINT "FK_10550080f54a06e28d5eccc6ed7"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" DROP CONSTRAINT "FK_5f735ae4212db03913d45c96918"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" DROP CONSTRAINT "FK_8988192a829df38557fad2e3914"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" DROP CONSTRAINT "FK_352f7641b71c9ef4fc5ff43a13f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7c3505837e5137fda591a8f052"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6f7f270eff562bc028b3785a0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f9ba7e2d3c6f5aff0ed3f32799"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_10550080f54a06e28d5eccc6ed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a8520a586d162304e2b555c403"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e88da91c9a83d28665f2ac06b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5f735ae4212db03913d45c9691"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8988192a829df38557fad2e391"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_352f7641b71c9ef4fc5ff43a13"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article_version"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "knowledge_base_article_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "descriptionHtml" text, "descriptionJson" text, "lastSavedAt" datetime NOT NULL DEFAULT (datetime('now')), "articleId" varchar NOT NULL, "ownedById" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_352f7641b71c9ef4fc5ff43a13" ON "knowledge_base_article_version" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8988192a829df38557fad2e391" ON "knowledge_base_article_version" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f735ae4212db03913d45c9691" ON "knowledge_base_article_version" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e88da91c9a83d28665f2ac06b" ON "knowledge_base_article_version" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_a8520a586d162304e2b555c403" ON "knowledge_base_article_version" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_10550080f54a06e28d5eccc6ed" ON "knowledge_base_article_version" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799" ON "knowledge_base_article_version" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d6f7f270eff562bc028b3785a0" ON "knowledge_base_article_version" ("articleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c3505837e5137fda591a8f052" ON "knowledge_base_article_version" ("ownedById") `);
        await queryRunner.query(`DROP INDEX "IDX_352f7641b71c9ef4fc5ff43a13"`);
        await queryRunner.query(`DROP INDEX "IDX_8988192a829df38557fad2e391"`);
        await queryRunner.query(`DROP INDEX "IDX_5f735ae4212db03913d45c9691"`);
        await queryRunner.query(`DROP INDEX "IDX_8e88da91c9a83d28665f2ac06b"`);
        await queryRunner.query(`DROP INDEX "IDX_a8520a586d162304e2b555c403"`);
        await queryRunner.query(`DROP INDEX "IDX_10550080f54a06e28d5eccc6ed"`);
        await queryRunner.query(`DROP INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799"`);
        await queryRunner.query(`DROP INDEX "IDX_d6f7f270eff562bc028b3785a0"`);
        await queryRunner.query(`DROP INDEX "IDX_7c3505837e5137fda591a8f052"`);
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base_article_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "descriptionHtml" text, "descriptionJson" text, "lastSavedAt" datetime NOT NULL DEFAULT (datetime('now')), "articleId" varchar NOT NULL, "ownedById" varchar, CONSTRAINT "FK_352f7641b71c9ef4fc5ff43a13f" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8988192a829df38557fad2e3914" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5f735ae4212db03913d45c96918" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_10550080f54a06e28d5eccc6ed7" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f9ba7e2d3c6f5aff0ed3f327997" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d6f7f270eff562bc028b3785a0f" FOREIGN KEY ("articleId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7c3505837e5137fda591a8f0523" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
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
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
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
        await queryRunner.query(`CREATE TABLE "knowledge_base_article_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "descriptionHtml" text, "descriptionJson" text, "lastSavedAt" datetime NOT NULL DEFAULT (datetime('now')), "articleId" varchar NOT NULL, "ownedById" varchar)`);
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
        await queryRunner.query(`DROP INDEX "IDX_7c3505837e5137fda591a8f052"`);
        await queryRunner.query(`DROP INDEX "IDX_d6f7f270eff562bc028b3785a0"`);
        await queryRunner.query(`DROP INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799"`);
        await queryRunner.query(`DROP INDEX "IDX_10550080f54a06e28d5eccc6ed"`);
        await queryRunner.query(`DROP INDEX "IDX_a8520a586d162304e2b555c403"`);
        await queryRunner.query(`DROP INDEX "IDX_8e88da91c9a83d28665f2ac06b"`);
        await queryRunner.query(`DROP INDEX "IDX_5f735ae4212db03913d45c9691"`);
        await queryRunner.query(`DROP INDEX "IDX_8988192a829df38557fad2e391"`);
        await queryRunner.query(`DROP INDEX "IDX_352f7641b71c9ef4fc5ff43a13"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article_version"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE \`knowledge_base_article_version\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`descriptionHtml\` text NULL, \`descriptionJson\` json NULL, \`lastSavedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`articleId\` varchar(255) NOT NULL, \`ownedById\` varchar(255) NULL, INDEX \`IDX_352f7641b71c9ef4fc5ff43a13\` (\`createdByUserId\`), INDEX \`IDX_8988192a829df38557fad2e391\` (\`updatedByUserId\`), INDEX \`IDX_5f735ae4212db03913d45c9691\` (\`deletedByUserId\`), INDEX \`IDX_8e88da91c9a83d28665f2ac06b\` (\`isActive\`), INDEX \`IDX_a8520a586d162304e2b555c403\` (\`isArchived\`), INDEX \`IDX_10550080f54a06e28d5eccc6ed\` (\`tenantId\`), INDEX \`IDX_f9ba7e2d3c6f5aff0ed3f32799\` (\`organizationId\`), INDEX \`IDX_d6f7f270eff562bc028b3785a0\` (\`articleId\`), INDEX \`IDX_7c3505837e5137fda591a8f052\` (\`ownedById\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` ADD CONSTRAINT \`FK_352f7641b71c9ef4fc5ff43a13f\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` ADD CONSTRAINT \`FK_8988192a829df38557fad2e3914\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` ADD CONSTRAINT \`FK_5f735ae4212db03913d45c96918\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` ADD CONSTRAINT \`FK_10550080f54a06e28d5eccc6ed7\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` ADD CONSTRAINT \`FK_f9ba7e2d3c6f5aff0ed3f327997\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` ADD CONSTRAINT \`FK_d6f7f270eff562bc028b3785a0f\` FOREIGN KEY (\`articleId\`) REFERENCES \`knowledge_base_article\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` ADD CONSTRAINT \`FK_7c3505837e5137fda591a8f0523\` FOREIGN KEY (\`ownedById\`) REFERENCES \`employee\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` DROP FOREIGN KEY \`FK_7c3505837e5137fda591a8f0523\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` DROP FOREIGN KEY \`FK_d6f7f270eff562bc028b3785a0f\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` DROP FOREIGN KEY \`FK_f9ba7e2d3c6f5aff0ed3f327997\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` DROP FOREIGN KEY \`FK_10550080f54a06e28d5eccc6ed7\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` DROP FOREIGN KEY \`FK_5f735ae4212db03913d45c96918\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` DROP FOREIGN KEY \`FK_8988192a829df38557fad2e3914\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` DROP FOREIGN KEY \`FK_352f7641b71c9ef4fc5ff43a13f\``);
        await queryRunner.query(`DROP INDEX \`IDX_7c3505837e5137fda591a8f052\` ON \`knowledge_base_article_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_d6f7f270eff562bc028b3785a0\` ON \`knowledge_base_article_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_f9ba7e2d3c6f5aff0ed3f32799\` ON \`knowledge_base_article_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_10550080f54a06e28d5eccc6ed\` ON \`knowledge_base_article_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_a8520a586d162304e2b555c403\` ON \`knowledge_base_article_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_8e88da91c9a83d28665f2ac06b\` ON \`knowledge_base_article_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_5f735ae4212db03913d45c9691\` ON \`knowledge_base_article_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_8988192a829df38557fad2e391\` ON \`knowledge_base_article_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_352f7641b71c9ef4fc5ff43a13\` ON \`knowledge_base_article_version\``);
        await queryRunner.query(`DROP TABLE \`knowledge_base_article_version\``);
    }
}
