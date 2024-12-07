import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterEmailResetTable1678461100447 implements MigrationInterface {

    name = 'AlterEmailResetTable1678461100447';

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
        await queryRunner.query(`ALTER TABLE "email_reset" DROP CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345"`);
        await queryRunner.query(`ALTER TABLE "email_reset" ADD "token" character varying`);
        await queryRunner.query(`ALTER TABLE "email_reset" ADD "expiredAt" TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `);
        await queryRunner.query(`ALTER TABLE "email_reset" ADD CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "email_reset" DROP CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4ac734f2a1a3c055dca04fba99"`);
        await queryRunner.query(`ALTER TABLE "email_reset" DROP COLUMN "expiredAt"`);
        await queryRunner.query(`ALTER TABLE "email_reset" DROP COLUMN "token"`);
        await queryRunner.query(`ALTER TABLE "email_reset" ADD CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
        await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
        await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
        await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
        await queryRunner.query(`CREATE TABLE "temporary_email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId" FROM "email_reset"`);
        await queryRunner.query(`DROP TABLE "email_reset"`);
        await queryRunner.query(`ALTER TABLE "temporary_email_reset" RENAME TO "email_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `);
        await queryRunner.query(`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
        await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
        await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
        await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
        await queryRunner.query(`CREATE TABLE "temporary_email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, "token" varchar, "expiredAt" datetime, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId" FROM "email_reset"`);
        await queryRunner.query(`DROP TABLE "email_reset"`);
        await queryRunner.query(`ALTER TABLE "temporary_email_reset" RENAME TO "email_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `);
        await queryRunner.query(`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `);
        await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
        await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
        await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
        await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
        await queryRunner.query(`DROP INDEX "IDX_4ac734f2a1a3c055dca04fba99"`);
        await queryRunner.query(`CREATE TABLE "temporary_email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, "token" varchar, "expiredAt" datetime, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt" FROM "email_reset"`);
        await queryRunner.query(`DROP TABLE "email_reset"`);
        await queryRunner.query(`ALTER TABLE "temporary_email_reset" RENAME TO "email_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `);
        await queryRunner.query(`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_4ac734f2a1a3c055dca04fba99"`);
        await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
        await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
        await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
        await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
        await queryRunner.query(`ALTER TABLE "email_reset" RENAME TO "temporary_email_reset"`);
        await queryRunner.query(`CREATE TABLE "email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, "token" varchar, "expiredAt" datetime, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt" FROM "temporary_email_reset"`);
        await queryRunner.query(`DROP TABLE "temporary_email_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `);
        await queryRunner.query(`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_4ac734f2a1a3c055dca04fba99"`);
        await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
        await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
        await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
        await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
        await queryRunner.query(`ALTER TABLE "email_reset" RENAME TO "temporary_email_reset"`);
        await queryRunner.query(`CREATE TABLE "email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId" FROM "temporary_email_reset"`);
        await queryRunner.query(`DROP TABLE "temporary_email_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
        await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
        await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
        await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
        await queryRunner.query(`ALTER TABLE "email_reset" RENAME TO "temporary_email_reset"`);
        await queryRunner.query(`CREATE TABLE "email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId" FROM "temporary_email_reset"`);
        await queryRunner.query(`DROP TABLE "temporary_email_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `);
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
