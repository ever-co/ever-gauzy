import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates `timesheet_project_change_request` — the approval workflow that lets an employee move
 * the time they logged against one project over to another one (issue #9516).
 *
 * Pure additive DDL: one new table, its indexes and its foreign keys. No existing table, column
 * or row is touched, so the migration is safe to run against a populated database and `down()`
 * simply drops what `up()` created.
 *
 * `previousProjectId` is NOT NULL on purpose. A timesheet is a per-employee, per-period container
 * of `TimeLog` rows and the project lives on the log, so one timesheet routinely holds logs for
 * several projects. Recording the project the time is moving FROM is what allows an approval to
 * touch only the mis-booked logs instead of rewriting the whole timesheet.
 */
export class CreateTimesheetProjectChangeRequest1790000010000 implements MigrationInterface {
	name = 'CreateTimesheetProjectChangeRequest1790000010000';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
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
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
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
		await queryRunner.query(
			`CREATE TABLE "timesheet_project_change_request" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "reason" character varying(500) NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "reviewedAt" TIMESTAMP, "reviewNote" character varying(500), "timesheetId" uuid NOT NULL, "requestedProjectId" uuid NOT NULL, "previousProjectId" uuid NOT NULL, "reviewedById" uuid, CONSTRAINT "PK_timesheet_prj_chg_req_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_createdByUserId" ON "timesheet_project_change_request" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_updatedByUserId" ON "timesheet_project_change_request" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_deletedByUserId" ON "timesheet_project_change_request" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_isActive" ON "timesheet_project_change_request" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_isArchived" ON "timesheet_project_change_request" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_tenantId" ON "timesheet_project_change_request" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_organizationId" ON "timesheet_project_change_request" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_status" ON "timesheet_project_change_request" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_timesheetId" ON "timesheet_project_change_request" ("timesheetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_requestedProjectId" ON "timesheet_project_change_request" ("requestedProjectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_previousProjectId" ON "timesheet_project_change_request" ("previousProjectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_reviewedById" ON "timesheet_project_change_request" ("reviewedById") `
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" ADD CONSTRAINT "FK_tsheet_prj_chg_req_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" ADD CONSTRAINT "FK_tsheet_prj_chg_req_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" ADD CONSTRAINT "FK_tsheet_prj_chg_req_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" ADD CONSTRAINT "FK_tsheet_prj_chg_req_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" ADD CONSTRAINT "FK_tsheet_prj_chg_req_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" ADD CONSTRAINT "FK_tsheet_prj_chg_req_timesheetId" FOREIGN KEY ("timesheetId") REFERENCES "timesheet"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" ADD CONSTRAINT "FK_tsheet_prj_chg_req_requestedProjectId" FOREIGN KEY ("requestedProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" ADD CONSTRAINT "FK_tsheet_prj_chg_req_previousProjectId" FOREIGN KEY ("previousProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" ADD CONSTRAINT "FK_tsheet_prj_chg_req_reviewedById" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" DROP CONSTRAINT "FK_tsheet_prj_chg_req_reviewedById"`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" DROP CONSTRAINT "FK_tsheet_prj_chg_req_previousProjectId"`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" DROP CONSTRAINT "FK_tsheet_prj_chg_req_requestedProjectId"`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" DROP CONSTRAINT "FK_tsheet_prj_chg_req_timesheetId"`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" DROP CONSTRAINT "FK_tsheet_prj_chg_req_organizationId"`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" DROP CONSTRAINT "FK_tsheet_prj_chg_req_tenantId"`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" DROP CONSTRAINT "FK_tsheet_prj_chg_req_deletedByUserId"`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" DROP CONSTRAINT "FK_tsheet_prj_chg_req_updatedByUserId"`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet_project_change_request" DROP CONSTRAINT "FK_tsheet_prj_chg_req_createdByUserId"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_reviewedById"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_previousProjectId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_requestedProjectId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_timesheetId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_status"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_organizationId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_tenantId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_isArchived"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_isActive"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_tsheet_prj_chg_req_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "timesheet_project_change_request"`);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "timesheet_project_change_request" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "reason" varchar(500) NOT NULL, "status" varchar NOT NULL DEFAULT ('PENDING'), "reviewedAt" datetime, "reviewNote" varchar(500), "timesheetId" varchar NOT NULL, "requestedProjectId" varchar NOT NULL, "previousProjectId" varchar NOT NULL, "reviewedById" varchar, CONSTRAINT "FK_tsheet_prj_chg_req_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_tsheet_prj_chg_req_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_tsheet_prj_chg_req_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_tsheet_prj_chg_req_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_tsheet_prj_chg_req_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_tsheet_prj_chg_req_timesheetId" FOREIGN KEY ("timesheetId") REFERENCES "timesheet" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_tsheet_prj_chg_req_requestedProjectId" FOREIGN KEY ("requestedProjectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_tsheet_prj_chg_req_previousProjectId" FOREIGN KEY ("previousProjectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_tsheet_prj_chg_req_reviewedById" FOREIGN KEY ("reviewedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_createdByUserId" ON "timesheet_project_change_request" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_updatedByUserId" ON "timesheet_project_change_request" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_deletedByUserId" ON "timesheet_project_change_request" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_isActive" ON "timesheet_project_change_request" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_isArchived" ON "timesheet_project_change_request" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_tenantId" ON "timesheet_project_change_request" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_organizationId" ON "timesheet_project_change_request" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_status" ON "timesheet_project_change_request" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_timesheetId" ON "timesheet_project_change_request" ("timesheetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_requestedProjectId" ON "timesheet_project_change_request" ("requestedProjectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_previousProjectId" ON "timesheet_project_change_request" ("previousProjectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tsheet_prj_chg_req_reviewedById" ON "timesheet_project_change_request" ("reviewedById") `
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_reviewedById"`);
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_previousProjectId"`);
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_requestedProjectId"`);
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_timesheetId"`);
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_status"`);
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_organizationId"`);
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_tenantId"`);
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_isArchived"`);
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_isActive"`);
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_tsheet_prj_chg_req_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "timesheet_project_change_request"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`timesheet_project_change_request\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`reason\` varchar(500) NOT NULL, \`status\` varchar(255) NOT NULL DEFAULT 'PENDING', \`reviewedAt\` datetime NULL, \`reviewNote\` varchar(500) NULL, \`timesheetId\` varchar(255) NOT NULL, \`requestedProjectId\` varchar(255) NOT NULL, \`previousProjectId\` varchar(255) NOT NULL, \`reviewedById\` varchar(255) NULL, INDEX \`IDX_tsheet_prj_chg_req_createdByUserId\` (\`createdByUserId\`), INDEX \`IDX_tsheet_prj_chg_req_updatedByUserId\` (\`updatedByUserId\`), INDEX \`IDX_tsheet_prj_chg_req_deletedByUserId\` (\`deletedByUserId\`), INDEX \`IDX_tsheet_prj_chg_req_isActive\` (\`isActive\`), INDEX \`IDX_tsheet_prj_chg_req_isArchived\` (\`isArchived\`), INDEX \`IDX_tsheet_prj_chg_req_tenantId\` (\`tenantId\`), INDEX \`IDX_tsheet_prj_chg_req_organizationId\` (\`organizationId\`), INDEX \`IDX_tsheet_prj_chg_req_status\` (\`status\`), INDEX \`IDX_tsheet_prj_chg_req_timesheetId\` (\`timesheetId\`), INDEX \`IDX_tsheet_prj_chg_req_requestedProjectId\` (\`requestedProjectId\`), INDEX \`IDX_tsheet_prj_chg_req_previousProjectId\` (\`previousProjectId\`), INDEX \`IDX_tsheet_prj_chg_req_reviewedById\` (\`reviewedById\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` ADD CONSTRAINT \`FK_tsheet_prj_chg_req_createdByUserId\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` ADD CONSTRAINT \`FK_tsheet_prj_chg_req_updatedByUserId\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` ADD CONSTRAINT \`FK_tsheet_prj_chg_req_deletedByUserId\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` ADD CONSTRAINT \`FK_tsheet_prj_chg_req_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` ADD CONSTRAINT \`FK_tsheet_prj_chg_req_organizationId\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` ADD CONSTRAINT \`FK_tsheet_prj_chg_req_timesheetId\` FOREIGN KEY (\`timesheetId\`) REFERENCES \`timesheet\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` ADD CONSTRAINT \`FK_tsheet_prj_chg_req_requestedProjectId\` FOREIGN KEY (\`requestedProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` ADD CONSTRAINT \`FK_tsheet_prj_chg_req_previousProjectId\` FOREIGN KEY (\`previousProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` ADD CONSTRAINT \`FK_tsheet_prj_chg_req_reviewedById\` FOREIGN KEY (\`reviewedById\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` DROP FOREIGN KEY \`FK_tsheet_prj_chg_req_reviewedById\``
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` DROP FOREIGN KEY \`FK_tsheet_prj_chg_req_previousProjectId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` DROP FOREIGN KEY \`FK_tsheet_prj_chg_req_requestedProjectId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` DROP FOREIGN KEY \`FK_tsheet_prj_chg_req_timesheetId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` DROP FOREIGN KEY \`FK_tsheet_prj_chg_req_organizationId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` DROP FOREIGN KEY \`FK_tsheet_prj_chg_req_tenantId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` DROP FOREIGN KEY \`FK_tsheet_prj_chg_req_deletedByUserId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` DROP FOREIGN KEY \`FK_tsheet_prj_chg_req_updatedByUserId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet_project_change_request\` DROP FOREIGN KEY \`FK_tsheet_prj_chg_req_createdByUserId\``
		);
		await queryRunner.query(`DROP TABLE \`timesheet_project_change_request\``);
	}
}
