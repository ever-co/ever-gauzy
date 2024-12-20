
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterOrderColumnToTheTaskStatusEntityTable1703571105557 implements MigrationInterface {

    name = 'AlterOrderColumnToTheTaskStatusEntityTable1703571105557';

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

    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {

    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        /**
         * First, drop the 'Order' column to remove the unique constraints.
         */
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`DROP INDEX "IDX_0330b4a942b536d8d1f264abe3"`);
        await queryRunner.query(`DROP INDEX "IDX_25d9737ee153411871b4d20c67"`);
        await queryRunner.query(`DROP INDEX "IDX_79c525a8c2209e90186bfcbea9"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "isCollapsed" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_0330b4a942b536d8d1f264abe32" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed" FROM "task_status"`);
        await queryRunner.query(`DROP TABLE "task_status"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_status" RENAME TO "task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0330b4a942b536d8d1f264abe3" ON "task_status" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_25d9737ee153411871b4d20c67" ON "task_status" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_79c525a8c2209e90186bfcbea9" ON "task_status" ("isArchived") `);
        await queryRunner.query(`DROP INDEX "IDX_719aeb37fa7a1dd80d25336a0c"`);
        await queryRunner.query(`DROP INDEX "IDX_ce83034f38496f5fe3f1979697"`);
        await queryRunner.query(`DROP INDEX "IDX_a2a5601d799fbfc29c17b99243"`);
        await queryRunner.query(`DROP INDEX "IDX_8dc83cdd7c519d73afc0d8bdf0"`);
        await queryRunner.query(`DROP INDEX "IDX_d8eba1c0e500c60be1b69c1e77"`);
        await queryRunner.query(`DROP INDEX "IDX_fe12e1b76bbb76209134d9bdc2"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_team_employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "organizationTeamId" varchar NOT NULL, "employeeId" varchar NOT NULL, "roleId" varchar, "isTrackingEnabled" boolean DEFAULT (1), "activeTaskId" varchar, "deletedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "order" integer, CONSTRAINT "FK_719aeb37fa7a1dd80d25336a0cf" FOREIGN KEY ("activeTaskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ce83034f38496f5fe3f19796977" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a2a5601d799fbfc29c17b99243f" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8dc83cdd7c519d73afc0d8bdf09" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d8eba1c0e500c60be1b69c1e777" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_fe12e1b76bbb76209134d9bdc2e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_team_employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "organizationTeamId", "employeeId", "roleId", "isTrackingEnabled", "activeTaskId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "organizationTeamId", "employeeId", "roleId", "isTrackingEnabled", "activeTaskId" FROM "organization_team_employee"`);
        await queryRunner.query(`DROP TABLE "organization_team_employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_team_employee" RENAME TO "organization_team_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_719aeb37fa7a1dd80d25336a0c" ON "organization_team_employee" ("activeTaskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ce83034f38496f5fe3f1979697" ON "organization_team_employee" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a2a5601d799fbfc29c17b99243" ON "organization_team_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8dc83cdd7c519d73afc0d8bdf0" ON "organization_team_employee" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d8eba1c0e500c60be1b69c1e77" ON "organization_team_employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe12e1b76bbb76209134d9bdc2" ON "organization_team_employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_70fcc451944fbde73d223c2af3" ON "organization_team_employee" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_752d7a0fe6597ee6bbc6502a12" ON "organization_team_employee" ("isArchived") `);
        /**
         * Second, re-add the 'Order' column.
         */
        await queryRunner.query(`DROP INDEX "IDX_79c525a8c2209e90186bfcbea9"`);
        await queryRunner.query(`DROP INDEX "IDX_25d9737ee153411871b4d20c67"`);
        await queryRunner.query(`DROP INDEX "IDX_0330b4a942b536d8d1f264abe3"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "isCollapsed" boolean NOT NULL DEFAULT (0), "order" integer, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0330b4a942b536d8d1f264abe32" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed" FROM "task_status"`);
        await queryRunner.query(`DROP TABLE "task_status"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_status" RENAME TO "task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_79c525a8c2209e90186bfcbea9" ON "task_status" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_25d9737ee153411871b4d20c67" ON "task_status" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_0330b4a942b536d8d1f264abe3" ON "task_status" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        /**
         *
         */
        await queryRunner.query(`DROP INDEX "IDX_752d7a0fe6597ee6bbc6502a12"`);
        await queryRunner.query(`DROP INDEX "IDX_70fcc451944fbde73d223c2af3"`);
        await queryRunner.query(`DROP INDEX "IDX_fe12e1b76bbb76209134d9bdc2"`);
        await queryRunner.query(`DROP INDEX "IDX_d8eba1c0e500c60be1b69c1e77"`);
        await queryRunner.query(`DROP INDEX "IDX_8dc83cdd7c519d73afc0d8bdf0"`);
        await queryRunner.query(`DROP INDEX "IDX_a2a5601d799fbfc29c17b99243"`);
        await queryRunner.query(`DROP INDEX "IDX_ce83034f38496f5fe3f1979697"`);
        await queryRunner.query(`DROP INDEX "IDX_719aeb37fa7a1dd80d25336a0c"`);
        await queryRunner.query(`ALTER TABLE "organization_team_employee" RENAME TO "temporary_organization_team_employee"`);
        await queryRunner.query(`CREATE TABLE "organization_team_employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "organizationTeamId" varchar NOT NULL, "employeeId" varchar NOT NULL, "roleId" varchar, "isTrackingEnabled" boolean DEFAULT (1), "activeTaskId" varchar, CONSTRAINT "FK_719aeb37fa7a1dd80d25336a0cf" FOREIGN KEY ("activeTaskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ce83034f38496f5fe3f19796977" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a2a5601d799fbfc29c17b99243f" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8dc83cdd7c519d73afc0d8bdf09" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d8eba1c0e500c60be1b69c1e777" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_fe12e1b76bbb76209134d9bdc2e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization_team_employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "organizationTeamId", "employeeId", "roleId", "isTrackingEnabled", "activeTaskId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "organizationTeamId", "employeeId", "roleId", "isTrackingEnabled", "activeTaskId" FROM "temporary_organization_team_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_team_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_fe12e1b76bbb76209134d9bdc2" ON "organization_team_employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d8eba1c0e500c60be1b69c1e77" ON "organization_team_employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8dc83cdd7c519d73afc0d8bdf0" ON "organization_team_employee" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a2a5601d799fbfc29c17b99243" ON "organization_team_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ce83034f38496f5fe3f1979697" ON "organization_team_employee" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_719aeb37fa7a1dd80d25336a0c" ON "organization_team_employee" ("activeTaskId") `);
        await queryRunner.query(`DROP INDEX "IDX_79c525a8c2209e90186bfcbea9"`);
        await queryRunner.query(`DROP INDEX "IDX_25d9737ee153411871b4d20c67"`);
        await queryRunner.query(`DROP INDEX "IDX_0330b4a942b536d8d1f264abe3"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`ALTER TABLE "task_status" RENAME TO "temporary_task_status"`);
        await queryRunner.query(`CREATE TABLE "task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "order" integer, "isCollapsed" boolean NOT NULL DEFAULT (0), CONSTRAINT "UQ_cc7abdfc6b4db2aee3b5ecad795" UNIQUE ("order"), CONSTRAINT "FK_0330b4a942b536d8d1f264abe32" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed" FROM "temporary_task_status"`);
        await queryRunner.query(`DROP TABLE "temporary_task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_79c525a8c2209e90186bfcbea9" ON "task_status" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_25d9737ee153411871b4d20c67" ON "task_status" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_0330b4a942b536d8d1f264abe3" ON "task_status" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        /**
         *
         */
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`DROP INDEX "IDX_0330b4a942b536d8d1f264abe3"`);
        await queryRunner.query(`DROP INDEX "IDX_25d9737ee153411871b4d20c67"`);
        await queryRunner.query(`DROP INDEX "IDX_79c525a8c2209e90186bfcbea9"`);
        await queryRunner.query(`ALTER TABLE "task_status" RENAME TO "temporary_task_status"`);
        await queryRunner.query(`CREATE TABLE "task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "isCollapsed" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0330b4a942b536d8d1f264abe32" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed" FROM "temporary_task_status"`);
        await queryRunner.query(`DROP TABLE "temporary_task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0330b4a942b536d8d1f264abe3" ON "task_status" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_25d9737ee153411871b4d20c67" ON "task_status" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_79c525a8c2209e90186bfcbea9" ON "task_status" ("isArchived") `);
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
