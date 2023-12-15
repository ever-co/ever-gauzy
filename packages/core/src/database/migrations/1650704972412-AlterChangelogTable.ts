import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";

export class AlterChangelogTable1650704972412 implements MigrationInterface {

    name = 'AlterChangelogTable1650704972412';

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(chalk.yellow(this.name + ' start running!'));

        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
            await this.sqliteUpQueryRunner(queryRunner);
        } else {
            await this.postgresUpQueryRunner(queryRunner);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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
        await queryRunner.query(`ALTER TABLE "changelog" ADD "isFeature" boolean`);
        await queryRunner.query(`ALTER TABLE "changelog" ADD "imageUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "changelog" ALTER COLUMN "learnMoreUrl" DROP NOT NULL`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "changelog" ALTER COLUMN "learnMoreUrl" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "changelog" DROP COLUMN "imageUrl"`);
        await queryRunner.query(`ALTER TABLE "changelog" DROP COLUMN "isFeature"`);
    }

    /**
     * SqliteDB Up Migration
     *
     * @param queryRunner
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`DROP INDEX "IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`CREATE TABLE "temporary_changelog" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "learnMoreUrl" varchar NOT NULL, "isFeature" boolean, "imageUrl" varchar, CONSTRAINT "FK_c2037b621d2e8023898aee4ac74" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_744268ee0ec6073883267bc3b66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_changelog"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl" FROM "changelog"`);
        await queryRunner.query(`DROP TABLE "changelog"`);
        await queryRunner.query(`ALTER TABLE "temporary_changelog" RENAME TO "changelog"`);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`DROP INDEX "IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`CREATE TABLE "temporary_changelog" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "learnMoreUrl" varchar, "isFeature" boolean, "imageUrl" varchar, CONSTRAINT "FK_c2037b621d2e8023898aee4ac74" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_744268ee0ec6073883267bc3b66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_changelog"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl", "isFeature", "imageUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl", "isFeature", "imageUrl" FROM "changelog"`);
        await queryRunner.query(`DROP TABLE "changelog"`);
        await queryRunner.query(`ALTER TABLE "temporary_changelog" RENAME TO "changelog"`);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
    }

    /**
     * SqliteDB Down Migration
     *
     * @param queryRunner
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`DROP INDEX "IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`ALTER TABLE "changelog" RENAME TO "temporary_changelog"`);
        await queryRunner.query(`CREATE TABLE "changelog" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "learnMoreUrl" varchar NOT NULL, "isFeature" boolean, "imageUrl" varchar, CONSTRAINT "FK_c2037b621d2e8023898aee4ac74" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_744268ee0ec6073883267bc3b66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "changelog"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl", "isFeature", "imageUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl", "isFeature", "imageUrl" FROM "temporary_changelog"`);
        await queryRunner.query(`DROP TABLE "temporary_changelog"`);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`DROP INDEX "IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`ALTER TABLE "changelog" RENAME TO "temporary_changelog"`);
        await queryRunner.query(`CREATE TABLE "changelog" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "learnMoreUrl" varchar NOT NULL, CONSTRAINT "FK_c2037b621d2e8023898aee4ac74" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_744268ee0ec6073883267bc3b66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "changelog"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl" FROM "temporary_changelog"`);
        await queryRunner.query(`DROP TABLE "temporary_changelog"`);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
    }
}
