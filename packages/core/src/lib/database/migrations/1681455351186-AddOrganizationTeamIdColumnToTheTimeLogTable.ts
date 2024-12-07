import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddOrganizationTeamIdColumnToTheTimeLogTable1681455351186 implements MigrationInterface {

    name = 'AddOrganizationTeamIdColumnToTheTimeLogTable1681455351186';

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
        await queryRunner.query(`ALTER TABLE "time_log" ADD "organizationTeamId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_18dcdf754396f0cb0308dc91f4" ON "time_log" ("organizationTeamId") `);
        await queryRunner.query(`ALTER TABLE "time_log" ADD CONSTRAINT "FK_18dcdf754396f0cb0308dc91f4c" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "time_log" DROP CONSTRAINT "FK_18dcdf754396f0cb0308dc91f4c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18dcdf754396f0cb0308dc91f4"`);
        await queryRunner.query(`ALTER TABLE "time_log" DROP COLUMN "organizationTeamId"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_c52aae9bd99b254f62a6a71a54"`);
        await queryRunner.query(`DROP INDEX "IDX_79001d281ecb766005b3d331c1"`);
        await queryRunner.query(`DROP INDEX "IDX_f447474d185cd70b3015853874"`);
        await queryRunner.query(`DROP INDEX "IDX_722b9cb3a991c964d86396b6bc"`);
        await queryRunner.query(`DROP INDEX "IDX_402290e7045e0c10ef97d9f982"`);
        await queryRunner.query(`DROP INDEX "IDX_e80fb588b1086ce2a4f2244814"`);
        await queryRunner.query(`DROP INDEX "IDX_a1f8fcd70164d915fe7dd4a1ec"`);
        await queryRunner.query(`DROP INDEX "IDX_189b79acd611870aba62b3594e"`);
        await queryRunner.query(`DROP INDEX "IDX_fa9018cb248ea0f3b2b30ef143"`);
        await queryRunner.query(`DROP INDEX "IDX_aed2d5cc5680fba9d387c7f931"`);
        await queryRunner.query(`DROP INDEX "IDX_a89a849957e005bafb8e4220bc"`);
        await queryRunner.query(`DROP INDEX "IDX_e65393bb52aa8275b1392c73f7"`);
        await queryRunner.query(`DROP INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5"`);
        await queryRunner.query(`DROP INDEX "IDX_1ddf2da35e34378fd845d80a18"`);
        await queryRunner.query(`DROP INDEX "IDX_d1e8f22c02c5e949453dde7f2d"`);
        await queryRunner.query(`CREATE TABLE "temporary_time_log" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startedAt" datetime, "stoppedAt" datetime, "logType" varchar NOT NULL DEFAULT ('TRACKED'), "source" varchar NOT NULL DEFAULT ('BROWSER'), "description" varchar, "reason" varchar, "isBillable" boolean NOT NULL DEFAULT (0), "deletedAt" datetime, "employeeId" varchar NOT NULL, "timesheetId" varchar, "projectId" varchar, "taskId" varchar, "organizationContactId" varchar, "isRunning" boolean, "version" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_a89a849957e005bafb8e4220bc7" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fa9018cb248ea0f3b2b30ef143b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aed2d5cc5680fba9d387c7f931d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e65393bb52aa8275b1392c73f72" FOREIGN KEY ("timesheetId") REFERENCES "timesheet" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_54776f6f5fd3c13c3bc1fbfac5b" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1ddf2da35e34378fd845d80a18b" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_d1e8f22c02c5e949453dde7f2d1" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_time_log"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version" FROM "time_log"`);
        await queryRunner.query(`DROP TABLE "time_log"`);
        await queryRunner.query(`ALTER TABLE "temporary_time_log" RENAME TO "time_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_c52aae9bd99b254f62a6a71a54" ON "time_log" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_79001d281ecb766005b3d331c1" ON "time_log" ("version") `);
        await queryRunner.query(`CREATE INDEX "IDX_f447474d185cd70b3015853874" ON "time_log" ("isRunning") `);
        await queryRunner.query(`CREATE INDEX "IDX_722b9cb3a991c964d86396b6bc" ON "time_log" ("isBillable") `);
        await queryRunner.query(`CREATE INDEX "IDX_402290e7045e0c10ef97d9f982" ON "time_log" ("source") `);
        await queryRunner.query(`CREATE INDEX "IDX_e80fb588b1086ce2a4f2244814" ON "time_log" ("logType") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1f8fcd70164d915fe7dd4a1ec" ON "time_log" ("stoppedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_189b79acd611870aba62b3594e" ON "time_log" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa9018cb248ea0f3b2b30ef143" ON "time_log" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aed2d5cc5680fba9d387c7f931" ON "time_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a89a849957e005bafb8e4220bc" ON "time_log" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e65393bb52aa8275b1392c73f7" ON "time_log" ("timesheetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5" ON "time_log" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ddf2da35e34378fd845d80a18" ON "time_log" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d1e8f22c02c5e949453dde7f2d" ON "time_log" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_18dcdf754396f0cb0308dc91f4" ON "time_log" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_c52aae9bd99b254f62a6a71a54"`);
        await queryRunner.query(`DROP INDEX "IDX_79001d281ecb766005b3d331c1"`);
        await queryRunner.query(`DROP INDEX "IDX_f447474d185cd70b3015853874"`);
        await queryRunner.query(`DROP INDEX "IDX_722b9cb3a991c964d86396b6bc"`);
        await queryRunner.query(`DROP INDEX "IDX_402290e7045e0c10ef97d9f982"`);
        await queryRunner.query(`DROP INDEX "IDX_e80fb588b1086ce2a4f2244814"`);
        await queryRunner.query(`DROP INDEX "IDX_a1f8fcd70164d915fe7dd4a1ec"`);
        await queryRunner.query(`DROP INDEX "IDX_189b79acd611870aba62b3594e"`);
        await queryRunner.query(`DROP INDEX "IDX_fa9018cb248ea0f3b2b30ef143"`);
        await queryRunner.query(`DROP INDEX "IDX_aed2d5cc5680fba9d387c7f931"`);
        await queryRunner.query(`DROP INDEX "IDX_a89a849957e005bafb8e4220bc"`);
        await queryRunner.query(`DROP INDEX "IDX_e65393bb52aa8275b1392c73f7"`);
        await queryRunner.query(`DROP INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5"`);
        await queryRunner.query(`DROP INDEX "IDX_1ddf2da35e34378fd845d80a18"`);
        await queryRunner.query(`DROP INDEX "IDX_d1e8f22c02c5e949453dde7f2d"`);
        await queryRunner.query(`DROP INDEX "IDX_18dcdf754396f0cb0308dc91f4"`);
        await queryRunner.query(`CREATE TABLE "temporary_time_log" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startedAt" datetime, "stoppedAt" datetime, "logType" varchar NOT NULL DEFAULT ('TRACKED'), "source" varchar NOT NULL DEFAULT ('BROWSER'), "description" varchar, "reason" varchar, "isBillable" boolean NOT NULL DEFAULT (0), "deletedAt" datetime, "employeeId" varchar NOT NULL, "timesheetId" varchar, "projectId" varchar, "taskId" varchar, "organizationContactId" varchar, "isRunning" boolean, "version" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_a89a849957e005bafb8e4220bc7" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fa9018cb248ea0f3b2b30ef143b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aed2d5cc5680fba9d387c7f931d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e65393bb52aa8275b1392c73f72" FOREIGN KEY ("timesheetId") REFERENCES "timesheet" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_54776f6f5fd3c13c3bc1fbfac5b" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1ddf2da35e34378fd845d80a18b" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_d1e8f22c02c5e949453dde7f2d1" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_18dcdf754396f0cb0308dc91f4c" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_time_log"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version", "organizationTeamId" FROM "time_log"`);
        await queryRunner.query(`DROP TABLE "time_log"`);
        await queryRunner.query(`ALTER TABLE "temporary_time_log" RENAME TO "time_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_c52aae9bd99b254f62a6a71a54" ON "time_log" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_79001d281ecb766005b3d331c1" ON "time_log" ("version") `);
        await queryRunner.query(`CREATE INDEX "IDX_f447474d185cd70b3015853874" ON "time_log" ("isRunning") `);
        await queryRunner.query(`CREATE INDEX "IDX_722b9cb3a991c964d86396b6bc" ON "time_log" ("isBillable") `);
        await queryRunner.query(`CREATE INDEX "IDX_402290e7045e0c10ef97d9f982" ON "time_log" ("source") `);
        await queryRunner.query(`CREATE INDEX "IDX_e80fb588b1086ce2a4f2244814" ON "time_log" ("logType") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1f8fcd70164d915fe7dd4a1ec" ON "time_log" ("stoppedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_189b79acd611870aba62b3594e" ON "time_log" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa9018cb248ea0f3b2b30ef143" ON "time_log" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aed2d5cc5680fba9d387c7f931" ON "time_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a89a849957e005bafb8e4220bc" ON "time_log" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e65393bb52aa8275b1392c73f7" ON "time_log" ("timesheetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5" ON "time_log" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ddf2da35e34378fd845d80a18" ON "time_log" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d1e8f22c02c5e949453dde7f2d" ON "time_log" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_18dcdf754396f0cb0308dc91f4" ON "time_log" ("organizationTeamId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_18dcdf754396f0cb0308dc91f4"`);
        await queryRunner.query(`DROP INDEX "IDX_d1e8f22c02c5e949453dde7f2d"`);
        await queryRunner.query(`DROP INDEX "IDX_1ddf2da35e34378fd845d80a18"`);
        await queryRunner.query(`DROP INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5"`);
        await queryRunner.query(`DROP INDEX "IDX_e65393bb52aa8275b1392c73f7"`);
        await queryRunner.query(`DROP INDEX "IDX_a89a849957e005bafb8e4220bc"`);
        await queryRunner.query(`DROP INDEX "IDX_aed2d5cc5680fba9d387c7f931"`);
        await queryRunner.query(`DROP INDEX "IDX_fa9018cb248ea0f3b2b30ef143"`);
        await queryRunner.query(`DROP INDEX "IDX_189b79acd611870aba62b3594e"`);
        await queryRunner.query(`DROP INDEX "IDX_a1f8fcd70164d915fe7dd4a1ec"`);
        await queryRunner.query(`DROP INDEX "IDX_e80fb588b1086ce2a4f2244814"`);
        await queryRunner.query(`DROP INDEX "IDX_402290e7045e0c10ef97d9f982"`);
        await queryRunner.query(`DROP INDEX "IDX_722b9cb3a991c964d86396b6bc"`);
        await queryRunner.query(`DROP INDEX "IDX_f447474d185cd70b3015853874"`);
        await queryRunner.query(`DROP INDEX "IDX_79001d281ecb766005b3d331c1"`);
        await queryRunner.query(`DROP INDEX "IDX_c52aae9bd99b254f62a6a71a54"`);
        await queryRunner.query(`ALTER TABLE "time_log" RENAME TO "temporary_time_log"`);
        await queryRunner.query(`CREATE TABLE "time_log" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startedAt" datetime, "stoppedAt" datetime, "logType" varchar NOT NULL DEFAULT ('TRACKED'), "source" varchar NOT NULL DEFAULT ('BROWSER'), "description" varchar, "reason" varchar, "isBillable" boolean NOT NULL DEFAULT (0), "deletedAt" datetime, "employeeId" varchar NOT NULL, "timesheetId" varchar, "projectId" varchar, "taskId" varchar, "organizationContactId" varchar, "isRunning" boolean, "version" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_a89a849957e005bafb8e4220bc7" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fa9018cb248ea0f3b2b30ef143b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aed2d5cc5680fba9d387c7f931d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e65393bb52aa8275b1392c73f72" FOREIGN KEY ("timesheetId") REFERENCES "timesheet" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_54776f6f5fd3c13c3bc1fbfac5b" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1ddf2da35e34378fd845d80a18b" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_d1e8f22c02c5e949453dde7f2d1" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "time_log"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version", "organizationTeamId" FROM "temporary_time_log"`);
        await queryRunner.query(`DROP TABLE "temporary_time_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_18dcdf754396f0cb0308dc91f4" ON "time_log" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d1e8f22c02c5e949453dde7f2d" ON "time_log" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ddf2da35e34378fd845d80a18" ON "time_log" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5" ON "time_log" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e65393bb52aa8275b1392c73f7" ON "time_log" ("timesheetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a89a849957e005bafb8e4220bc" ON "time_log" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aed2d5cc5680fba9d387c7f931" ON "time_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa9018cb248ea0f3b2b30ef143" ON "time_log" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_189b79acd611870aba62b3594e" ON "time_log" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1f8fcd70164d915fe7dd4a1ec" ON "time_log" ("stoppedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_e80fb588b1086ce2a4f2244814" ON "time_log" ("logType") `);
        await queryRunner.query(`CREATE INDEX "IDX_402290e7045e0c10ef97d9f982" ON "time_log" ("source") `);
        await queryRunner.query(`CREATE INDEX "IDX_722b9cb3a991c964d86396b6bc" ON "time_log" ("isBillable") `);
        await queryRunner.query(`CREATE INDEX "IDX_f447474d185cd70b3015853874" ON "time_log" ("isRunning") `);
        await queryRunner.query(`CREATE INDEX "IDX_79001d281ecb766005b3d331c1" ON "time_log" ("version") `);
        await queryRunner.query(`CREATE INDEX "IDX_c52aae9bd99b254f62a6a71a54" ON "time_log" ("deletedAt") `);
        await queryRunner.query(`DROP INDEX "IDX_18dcdf754396f0cb0308dc91f4"`);
        await queryRunner.query(`DROP INDEX "IDX_d1e8f22c02c5e949453dde7f2d"`);
        await queryRunner.query(`DROP INDEX "IDX_1ddf2da35e34378fd845d80a18"`);
        await queryRunner.query(`DROP INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5"`);
        await queryRunner.query(`DROP INDEX "IDX_e65393bb52aa8275b1392c73f7"`);
        await queryRunner.query(`DROP INDEX "IDX_a89a849957e005bafb8e4220bc"`);
        await queryRunner.query(`DROP INDEX "IDX_aed2d5cc5680fba9d387c7f931"`);
        await queryRunner.query(`DROP INDEX "IDX_fa9018cb248ea0f3b2b30ef143"`);
        await queryRunner.query(`DROP INDEX "IDX_189b79acd611870aba62b3594e"`);
        await queryRunner.query(`DROP INDEX "IDX_a1f8fcd70164d915fe7dd4a1ec"`);
        await queryRunner.query(`DROP INDEX "IDX_e80fb588b1086ce2a4f2244814"`);
        await queryRunner.query(`DROP INDEX "IDX_402290e7045e0c10ef97d9f982"`);
        await queryRunner.query(`DROP INDEX "IDX_722b9cb3a991c964d86396b6bc"`);
        await queryRunner.query(`DROP INDEX "IDX_f447474d185cd70b3015853874"`);
        await queryRunner.query(`DROP INDEX "IDX_79001d281ecb766005b3d331c1"`);
        await queryRunner.query(`DROP INDEX "IDX_c52aae9bd99b254f62a6a71a54"`);
        await queryRunner.query(`ALTER TABLE "time_log" RENAME TO "temporary_time_log"`);
        await queryRunner.query(`CREATE TABLE "time_log" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startedAt" datetime, "stoppedAt" datetime, "logType" varchar NOT NULL DEFAULT ('TRACKED'), "source" varchar NOT NULL DEFAULT ('BROWSER'), "description" varchar, "reason" varchar, "isBillable" boolean NOT NULL DEFAULT (0), "deletedAt" datetime, "employeeId" varchar NOT NULL, "timesheetId" varchar, "projectId" varchar, "taskId" varchar, "organizationContactId" varchar, "isRunning" boolean, "version" varchar, CONSTRAINT "FK_a89a849957e005bafb8e4220bc7" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fa9018cb248ea0f3b2b30ef143b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aed2d5cc5680fba9d387c7f931d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e65393bb52aa8275b1392c73f72" FOREIGN KEY ("timesheetId") REFERENCES "timesheet" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_54776f6f5fd3c13c3bc1fbfac5b" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1ddf2da35e34378fd845d80a18b" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_d1e8f22c02c5e949453dde7f2d1" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "time_log"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startedAt", "stoppedAt", "logType", "source", "description", "reason", "isBillable", "deletedAt", "employeeId", "timesheetId", "projectId", "taskId", "organizationContactId", "isRunning", "version" FROM "temporary_time_log"`);
        await queryRunner.query(`DROP TABLE "temporary_time_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_d1e8f22c02c5e949453dde7f2d" ON "time_log" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ddf2da35e34378fd845d80a18" ON "time_log" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_54776f6f5fd3c13c3bc1fbfac5" ON "time_log" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e65393bb52aa8275b1392c73f7" ON "time_log" ("timesheetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a89a849957e005bafb8e4220bc" ON "time_log" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aed2d5cc5680fba9d387c7f931" ON "time_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa9018cb248ea0f3b2b30ef143" ON "time_log" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_189b79acd611870aba62b3594e" ON "time_log" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1f8fcd70164d915fe7dd4a1ec" ON "time_log" ("stoppedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_e80fb588b1086ce2a4f2244814" ON "time_log" ("logType") `);
        await queryRunner.query(`CREATE INDEX "IDX_402290e7045e0c10ef97d9f982" ON "time_log" ("source") `);
        await queryRunner.query(`CREATE INDEX "IDX_722b9cb3a991c964d86396b6bc" ON "time_log" ("isBillable") `);
        await queryRunner.query(`CREATE INDEX "IDX_f447474d185cd70b3015853874" ON "time_log" ("isRunning") `);
        await queryRunner.query(`CREATE INDEX "IDX_79001d281ecb766005b3d331c1" ON "time_log" ("version") `);
        await queryRunner.query(`CREATE INDEX "IDX_c52aae9bd99b254f62a6a71a54" ON "time_log" ("deletedAt") `);
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
