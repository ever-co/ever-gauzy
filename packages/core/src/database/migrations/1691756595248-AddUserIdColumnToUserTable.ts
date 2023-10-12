
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';

export class AddUserIdColumnToUserTable1691756595248 implements MigrationInterface {

    name = 'AddUserIdColumnToUserTable1691756595248';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(`AddUserIdColumnToUserTable1691756595248 start running!`));

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
        await queryRunner.query(`ALTER TABLE "screenshot" ADD "userId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_fa1896dc735403799311968f7e" ON "screenshot" ("userId") `);
        await queryRunner.query(`ALTER TABLE "screenshot" ADD CONSTRAINT "FK_fa1896dc735403799311968f7ec" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "screenshot" DROP CONSTRAINT "FK_fa1896dc735403799311968f7ec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fa1896dc735403799311968f7e"`);
        await queryRunner.query(`ALTER TABLE "screenshot" DROP COLUMN "userId"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_2b374e5cdee1145ebb2a832f20"`);
        await queryRunner.query(`DROP INDEX "IDX_785958f324b568a307c9496909"`);
        await queryRunner.query(`DROP INDEX "IDX_3d7feb5fe793e4811cdb79f983"`);
        await queryRunner.query(`DROP INDEX "IDX_235004f3dafac90692cd64d915"`);
        await queryRunner.query(`DROP INDEX "IDX_0951aacffe3f8d0cff54cf2f34"`);
        await queryRunner.query(`DROP INDEX "IDX_5b594d02d98d5defcde323abe5"`);
        await queryRunner.query(`CREATE TABLE "temporary_screenshot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "file" varchar NOT NULL, "thumb" varchar, "recordedAt" datetime, "deletedAt" datetime, "timeSlotId" varchar, "storageProvider" varchar, "userId" varchar, CONSTRAINT "FK_235004f3dafac90692cd64d9158" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0951aacffe3f8d0cff54cf2f341" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5b594d02d98d5defcde323abe5b" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_screenshot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId", "storageProvider") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId", "storageProvider" FROM "screenshot"`);
        await queryRunner.query(`DROP TABLE "screenshot"`);
        await queryRunner.query(`ALTER TABLE "temporary_screenshot" RENAME TO "screenshot"`);
        await queryRunner.query(`CREATE INDEX "IDX_2b374e5cdee1145ebb2a832f20" ON "screenshot" ("storageProvider") `);
        await queryRunner.query(`CREATE INDEX "IDX_785958f324b568a307c9496909" ON "screenshot" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_3d7feb5fe793e4811cdb79f983" ON "screenshot" ("recordedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_235004f3dafac90692cd64d915" ON "screenshot" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0951aacffe3f8d0cff54cf2f34" ON "screenshot" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5b594d02d98d5defcde323abe5" ON "screenshot" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa1896dc735403799311968f7e" ON "screenshot" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_2b374e5cdee1145ebb2a832f20"`);
        await queryRunner.query(`DROP INDEX "IDX_785958f324b568a307c9496909"`);
        await queryRunner.query(`DROP INDEX "IDX_3d7feb5fe793e4811cdb79f983"`);
        await queryRunner.query(`DROP INDEX "IDX_235004f3dafac90692cd64d915"`);
        await queryRunner.query(`DROP INDEX "IDX_0951aacffe3f8d0cff54cf2f34"`);
        await queryRunner.query(`DROP INDEX "IDX_5b594d02d98d5defcde323abe5"`);
        await queryRunner.query(`DROP INDEX "IDX_fa1896dc735403799311968f7e"`);
        await queryRunner.query(`CREATE TABLE "temporary_screenshot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "file" varchar NOT NULL, "thumb" varchar, "recordedAt" datetime, "deletedAt" datetime, "timeSlotId" varchar, "storageProvider" varchar, "userId" varchar, CONSTRAINT "FK_235004f3dafac90692cd64d9158" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0951aacffe3f8d0cff54cf2f341" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5b594d02d98d5defcde323abe5b" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fa1896dc735403799311968f7ec" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_screenshot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId", "storageProvider", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId", "storageProvider", "userId" FROM "screenshot"`);
        await queryRunner.query(`DROP TABLE "screenshot"`);
        await queryRunner.query(`ALTER TABLE "temporary_screenshot" RENAME TO "screenshot"`);
        await queryRunner.query(`CREATE INDEX "IDX_2b374e5cdee1145ebb2a832f20" ON "screenshot" ("storageProvider") `);
        await queryRunner.query(`CREATE INDEX "IDX_785958f324b568a307c9496909" ON "screenshot" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_3d7feb5fe793e4811cdb79f983" ON "screenshot" ("recordedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_235004f3dafac90692cd64d915" ON "screenshot" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0951aacffe3f8d0cff54cf2f34" ON "screenshot" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5b594d02d98d5defcde323abe5" ON "screenshot" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa1896dc735403799311968f7e" ON "screenshot" ("userId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_fa1896dc735403799311968f7e"`);
        await queryRunner.query(`DROP INDEX "IDX_5b594d02d98d5defcde323abe5"`);
        await queryRunner.query(`DROP INDEX "IDX_0951aacffe3f8d0cff54cf2f34"`);
        await queryRunner.query(`DROP INDEX "IDX_235004f3dafac90692cd64d915"`);
        await queryRunner.query(`DROP INDEX "IDX_3d7feb5fe793e4811cdb79f983"`);
        await queryRunner.query(`DROP INDEX "IDX_785958f324b568a307c9496909"`);
        await queryRunner.query(`DROP INDEX "IDX_2b374e5cdee1145ebb2a832f20"`);
        await queryRunner.query(`ALTER TABLE "screenshot" RENAME TO "temporary_screenshot"`);
        await queryRunner.query(`CREATE TABLE "screenshot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "file" varchar NOT NULL, "thumb" varchar, "recordedAt" datetime, "deletedAt" datetime, "timeSlotId" varchar, "storageProvider" varchar, "userId" varchar, CONSTRAINT "FK_235004f3dafac90692cd64d9158" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0951aacffe3f8d0cff54cf2f341" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5b594d02d98d5defcde323abe5b" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "screenshot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId", "storageProvider", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId", "storageProvider", "userId" FROM "temporary_screenshot"`);
        await queryRunner.query(`DROP TABLE "temporary_screenshot"`);
        await queryRunner.query(`CREATE INDEX "IDX_fa1896dc735403799311968f7e" ON "screenshot" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5b594d02d98d5defcde323abe5" ON "screenshot" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0951aacffe3f8d0cff54cf2f34" ON "screenshot" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_235004f3dafac90692cd64d915" ON "screenshot" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3d7feb5fe793e4811cdb79f983" ON "screenshot" ("recordedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_785958f324b568a307c9496909" ON "screenshot" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_2b374e5cdee1145ebb2a832f20" ON "screenshot" ("storageProvider") `);
        await queryRunner.query(`DROP INDEX "IDX_fa1896dc735403799311968f7e"`);
        await queryRunner.query(`DROP INDEX "IDX_5b594d02d98d5defcde323abe5"`);
        await queryRunner.query(`DROP INDEX "IDX_0951aacffe3f8d0cff54cf2f34"`);
        await queryRunner.query(`DROP INDEX "IDX_235004f3dafac90692cd64d915"`);
        await queryRunner.query(`DROP INDEX "IDX_3d7feb5fe793e4811cdb79f983"`);
        await queryRunner.query(`DROP INDEX "IDX_785958f324b568a307c9496909"`);
        await queryRunner.query(`DROP INDEX "IDX_2b374e5cdee1145ebb2a832f20"`);
        await queryRunner.query(`ALTER TABLE "screenshot" RENAME TO "temporary_screenshot"`);
        await queryRunner.query(`CREATE TABLE "screenshot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "file" varchar NOT NULL, "thumb" varchar, "recordedAt" datetime, "deletedAt" datetime, "timeSlotId" varchar, "storageProvider" varchar, CONSTRAINT "FK_235004f3dafac90692cd64d9158" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0951aacffe3f8d0cff54cf2f341" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5b594d02d98d5defcde323abe5b" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "screenshot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId", "storageProvider") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "file", "thumb", "recordedAt", "deletedAt", "timeSlotId", "storageProvider" FROM "temporary_screenshot"`);
        await queryRunner.query(`DROP TABLE "temporary_screenshot"`);
        await queryRunner.query(`CREATE INDEX "IDX_5b594d02d98d5defcde323abe5" ON "screenshot" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0951aacffe3f8d0cff54cf2f34" ON "screenshot" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_235004f3dafac90692cd64d915" ON "screenshot" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3d7feb5fe793e4811cdb79f983" ON "screenshot" ("recordedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_785958f324b568a307c9496909" ON "screenshot" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_2b374e5cdee1145ebb2a832f20" ON "screenshot" ("storageProvider") `);
    }
}
