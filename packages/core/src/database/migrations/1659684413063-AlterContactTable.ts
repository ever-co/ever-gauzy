import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterContactTable1659684413063 implements MigrationInterface {

    name = 'AlterContactTable1659684413063';

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
        await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "latitude"`);
        await queryRunner.query(`ALTER TABLE "contact" ADD "latitude" numeric`);
        await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "longitude"`);
        await queryRunner.query(`ALTER TABLE "contact" ADD "longitude" numeric`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "longitude"`);
        await queryRunner.query(`ALTER TABLE "contact" ADD "longitude" double precision`);
        await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "latitude"`);
        await queryRunner.query(`ALTER TABLE "contact" ADD "latitude" double precision`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_7719d73cd16a9f57ecc6ac24b3"`);
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`CREATE TABLE "temporary_contact" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "firstName" varchar, "lastName" varchar, "country" varchar, "city" varchar, "address" varchar, "address2" varchar, "postcode" varchar, "latitude" numeric, "longitude" numeric, "regionCode" varchar, "fax" varchar, "fiscalInformation" varchar, "website" varchar, CONSTRAINT "FK_7719d73cd16a9f57ecc6ac24b3d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_60468af1ce34043a900809c84f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_contact"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website" FROM "contact"`);
        await queryRunner.query(`DROP TABLE "contact"`);
        await queryRunner.query(`ALTER TABLE "temporary_contact" RENAME TO "contact"`);
        await queryRunner.query(`CREATE INDEX "IDX_7719d73cd16a9f57ecc6ac24b3" ON "contact" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_60468af1ce34043a900809c84f" ON "contact" ("tenantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`DROP INDEX "IDX_7719d73cd16a9f57ecc6ac24b3"`);
        await queryRunner.query(`ALTER TABLE "contact" RENAME TO "temporary_contact"`);
        await queryRunner.query(`CREATE TABLE "contact" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "firstName" varchar, "lastName" varchar, "country" varchar, "city" varchar, "address" varchar, "address2" varchar, "postcode" varchar, "latitude" float, "longitude" float, "regionCode" varchar, "fax" varchar, "fiscalInformation" varchar, "website" varchar, CONSTRAINT "FK_7719d73cd16a9f57ecc6ac24b3d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_60468af1ce34043a900809c84f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "contact"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website" FROM "temporary_contact"`);
        await queryRunner.query(`DROP TABLE "temporary_contact"`);
        await queryRunner.query(`CREATE INDEX "IDX_60468af1ce34043a900809c84f" ON "contact" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7719d73cd16a9f57ecc6ac24b3" ON "contact" ("organizationId") `);
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
