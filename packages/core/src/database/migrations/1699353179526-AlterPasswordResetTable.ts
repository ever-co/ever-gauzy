
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterPasswordResetTable1699353179526 implements MigrationInterface {

    name = 'AlterPasswordResetTable1699353179526';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
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
        await queryRunner.query(`ALTER TABLE "password_reset" ADD "tenantId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_1fa632f2d12a06ef8dcc00858f" ON "password_reset" ("tenantId") `);
        await queryRunner.query(`ALTER TABLE "password_reset" ADD CONSTRAINT "FK_1fa632f2d12a06ef8dcc00858ff" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "password_reset" DROP CONSTRAINT "FK_1fa632f2d12a06ef8dcc00858ff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1fa632f2d12a06ef8dcc00858f"`);
        await queryRunner.query(`ALTER TABLE "password_reset" DROP COLUMN "tenantId"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_36e929b98372d961bb63bd4b4e"`);
        await queryRunner.query(`DROP INDEX "IDX_1c88db6e50f0704688d1f1978c"`);
        await queryRunner.query(`DROP INDEX "IDX_380c03025a41ad032191f1ef2d"`);
        await queryRunner.query(`DROP INDEX "IDX_e71a736d52820b568f6b0ca203"`);
        await queryRunner.query(`CREATE TABLE "temporary_password_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "email" varchar NOT NULL, "token" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "tenantId" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_password_reset"("id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt") SELECT "id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt" FROM "password_reset"`);
        await queryRunner.query(`DROP TABLE "password_reset"`);
        await queryRunner.query(`ALTER TABLE "temporary_password_reset" RENAME TO "password_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_36e929b98372d961bb63bd4b4e" ON "password_reset" ("token") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c88db6e50f0704688d1f1978c" ON "password_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_380c03025a41ad032191f1ef2d" ON "password_reset" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_e71a736d52820b568f6b0ca203" ON "password_reset" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1fa632f2d12a06ef8dcc00858f" ON "password_reset" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_36e929b98372d961bb63bd4b4e"`);
        await queryRunner.query(`DROP INDEX "IDX_1c88db6e50f0704688d1f1978c"`);
        await queryRunner.query(`DROP INDEX "IDX_380c03025a41ad032191f1ef2d"`);
        await queryRunner.query(`DROP INDEX "IDX_e71a736d52820b568f6b0ca203"`);
        await queryRunner.query(`DROP INDEX "IDX_1fa632f2d12a06ef8dcc00858f"`);
        await queryRunner.query(`CREATE TABLE "temporary_password_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "email" varchar NOT NULL, "token" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "tenantId" varchar, CONSTRAINT "FK_1fa632f2d12a06ef8dcc00858ff" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_password_reset"("id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId") SELECT "id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId" FROM "password_reset"`);
        await queryRunner.query(`DROP TABLE "password_reset"`);
        await queryRunner.query(`ALTER TABLE "temporary_password_reset" RENAME TO "password_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_36e929b98372d961bb63bd4b4e" ON "password_reset" ("token") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c88db6e50f0704688d1f1978c" ON "password_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_380c03025a41ad032191f1ef2d" ON "password_reset" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_e71a736d52820b568f6b0ca203" ON "password_reset" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1fa632f2d12a06ef8dcc00858f" ON "password_reset" ("tenantId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_1fa632f2d12a06ef8dcc00858f"`);
        await queryRunner.query(`DROP INDEX "IDX_e71a736d52820b568f6b0ca203"`);
        await queryRunner.query(`DROP INDEX "IDX_380c03025a41ad032191f1ef2d"`);
        await queryRunner.query(`DROP INDEX "IDX_1c88db6e50f0704688d1f1978c"`);
        await queryRunner.query(`DROP INDEX "IDX_36e929b98372d961bb63bd4b4e"`);
        await queryRunner.query(`ALTER TABLE "password_reset" RENAME TO "temporary_password_reset"`);
        await queryRunner.query(`CREATE TABLE "password_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "email" varchar NOT NULL, "token" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "tenantId" varchar)`);
        await queryRunner.query(`INSERT INTO "password_reset"("id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId") SELECT "id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId" FROM "temporary_password_reset"`);
        await queryRunner.query(`DROP TABLE "temporary_password_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_1fa632f2d12a06ef8dcc00858f" ON "password_reset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e71a736d52820b568f6b0ca203" ON "password_reset" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_380c03025a41ad032191f1ef2d" ON "password_reset" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c88db6e50f0704688d1f1978c" ON "password_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_36e929b98372d961bb63bd4b4e" ON "password_reset" ("token") `);
        await queryRunner.query(`DROP INDEX "IDX_1fa632f2d12a06ef8dcc00858f"`);
        await queryRunner.query(`DROP INDEX "IDX_e71a736d52820b568f6b0ca203"`);
        await queryRunner.query(`DROP INDEX "IDX_380c03025a41ad032191f1ef2d"`);
        await queryRunner.query(`DROP INDEX "IDX_1c88db6e50f0704688d1f1978c"`);
        await queryRunner.query(`DROP INDEX "IDX_36e929b98372d961bb63bd4b4e"`);
        await queryRunner.query(`ALTER TABLE "password_reset" RENAME TO "temporary_password_reset"`);
        await queryRunner.query(`CREATE TABLE "password_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "email" varchar NOT NULL, "token" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime)`);
        await queryRunner.query(`INSERT INTO "password_reset"("id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt") SELECT "id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt" FROM "temporary_password_reset"`);
        await queryRunner.query(`DROP TABLE "temporary_password_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_e71a736d52820b568f6b0ca203" ON "password_reset" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_380c03025a41ad032191f1ef2d" ON "password_reset" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c88db6e50f0704688d1f1978c" ON "password_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_36e929b98372d961bb63bd4b4e" ON "password_reset" ("token") `);
    }
}
