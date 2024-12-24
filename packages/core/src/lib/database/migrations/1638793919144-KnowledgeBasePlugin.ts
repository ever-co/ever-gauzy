import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class KnowledgeBasePlugin1638793919144 implements MigrationInterface {
    name = 'KnowledgeBasePlugin1638793919144';

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
        await queryRunner.query(`CREATE TABLE "knowledge_base" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "flag" character varying NOT NULL, "icon" character varying NOT NULL, "privacy" character varying NOT NULL, "language" character varying NOT NULL, "color" character varying NOT NULL, "description" character varying, "data" character varying, "index" integer, "parentId" uuid, CONSTRAINT "PK_19d3f52f6da1501b7e235f1da5c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bcb30c9893f4c8d0c4e556b4ed" ON "knowledge_base" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ba72a9dec732a10e8c05bcdec" ON "knowledge_base" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ff979040ce93cbc60863d322ec" ON "knowledge_base" ("parentId") `);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "description" character varying, "data" character varying, "draft" boolean NOT NULL, "privacy" boolean NOT NULL, "index" integer NOT NULL, "categoryId" uuid NOT NULL, CONSTRAINT "PK_c5b373d858b6e8866dec56ae313" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE TABLE "knowledge_base_author" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "employeeId" uuid NOT NULL, "articleId" uuid NOT NULL, CONSTRAINT "PK_edf0d4be3efe6361a73cf958503" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1551e821871d9230cc0dafbbe5" ON "knowledge_base_author" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_81558bb2bef673628d92540b4e" ON "knowledge_base_author" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8eb7e413257d7a26104f4e326f" ON "knowledge_base_author" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d5ecab1f06b327bad54553614" ON "knowledge_base_author" ("articleId") `);
        await queryRunner.query(`ALTER TABLE "contact" ALTER COLUMN "latitude" TYPE double precision`);
        await queryRunner.query(`ALTER TABLE "contact" ALTER COLUMN "longitude" TYPE double precision`);
        await queryRunner.query(`ALTER TABLE "knowledge_base" ADD CONSTRAINT "FK_bcb30c9893f4c8d0c4e556b4ed3" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base" ADD CONSTRAINT "FK_2ba72a9dec732a10e8c05bcdec1" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "knowledge_base" ADD CONSTRAINT "FK_ff979040ce93cbc60863d322ecd" FOREIGN KEY ("parentId") REFERENCES "knowledge_base"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_author" ADD CONSTRAINT "FK_1551e821871d9230cc0dafbbe58" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_author" ADD CONSTRAINT "FK_81558bb2bef673628d92540b4e4" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_author" ADD CONSTRAINT "FK_8eb7e413257d7a26104f4e326fd" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_author" ADD CONSTRAINT "FK_2d5ecab1f06b327bad545536143" FOREIGN KEY ("articleId") REFERENCES "knowledge_base_article"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
     * PostgresDB Down Migration
     *
     * @param queryRunner
     */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "knowledge_base_author" DROP CONSTRAINT "FK_2d5ecab1f06b327bad545536143"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_author" DROP CONSTRAINT "FK_8eb7e413257d7a26104f4e326fd"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_author" DROP CONSTRAINT "FK_81558bb2bef673628d92540b4e4"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_author" DROP CONSTRAINT "FK_1551e821871d9230cc0dafbbe58"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP CONSTRAINT "FK_66af194845635058239e794e1b9"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP CONSTRAINT "FK_3547f82f867489542ceae58a49e"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base" DROP CONSTRAINT "FK_ff979040ce93cbc60863d322ecd"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base" DROP CONSTRAINT "FK_2ba72a9dec732a10e8c05bcdec1"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base" DROP CONSTRAINT "FK_bcb30c9893f4c8d0c4e556b4ed3"`);
        await queryRunner.query(`ALTER TABLE "contact" ALTER COLUMN "longitude" TYPE double precision`);
        await queryRunner.query(`ALTER TABLE "contact" ALTER COLUMN "latitude" TYPE double precision`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d5ecab1f06b327bad54553614"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8eb7e413257d7a26104f4e326f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_81558bb2bef673628d92540b4e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1551e821871d9230cc0dafbbe5"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_author"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff979040ce93cbc60863d322ec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ba72a9dec732a10e8c05bcdec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bcb30c9893f4c8d0c4e556b4ed"`);
        await queryRunner.query(`DROP TABLE "knowledge_base"`);
    }

    /**
     * SqliteDB Up Migration
     *
     * @param queryRunner
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "knowledge_base" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "flag" varchar NOT NULL, "icon" varchar NOT NULL, "privacy" varchar NOT NULL, "language" varchar NOT NULL, "color" varchar NOT NULL, "description" varchar, "data" varchar, "index" integer, "parentId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_bcb30c9893f4c8d0c4e556b4ed" ON "knowledge_base" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ba72a9dec732a10e8c05bcdec" ON "knowledge_base" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ff979040ce93cbc60863d322ec" ON "knowledge_base" ("parentId") `);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL, "privacy" boolean NOT NULL, "index" integer NOT NULL, "categoryId" varchar NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE TABLE "knowledge_base_author" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "employeeId" varchar NOT NULL, "articleId" varchar NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_1551e821871d9230cc0dafbbe5" ON "knowledge_base_author" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_81558bb2bef673628d92540b4e" ON "knowledge_base_author" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8eb7e413257d7a26104f4e326f" ON "knowledge_base_author" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d5ecab1f06b327bad54553614" ON "knowledge_base_author" ("articleId") `);
        await queryRunner.query(`DROP INDEX "IDX_7719d73cd16a9f57ecc6ac24b3"`);
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`CREATE TABLE "temporary_contact" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "firstName" varchar, "lastName" varchar, "country" varchar, "city" varchar, "address" varchar, "address2" varchar, "postcode" varchar, "latitude" float, "longitude" float, "regionCode" varchar, "fax" varchar, "fiscalInformation" varchar, "website" varchar, CONSTRAINT "FK_7719d73cd16a9f57ecc6ac24b3d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_60468af1ce34043a900809c84f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_contact"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website" FROM "contact"`);
        await queryRunner.query(`DROP TABLE "contact"`);
        await queryRunner.query(`ALTER TABLE "temporary_contact" RENAME TO "contact"`);
        await queryRunner.query(`CREATE INDEX "IDX_7719d73cd16a9f57ecc6ac24b3" ON "contact" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_60468af1ce34043a900809c84f" ON "contact" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_bcb30c9893f4c8d0c4e556b4ed"`);
        await queryRunner.query(`DROP INDEX "IDX_2ba72a9dec732a10e8c05bcdec"`);
        await queryRunner.query(`DROP INDEX "IDX_ff979040ce93cbc60863d322ec"`);
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "flag" varchar NOT NULL, "icon" varchar NOT NULL, "privacy" varchar NOT NULL, "language" varchar NOT NULL, "color" varchar NOT NULL, "description" varchar, "data" varchar, "index" integer, "parentId" varchar, CONSTRAINT "FK_bcb30c9893f4c8d0c4e556b4ed3" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2ba72a9dec732a10e8c05bcdec1" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_ff979040ce93cbc60863d322ecd" FOREIGN KEY ("parentId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_knowledge_base"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "flag", "icon", "privacy", "language", "color", "description", "data", "index", "parentId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "flag", "icon", "privacy", "language", "color", "description", "data", "index", "parentId" FROM "knowledge_base"`);
        await queryRunner.query(`DROP TABLE "knowledge_base"`);
        await queryRunner.query(`ALTER TABLE "temporary_knowledge_base" RENAME TO "knowledge_base"`);
        await queryRunner.query(`CREATE INDEX "IDX_bcb30c9893f4c8d0c4e556b4ed" ON "knowledge_base" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ba72a9dec732a10e8c05bcdec" ON "knowledge_base" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ff979040ce93cbc60863d322ec" ON "knowledge_base" ("parentId") `);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL, "privacy" boolean NOT NULL, "index" integer NOT NULL, "categoryId" varchar NOT NULL, CONSTRAINT "FK_06a9902fedc1f9dcdbaf14afb01" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3547f82f867489542ceae58a49e" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_66af194845635058239e794e1b9" FOREIGN KEY ("categoryId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId" FROM "knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article"`);
        await queryRunner.query(`ALTER TABLE "temporary_knowledge_base_article" RENAME TO "knowledge_base_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`DROP INDEX "IDX_1551e821871d9230cc0dafbbe5"`);
        await queryRunner.query(`DROP INDEX "IDX_81558bb2bef673628d92540b4e"`);
        await queryRunner.query(`DROP INDEX "IDX_8eb7e413257d7a26104f4e326f"`);
        await queryRunner.query(`DROP INDEX "IDX_2d5ecab1f06b327bad54553614"`);
        await queryRunner.query(`CREATE TABLE "temporary_knowledge_base_author" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "employeeId" varchar NOT NULL, "articleId" varchar NOT NULL, CONSTRAINT "FK_1551e821871d9230cc0dafbbe58" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_81558bb2bef673628d92540b4e4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8eb7e413257d7a26104f4e326fd" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2d5ecab1f06b327bad545536143" FOREIGN KEY ("articleId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_knowledge_base_author"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "employeeId", "articleId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "employeeId", "articleId" FROM "knowledge_base_author"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_author"`);
        await queryRunner.query(`ALTER TABLE "temporary_knowledge_base_author" RENAME TO "knowledge_base_author"`);
        await queryRunner.query(`CREATE INDEX "IDX_1551e821871d9230cc0dafbbe5" ON "knowledge_base_author" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_81558bb2bef673628d92540b4e" ON "knowledge_base_author" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8eb7e413257d7a26104f4e326f" ON "knowledge_base_author" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d5ecab1f06b327bad54553614" ON "knowledge_base_author" ("articleId") `);
    }

    /**
     * SqliteDB Down Migration
     *
     * @param queryRunner
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_2d5ecab1f06b327bad54553614"`);
        await queryRunner.query(`DROP INDEX "IDX_8eb7e413257d7a26104f4e326f"`);
        await queryRunner.query(`DROP INDEX "IDX_81558bb2bef673628d92540b4e"`);
        await queryRunner.query(`DROP INDEX "IDX_1551e821871d9230cc0dafbbe5"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_author" RENAME TO "temporary_knowledge_base_author"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base_author" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "employeeId" varchar NOT NULL, "articleId" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "knowledge_base_author"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "employeeId", "articleId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "employeeId", "articleId" FROM "temporary_knowledge_base_author"`);
        await queryRunner.query(`DROP TABLE "temporary_knowledge_base_author"`);
        await queryRunner.query(`CREATE INDEX "IDX_2d5ecab1f06b327bad54553614" ON "knowledge_base_author" ("articleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8eb7e413257d7a26104f4e326f" ON "knowledge_base_author" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_81558bb2bef673628d92540b4e" ON "knowledge_base_author" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1551e821871d9230cc0dafbbe5" ON "knowledge_base_author" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base_article" RENAME TO "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base_article" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "data" varchar, "draft" boolean NOT NULL, "privacy" boolean NOT NULL, "index" integer NOT NULL, "categoryId" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "knowledge_base_article"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "data", "draft", "privacy", "index", "categoryId" FROM "temporary_knowledge_base_article"`);
        await queryRunner.query(`DROP TABLE "temporary_knowledge_base_article"`);
        await queryRunner.query(`CREATE INDEX "IDX_66af194845635058239e794e1b" ON "knowledge_base_article" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3547f82f867489542ceae58a49" ON "knowledge_base_article" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_06a9902fedc1f9dcdbaf14afb0" ON "knowledge_base_article" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_ff979040ce93cbc60863d322ec"`);
        await queryRunner.query(`DROP INDEX "IDX_2ba72a9dec732a10e8c05bcdec"`);
        await queryRunner.query(`DROP INDEX "IDX_bcb30c9893f4c8d0c4e556b4ed"`);
        await queryRunner.query(`ALTER TABLE "knowledge_base" RENAME TO "temporary_knowledge_base"`);
        await queryRunner.query(`CREATE TABLE "knowledge_base" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "flag" varchar NOT NULL, "icon" varchar NOT NULL, "privacy" varchar NOT NULL, "language" varchar NOT NULL, "color" varchar NOT NULL, "description" varchar, "data" varchar, "index" integer, "parentId" varchar)`);
        await queryRunner.query(`INSERT INTO "knowledge_base"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "flag", "icon", "privacy", "language", "color", "description", "data", "index", "parentId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "flag", "icon", "privacy", "language", "color", "description", "data", "index", "parentId" FROM "temporary_knowledge_base"`);
        await queryRunner.query(`DROP TABLE "temporary_knowledge_base"`);
        await queryRunner.query(`CREATE INDEX "IDX_ff979040ce93cbc60863d322ec" ON "knowledge_base" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ba72a9dec732a10e8c05bcdec" ON "knowledge_base" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_bcb30c9893f4c8d0c4e556b4ed" ON "knowledge_base" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`DROP INDEX "IDX_7719d73cd16a9f57ecc6ac24b3"`);
        await queryRunner.query(`ALTER TABLE "contact" RENAME TO "temporary_contact"`);
        await queryRunner.query(`CREATE TABLE "contact" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "firstName" varchar, "lastName" varchar, "country" varchar, "city" varchar, "address" varchar, "address2" varchar, "postcode" varchar, "latitude" float, "longitude" float, "regionCode" varchar, "fax" varchar, "fiscalInformation" varchar, "website" varchar, CONSTRAINT "FK_7719d73cd16a9f57ecc6ac24b3d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_60468af1ce34043a900809c84f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "contact"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website" FROM "temporary_contact"`);
        await queryRunner.query(`DROP TABLE "temporary_contact"`);
        await queryRunner.query(`CREATE INDEX "IDX_60468af1ce34043a900809c84f" ON "contact" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7719d73cd16a9f57ecc6ac24b3" ON "contact" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_2d5ecab1f06b327bad54553614"`);
        await queryRunner.query(`DROP INDEX "IDX_8eb7e413257d7a26104f4e326f"`);
        await queryRunner.query(`DROP INDEX "IDX_81558bb2bef673628d92540b4e"`);
        await queryRunner.query(`DROP INDEX "IDX_1551e821871d9230cc0dafbbe5"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_author"`);
        await queryRunner.query(`DROP INDEX "IDX_66af194845635058239e794e1b"`);
        await queryRunner.query(`DROP INDEX "IDX_3547f82f867489542ceae58a49"`);
        await queryRunner.query(`DROP INDEX "IDX_06a9902fedc1f9dcdbaf14afb0"`);
        await queryRunner.query(`DROP TABLE "knowledge_base_article"`);
        await queryRunner.query(`DROP INDEX "IDX_ff979040ce93cbc60863d322ec"`);
        await queryRunner.query(`DROP INDEX "IDX_2ba72a9dec732a10e8c05bcdec"`);
        await queryRunner.query(`DROP INDEX "IDX_bcb30c9893f4c8d0c4e556b4ed"`);
        await queryRunner.query(`DROP TABLE "knowledge_base"`);
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
