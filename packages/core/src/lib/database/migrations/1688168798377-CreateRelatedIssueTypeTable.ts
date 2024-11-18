import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateRelatedIssueTypeTable1688168798377 implements MigrationInterface {

	name = 'CreateRelatedIssueTypeTable1688168798377';

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
		await queryRunner.query(
			`CREATE TABLE "task_related_issue_type" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "value" character varying NOT NULL, "description" character varying, "icon" character varying, "color" character varying, "isSystem" boolean NOT NULL DEFAULT false, "projectId" uuid, "organizationTeamId" uuid, CONSTRAINT "PK_11693c6ae3157d04eaaeedd0446" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b7b0ea8ac2825fb981c1181d11" ON "task_related_issue_type" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bed691e21fe01cf5aceee72295" ON "task_related_issue_type" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9423f99da972c150f85dbc11c1" ON "task_related_issue_type" ("name") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_61a7cb4452d9e23f91231b7fd6" ON "task_related_issue_type" ("value") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d99fe5b50dbe5078e0d9a9b6a9" ON "task_related_issue_type" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4967ebdca0aefb9d43e56695e4" ON "task_related_issue_type" ("organizationTeamId") `
		);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" ADD CONSTRAINT "FK_b7b0ea8ac2825fb981c1181d115" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" ADD CONSTRAINT "FK_bed691e21fe01cf5aceee722952" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" ADD CONSTRAINT "FK_d99fe5b50dbe5078e0d9a9b6a9d" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" ADD CONSTRAINT "FK_4967ebdca0aefb9d43e56695e42" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
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
			`ALTER TABLE "task_related_issue_type" DROP CONSTRAINT "FK_4967ebdca0aefb9d43e56695e42"`
		);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" DROP CONSTRAINT "FK_d99fe5b50dbe5078e0d9a9b6a9d"`
		);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" DROP CONSTRAINT "FK_bed691e21fe01cf5aceee722952"`
		);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" DROP CONSTRAINT "FK_b7b0ea8ac2825fb981c1181d115"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_4967ebdca0aefb9d43e56695e4"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_d99fe5b50dbe5078e0d9a9b6a9"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_61a7cb4452d9e23f91231b7fd6"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_9423f99da972c150f85dbc11c1"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_bed691e21fe01cf5aceee72295"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_b7b0ea8ac2825fb981c1181d11"`
		);
		await queryRunner.query(`DROP TABLE "task_related_issue_type"`);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "task_related_issue_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b7b0ea8ac2825fb981c1181d11" ON "task_related_issue_type" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bed691e21fe01cf5aceee72295" ON "task_related_issue_type" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9423f99da972c150f85dbc11c1" ON "task_related_issue_type" ("name") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_61a7cb4452d9e23f91231b7fd6" ON "task_related_issue_type" ("value") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d99fe5b50dbe5078e0d9a9b6a9" ON "task_related_issue_type" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4967ebdca0aefb9d43e56695e4" ON "task_related_issue_type" ("organizationTeamId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_b7b0ea8ac2825fb981c1181d11"`);
		await queryRunner.query(`DROP INDEX "IDX_bed691e21fe01cf5aceee72295"`);
		await queryRunner.query(`DROP INDEX "IDX_9423f99da972c150f85dbc11c1"`);
		await queryRunner.query(`DROP INDEX "IDX_61a7cb4452d9e23f91231b7fd6"`);
		await queryRunner.query(`DROP INDEX "IDX_d99fe5b50dbe5078e0d9a9b6a9"`);
		await queryRunner.query(`DROP INDEX "IDX_4967ebdca0aefb9d43e56695e4"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_task_related_issue_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_b7b0ea8ac2825fb981c1181d115" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_bed691e21fe01cf5aceee722952" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d99fe5b50dbe5078e0d9a9b6a9d" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4967ebdca0aefb9d43e56695e42" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_task_related_issue_type"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId" FROM "task_related_issue_type"`
		);
		await queryRunner.query(`DROP TABLE "task_related_issue_type"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_task_related_issue_type" RENAME TO "task_related_issue_type"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b7b0ea8ac2825fb981c1181d11" ON "task_related_issue_type" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bed691e21fe01cf5aceee72295" ON "task_related_issue_type" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9423f99da972c150f85dbc11c1" ON "task_related_issue_type" ("name") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_61a7cb4452d9e23f91231b7fd6" ON "task_related_issue_type" ("value") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d99fe5b50dbe5078e0d9a9b6a9" ON "task_related_issue_type" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4967ebdca0aefb9d43e56695e4" ON "task_related_issue_type" ("organizationTeamId") `
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_4967ebdca0aefb9d43e56695e4"`);
		await queryRunner.query(`DROP INDEX "IDX_d99fe5b50dbe5078e0d9a9b6a9"`);
		await queryRunner.query(`DROP INDEX "IDX_61a7cb4452d9e23f91231b7fd6"`);
		await queryRunner.query(`DROP INDEX "IDX_9423f99da972c150f85dbc11c1"`);
		await queryRunner.query(`DROP INDEX "IDX_bed691e21fe01cf5aceee72295"`);
		await queryRunner.query(`DROP INDEX "IDX_b7b0ea8ac2825fb981c1181d11"`);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" RENAME TO "temporary_task_related_issue_type"`
		);
		await queryRunner.query(
			`CREATE TABLE "task_related_issue_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "task_related_issue_type"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId" FROM "temporary_task_related_issue_type"`
		);
		await queryRunner.query(
			`DROP TABLE "temporary_task_related_issue_type"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4967ebdca0aefb9d43e56695e4" ON "task_related_issue_type" ("organizationTeamId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d99fe5b50dbe5078e0d9a9b6a9" ON "task_related_issue_type" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_61a7cb4452d9e23f91231b7fd6" ON "task_related_issue_type" ("value") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9423f99da972c150f85dbc11c1" ON "task_related_issue_type" ("name") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bed691e21fe01cf5aceee72295" ON "task_related_issue_type" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b7b0ea8ac2825fb981c1181d11" ON "task_related_issue_type" ("tenantId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_4967ebdca0aefb9d43e56695e4"`);
		await queryRunner.query(`DROP INDEX "IDX_d99fe5b50dbe5078e0d9a9b6a9"`);
		await queryRunner.query(`DROP INDEX "IDX_61a7cb4452d9e23f91231b7fd6"`);
		await queryRunner.query(`DROP INDEX "IDX_9423f99da972c150f85dbc11c1"`);
		await queryRunner.query(`DROP INDEX "IDX_bed691e21fe01cf5aceee72295"`);
		await queryRunner.query(`DROP INDEX "IDX_b7b0ea8ac2825fb981c1181d11"`);
		await queryRunner.query(`DROP TABLE "task_related_issue_type"`);
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
