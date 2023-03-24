
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterEmployeeTable1677313663312 implements MigrationInterface {

    name = 'AlterEmployeeTable1677313663312';

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
        await queryRunner.query(`ALTER TABLE "time_log" DROP CONSTRAINT "FK_a89a849957e005bafb8e4220bc7"`);
        await queryRunner.query(`ALTER TABLE "time_slot" DROP CONSTRAINT "FK_7913305b850c7afc89b6ed96a30"`);
        await queryRunner.query(`ALTER TABLE "time_log" ADD CONSTRAINT "FK_a89a849957e005bafb8e4220bc7" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "time_slot" ADD CONSTRAINT "FK_7913305b850c7afc89b6ed96a30" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "time_slot" DROP CONSTRAINT "FK_7913305b850c7afc89b6ed96a30"`);
        await queryRunner.query(`ALTER TABLE "time_log" DROP CONSTRAINT "FK_a89a849957e005bafb8e4220bc7"`);
        await queryRunner.query(`ALTER TABLE "time_slot" ADD CONSTRAINT "FK_7913305b850c7afc89b6ed96a30" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "time_log" ADD CONSTRAINT "FK_a89a849957e005bafb8e4220bc7" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_d1e8f22c02c5e949453dde7f2d"`);
        await queryRunner.query(`DROP INDEX "IDX_1ddf2da35e34378fd845d80a18"`);
        await queryRunner.query(`DROP INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5"`);
        await queryRunner.query(`DROP INDEX "IDX_e65393bb52aa8275b1392c73f7"`);
        await queryRunner.query(`DROP INDEX "IDX_a89a849957e005bafb8e4220bc"`);
        await queryRunner.query(`DROP INDEX "IDX_aed2d5cc5680fba9d387c7f931"`);
        await queryRunner.query(`DROP INDEX "IDX_fa9018cb248ea0f3b2b30ef143"`);
        await queryRunner.query(`CREATE TABLE "temporary_time_log" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startedAt" datetime, "stoppedAt" datetime, "logType" varchar NOT NULL DEFAULT ('TRACKED'), "source" varchar NOT NULL DEFAULT ('BROWSER'), "description" varchar, "reason" varchar, "isBillable" boolean NOT NULL DEFAULT (0), "deletedAt" datetime, "employeeId" varchar NOT NULL, "timesheetId" varchar, "projectId" varchar, "taskId" varchar, "organizationContactId" varchar, "isRunning" boolean, "version" varchar, CONSTRAINT "FK_d1e8f22c02c5e949453dde7f2d1" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1ddf2da35e34378fd845d80a18b" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_54776f6f5fd3c13c3bc1fbfac5b" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_e65393bb52aa8275b1392c73f72" FOREIGN KEY ("timesheetId") REFERENCES "timesheet" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aed2d5cc5680fba9d387c7f931d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_fa9018cb248ea0f3b2b30ef143b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_time_log"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version" FROM "time_log"`);
        await queryRunner.query(`DROP TABLE "time_log"`);
        await queryRunner.query(`ALTER TABLE "temporary_time_log" RENAME TO "time_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_d1e8f22c02c5e949453dde7f2d" ON "time_log" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ddf2da35e34378fd845d80a18" ON "time_log" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5" ON "time_log" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e65393bb52aa8275b1392c73f7" ON "time_log" ("timesheetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a89a849957e005bafb8e4220bc" ON "time_log" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aed2d5cc5680fba9d387c7f931" ON "time_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa9018cb248ea0f3b2b30ef143" ON "time_log" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_b407841271245501dd1a8c7551"`);
        await queryRunner.query(`DROP INDEX "IDX_b8284109257b5137256b5b3e84"`);
        await queryRunner.query(`CREATE TABLE "temporary_time_slot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_b407841271245501dd1a8c75513" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b8284109257b5137256b5b3e848" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_time_slot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId" FROM "time_slot"`);
        await queryRunner.query(`DROP TABLE "time_slot"`);
        await queryRunner.query(`ALTER TABLE "temporary_time_slot" RENAME TO "time_slot"`);
        await queryRunner.query(`CREATE INDEX "IDX_b407841271245501dd1a8c7551" ON "time_slot" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b8284109257b5137256b5b3e84" ON "time_slot" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_d1e8f22c02c5e949453dde7f2d"`);
        await queryRunner.query(`DROP INDEX "IDX_1ddf2da35e34378fd845d80a18"`);
        await queryRunner.query(`DROP INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5"`);
        await queryRunner.query(`DROP INDEX "IDX_e65393bb52aa8275b1392c73f7"`);
        await queryRunner.query(`DROP INDEX "IDX_a89a849957e005bafb8e4220bc"`);
        await queryRunner.query(`DROP INDEX "IDX_aed2d5cc5680fba9d387c7f931"`);
        await queryRunner.query(`DROP INDEX "IDX_fa9018cb248ea0f3b2b30ef143"`);
        await queryRunner.query(`CREATE TABLE "temporary_time_log" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startedAt" datetime, "stoppedAt" datetime, "logType" varchar NOT NULL DEFAULT ('TRACKED'), "source" varchar NOT NULL DEFAULT ('BROWSER'), "description" varchar, "reason" varchar, "isBillable" boolean NOT NULL DEFAULT (0), "deletedAt" datetime, "employeeId" varchar NOT NULL, "timesheetId" varchar, "projectId" varchar, "taskId" varchar, "organizationContactId" varchar, "isRunning" boolean, "version" varchar, CONSTRAINT "FK_d1e8f22c02c5e949453dde7f2d1" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1ddf2da35e34378fd845d80a18b" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_54776f6f5fd3c13c3bc1fbfac5b" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_e65393bb52aa8275b1392c73f72" FOREIGN KEY ("timesheetId") REFERENCES "timesheet" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aed2d5cc5680fba9d387c7f931d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_fa9018cb248ea0f3b2b30ef143b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a89a849957e005bafb8e4220bc7" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_time_log"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version" FROM "time_log"`);
        await queryRunner.query(`DROP TABLE "time_log"`);
        await queryRunner.query(`ALTER TABLE "temporary_time_log" RENAME TO "time_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_d1e8f22c02c5e949453dde7f2d" ON "time_log" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ddf2da35e34378fd845d80a18" ON "time_log" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5" ON "time_log" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e65393bb52aa8275b1392c73f7" ON "time_log" ("timesheetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a89a849957e005bafb8e4220bc" ON "time_log" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aed2d5cc5680fba9d387c7f931" ON "time_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa9018cb248ea0f3b2b30ef143" ON "time_log" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_b407841271245501dd1a8c7551"`);
        await queryRunner.query(`DROP INDEX "IDX_b8284109257b5137256b5b3e84"`);
        await queryRunner.query(`CREATE TABLE "temporary_time_slot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_b407841271245501dd1a8c75513" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b8284109257b5137256b5b3e848" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7913305b850c7afc89b6ed96a30" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_time_slot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId" FROM "time_slot"`);
        await queryRunner.query(`DROP TABLE "time_slot"`);
        await queryRunner.query(`ALTER TABLE "temporary_time_slot" RENAME TO "time_slot"`);
        await queryRunner.query(`CREATE INDEX "IDX_b407841271245501dd1a8c7551" ON "time_slot" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b8284109257b5137256b5b3e84" ON "time_slot" ("tenantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_b8284109257b5137256b5b3e84"`);
        await queryRunner.query(`DROP INDEX "IDX_b407841271245501dd1a8c7551"`);
        await queryRunner.query(`ALTER TABLE "time_slot" RENAME TO "temporary_time_slot"`);
        await queryRunner.query(`CREATE TABLE "time_slot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_b407841271245501dd1a8c75513" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b8284109257b5137256b5b3e848" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "time_slot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId" FROM "temporary_time_slot"`);
        await queryRunner.query(`DROP TABLE "temporary_time_slot"`);
        await queryRunner.query(`CREATE INDEX "IDX_b8284109257b5137256b5b3e84" ON "time_slot" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b407841271245501dd1a8c7551" ON "time_slot" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_fa9018cb248ea0f3b2b30ef143"`);
        await queryRunner.query(`DROP INDEX "IDX_aed2d5cc5680fba9d387c7f931"`);
        await queryRunner.query(`DROP INDEX "IDX_a89a849957e005bafb8e4220bc"`);
        await queryRunner.query(`DROP INDEX "IDX_e65393bb52aa8275b1392c73f7"`);
        await queryRunner.query(`DROP INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5"`);
        await queryRunner.query(`DROP INDEX "IDX_1ddf2da35e34378fd845d80a18"`);
        await queryRunner.query(`DROP INDEX "IDX_d1e8f22c02c5e949453dde7f2d"`);
        await queryRunner.query(`ALTER TABLE "time_log" RENAME TO "temporary_time_log"`);
        await queryRunner.query(`CREATE TABLE "time_log" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startedAt" datetime, "stoppedAt" datetime, "logType" varchar NOT NULL DEFAULT ('TRACKED'), "source" varchar NOT NULL DEFAULT ('BROWSER'), "description" varchar, "reason" varchar, "isBillable" boolean NOT NULL DEFAULT (0), "deletedAt" datetime, "employeeId" varchar NOT NULL, "timesheetId" varchar, "projectId" varchar, "taskId" varchar, "organizationContactId" varchar, "isRunning" boolean, "version" varchar, CONSTRAINT "FK_d1e8f22c02c5e949453dde7f2d1" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1ddf2da35e34378fd845d80a18b" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_54776f6f5fd3c13c3bc1fbfac5b" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_e65393bb52aa8275b1392c73f72" FOREIGN KEY ("timesheetId") REFERENCES "timesheet" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aed2d5cc5680fba9d387c7f931d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_fa9018cb248ea0f3b2b30ef143b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "time_log"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version" FROM "temporary_time_log"`);
        await queryRunner.query(`DROP TABLE "temporary_time_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_fa9018cb248ea0f3b2b30ef143" ON "time_log" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aed2d5cc5680fba9d387c7f931" ON "time_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a89a849957e005bafb8e4220bc" ON "time_log" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e65393bb52aa8275b1392c73f7" ON "time_log" ("timesheetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5" ON "time_log" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ddf2da35e34378fd845d80a18" ON "time_log" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d1e8f22c02c5e949453dde7f2d" ON "time_log" ("organizationContactId") `);
        await queryRunner.query(`DROP INDEX "IDX_b8284109257b5137256b5b3e84"`);
        await queryRunner.query(`DROP INDEX "IDX_b407841271245501dd1a8c7551"`);
        await queryRunner.query(`ALTER TABLE "time_slot" RENAME TO "temporary_time_slot"`);
        await queryRunner.query(`CREATE TABLE "time_slot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_7913305b850c7afc89b6ed96a30" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_b407841271245501dd1a8c75513" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b8284109257b5137256b5b3e848" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "time_slot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId" FROM "temporary_time_slot"`);
        await queryRunner.query(`DROP TABLE "temporary_time_slot"`);
        await queryRunner.query(`CREATE INDEX "IDX_b8284109257b5137256b5b3e84" ON "time_slot" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b407841271245501dd1a8c7551" ON "time_slot" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_fa9018cb248ea0f3b2b30ef143"`);
        await queryRunner.query(`DROP INDEX "IDX_aed2d5cc5680fba9d387c7f931"`);
        await queryRunner.query(`DROP INDEX "IDX_a89a849957e005bafb8e4220bc"`);
        await queryRunner.query(`DROP INDEX "IDX_e65393bb52aa8275b1392c73f7"`);
        await queryRunner.query(`DROP INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5"`);
        await queryRunner.query(`DROP INDEX "IDX_1ddf2da35e34378fd845d80a18"`);
        await queryRunner.query(`DROP INDEX "IDX_d1e8f22c02c5e949453dde7f2d"`);
        await queryRunner.query(`ALTER TABLE "time_log" RENAME TO "temporary_time_log"`);
        await queryRunner.query(`CREATE TABLE "time_log" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startedAt" datetime, "stoppedAt" datetime, "logType" varchar NOT NULL DEFAULT ('TRACKED'), "source" varchar NOT NULL DEFAULT ('BROWSER'), "description" varchar, "reason" varchar, "isBillable" boolean NOT NULL DEFAULT (0), "deletedAt" datetime, "employeeId" varchar NOT NULL, "timesheetId" varchar, "projectId" varchar, "taskId" varchar, "organizationContactId" varchar, "isRunning" boolean, "version" varchar, CONSTRAINT "FK_d1e8f22c02c5e949453dde7f2d1" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1ddf2da35e34378fd845d80a18b" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_54776f6f5fd3c13c3bc1fbfac5b" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_e65393bb52aa8275b1392c73f72" FOREIGN KEY ("timesheetId") REFERENCES "timesheet" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a89a849957e005bafb8e4220bc7" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_aed2d5cc5680fba9d387c7f931d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_fa9018cb248ea0f3b2b30ef143b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "time_log"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version" FROM "temporary_time_log"`);
        await queryRunner.query(`DROP TABLE "temporary_time_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_fa9018cb248ea0f3b2b30ef143" ON "time_log" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aed2d5cc5680fba9d387c7f931" ON "time_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a89a849957e005bafb8e4220bc" ON "time_log" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e65393bb52aa8275b1392c73f7" ON "time_log" ("timesheetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5" ON "time_log" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ddf2da35e34378fd845d80a18" ON "time_log" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d1e8f22c02c5e949453dde7f2d" ON "time_log" ("organizationContactId") `);
    }
}
