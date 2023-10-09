
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';

export class AddColumnsToTheIntegrationTypeTable1695111838783 implements MigrationInterface {

    name = 'AddColumnsToTheIntegrationTypeTable1695111838783';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(`AddColumnsToTheIntegrationTypeTable1695111838783 start running!`));

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
        await queryRunner.query(`ALTER TABLE "integration_type" ADD "description" character varying`);
        await queryRunner.query(`ALTER TABLE "integration_type" ADD "icon" character varying`);
        await queryRunner.query(`ALTER TABLE "integration_type" ADD CONSTRAINT "UQ_83443d669822bbbf2bd0ebdacd7" UNIQUE ("name")`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "integration_type" DROP CONSTRAINT "UQ_83443d669822bbbf2bd0ebdacd7"`);
        await queryRunner.query(`ALTER TABLE "integration_type" DROP COLUMN "icon"`);
        await queryRunner.query(`ALTER TABLE "integration_type" DROP COLUMN "description"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "temporary_integration_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "groupName" varchar NOT NULL, "order" integer NOT NULL, "description" varchar, "icon" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_integration_type"("id", "createdAt", "updatedAt", "name", "groupName", "order") SELECT "id", "createdAt", "updatedAt", "name", "groupName", "order" FROM "integration_type"`);
        await queryRunner.query(`DROP TABLE "integration_type"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_type" RENAME TO "integration_type"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "groupName" varchar NOT NULL, "order" integer NOT NULL, "description" varchar, "icon" varchar, CONSTRAINT "UQ_be0d67f4df84f036fab2ed89c47" UNIQUE ("name"))`);
        await queryRunner.query(`INSERT INTO "temporary_integration_type"("id", "createdAt", "updatedAt", "name", "groupName", "order", "description", "icon") SELECT "id", "createdAt", "updatedAt", "name", "groupName", "order", "description", "icon" FROM "integration_type"`);
        await queryRunner.query(`DROP TABLE "integration_type"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_type" RENAME TO "integration_type"`);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "integration_type" RENAME TO "temporary_integration_type"`);
        await queryRunner.query(`CREATE TABLE "integration_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "groupName" varchar NOT NULL, "order" integer NOT NULL, "description" varchar, "icon" varchar)`);
        await queryRunner.query(`INSERT INTO "integration_type"("id", "createdAt", "updatedAt", "name", "groupName", "order", "description", "icon") SELECT "id", "createdAt", "updatedAt", "name", "groupName", "order", "description", "icon" FROM "temporary_integration_type"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_type"`);
        await queryRunner.query(`ALTER TABLE "integration_type" RENAME TO "temporary_integration_type"`);
        await queryRunner.query(`CREATE TABLE "integration_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "groupName" varchar NOT NULL, "order" integer NOT NULL)`);
        await queryRunner.query(`INSERT INTO "integration_type"("id", "createdAt", "updatedAt", "name", "groupName", "order") SELECT "id", "createdAt", "updatedAt", "name", "groupName", "order" FROM "temporary_integration_type"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_type"`);
    }
}
