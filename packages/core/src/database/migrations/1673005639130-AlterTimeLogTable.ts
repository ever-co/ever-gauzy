
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterTimeLogTable1673005639130 implements MigrationInterface {

    name = 'AlterTimeLogTable1673005639130';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (queryRunner.connection.options.type === 'sqlite') {
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
        if (queryRunner.connection.options.type === 'sqlite') {
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
        await queryRunner.query(`ALTER TABLE "time_log" ADD "version" character varying`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "time_log" DROP COLUMN "version"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_fa9018cb248ea0f3b2b30ef143"`);
        await queryRunner.query(`DROP INDEX "IDX_aed2d5cc5680fba9d387c7f931"`);
        await queryRunner.query(`DROP INDEX "IDX_a89a849957e005bafb8e4220bc"`);
        await queryRunner.query(`DROP INDEX "IDX_e65393bb52aa8275b1392c73f7"`);
        await queryRunner.query(`DROP INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5"`);
        await queryRunner.query(`DROP INDEX "IDX_1ddf2da35e34378fd845d80a18"`);
        await queryRunner.query(`DROP INDEX "IDX_d1e8f22c02c5e949453dde7f2d"`);
        await queryRunner.query(`CREATE TABLE "temporary_time_log" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startedAt" datetime, "stoppedAt" datetime, "logType" varchar NOT NULL DEFAULT ('TRACKED'), "source" varchar NOT NULL DEFAULT ('BROWSER'), "description" varchar, "reason" varchar, "isBillable" boolean NOT NULL DEFAULT (0), "deletedAt" datetime, "employeeId" varchar NOT NULL, "timesheetId" varchar, "projectId" varchar, "taskId" varchar, "organizationContactId" varchar, "isRunning" boolean, "version" varchar, CONSTRAINT "FK_fa9018cb248ea0f3b2b30ef143b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aed2d5cc5680fba9d387c7f931d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a89a849957e005bafb8e4220bc7" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_e65393bb52aa8275b1392c73f72" FOREIGN KEY ("timesheetId") REFERENCES "timesheet" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_54776f6f5fd3c13c3bc1fbfac5b" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1ddf2da35e34378fd845d80a18b" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_d1e8f22c02c5e949453dde7f2d1" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_time_log"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning" FROM "time_log"`);
        await queryRunner.query(`DROP TABLE "time_log"`);
        await queryRunner.query(`ALTER TABLE "temporary_time_log" RENAME TO "time_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_fa9018cb248ea0f3b2b30ef143" ON "time_log" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aed2d5cc5680fba9d387c7f931" ON "time_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a89a849957e005bafb8e4220bc" ON "time_log" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e65393bb52aa8275b1392c73f7" ON "time_log" ("timesheetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5" ON "time_log" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ddf2da35e34378fd845d80a18" ON "time_log" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d1e8f22c02c5e949453dde7f2d" ON "time_log" ("organizationContactId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_d1e8f22c02c5e949453dde7f2d"`);
        await queryRunner.query(`DROP INDEX "IDX_1ddf2da35e34378fd845d80a18"`);
        await queryRunner.query(`DROP INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5"`);
        await queryRunner.query(`DROP INDEX "IDX_e65393bb52aa8275b1392c73f7"`);
        await queryRunner.query(`DROP INDEX "IDX_a89a849957e005bafb8e4220bc"`);
        await queryRunner.query(`DROP INDEX "IDX_aed2d5cc5680fba9d387c7f931"`);
        await queryRunner.query(`DROP INDEX "IDX_fa9018cb248ea0f3b2b30ef143"`);
        await queryRunner.query(`ALTER TABLE "time_log" RENAME TO "temporary_time_log"`);
        await queryRunner.query(`CREATE TABLE "time_log" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startedAt" datetime, "stoppedAt" datetime, "logType" varchar NOT NULL DEFAULT ('TRACKED'), "source" varchar NOT NULL DEFAULT ('BROWSER'), "description" varchar, "reason" varchar, "isBillable" boolean NOT NULL DEFAULT (0), "deletedAt" datetime, "employeeId" varchar NOT NULL, "timesheetId" varchar, "projectId" varchar, "taskId" varchar, "organizationContactId" varchar, "isRunning" boolean, CONSTRAINT "FK_fa9018cb248ea0f3b2b30ef143b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aed2d5cc5680fba9d387c7f931d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a89a849957e005bafb8e4220bc7" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_e65393bb52aa8275b1392c73f72" FOREIGN KEY ("timesheetId") REFERENCES "timesheet" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_54776f6f5fd3c13c3bc1fbfac5b" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1ddf2da35e34378fd845d80a18b" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_d1e8f22c02c5e949453dde7f2d1" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "time_log"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning" FROM "temporary_time_log"`);
        await queryRunner.query(`DROP TABLE "temporary_time_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_d1e8f22c02c5e949453dde7f2d" ON "time_log" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ddf2da35e34378fd845d80a18" ON "time_log" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5" ON "time_log" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e65393bb52aa8275b1392c73f7" ON "time_log" ("timesheetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a89a849957e005bafb8e4220bc" ON "time_log" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aed2d5cc5680fba9d387c7f931" ON "time_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa9018cb248ea0f3b2b30ef143" ON "time_log" ("tenantId") `);
    }
}
