import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterTimeOffRequestTable1652270907163 implements MigrationInterface {
    name = 'AlterTimeOffRequestTable1652270907163';

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
        await queryRunner.query(`ALTER TABLE "time_off_request" ALTER COLUMN "isHoliday" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "time_off_request" ALTER COLUMN "isHoliday" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "time_off_request" ALTER COLUMN "isArchived" SET DEFAULT false`);
    }

    /**
     * PostgresDB Down Migration
     *
     * @param queryRunner
     */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "time_off_request" ALTER COLUMN "isArchived" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "time_off_request" ALTER COLUMN "isHoliday" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "time_off_request" ALTER COLUMN "isHoliday" SET NOT NULL`);
    }

    /**
     * SqliteDB Up Migration
     *
     * @param queryRunner
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_c1f8ae47dc2f1882afc5045c73"`);
        await queryRunner.query(`DROP INDEX "IDX_981333982a6df8b815957dcbf2"`);
        await queryRunner.query(`DROP INDEX "IDX_4989834dd1c9c8ea3576ed99ce"`);
        await queryRunner.query(`CREATE TABLE "temporary_time_off_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "documentUrl" varchar, "description" varchar, "start" datetime NOT NULL, "end" datetime NOT NULL, "requestDate" datetime NOT NULL, "status" varchar NOT NULL, "isHoliday" boolean NOT NULL, "isArchived" boolean, "policyId" varchar NOT NULL, CONSTRAINT "FK_c1f8ae47dc2f1882afc5045c739" FOREIGN KEY ("policyId") REFERENCES "time_off_policy" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_981333982a6df8b815957dcbf27" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4989834dd1c9c8ea3576ed99ce5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_time_off_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "documentUrl", "description", "start", "end", "requestDate", "status", "isHoliday", "isArchived", "policyId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "documentUrl", "description", "start", "end", "requestDate", "status", "isHoliday", "isArchived", "policyId" FROM "time_off_request"`);
        await queryRunner.query(`DROP TABLE "time_off_request"`);
        await queryRunner.query(`ALTER TABLE "temporary_time_off_request" RENAME TO "time_off_request"`);
        await queryRunner.query(`CREATE INDEX "IDX_c1f8ae47dc2f1882afc5045c73" ON "time_off_request" ("policyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_981333982a6df8b815957dcbf2" ON "time_off_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4989834dd1c9c8ea3576ed99ce" ON "time_off_request" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_c1f8ae47dc2f1882afc5045c73"`);
        await queryRunner.query(`DROP INDEX "IDX_981333982a6df8b815957dcbf2"`);
        await queryRunner.query(`DROP INDEX "IDX_4989834dd1c9c8ea3576ed99ce"`);
        await queryRunner.query(`CREATE TABLE "temporary_time_off_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "documentUrl" varchar, "description" varchar, "start" datetime NOT NULL, "end" datetime NOT NULL, "requestDate" datetime NOT NULL, "status" varchar NOT NULL, "isHoliday" boolean DEFAULT (0), "isArchived" boolean DEFAULT (0), "policyId" varchar NOT NULL, CONSTRAINT "FK_c1f8ae47dc2f1882afc5045c739" FOREIGN KEY ("policyId") REFERENCES "time_off_policy" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_981333982a6df8b815957dcbf27" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4989834dd1c9c8ea3576ed99ce5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_time_off_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "documentUrl", "description", "start", "end", "requestDate", "status", "isHoliday", "isArchived", "policyId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "documentUrl", "description", "start", "end", "requestDate", "status", "isHoliday", "isArchived", "policyId" FROM "time_off_request"`);
        await queryRunner.query(`DROP TABLE "time_off_request"`);
        await queryRunner.query(`ALTER TABLE "temporary_time_off_request" RENAME TO "time_off_request"`);
        await queryRunner.query(`CREATE INDEX "IDX_c1f8ae47dc2f1882afc5045c73" ON "time_off_request" ("policyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_981333982a6df8b815957dcbf2" ON "time_off_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4989834dd1c9c8ea3576ed99ce" ON "time_off_request" ("tenantId") `);
    }

    /**
     * SqliteDB Down Migration
     *
     * @param queryRunner
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_4989834dd1c9c8ea3576ed99ce"`);
        await queryRunner.query(`DROP INDEX "IDX_981333982a6df8b815957dcbf2"`);
        await queryRunner.query(`DROP INDEX "IDX_c1f8ae47dc2f1882afc5045c73"`);
        await queryRunner.query(`ALTER TABLE "time_off_request" RENAME TO "temporary_time_off_request"`);
        await queryRunner.query(`CREATE TABLE "time_off_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "documentUrl" varchar, "description" varchar, "start" datetime NOT NULL, "end" datetime NOT NULL, "requestDate" datetime NOT NULL, "status" varchar NOT NULL, "isHoliday" boolean NOT NULL, "isArchived" boolean, "policyId" varchar NOT NULL, CONSTRAINT "FK_c1f8ae47dc2f1882afc5045c739" FOREIGN KEY ("policyId") REFERENCES "time_off_policy" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_981333982a6df8b815957dcbf27" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4989834dd1c9c8ea3576ed99ce5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "time_off_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "documentUrl", "description", "start", "end", "requestDate", "status", "isHoliday", "isArchived", "policyId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "documentUrl", "description", "start", "end", "requestDate", "status", "isHoliday", "isArchived", "policyId" FROM "temporary_time_off_request"`);
        await queryRunner.query(`DROP TABLE "temporary_time_off_request"`);
        await queryRunner.query(`CREATE INDEX "IDX_4989834dd1c9c8ea3576ed99ce" ON "time_off_request" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_981333982a6df8b815957dcbf2" ON "time_off_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c1f8ae47dc2f1882afc5045c73" ON "time_off_request" ("policyId") `);
        await queryRunner.query(`DROP INDEX "IDX_4989834dd1c9c8ea3576ed99ce"`);
        await queryRunner.query(`DROP INDEX "IDX_981333982a6df8b815957dcbf2"`);
        await queryRunner.query(`DROP INDEX "IDX_c1f8ae47dc2f1882afc5045c73"`);
        await queryRunner.query(`ALTER TABLE "time_off_request" RENAME TO "temporary_time_off_request"`);
        await queryRunner.query(`CREATE TABLE "time_off_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "documentUrl" varchar, "description" varchar, "start" datetime NOT NULL, "end" datetime NOT NULL, "requestDate" datetime NOT NULL, "status" varchar NOT NULL, "isHoliday" boolean NOT NULL, "isArchived" boolean, "policyId" varchar NOT NULL, CONSTRAINT "FK_c1f8ae47dc2f1882afc5045c739" FOREIGN KEY ("policyId") REFERENCES "time_off_policy" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_981333982a6df8b815957dcbf27" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4989834dd1c9c8ea3576ed99ce5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "time_off_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "documentUrl", "description", "start", "end", "requestDate", "status", "isHoliday", "isArchived", "policyId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "documentUrl", "description", "start", "end", "requestDate", "status", "isHoliday", "isArchived", "policyId" FROM "temporary_time_off_request"`);
        await queryRunner.query(`DROP TABLE "temporary_time_off_request"`);
        await queryRunner.query(`CREATE INDEX "IDX_4989834dd1c9c8ea3576ed99ce" ON "time_off_request" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_981333982a6df8b815957dcbf2" ON "time_off_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c1f8ae47dc2f1882afc5045c73" ON "time_off_request" ("policyId") `);
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
