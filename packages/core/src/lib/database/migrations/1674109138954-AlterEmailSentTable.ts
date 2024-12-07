import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterEmailSentTable1674109138954 implements MigrationInterface {

    name = 'AlterEmailSentTable1674109138954';

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
        await queryRunner.query(`ALTER TABLE "email_sent" DROP CONSTRAINT "FK_9033faf41b23c61ba201c487969"`);
        await queryRunner.query(`ALTER TABLE "email_sent" ADD CONSTRAINT "FK_9033faf41b23c61ba201c487969" FOREIGN KEY ("emailTemplateId") REFERENCES "email_template"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "email_sent" DROP CONSTRAINT "FK_9033faf41b23c61ba201c487969"`);
        await queryRunner.query(`ALTER TABLE "email_sent" ADD CONSTRAINT "FK_9033faf41b23c61ba201c487969" FOREIGN KEY ("emailTemplateId") REFERENCES "email_template"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_1261c457b3035b77719556995b"`);
        await queryRunner.query(`DROP INDEX "IDX_953df0eb0df3035baf140399f6"`);
        await queryRunner.query(`DROP INDEX "IDX_525f4873c6edc3d94559f88900"`);
        await queryRunner.query(`DROP INDEX "IDX_0af511c44de7a16beb45cc3785"`);
        await queryRunner.query(`DROP INDEX "IDX_a954fda57cca81dc48446e73b8"`);
        await queryRunner.query(`CREATE TABLE "temporary_email_sent" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "content" varchar, "email" varchar NOT NULL, "isArchived" boolean DEFAULT (0), "userId" varchar, "emailTemplateId" varchar NOT NULL, CONSTRAINT "FK_1261c457b3035b77719556995bf" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_525f4873c6edc3d94559f88900c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0af511c44de7a16beb45cc37852" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_email_sent"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId" FROM "email_sent"`);
        await queryRunner.query(`DROP TABLE "email_sent"`);
        await queryRunner.query(`ALTER TABLE "temporary_email_sent" RENAME TO "email_sent"`);
        await queryRunner.query(`CREATE INDEX "IDX_1261c457b3035b77719556995b" ON "email_sent" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_953df0eb0df3035baf140399f6" ON "email_sent" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_525f4873c6edc3d94559f88900" ON "email_sent" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0af511c44de7a16beb45cc3785" ON "email_sent" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a954fda57cca81dc48446e73b8" ON "email_sent" ("email") `);
        await queryRunner.query(`DROP INDEX "IDX_1261c457b3035b77719556995b"`);
        await queryRunner.query(`DROP INDEX "IDX_953df0eb0df3035baf140399f6"`);
        await queryRunner.query(`DROP INDEX "IDX_525f4873c6edc3d94559f88900"`);
        await queryRunner.query(`DROP INDEX "IDX_0af511c44de7a16beb45cc3785"`);
        await queryRunner.query(`DROP INDEX "IDX_a954fda57cca81dc48446e73b8"`);
        await queryRunner.query(`CREATE TABLE "temporary_email_sent" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "content" varchar, "email" varchar NOT NULL, "isArchived" boolean DEFAULT (0), "userId" varchar, "emailTemplateId" varchar NOT NULL, CONSTRAINT "FK_1261c457b3035b77719556995bf" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_525f4873c6edc3d94559f88900c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0af511c44de7a16beb45cc37852" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9033faf41b23c61ba201c487969" FOREIGN KEY ("emailTemplateId") REFERENCES "email_template" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_email_sent"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId" FROM "email_sent"`);
        await queryRunner.query(`DROP TABLE "email_sent"`);
        await queryRunner.query(`ALTER TABLE "temporary_email_sent" RENAME TO "email_sent"`);
        await queryRunner.query(`CREATE INDEX "IDX_1261c457b3035b77719556995b" ON "email_sent" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_953df0eb0df3035baf140399f6" ON "email_sent" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_525f4873c6edc3d94559f88900" ON "email_sent" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0af511c44de7a16beb45cc3785" ON "email_sent" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a954fda57cca81dc48446e73b8" ON "email_sent" ("email") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_a954fda57cca81dc48446e73b8"`);
        await queryRunner.query(`DROP INDEX "IDX_0af511c44de7a16beb45cc3785"`);
        await queryRunner.query(`DROP INDEX "IDX_525f4873c6edc3d94559f88900"`);
        await queryRunner.query(`DROP INDEX "IDX_953df0eb0df3035baf140399f6"`);
        await queryRunner.query(`DROP INDEX "IDX_1261c457b3035b77719556995b"`);
        await queryRunner.query(`ALTER TABLE "email_sent" RENAME TO "temporary_email_sent"`);
        await queryRunner.query(`CREATE TABLE "email_sent" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "content" varchar, "email" varchar NOT NULL, "isArchived" boolean DEFAULT (0), "userId" varchar, "emailTemplateId" varchar NOT NULL, CONSTRAINT "FK_1261c457b3035b77719556995bf" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_525f4873c6edc3d94559f88900c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0af511c44de7a16beb45cc37852" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "email_sent"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId" FROM "temporary_email_sent"`);
        await queryRunner.query(`DROP TABLE "temporary_email_sent"`);
        await queryRunner.query(`CREATE INDEX "IDX_a954fda57cca81dc48446e73b8" ON "email_sent" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_0af511c44de7a16beb45cc3785" ON "email_sent" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_525f4873c6edc3d94559f88900" ON "email_sent" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_953df0eb0df3035baf140399f6" ON "email_sent" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_1261c457b3035b77719556995b" ON "email_sent" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_a954fda57cca81dc48446e73b8"`);
        await queryRunner.query(`DROP INDEX "IDX_0af511c44de7a16beb45cc3785"`);
        await queryRunner.query(`DROP INDEX "IDX_525f4873c6edc3d94559f88900"`);
        await queryRunner.query(`DROP INDEX "IDX_953df0eb0df3035baf140399f6"`);
        await queryRunner.query(`DROP INDEX "IDX_1261c457b3035b77719556995b"`);
        await queryRunner.query(`ALTER TABLE "email_sent" RENAME TO "temporary_email_sent"`);
        await queryRunner.query(`CREATE TABLE "email_sent" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "content" varchar, "email" varchar NOT NULL, "isArchived" boolean DEFAULT (0), "userId" varchar, "emailTemplateId" varchar NOT NULL, CONSTRAINT "FK_9033faf41b23c61ba201c487969" FOREIGN KEY ("emailTemplateId") REFERENCES "email_template" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1261c457b3035b77719556995bf" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_525f4873c6edc3d94559f88900c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0af511c44de7a16beb45cc37852" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "email_sent"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId" FROM "temporary_email_sent"`);
        await queryRunner.query(`DROP TABLE "temporary_email_sent"`);
        await queryRunner.query(`CREATE INDEX "IDX_a954fda57cca81dc48446e73b8" ON "email_sent" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_0af511c44de7a16beb45cc3785" ON "email_sent" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_525f4873c6edc3d94559f88900" ON "email_sent" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_953df0eb0df3035baf140399f6" ON "email_sent" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_1261c457b3035b77719556995b" ON "email_sent" ("userId") `);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
    }
}
