import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddColumnsToTheIntegrationTable1695023907817 implements MigrationInterface {

    name = 'AddColumnsToTheIntegrationTable1695023907817';

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
        await queryRunner.query(`ALTER TABLE "integration" RENAME COLUMN "navigationUrl" TO "redirectUrl"`);
        await queryRunner.query(`ALTER TABLE "integration" ADD "provider" character varying`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "integration" DROP COLUMN "provider"`);
        await queryRunner.query(`ALTER TABLE "integration" RENAME COLUMN "redirectUrl" TO "navigationUrl"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "temporary_integration" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "imgSrc" varchar, "isComingSoon" boolean NOT NULL DEFAULT (0), "isPaid" boolean NOT NULL DEFAULT (0), "version" varchar, "docUrl" varchar, "isFreeTrial" boolean NOT NULL DEFAULT (0), "freeTrialPeriod" numeric DEFAULT (0), "order" integer, CONSTRAINT "UQ_938c19d92ad3f290ff5fc163531" UNIQUE ("name"))`);
        await queryRunner.query(`INSERT INTO "temporary_integration"("id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order") SELECT "id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order" FROM "integration"`);
        await queryRunner.query(`DROP TABLE "integration"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration" RENAME TO "integration"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "imgSrc" varchar, "isComingSoon" boolean NOT NULL DEFAULT (0), "isPaid" boolean NOT NULL DEFAULT (0), "version" varchar, "docUrl" varchar, "isFreeTrial" boolean NOT NULL DEFAULT (0), "freeTrialPeriod" numeric DEFAULT (0), "order" integer, "provider" varchar, "redirectUrl" varchar, CONSTRAINT "UQ_938c19d92ad3f290ff5fc163531" UNIQUE ("name"))`);
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
        await queryRunner.query(`CREATE TABLE "integration" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "imgSrc" varchar, "isComingSoon" boolean NOT NULL DEFAULT (0), "isPaid" boolean NOT NULL DEFAULT (0), "version" varchar, "docUrl" varchar, "isFreeTrial" boolean NOT NULL DEFAULT (0), "freeTrialPeriod" numeric DEFAULT (0), "order" integer, CONSTRAINT "UQ_938c19d92ad3f290ff5fc163531" UNIQUE ("name"))`);
        await queryRunner.query(`INSERT INTO "integration"("id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order") SELECT "id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order" FROM "temporary_integration"`);
        await queryRunner.query(`DROP TABLE "temporary_integration"`);
        await queryRunner.query(`ALTER TABLE "integration" RENAME TO "temporary_integration"`);
        await queryRunner.query(`CREATE TABLE "integration" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "imgSrc" varchar, "isComingSoon" boolean NOT NULL DEFAULT (0), "isPaid" boolean NOT NULL DEFAULT (0), "version" varchar, "docUrl" varchar, "isFreeTrial" boolean NOT NULL DEFAULT (0), "freeTrialPeriod" numeric DEFAULT (0), "order" integer, "navigationUrl" varchar, CONSTRAINT "UQ_938c19d92ad3f290ff5fc163531" UNIQUE ("name"))`);
        await queryRunner.query(`INSERT INTO "integration"("id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order") SELECT "id", "createdAt", "updatedAt", "name", "imgSrc", "isComingSoon", "isPaid", "version", "docUrl", "isFreeTrial", "freeTrialPeriod", "order" FROM "temporary_integration"`);
        await queryRunner.query(`DROP TABLE "temporary_integration"`);
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
