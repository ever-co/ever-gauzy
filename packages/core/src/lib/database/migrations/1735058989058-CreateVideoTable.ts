
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateVideoTable1735058989058 implements MigrationInterface {

    name = 'CreateVideoTable1735058989058';

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
        await queryRunner.query(`CREATE TABLE "video" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "title" character varying NOT NULL, "file" character varying NOT NULL, "recordedAt" TIMESTAMP, "duration" integer, "size" integer, "fullUrl" character varying, "description" character varying, "storageProvider" text, "resolution" text DEFAULT '1920:1080', "codec" text DEFAULT 'libx264', "frameRate" integer DEFAULT '15', "timeSlotId" uuid, "uploadedById" uuid, CONSTRAINT "PK_1a2f3856250765d72e7e1636c8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca" ON "video" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_158647e790ce90499ed5a53c9b" ON "video" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_6fd9144466152ccef62e39d853" ON "video" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_061902beee13424f6372ac19f0" ON "video" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_95bba1c05216311bf162f6d835" ON "video" ("recordedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_1be826cc802f4cf0abb36ab365" ON "video" ("storageProvider") `);
        await queryRunner.query(`CREATE INDEX "IDX_a0c8486c125418dc0cc2e38470" ON "video" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f42d8d7033aacb69287d0dcfd9" ON "video" ("uploadedById") `);
        await queryRunner.query(`ALTER TABLE "video" ADD CONSTRAINT "FK_6fd9144466152ccef62e39d853e" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "video" ADD CONSTRAINT "FK_061902beee13424f6372ac19f02" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "video" ADD CONSTRAINT "FK_a0c8486c125418dc0cc2e384703" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "video" ADD CONSTRAINT "FK_f42d8d7033aacb69287d0dcfd9a" FOREIGN KEY ("uploadedById") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "video" DROP CONSTRAINT "FK_f42d8d7033aacb69287d0dcfd9a"`);
        await queryRunner.query(`ALTER TABLE "video" DROP CONSTRAINT "FK_a0c8486c125418dc0cc2e384703"`);
        await queryRunner.query(`ALTER TABLE "video" DROP CONSTRAINT "FK_061902beee13424f6372ac19f02"`);
        await queryRunner.query(`ALTER TABLE "video" DROP CONSTRAINT "FK_6fd9144466152ccef62e39d853e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f42d8d7033aacb69287d0dcfd9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a0c8486c125418dc0cc2e38470"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1be826cc802f4cf0abb36ab365"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_95bba1c05216311bf162f6d835"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_061902beee13424f6372ac19f0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6fd9144466152ccef62e39d853"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_158647e790ce90499ed5a53c9b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f57c7e5cac7c7ab9809bfc9aca"`);
        await queryRunner.query(`DROP TABLE "video"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "video" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "file" varchar NOT NULL, "recordedAt" datetime, "duration" integer, "size" integer, "fullUrl" varchar, "description" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "resolution" text DEFAULT ('1920:1080'), "codec" text DEFAULT ('libx264'), "frameRate" integer DEFAULT (15), "timeSlotId" varchar, "uploadedById" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca" ON "video" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_158647e790ce90499ed5a53c9b" ON "video" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_6fd9144466152ccef62e39d853" ON "video" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_061902beee13424f6372ac19f0" ON "video" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_95bba1c05216311bf162f6d835" ON "video" ("recordedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_1be826cc802f4cf0abb36ab365" ON "video" ("storageProvider") `);
        await queryRunner.query(`CREATE INDEX "IDX_a0c8486c125418dc0cc2e38470" ON "video" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f42d8d7033aacb69287d0dcfd9" ON "video" ("uploadedById") `);
        await queryRunner.query(`DROP INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca"`);
        await queryRunner.query(`DROP INDEX "IDX_158647e790ce90499ed5a53c9b"`);
        await queryRunner.query(`DROP INDEX "IDX_6fd9144466152ccef62e39d853"`);
        await queryRunner.query(`DROP INDEX "IDX_061902beee13424f6372ac19f0"`);
        await queryRunner.query(`DROP INDEX "IDX_95bba1c05216311bf162f6d835"`);
        await queryRunner.query(`DROP INDEX "IDX_1be826cc802f4cf0abb36ab365"`);
        await queryRunner.query(`DROP INDEX "IDX_a0c8486c125418dc0cc2e38470"`);
        await queryRunner.query(`DROP INDEX "IDX_f42d8d7033aacb69287d0dcfd9"`);
        await queryRunner.query(`CREATE TABLE "temporary_video" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "file" varchar NOT NULL, "recordedAt" datetime, "duration" integer, "size" integer, "fullUrl" varchar, "description" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "resolution" text DEFAULT ('1920:1080'), "codec" text DEFAULT ('libx264'), "frameRate" integer DEFAULT (15), "timeSlotId" varchar, "uploadedById" varchar, CONSTRAINT "FK_6fd9144466152ccef62e39d853e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_061902beee13424f6372ac19f02" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a0c8486c125418dc0cc2e384703" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f42d8d7033aacb69287d0dcfd9a" FOREIGN KEY ("uploadedById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_video"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById" FROM "video"`);
        await queryRunner.query(`DROP TABLE "video"`);
        await queryRunner.query(`ALTER TABLE "temporary_video" RENAME TO "video"`);
        await queryRunner.query(`CREATE INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca" ON "video" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_158647e790ce90499ed5a53c9b" ON "video" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_6fd9144466152ccef62e39d853" ON "video" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_061902beee13424f6372ac19f0" ON "video" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_95bba1c05216311bf162f6d835" ON "video" ("recordedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_1be826cc802f4cf0abb36ab365" ON "video" ("storageProvider") `);
        await queryRunner.query(`CREATE INDEX "IDX_a0c8486c125418dc0cc2e38470" ON "video" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f42d8d7033aacb69287d0dcfd9" ON "video" ("uploadedById") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_f42d8d7033aacb69287d0dcfd9"`);
        await queryRunner.query(`DROP INDEX "IDX_a0c8486c125418dc0cc2e38470"`);
        await queryRunner.query(`DROP INDEX "IDX_1be826cc802f4cf0abb36ab365"`);
        await queryRunner.query(`DROP INDEX "IDX_95bba1c05216311bf162f6d835"`);
        await queryRunner.query(`DROP INDEX "IDX_061902beee13424f6372ac19f0"`);
        await queryRunner.query(`DROP INDEX "IDX_6fd9144466152ccef62e39d853"`);
        await queryRunner.query(`DROP INDEX "IDX_158647e790ce90499ed5a53c9b"`);
        await queryRunner.query(`DROP INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca"`);
        await queryRunner.query(`ALTER TABLE "video" RENAME TO "temporary_video"`);
        await queryRunner.query(`CREATE TABLE "video" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "file" varchar NOT NULL, "recordedAt" datetime, "duration" integer, "size" integer, "fullUrl" varchar, "description" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "resolution" text DEFAULT ('1920:1080'), "codec" text DEFAULT ('libx264'), "frameRate" integer DEFAULT (15), "timeSlotId" varchar, "uploadedById" varchar)`);
        await queryRunner.query(`INSERT INTO "video"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById" FROM "temporary_video"`);
        await queryRunner.query(`DROP TABLE "temporary_video"`);
        await queryRunner.query(`CREATE INDEX "IDX_f42d8d7033aacb69287d0dcfd9" ON "video" ("uploadedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_a0c8486c125418dc0cc2e38470" ON "video" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1be826cc802f4cf0abb36ab365" ON "video" ("storageProvider") `);
        await queryRunner.query(`CREATE INDEX "IDX_95bba1c05216311bf162f6d835" ON "video" ("recordedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_061902beee13424f6372ac19f0" ON "video" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6fd9144466152ccef62e39d853" ON "video" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_158647e790ce90499ed5a53c9b" ON "video" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca" ON "video" ("isActive") `);
        await queryRunner.query(`DROP INDEX "IDX_f42d8d7033aacb69287d0dcfd9"`);
        await queryRunner.query(`DROP INDEX "IDX_a0c8486c125418dc0cc2e38470"`);
        await queryRunner.query(`DROP INDEX "IDX_1be826cc802f4cf0abb36ab365"`);
        await queryRunner.query(`DROP INDEX "IDX_95bba1c05216311bf162f6d835"`);
        await queryRunner.query(`DROP INDEX "IDX_061902beee13424f6372ac19f0"`);
        await queryRunner.query(`DROP INDEX "IDX_6fd9144466152ccef62e39d853"`);
        await queryRunner.query(`DROP INDEX "IDX_158647e790ce90499ed5a53c9b"`);
        await queryRunner.query(`DROP INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca"`);
        await queryRunner.query(`DROP TABLE "video"`);
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
