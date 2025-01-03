import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterActivityTable1640784835692 implements MigrationInterface {

    name = 'AlterActivityTable1640784835692';

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
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "title" DROP NOT NULL`);
    }

    /**
     * PostgresDB Down Migration
     *
     * @param queryRunner
     */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "title" SET NOT NULL`);
    }

    /**
     * SqliteDB Up Migration
     *
     * @param queryRunner
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_2743f8990fde12f9586287eb09"`);
        await queryRunner.query(`DROP INDEX "IDX_4e382caaf07ab0923b2e06bf91"`);
        await queryRunner.query(`DROP INDEX "IDX_5a898f44fa31ef7916f0c38b01"`);
        await queryRunner.query(`DROP INDEX "IDX_a6f74ae99d549932391f0f4460"`);
        await queryRunner.query(`DROP INDEX "IDX_fdb3f018c2bba4885bfa5757d1"`);
        await queryRunner.query(`DROP INDEX "IDX_f2401d8fdff5d8970dfe30d3ae"`);
        await queryRunner.query(`CREATE TABLE "temporary_activity" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "metaData" text, "date" date NOT NULL DEFAULT (datetime('now')), "time" time NOT NULL DEFAULT (datetime('now')), "duration" integer NOT NULL DEFAULT (0), "type" varchar, "source" varchar NOT NULL DEFAULT ('BROWSER'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "projectId" varchar, "timeSlotId" varchar, "taskId" varchar, CONSTRAINT "FK_2743f8990fde12f9586287eb09f" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_4e382caaf07ab0923b2e06bf918" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a898f44fa31ef7916f0c38b016" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_a6f74ae99d549932391f0f44609" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fdb3f018c2bba4885bfa5757d16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f2401d8fdff5d8970dfe30d3aed" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_activity"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId" FROM "activity"`);
        await queryRunner.query(`DROP TABLE "activity"`);
        await queryRunner.query(`ALTER TABLE "temporary_activity" RENAME TO "activity"`);
        await queryRunner.query(`CREATE INDEX "IDX_2743f8990fde12f9586287eb09" ON "activity" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e382caaf07ab0923b2e06bf91" ON "activity" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a898f44fa31ef7916f0c38b01" ON "activity" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6f74ae99d549932391f0f4460" ON "activity" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdb3f018c2bba4885bfa5757d1" ON "activity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2401d8fdff5d8970dfe30d3ae" ON "activity" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`DROP INDEX "IDX_7719d73cd16a9f57ecc6ac24b3"`);
        await queryRunner.query(`CREATE TABLE "temporary_contact" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "firstName" varchar, "lastName" varchar, "country" varchar, "city" varchar, "address" varchar, "address2" varchar, "postcode" varchar, "latitude" float, "longitude" float, "regionCode" varchar, "fax" varchar, "fiscalInformation" varchar, "website" varchar, CONSTRAINT "FK_60468af1ce34043a900809c84f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7719d73cd16a9f57ecc6ac24b3d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_contact"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website" FROM "contact"`);
        await queryRunner.query(`DROP TABLE "contact"`);
        await queryRunner.query(`ALTER TABLE "temporary_contact" RENAME TO "contact"`);
        await queryRunner.query(`CREATE INDEX "IDX_60468af1ce34043a900809c84f" ON "contact" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7719d73cd16a9f57ecc6ac24b3" ON "contact" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_ae4578dcaed5adff96595e6166"`);
        await queryRunner.query(`DROP INDEX "IDX_1751a572e91385a09d41c62471"`);
        await queryRunner.query(`CREATE TABLE "temporary_role" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "name" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_1751a572e91385a09d41c624714" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_role"("id", "createdAt", "updatedAt", "tenantId", "name", "isSystem") SELECT "id", "createdAt", "updatedAt", "tenantId", "name", "isSystem" FROM "role"`);
        await queryRunner.query(`DROP TABLE "role"`);
        await queryRunner.query(`ALTER TABLE "temporary_role" RENAME TO "role"`);
        await queryRunner.query(`CREATE INDEX "IDX_ae4578dcaed5adff96595e6166" ON "role" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_1751a572e91385a09d41c62471" ON "role" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_2743f8990fde12f9586287eb09"`);
        await queryRunner.query(`DROP INDEX "IDX_4e382caaf07ab0923b2e06bf91"`);
        await queryRunner.query(`DROP INDEX "IDX_5a898f44fa31ef7916f0c38b01"`);
        await queryRunner.query(`DROP INDEX "IDX_a6f74ae99d549932391f0f4460"`);
        await queryRunner.query(`DROP INDEX "IDX_fdb3f018c2bba4885bfa5757d1"`);
        await queryRunner.query(`DROP INDEX "IDX_f2401d8fdff5d8970dfe30d3ae"`);
        await queryRunner.query(`CREATE TABLE "temporary_activity" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar, "description" varchar, "metaData" text, "date" date NOT NULL DEFAULT (datetime('now')), "time" time NOT NULL DEFAULT (datetime('now')), "duration" integer NOT NULL DEFAULT (0), "type" varchar, "source" varchar NOT NULL DEFAULT ('BROWSER'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "projectId" varchar, "timeSlotId" varchar, "taskId" varchar, CONSTRAINT "FK_2743f8990fde12f9586287eb09f" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_4e382caaf07ab0923b2e06bf918" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a898f44fa31ef7916f0c38b016" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_a6f74ae99d549932391f0f44609" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fdb3f018c2bba4885bfa5757d16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f2401d8fdff5d8970dfe30d3aed" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_activity"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId" FROM "activity"`);
        await queryRunner.query(`DROP TABLE "activity"`);
        await queryRunner.query(`ALTER TABLE "temporary_activity" RENAME TO "activity"`);
        await queryRunner.query(`CREATE INDEX "IDX_2743f8990fde12f9586287eb09" ON "activity" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e382caaf07ab0923b2e06bf91" ON "activity" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a898f44fa31ef7916f0c38b01" ON "activity" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6f74ae99d549932391f0f4460" ON "activity" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdb3f018c2bba4885bfa5757d1" ON "activity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2401d8fdff5d8970dfe30d3ae" ON "activity" ("tenantId") `);
    }

    /**
     * SqliteDB Down Migration
     *
     * @param queryRunner
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_f2401d8fdff5d8970dfe30d3ae"`);
        await queryRunner.query(`DROP INDEX "IDX_fdb3f018c2bba4885bfa5757d1"`);
        await queryRunner.query(`DROP INDEX "IDX_a6f74ae99d549932391f0f4460"`);
        await queryRunner.query(`DROP INDEX "IDX_5a898f44fa31ef7916f0c38b01"`);
        await queryRunner.query(`DROP INDEX "IDX_4e382caaf07ab0923b2e06bf91"`);
        await queryRunner.query(`DROP INDEX "IDX_2743f8990fde12f9586287eb09"`);
        await queryRunner.query(`ALTER TABLE "activity" RENAME TO "temporary_activity"`);
        await queryRunner.query(`CREATE TABLE "activity" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "metaData" text, "date" date NOT NULL DEFAULT (datetime('now')), "time" time NOT NULL DEFAULT (datetime('now')), "duration" integer NOT NULL DEFAULT (0), "type" varchar, "source" varchar NOT NULL DEFAULT ('BROWSER'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "projectId" varchar, "timeSlotId" varchar, "taskId" varchar, CONSTRAINT "FK_2743f8990fde12f9586287eb09f" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_4e382caaf07ab0923b2e06bf918" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a898f44fa31ef7916f0c38b016" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_a6f74ae99d549932391f0f44609" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fdb3f018c2bba4885bfa5757d16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f2401d8fdff5d8970dfe30d3aed" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "activity"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId" FROM "temporary_activity"`);
        await queryRunner.query(`DROP TABLE "temporary_activity"`);
        await queryRunner.query(`CREATE INDEX "IDX_f2401d8fdff5d8970dfe30d3ae" ON "activity" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdb3f018c2bba4885bfa5757d1" ON "activity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6f74ae99d549932391f0f4460" ON "activity" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a898f44fa31ef7916f0c38b01" ON "activity" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e382caaf07ab0923b2e06bf91" ON "activity" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2743f8990fde12f9586287eb09" ON "activity" ("taskId") `);
        await queryRunner.query(`DROP INDEX "IDX_1751a572e91385a09d41c62471"`);
        await queryRunner.query(`DROP INDEX "IDX_ae4578dcaed5adff96595e6166"`);
        await queryRunner.query(`ALTER TABLE "role" RENAME TO "temporary_role"`);
        await queryRunner.query(`CREATE TABLE "role" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "name" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (false), CONSTRAINT "FK_1751a572e91385a09d41c624714" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "role"("id", "createdAt", "updatedAt", "tenantId", "name", "isSystem") SELECT "id", "createdAt", "updatedAt", "tenantId", "name", "isSystem" FROM "temporary_role"`);
        await queryRunner.query(`DROP TABLE "temporary_role"`);
        await queryRunner.query(`CREATE INDEX "IDX_1751a572e91385a09d41c62471" ON "role" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ae4578dcaed5adff96595e6166" ON "role" ("name") `);
        await queryRunner.query(`DROP INDEX "IDX_7719d73cd16a9f57ecc6ac24b3"`);
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`ALTER TABLE "contact" RENAME TO "temporary_contact"`);
        await queryRunner.query(`CREATE TABLE "contact" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "firstName" varchar, "lastName" varchar, "country" varchar, "city" varchar, "address" varchar, "address2" varchar, "postcode" varchar, "latitude" float, "longitude" float, "regionCode" varchar, "fax" varchar, "fiscalInformation" varchar, "website" varchar, CONSTRAINT "FK_60468af1ce34043a900809c84f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7719d73cd16a9f57ecc6ac24b3d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "contact"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website" FROM "temporary_contact"`);
        await queryRunner.query(`DROP TABLE "temporary_contact"`);
        await queryRunner.query(`CREATE INDEX "IDX_7719d73cd16a9f57ecc6ac24b3" ON "contact" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_60468af1ce34043a900809c84f" ON "contact" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_f2401d8fdff5d8970dfe30d3ae"`);
        await queryRunner.query(`DROP INDEX "IDX_fdb3f018c2bba4885bfa5757d1"`);
        await queryRunner.query(`DROP INDEX "IDX_a6f74ae99d549932391f0f4460"`);
        await queryRunner.query(`DROP INDEX "IDX_5a898f44fa31ef7916f0c38b01"`);
        await queryRunner.query(`DROP INDEX "IDX_4e382caaf07ab0923b2e06bf91"`);
        await queryRunner.query(`DROP INDEX "IDX_2743f8990fde12f9586287eb09"`);
        await queryRunner.query(`ALTER TABLE "activity" RENAME TO "temporary_activity"`);
        await queryRunner.query(`CREATE TABLE "activity" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "metaData" text, "date" date NOT NULL DEFAULT (datetime('now')), "time" time NOT NULL DEFAULT (datetime('now')), "duration" integer NOT NULL DEFAULT (0), "type" varchar, "source" varchar NOT NULL DEFAULT ('BROWSER'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "projectId" varchar, "timeSlotId" varchar, "taskId" varchar, CONSTRAINT "FK_2743f8990fde12f9586287eb09f" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_4e382caaf07ab0923b2e06bf918" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a898f44fa31ef7916f0c38b016" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_a6f74ae99d549932391f0f44609" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fdb3f018c2bba4885bfa5757d16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f2401d8fdff5d8970dfe30d3aed" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "activity"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId" FROM "temporary_activity"`);
        await queryRunner.query(`DROP TABLE "temporary_activity"`);
        await queryRunner.query(`CREATE INDEX "IDX_f2401d8fdff5d8970dfe30d3ae" ON "activity" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdb3f018c2bba4885bfa5757d1" ON "activity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6f74ae99d549932391f0f4460" ON "activity" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a898f44fa31ef7916f0c38b01" ON "activity" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e382caaf07ab0923b2e06bf91" ON "activity" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2743f8990fde12f9586287eb09" ON "activity" ("taskId") `);
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
