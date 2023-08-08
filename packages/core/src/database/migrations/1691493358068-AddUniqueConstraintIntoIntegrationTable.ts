
import { MigrationInterface, QueryRunner } from "typeorm";
import { getConfig } from "@gauzy/config";

export class AddUniqueConstraintIntoIntegrationTable1691493358068 implements MigrationInterface {

    config = getConfig();
    name = 'AddUniqueConstraintIntoIntegrationTable1691493358068';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (queryRunner.connection.options.type === 'sqlite') {
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
        if (queryRunner.connection.options.type === 'sqlite') {
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
        // Add unique constraint to the "name" column
        await queryRunner.query(`ALTER TABLE "integration" ADD CONSTRAINT "UQ_52d7fa32a7832b377fc2d7f6199" UNIQUE ("name")`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "integration" DROP CONSTRAINT "UQ_52d7fa32a7832b377fc2d7f6199"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "temporary_integration" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "imgSrc" varchar, "isComingSoon" boolean NOT NULL DEFAULT (0), "isPaid" boolean NOT NULL DEFAULT (0), "version" varchar, "docUrl" varchar, "isFreeTrial" boolean NOT NULL DEFAULT (0), "freeTrialPeriod" numeric DEFAULT (0), "order" integer)`);
        await queryRunner.query(`INSERT INTO "temporary_integration"("id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order") SELECT "id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order" FROM "integration"`);
        await queryRunner.query(`DROP TABLE "integration"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration" RENAME TO "integration"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "imgSrc" varchar, "isComingSoon" boolean NOT NULL DEFAULT (0), "isPaid" boolean NOT NULL DEFAULT (0), "version" varchar, "docUrl" varchar, "isFreeTrial" boolean NOT NULL DEFAULT (0), "freeTrialPeriod" numeric DEFAULT (0), "order" integer, CONSTRAINT "UQ_938c19d92ad3f290ff5fc163531" UNIQUE ("name"))`);
        await queryRunner.query(`INSERT INTO "temporary_integration"("id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order") SELECT "id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order" FROM "integration"`);
        await queryRunner.query(`DROP TABLE "integration"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration" RENAME TO "integration"`);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "integration" RENAME TO "temporary_integration"`);
        await queryRunner.query(`CREATE TABLE "integration" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "imgSrc" varchar, "isComingSoon" boolean NOT NULL DEFAULT (0), "isPaid" boolean NOT NULL DEFAULT (0), "version" varchar, "docUrl" varchar, "isFreeTrial" boolean NOT NULL DEFAULT (0), "freeTrialPeriod" numeric DEFAULT (0), "order" integer)`);
        await queryRunner.query(`INSERT INTO "integration"("id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order") SELECT "id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order" FROM "temporary_integration"`);
        await queryRunner.query(`DROP TABLE "temporary_integration"`);
        await queryRunner.query(`ALTER TABLE "integration" RENAME TO "temporary_integration"`);
        await queryRunner.query(`CREATE TABLE "integration" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "imgSrc" varchar, "isComingSoon" boolean NOT NULL DEFAULT (0), "isPaid" boolean NOT NULL DEFAULT (0), "version" varchar, "docUrl" varchar, "isFreeTrial" boolean NOT NULL DEFAULT (0), "freeTrialPeriod" numeric DEFAULT (0), "order" integer)`);
        await queryRunner.query(`INSERT INTO "integration"("id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order") SELECT "id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order" FROM "temporary_integration"`);
        await queryRunner.query(`DROP TABLE "temporary_integration"`);
    }
}
