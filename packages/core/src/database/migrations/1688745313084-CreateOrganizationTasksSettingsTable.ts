import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationTasksSettingsTable1688745313084
	implements MigrationInterface
{
	name = 'CreateOrganizationTasksSettingsTable1688745313084';

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
			`CREATE TABLE "organization_tasks_settings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT true, "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT true, "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT true, "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT true, "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT true, "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT true, "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT true, "tasksProofOfCompletionType" character varying NOT NULL DEFAULT 'PRIVATE', "isTasksLinkedEnabled" boolean NOT NULL DEFAULT true, "isTasksCommentsEnabled" boolean NOT NULL DEFAULT true, "isTasksHistoryEnabled" boolean NOT NULL DEFAULT true, "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT true, "isTasksDraftsEnabled" boolean NOT NULL DEFAULT true, "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT true, "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT '7', "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT true, "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT '7', "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT true, "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT '7', "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_7755b4125623abfa4b90b54f57d" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_493d593c7ff8e973b89f6b4656" ON "organization_tasks_settings" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_43a66941b5cdf78fa27e9788e7" ON "organization_tasks_settings" ("organizationId") `
		);
		await queryRunner.query(
			`ALTER TABLE "organization_tasks_settings" ADD CONSTRAINT "FK_493d593c7ff8e973b89f6b4656b" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_tasks_settings" ADD CONSTRAINT "FK_43a66941b5cdf78fa27e9788e79" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
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
			`ALTER TABLE "organization_tasks_settings" DROP CONSTRAINT "FK_43a66941b5cdf78fa27e9788e79"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_tasks_settings" DROP CONSTRAINT "FK_493d593c7ff8e973b89f6b4656b"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_43a66941b5cdf78fa27e9788e7"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_493d593c7ff8e973b89f6b4656"`
		);
		await queryRunner.query(`DROP TABLE "organization_tasks_settings"`);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "organization_tasks_settings" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT (1), "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT (1), "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT (1), "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT (1), "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT (1), "tasksProofOfCompletionType" varchar NOT NULL DEFAULT ('PRIVATE'), "isTasksLinkedEnabled" boolean NOT NULL DEFAULT (1), "isTasksCommentsEnabled" boolean NOT NULL DEFAULT (1), "isTasksHistoryEnabled" boolean NOT NULL DEFAULT (1), "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT (1), "isTasksDraftsEnabled" boolean NOT NULL DEFAULT (1), "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT (1), "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT (1))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_493d593c7ff8e973b89f6b4656" ON "organization_tasks_settings" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_43a66941b5cdf78fa27e9788e7" ON "organization_tasks_settings" ("organizationId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_493d593c7ff8e973b89f6b4656"`);
		await queryRunner.query(`DROP INDEX "IDX_43a66941b5cdf78fa27e9788e7"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_tasks_settings" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT (1), "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT (1), "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT (1), "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT (1), "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT (1), "tasksProofOfCompletionType" varchar NOT NULL DEFAULT ('PRIVATE'), "isTasksLinkedEnabled" boolean NOT NULL DEFAULT (1), "isTasksCommentsEnabled" boolean NOT NULL DEFAULT (1), "isTasksHistoryEnabled" boolean NOT NULL DEFAULT (1), "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT (1), "isTasksDraftsEnabled" boolean NOT NULL DEFAULT (1), "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT (1), "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT (1), CONSTRAINT "FK_493d593c7ff8e973b89f6b4656b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_43a66941b5cdf78fa27e9788e79" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_tasks_settings"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled" FROM "organization_tasks_settings"`
		);
		await queryRunner.query(`DROP TABLE "organization_tasks_settings"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_tasks_settings" RENAME TO "organization_tasks_settings"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_493d593c7ff8e973b89f6b4656" ON "organization_tasks_settings" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_43a66941b5cdf78fa27e9788e7" ON "organization_tasks_settings" ("organizationId") `
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_43a66941b5cdf78fa27e9788e7"`);
		await queryRunner.query(`DROP INDEX "IDX_493d593c7ff8e973b89f6b4656"`);
		await queryRunner.query(
			`ALTER TABLE "organization_tasks_settings" RENAME TO "temporary_organization_tasks_settings"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_tasks_settings" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "isTasksPrivacyEnabled" boolean NOT NULL DEFAULT (1), "isTasksMultipleAssigneesEnabled" boolean NOT NULL DEFAULT (1), "isTasksManualTimeEnabled" boolean NOT NULL DEFAULT (1), "isTasksGroupEstimationEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInHoursEnabled" boolean NOT NULL DEFAULT (1), "isTasksEstimationInStoryPointsEnabled" boolean NOT NULL DEFAULT (1), "isTasksProofOfCompletionEnabled" boolean NOT NULL DEFAULT (1), "tasksProofOfCompletionType" varchar NOT NULL DEFAULT ('PRIVATE'), "isTasksLinkedEnabled" boolean NOT NULL DEFAULT (1), "isTasksCommentsEnabled" boolean NOT NULL DEFAULT (1), "isTasksHistoryEnabled" boolean NOT NULL DEFAULT (1), "isTasksAcceptanceCriteriaEnabled" boolean NOT NULL DEFAULT (1), "isTasksDraftsEnabled" boolean NOT NULL DEFAULT (1), "isTasksNotifyLeftEnabled" boolean NOT NULL DEFAULT (1), "tasksNotifyLeftPeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoCloseEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoClosePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoArchiveEnabled" boolean NOT NULL DEFAULT (1), "tasksAutoArchivePeriodDays" integer NOT NULL DEFAULT (7), "isTasksAutoStatusEnabled" boolean NOT NULL DEFAULT (1))`
		);
		await queryRunner.query(
			`INSERT INTO "organization_tasks_settings"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "isTasksPrivacyEnabled", "isTasksMultipleAssigneesEnabled", "isTasksManualTimeEnabled", "isTasksGroupEstimationEnabled", "isTasksEstimationInHoursEnabled", "isTasksEstimationInStoryPointsEnabled", "isTasksProofOfCompletionEnabled", "tasksProofOfCompletionType", "isTasksLinkedEnabled", "isTasksCommentsEnabled", "isTasksHistoryEnabled", "isTasksAcceptanceCriteriaEnabled", "isTasksDraftsEnabled", "isTasksNotifyLeftEnabled", "tasksNotifyLeftPeriodDays", "isTasksAutoCloseEnabled", "tasksAutoClosePeriodDays", "isTasksAutoArchiveEnabled", "tasksAutoArchivePeriodDays", "isTasksAutoStatusEnabled" FROM "temporary_organization_tasks_settings"`
		);
		await queryRunner.query(
			`DROP TABLE "temporary_organization_tasks_settings"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_43a66941b5cdf78fa27e9788e7" ON "organization_tasks_settings" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_493d593c7ff8e973b89f6b4656" ON "organization_tasks_settings" ("tenantId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_43a66941b5cdf78fa27e9788e7"`);
		await queryRunner.query(`DROP INDEX "IDX_493d593c7ff8e973b89f6b4656"`);
		await queryRunner.query(`DROP TABLE "organization_tasks_settings"`);
	}
}
