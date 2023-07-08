import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationProjectTasksSettingsTable1688816099313
	implements MigrationInterface
{
	name = 'CreateOrganizationProjectTasksSettingsTable1688816099313';

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
		await queryRunner.query(
			`CREATE TABLE "organization_project_tasks_settings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT true, "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT true, "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT true, "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT true, "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT true, "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT true, "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT true, "tasksProofOfCompletionType" character varying NOT NULL DEFAULT 'PRIVATE', "isTasksLinkedEnabled" boolean NOT NULL DEFAULT true, "isTasksCommentsEnabled" boolean NOT NULL DEFAULT true, "isTasksHistoryEnabled" boolean NOT NULL DEFAULT true, "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT true, "isTasksDraftsEnabled" boolean NOT NULL DEFAULT true, "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT true, "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT '7', "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT true, "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT '7', "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT true, "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT '7', "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT true, "projectId" uuid, CONSTRAINT "REL_1cebd9d414775b23feb20e7740" UNIQUE ("projectId"), CONSTRAINT "PK_5158e077489909d94ecb2f66ed8" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c6981fb835e6878704cc4f7b3" ON "organization_project_tasks_settings" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_febcbc959ce953c6de98b1238b" ON "organization_project_tasks_settings" ("organizationId") `
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_tasks_settings" ADD CONSTRAINT "FK_1c6981fb835e6878704cc4f7b36" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_tasks_settings" ADD CONSTRAINT "FK_febcbc959ce953c6de98b1238bb" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_tasks_settings" ADD CONSTRAINT "FK_1cebd9d414775b23feb20e77401" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(
		queryRunner: QueryRunner
	): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "organization_project_tasks_settings" DROP CONSTRAINT "FK_1cebd9d414775b23feb20e77401"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_tasks_settings" DROP CONSTRAINT "FK_febcbc959ce953c6de98b1238bb"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_tasks_settings" DROP CONSTRAINT "FK_1c6981fb835e6878704cc4f7b36"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_febcbc959ce953c6de98b1238b"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_1c6981fb835e6878704cc4f7b3"`
		);
		await queryRunner.query(
			`DROP TABLE "organization_project_tasks_settings"`
		);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "organization_project_tasks_settings" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT (1), "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT (1), "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT (1), "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT (1), "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT (1), "tasksProofOfCompletionType" varchar NOT NULL DEFAULT ('PRIVATE'), "isTasksLinkedEnabled" boolean NOT NULL DEFAULT (1), "isTasksCommentsEnabled" boolean NOT NULL DEFAULT (1), "isTasksHistoryEnabled" boolean NOT NULL DEFAULT (1), "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT (1), "isTasksDraftsEnabled" boolean NOT NULL DEFAULT (1), "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT (1), "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT (1), "projectId" varchar, CONSTRAINT "REL_1cebd9d414775b23feb20e7740" UNIQUE ("projectId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c6981fb835e6878704cc4f7b3" ON "organization_project_tasks_settings" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_febcbc959ce953c6de98b1238b" ON "organization_project_tasks_settings" ("organizationId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_1c6981fb835e6878704cc4f7b3"`);
		await queryRunner.query(`DROP INDEX "IDX_febcbc959ce953c6de98b1238b"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_tasks_settings" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT (1), "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT (1), "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT (1), "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT (1), "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT (1), "tasksProofOfCompletionType" varchar NOT NULL DEFAULT ('PRIVATE'), "isTasksLinkedEnabled" boolean NOT NULL DEFAULT (1), "isTasksCommentsEnabled" boolean NOT NULL DEFAULT (1), "isTasksHistoryEnabled" boolean NOT NULL DEFAULT (1), "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT (1), "isTasksDraftsEnabled" boolean NOT NULL DEFAULT (1), "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT (1), "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT (1), "projectId" varchar, CONSTRAINT "REL_1cebd9d414775b23feb20e7740" UNIQUE ("projectId"), CONSTRAINT "FK_1c6981fb835e6878704cc4f7b36" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_febcbc959ce953c6de98b1238bb" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1cebd9d414775b23feb20e77401" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_tasks_settings"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled", "projectId" FROM "organization_project_tasks_settings"`
		);
		await queryRunner.query(
			`DROP TABLE "organization_project_tasks_settings"`
		);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_tasks_settings" RENAME TO "organization_project_tasks_settings"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c6981fb835e6878704cc4f7b3" ON "organization_project_tasks_settings" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_febcbc959ce953c6de98b1238b" ON "organization_project_tasks_settings" ("organizationId") `
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_febcbc959ce953c6de98b1238b"`);
		await queryRunner.query(`DROP INDEX "IDX_1c6981fb835e6878704cc4f7b3"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_tasks_settings" RENAME TO "temporary_organization_project_tasks_settings"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_tasks_settings" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT (1), "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT (1), "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT (1), "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT (1), "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT (1), "tasksProofOfCompletionType" varchar NOT NULL DEFAULT ('PRIVATE'), "isTasksLinkedEnabled" boolean NOT NULL DEFAULT (1), "isTasksCommentsEnabled" boolean NOT NULL DEFAULT (1), "isTasksHistoryEnabled" boolean NOT NULL DEFAULT (1), "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT (1), "isTasksDraftsEnabled" boolean NOT NULL DEFAULT (1), "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT (1), "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT (1), "projectId" varchar, CONSTRAINT "REL_1cebd9d414775b23feb20e7740" UNIQUE ("projectId"))`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_tasks_settings"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled", "projectId" FROM "temporary_organization_project_tasks_settings"`
		);
		await queryRunner.query(
			`DROP TABLE "temporary_organization_project_tasks_settings"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_febcbc959ce953c6de98b1238b" ON "organization_project_tasks_settings" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c6981fb835e6878704cc4f7b3" ON "organization_project_tasks_settings" ("tenantId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_febcbc959ce953c6de98b1238b"`);
		await queryRunner.query(`DROP INDEX "IDX_1c6981fb835e6878704cc4f7b3"`);
		await queryRunner.query(
			`DROP TABLE "organization_project_tasks_settings"`
		);
	}
}
