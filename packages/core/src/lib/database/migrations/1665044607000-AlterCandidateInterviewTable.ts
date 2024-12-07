import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterCandidateInterviewTable1665044607000 implements MigrationInterface {

    name = 'AlterCandidateInterviewTable1665044607000';

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
        await queryRunner.query(`ALTER TABLE "candidate_interview" ALTER COLUMN "note" DROP NOT NULL`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "candidate_interview" ALTER COLUMN "note" SET NOT NULL`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_91996439c4baafee8395d3df15"`);
        await queryRunner.query(`DROP INDEX "IDX_03be41e88b1fecfe4e24d6b04b"`);
        await queryRunner.query(`DROP INDEX "IDX_59b765e6d13d83dba4852a43eb"`);
        await queryRunner.query(`CREATE TABLE "temporary_candidate_interview" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "startTime" datetime, "endTime" datetime, "location" varchar, "note" varchar NOT NULL, "isArchived" boolean DEFAULT (0), "rating" numeric, "candidateId" varchar, CONSTRAINT "FK_91996439c4baafee8395d3df153" FOREIGN KEY ("candidateId") REFERENCES "candidate" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_03be41e88b1fecfe4e24d6b04b2" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_59b765e6d13d83dba4852a43eb5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_candidate_interview"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "startTime", "endTime", "location", "note", "isArchived", "rating", "candidateId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "startTime", "endTime", "location", "note", "isArchived", "rating", "candidateId" FROM "candidate_interview"`);
        await queryRunner.query(`DROP TABLE "candidate_interview"`);
        await queryRunner.query(`ALTER TABLE "temporary_candidate_interview" RENAME TO "candidate_interview"`);
        await queryRunner.query(`CREATE INDEX "IDX_91996439c4baafee8395d3df15" ON "candidate_interview" ("candidateId") `);
        await queryRunner.query(`CREATE INDEX "IDX_03be41e88b1fecfe4e24d6b04b" ON "candidate_interview" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_59b765e6d13d83dba4852a43eb" ON "candidate_interview" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_91996439c4baafee8395d3df15"`);
        await queryRunner.query(`DROP INDEX "IDX_03be41e88b1fecfe4e24d6b04b"`);
        await queryRunner.query(`DROP INDEX "IDX_59b765e6d13d83dba4852a43eb"`);
        await queryRunner.query(`CREATE TABLE "temporary_candidate_interview" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "startTime" datetime, "endTime" datetime, "location" varchar, "note" varchar, "isArchived" boolean DEFAULT (0), "rating" numeric, "candidateId" varchar, CONSTRAINT "FK_91996439c4baafee8395d3df153" FOREIGN KEY ("candidateId") REFERENCES "candidate" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_03be41e88b1fecfe4e24d6b04b2" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_59b765e6d13d83dba4852a43eb5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_candidate_interview"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "startTime", "endTime", "location", "note", "isArchived", "rating", "candidateId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "startTime", "endTime", "location", "note", "isArchived", "rating", "candidateId" FROM "candidate_interview"`);
        await queryRunner.query(`DROP TABLE "candidate_interview"`);
        await queryRunner.query(`ALTER TABLE "temporary_candidate_interview" RENAME TO "candidate_interview"`);
        await queryRunner.query(`CREATE INDEX "IDX_91996439c4baafee8395d3df15" ON "candidate_interview" ("candidateId") `);
        await queryRunner.query(`CREATE INDEX "IDX_03be41e88b1fecfe4e24d6b04b" ON "candidate_interview" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_59b765e6d13d83dba4852a43eb" ON "candidate_interview" ("tenantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_59b765e6d13d83dba4852a43eb"`);
        await queryRunner.query(`DROP INDEX "IDX_03be41e88b1fecfe4e24d6b04b"`);
        await queryRunner.query(`DROP INDEX "IDX_91996439c4baafee8395d3df15"`);
        await queryRunner.query(`ALTER TABLE "candidate_interview" RENAME TO "temporary_candidate_interview"`);
        await queryRunner.query(`CREATE TABLE "candidate_interview" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "startTime" datetime, "endTime" datetime, "location" varchar, "note" varchar NOT NULL, "isArchived" boolean DEFAULT (0), "rating" numeric, "candidateId" varchar, CONSTRAINT "FK_91996439c4baafee8395d3df153" FOREIGN KEY ("candidateId") REFERENCES "candidate" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_03be41e88b1fecfe4e24d6b04b2" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_59b765e6d13d83dba4852a43eb5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "candidate_interview"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "startTime", "endTime", "location", "note", "isArchived", "rating", "candidateId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "startTime", "endTime", "location", "note", "isArchived", "rating", "candidateId" FROM "temporary_candidate_interview"`);
        await queryRunner.query(`DROP TABLE "temporary_candidate_interview"`);
        await queryRunner.query(`CREATE INDEX "IDX_59b765e6d13d83dba4852a43eb" ON "candidate_interview" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_03be41e88b1fecfe4e24d6b04b" ON "candidate_interview" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_91996439c4baafee8395d3df15" ON "candidate_interview" ("candidateId") `);
        await queryRunner.query(`DROP INDEX "IDX_59b765e6d13d83dba4852a43eb"`);
        await queryRunner.query(`DROP INDEX "IDX_03be41e88b1fecfe4e24d6b04b"`);
        await queryRunner.query(`DROP INDEX "IDX_91996439c4baafee8395d3df15"`);
        await queryRunner.query(`ALTER TABLE "candidate_interview" RENAME TO "temporary_candidate_interview"`);
        await queryRunner.query(`CREATE TABLE "candidate_interview" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "startTime" datetime, "endTime" datetime, "location" varchar, "note" varchar NOT NULL, "isArchived" boolean DEFAULT (0), "rating" numeric, "candidateId" varchar, CONSTRAINT "FK_91996439c4baafee8395d3df153" FOREIGN KEY ("candidateId") REFERENCES "candidate" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_03be41e88b1fecfe4e24d6b04b2" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_59b765e6d13d83dba4852a43eb5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "candidate_interview"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "startTime", "endTime", "location", "note", "isArchived", "rating", "candidateId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "startTime", "endTime", "location", "note", "isArchived", "rating", "candidateId" FROM "temporary_candidate_interview"`);
        await queryRunner.query(`DROP TABLE "temporary_candidate_interview"`);
        await queryRunner.query(`CREATE INDEX "IDX_59b765e6d13d83dba4852a43eb" ON "candidate_interview" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_03be41e88b1fecfe4e24d6b04b" ON "candidate_interview" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_91996439c4baafee8395d3df15" ON "candidate_interview" ("candidateId") `);
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
