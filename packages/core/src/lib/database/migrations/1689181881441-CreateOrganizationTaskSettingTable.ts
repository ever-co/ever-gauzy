import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateOrganizationTaskSettingTable1689181881441 implements MigrationInterface {

    name = 'CreateOrganizationTaskSettingTable1689181881441';

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
        await queryRunner.query(`CREATE TABLE "organization_task_setting" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT true, "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT true, "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT true, "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT true, "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT true, "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT true, "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT true, "tasksProofOfCompletionType" character varying NOT NULL DEFAULT 'PRIVATE', "isTasksLinkedEnabled" boolean NOT NULL DEFAULT true, "isTasksCommentsEnabled" boolean NOT NULL DEFAULT true, "isTasksHistoryEnabled" boolean NOT NULL DEFAULT true, "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT true, "isTasksDraftsEnabled" boolean NOT NULL DEFAULT true, "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT true, "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT '7', "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT true, "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT '7', "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT true, "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT '7', "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT true, "projectId" uuid, "organizationTeamId" uuid, CONSTRAINT "PK_7f5ac995aeaec3033889398147c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_582768159ef0c749e8552ea9bc" ON "organization_task_setting" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5830901876e426adfc15fb7341" ON "organization_task_setting" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_19ab7adf33199bc6f913db277d" ON "organization_task_setting" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_20a290f166c0810eafbf271717" ON "organization_task_setting" ("organizationTeamId") `);
        await queryRunner.query(`ALTER TABLE "organization_task_setting" ADD CONSTRAINT "FK_582768159ef0c749e8552ea9bcd" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_task_setting" ADD CONSTRAINT "FK_5830901876e426adfc15fb7341b" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "organization_task_setting" ADD CONSTRAINT "FK_19ab7adf33199bc6f913db277d7" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_task_setting" ADD CONSTRAINT "FK_20a290f166c0810eafbf2717171" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization_task_setting" DROP CONSTRAINT "FK_20a290f166c0810eafbf2717171"`);
        await queryRunner.query(`ALTER TABLE "organization_task_setting" DROP CONSTRAINT "FK_19ab7adf33199bc6f913db277d7"`);
        await queryRunner.query(`ALTER TABLE "organization_task_setting" DROP CONSTRAINT "FK_5830901876e426adfc15fb7341b"`);
        await queryRunner.query(`ALTER TABLE "organization_task_setting" DROP CONSTRAINT "FK_582768159ef0c749e8552ea9bcd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20a290f166c0810eafbf271717"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_19ab7adf33199bc6f913db277d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5830901876e426adfc15fb7341"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_582768159ef0c749e8552ea9bc"`);
        await queryRunner.query(`DROP TABLE "organization_task_setting"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "organization_task_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT (1), "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT (1), "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT (1), "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT (1), "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT (1), "tasksProofOfCompletionType" varchar NOT NULL DEFAULT ('PRIVATE'), "isTasksLinkedEnabled" boolean NOT NULL DEFAULT (1), "isTasksCommentsEnabled" boolean NOT NULL DEFAULT (1), "isTasksHistoryEnabled" boolean NOT NULL DEFAULT (1), "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT (1), "isTasksDraftsEnabled" boolean NOT NULL DEFAULT (1), "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT (1), "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT (1), "projectId" varchar, "organizationTeamId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_582768159ef0c749e8552ea9bc" ON "organization_task_setting" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5830901876e426adfc15fb7341" ON "organization_task_setting" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_19ab7adf33199bc6f913db277d" ON "organization_task_setting" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_20a290f166c0810eafbf271717" ON "organization_task_setting" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_582768159ef0c749e8552ea9bc"`);
        await queryRunner.query(`DROP INDEX "IDX_5830901876e426adfc15fb7341"`);
        await queryRunner.query(`DROP INDEX "IDX_19ab7adf33199bc6f913db277d"`);
        await queryRunner.query(`DROP INDEX "IDX_20a290f166c0810eafbf271717"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_task_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT (1), "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT (1), "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT (1), "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT (1), "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT (1), "tasksProofOfCompletionType" varchar NOT NULL DEFAULT ('PRIVATE'), "isTasksLinkedEnabled" boolean NOT NULL DEFAULT (1), "isTasksCommentsEnabled" boolean NOT NULL DEFAULT (1), "isTasksHistoryEnabled" boolean NOT NULL DEFAULT (1), "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT (1), "isTasksDraftsEnabled" boolean NOT NULL DEFAULT (1), "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT (1), "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT (1), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_582768159ef0c749e8552ea9bcd" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5830901876e426adfc15fb7341b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_19ab7adf33199bc6f913db277d7" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_20a290f166c0810eafbf2717171" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_task_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled", "projectId", "organizationTeamId" FROM "organization_task_setting"`);
        await queryRunner.query(`DROP TABLE "organization_task_setting"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_task_setting" RENAME TO "organization_task_setting"`);
        await queryRunner.query(`CREATE INDEX "IDX_582768159ef0c749e8552ea9bc" ON "organization_task_setting" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5830901876e426adfc15fb7341" ON "organization_task_setting" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_19ab7adf33199bc6f913db277d" ON "organization_task_setting" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_20a290f166c0810eafbf271717" ON "organization_task_setting" ("organizationTeamId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_20a290f166c0810eafbf271717"`);
        await queryRunner.query(`DROP INDEX "IDX_19ab7adf33199bc6f913db277d"`);
        await queryRunner.query(`DROP INDEX "IDX_5830901876e426adfc15fb7341"`);
        await queryRunner.query(`DROP INDEX "IDX_582768159ef0c749e8552ea9bc"`);
        await queryRunner.query(`ALTER TABLE "organization_task_setting" RENAME TO "temporary_organization_task_setting"`);
        await queryRunner.query(`CREATE TABLE "organization_task_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT (1), "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT (1), "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT (1), "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT (1), "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT (1), "tasksProofOfCompletionType" varchar NOT NULL DEFAULT ('PRIVATE'), "isTasksLinkedEnabled" boolean NOT NULL DEFAULT (1), "isTasksCommentsEnabled" boolean NOT NULL DEFAULT (1), "isTasksHistoryEnabled" boolean NOT NULL DEFAULT (1), "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT (1), "isTasksDraftsEnabled" boolean NOT NULL DEFAULT (1), "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT (1), "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT (1), "projectId" varchar, "organizationTeamId" varchar)`);
        await queryRunner.query(`INSERT INTO "organization_task_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled", "projectId", "organizationTeamId" FROM "temporary_organization_task_setting"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_task_setting"`);
        await queryRunner.query(`CREATE INDEX "IDX_20a290f166c0810eafbf271717" ON "organization_task_setting" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_19ab7adf33199bc6f913db277d" ON "organization_task_setting" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5830901876e426adfc15fb7341" ON "organization_task_setting" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_582768159ef0c749e8552ea9bc" ON "organization_task_setting" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_20a290f166c0810eafbf271717"`);
        await queryRunner.query(`DROP INDEX "IDX_19ab7adf33199bc6f913db277d"`);
        await queryRunner.query(`DROP INDEX "IDX_5830901876e426adfc15fb7341"`);
        await queryRunner.query(`DROP INDEX "IDX_582768159ef0c749e8552ea9bc"`);
        await queryRunner.query(`DROP TABLE "organization_task_setting"`);
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
