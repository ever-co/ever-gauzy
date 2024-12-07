import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterScreenshotTable1646117679347 implements MigrationInterface {
    name = 'AlterScreenshotTable1646117679347';

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
        await queryRunner.query(`CREATE TYPE "public"."screenshot_storageprovider_enum" AS ENUM('LOCAL', 'S3', 'WASABI')`);
        await queryRunner.query(`ALTER TABLE "screenshot" ADD "storageProvider" "public"."screenshot_storageprovider_enum"`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "screenshot" DROP COLUMN "storageProvider"`);
        await queryRunner.query(`DROP TYPE "public"."screenshot_storageprovider_enum"`);
    }


    /**
   * SqliteDB Up Migration
   *
   * @param queryRunner
   */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_5b594d02d98d5defcde323abe5"`);
        await queryRunner.query(`DROP INDEX "IDX_0951aacffe3f8d0cff54cf2f34"`);
        await queryRunner.query(`DROP INDEX "IDX_235004f3dafac90692cd64d915"`);
        await queryRunner.query(`CREATE TABLE "temporary_screenshot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "file" varchar NOT NULL, "thumb" varchar, "recordedAt" datetime, "deletedAt" datetime, "timeSlotId" varchar, "storageProvider" varchar CHECK( storageProvider IN ('LOCAL','S3','WASABI') ), CONSTRAINT "FK_5b594d02d98d5defcde323abe5b" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0951aacffe3f8d0cff54cf2f341" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_235004f3dafac90692cd64d9158" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_screenshot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId" FROM "screenshot"`);
        await queryRunner.query(`DROP TABLE "screenshot"`);
        await queryRunner.query(`ALTER TABLE "temporary_screenshot" RENAME TO "screenshot"`);
        await queryRunner.query(`CREATE INDEX "IDX_5b594d02d98d5defcde323abe5" ON "screenshot" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0951aacffe3f8d0cff54cf2f34" ON "screenshot" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_235004f3dafac90692cd64d915" ON "screenshot" ("tenantId") `);
    }

    /**
     * SqliteDB Down Migration
     *
     * @param queryRunner
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_235004f3dafac90692cd64d915"`);
        await queryRunner.query(`DROP INDEX "IDX_0951aacffe3f8d0cff54cf2f34"`);
        await queryRunner.query(`DROP INDEX "IDX_5b594d02d98d5defcde323abe5"`);
        await queryRunner.query(`ALTER TABLE "screenshot" RENAME TO "temporary_screenshot"`);
        await queryRunner.query(`CREATE TABLE "screenshot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "file" varchar NOT NULL, "thumb" varchar, "recordedAt" datetime, "deletedAt" datetime, "timeSlotId" varchar, CONSTRAINT "FK_5b594d02d98d5defcde323abe5b" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0951aacffe3f8d0cff54cf2f341" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_235004f3dafac90692cd64d9158" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "screenshot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId" FROM "temporary_screenshot"`);
        await queryRunner.query(`DROP TABLE "temporary_screenshot"`);
        await queryRunner.query(`CREATE INDEX "IDX_235004f3dafac90692cd64d915" ON "screenshot" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0951aacffe3f8d0cff54cf2f34" ON "screenshot" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5b594d02d98d5defcde323abe5" ON "screenshot" ("timeSlotId") `);
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
