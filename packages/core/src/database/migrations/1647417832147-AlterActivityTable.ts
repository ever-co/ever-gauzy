import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterActivityTable1647417832147 implements MigrationInterface {

    name = 'AlterActivityTable1647417832147';

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
        await queryRunner.query(`ALTER TABLE "activity" ADD "recordedAt" TIMESTAMP`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "activity" DROP COLUMN "recordedAt"`);
    }

    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_f2401d8fdff5d8970dfe30d3ae"`);
        await queryRunner.query(`DROP INDEX "IDX_fdb3f018c2bba4885bfa5757d1"`);
        await queryRunner.query(`DROP INDEX "IDX_a6f74ae99d549932391f0f4460"`);
        await queryRunner.query(`DROP INDEX "IDX_5a898f44fa31ef7916f0c38b01"`);
        await queryRunner.query(`DROP INDEX "IDX_4e382caaf07ab0923b2e06bf91"`);
        await queryRunner.query(`DROP INDEX "IDX_2743f8990fde12f9586287eb09"`);
        await queryRunner.query(`CREATE TABLE "temporary_activity" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar, "description" varchar, "metaData" text, "date" date NOT NULL DEFAULT (datetime('now')), "time" time NOT NULL DEFAULT (datetime('now')), "duration" integer NOT NULL DEFAULT (0), "type" varchar, "source" varchar NOT NULL DEFAULT ('BROWSER'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "projectId" varchar, "timeSlotId" varchar, "taskId" varchar, "recordedAt" datetime, CONSTRAINT "FK_f2401d8fdff5d8970dfe30d3aed" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fdb3f018c2bba4885bfa5757d16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a6f74ae99d549932391f0f44609" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a898f44fa31ef7916f0c38b016" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_4e382caaf07ab0923b2e06bf918" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2743f8990fde12f9586287eb09f" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_activity"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId" FROM "activity"`);
        await queryRunner.query(`DROP TABLE "activity"`);
        await queryRunner.query(`ALTER TABLE "temporary_activity" RENAME TO "activity"`);
        await queryRunner.query(`CREATE INDEX "IDX_f2401d8fdff5d8970dfe30d3ae" ON "activity" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdb3f018c2bba4885bfa5757d1" ON "activity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6f74ae99d549932391f0f4460" ON "activity" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a898f44fa31ef7916f0c38b01" ON "activity" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e382caaf07ab0923b2e06bf91" ON "activity" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2743f8990fde12f9586287eb09" ON "activity" ("taskId") `);
    }

    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_2743f8990fde12f9586287eb09"`);
        await queryRunner.query(`DROP INDEX "IDX_4e382caaf07ab0923b2e06bf91"`);
        await queryRunner.query(`DROP INDEX "IDX_5a898f44fa31ef7916f0c38b01"`);
        await queryRunner.query(`DROP INDEX "IDX_a6f74ae99d549932391f0f4460"`);
        await queryRunner.query(`DROP INDEX "IDX_fdb3f018c2bba4885bfa5757d1"`);
        await queryRunner.query(`DROP INDEX "IDX_f2401d8fdff5d8970dfe30d3ae"`);
        await queryRunner.query(`ALTER TABLE "activity" RENAME TO "temporary_activity"`);
        await queryRunner.query(`CREATE TABLE "activity" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar, "description" varchar, "metaData" text, "date" date NOT NULL DEFAULT (datetime('now')), "time" time NOT NULL DEFAULT (datetime('now')), "duration" integer NOT NULL DEFAULT (0), "type" varchar, "source" varchar NOT NULL DEFAULT ('BROWSER'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "projectId" varchar, "timeSlotId" varchar, "taskId" varchar, CONSTRAINT "FK_f2401d8fdff5d8970dfe30d3aed" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fdb3f018c2bba4885bfa5757d16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a6f74ae99d549932391f0f44609" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a898f44fa31ef7916f0c38b016" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_4e382caaf07ab0923b2e06bf918" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2743f8990fde12f9586287eb09f" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "activity"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId" FROM "temporary_activity"`);
        await queryRunner.query(`DROP TABLE "temporary_activity"`);
        await queryRunner.query(`CREATE INDEX "IDX_2743f8990fde12f9586287eb09" ON "activity" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e382caaf07ab0923b2e06bf91" ON "activity" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a898f44fa31ef7916f0c38b01" ON "activity" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6f74ae99d549932391f0f4460" ON "activity" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdb3f018c2bba4885bfa5757d1" ON "activity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2401d8fdff5d8970dfe30d3ae" ON "activity" ("tenantId") `);
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
