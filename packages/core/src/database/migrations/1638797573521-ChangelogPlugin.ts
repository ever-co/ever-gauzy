import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class ChangelogPlugin1638797573521 implements MigrationInterface {

    name = 'ChangelogPlugin1638797573521';

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
        await queryRunner.query(`CREATE TABLE "changelog" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "icon" character varying, "title" character varying, "date" TIMESTAMP NOT NULL, "content" character varying NOT NULL, "learnMoreUrl" character varying NOT NULL, CONSTRAINT "PK_9d12e70193212a9f6d2c542433d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
        await queryRunner.query(`ALTER TABLE "contact" ALTER COLUMN "latitude" TYPE double precision`);
        await queryRunner.query(`ALTER TABLE "contact" ALTER COLUMN "longitude" TYPE double precision`);
        await queryRunner.query(`ALTER TABLE "changelog" ADD CONSTRAINT "FK_744268ee0ec6073883267bc3b66" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "changelog" ADD CONSTRAINT "FK_c2037b621d2e8023898aee4ac74" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
     * PostgresDB Down Migration
     *
     * @param queryRunner
     */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "changelog" DROP CONSTRAINT "FK_c2037b621d2e8023898aee4ac74"`);
        await queryRunner.query(`ALTER TABLE "changelog" DROP CONSTRAINT "FK_744268ee0ec6073883267bc3b66"`);
        await queryRunner.query(`ALTER TABLE "contact" ALTER COLUMN "longitude" TYPE double precision`);
        await queryRunner.query(`ALTER TABLE "contact" ALTER COLUMN "latitude" TYPE double precision`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`DROP TABLE "changelog"`);
    }

    /**
     * SqliteDB Up Migration
     *
     * @param queryRunner
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "changelog" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "learnMoreUrl" varchar NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`DROP INDEX "IDX_7719d73cd16a9f57ecc6ac24b3"`);
        await queryRunner.query(`CREATE TABLE "temporary_contact" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "firstName" varchar, "lastName" varchar, "country" varchar, "city" varchar, "address" varchar, "address2" varchar, "postcode" varchar, "latitude" float, "longitude" float, "regionCode" varchar, "fax" varchar, "fiscalInformation" varchar, "website" varchar, CONSTRAINT "FK_60468af1ce34043a900809c84f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7719d73cd16a9f57ecc6ac24b3d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_contact"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website" FROM "contact"`);
        await queryRunner.query(`DROP TABLE "contact"`);
        await queryRunner.query(`ALTER TABLE "temporary_contact" RENAME TO "contact"`);
        await queryRunner.query(`CREATE INDEX "IDX_60468af1ce34043a900809c84f" ON "contact" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7719d73cd16a9f57ecc6ac24b3" ON "contact" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`DROP INDEX "IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`CREATE TABLE "temporary_changelog" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "learnMoreUrl" varchar NOT NULL, CONSTRAINT "FK_744268ee0ec6073883267bc3b66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c2037b621d2e8023898aee4ac74" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_changelog"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl" FROM "changelog"`);
        await queryRunner.query(`DROP TABLE "changelog"`);
        await queryRunner.query(`ALTER TABLE "temporary_changelog" RENAME TO "changelog"`);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`DROP INDEX "IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`ALTER TABLE "changelog" RENAME TO "temporary_changelog"`);
        await queryRunner.query(`CREATE TABLE "changelog" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "learnMoreUrl" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "changelog"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl" FROM "temporary_changelog"`);
        await queryRunner.query(`DROP TABLE "temporary_changelog"`);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_7719d73cd16a9f57ecc6ac24b3"`);
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`ALTER TABLE "contact" RENAME TO "temporary_contact"`);
        await queryRunner.query(`CREATE TABLE "contact" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "firstName" varchar, "lastName" varchar, "country" varchar, "city" varchar, "address" varchar, "address2" varchar, "postcode" varchar, "latitude" float, "longitude" float, "regionCode" varchar, "fax" varchar, "fiscalInformation" varchar, "website" varchar, CONSTRAINT "FK_60468af1ce34043a900809c84f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7719d73cd16a9f57ecc6ac24b3d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "contact"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website" FROM "temporary_contact"`);
        await queryRunner.query(`DROP TABLE "temporary_contact"`);
        await queryRunner.query(`CREATE INDEX "IDX_7719d73cd16a9f57ecc6ac24b3" ON "contact" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_60468af1ce34043a900809c84f" ON "contact" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`DROP INDEX "IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`DROP TABLE "changelog"`);
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
