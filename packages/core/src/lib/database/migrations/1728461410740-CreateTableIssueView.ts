import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateTableIssueView1728461410740 implements MigrationInterface {
	name = 'CreateTableIssueView1728461410740';

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
			`CREATE TABLE "task_view" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "description" text, "visibilityLevel" integer, "queryParams" jsonb, "filterOptions" jsonb, "displayOptions" jsonb, "properties" jsonb, "isLocked" boolean NOT NULL DEFAULT false, "projectId" uuid, "organizationTeamId" uuid, "projectModuleId" uuid, "organizationSprintId" uuid, CONSTRAINT "PK_f4c3a51cd56250a117c9bbb3af6" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_38bcdf0455ac5ab5a925a015ab" ON "task_view" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c4f8a4d5b859c23c42ab5f984" ON "task_view" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ee94e92fccbbf8898221cb4eb5" ON "task_view" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c1c6e1c8d7c7971e234a768419" ON "task_view" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cf779d00641c3bd276a5a7e4df" ON "task_view" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_d4c182a7adfffa1a57315e8bfc" ON "task_view" ("visibilityLevel") `);
		await queryRunner.query(`CREATE INDEX "IDX_1e5e43bbd58c370c538dac0b17" ON "task_view" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3c1eb880f298e646d43736e911" ON "task_view" ("organizationTeamId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e58e58a3fd113bf4b336c90997" ON "task_view" ("projectModuleId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_4814ca7712537f79bed938d9a1" ON "task_view" ("organizationSprintId") `
		);
		await queryRunner.query(
			`ALTER TABLE "task_view" ADD CONSTRAINT "FK_ee94e92fccbbf8898221cb4eb53" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_view" ADD CONSTRAINT "FK_c1c6e1c8d7c7971e234a768419c" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "task_view" ADD CONSTRAINT "FK_1e5e43bbd58c370c538dac0b17c" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_view" ADD CONSTRAINT "FK_3c1eb880f298e646d43736e911a" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_view" ADD CONSTRAINT "FK_e58e58a3fd113bf4b336c90997b" FOREIGN KEY ("projectModuleId") REFERENCES "organization_project_module"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_view" ADD CONSTRAINT "FK_4814ca7712537f79bed938d9a15" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "task_view" DROP CONSTRAINT "FK_4814ca7712537f79bed938d9a15"`);
		await queryRunner.query(`ALTER TABLE "task_view" DROP CONSTRAINT "FK_e58e58a3fd113bf4b336c90997b"`);
		await queryRunner.query(`ALTER TABLE "task_view" DROP CONSTRAINT "FK_3c1eb880f298e646d43736e911a"`);
		await queryRunner.query(`ALTER TABLE "task_view" DROP CONSTRAINT "FK_1e5e43bbd58c370c538dac0b17c"`);
		await queryRunner.query(`ALTER TABLE "task_view" DROP CONSTRAINT "FK_c1c6e1c8d7c7971e234a768419c"`);
		await queryRunner.query(`ALTER TABLE "task_view" DROP CONSTRAINT "FK_ee94e92fccbbf8898221cb4eb53"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4814ca7712537f79bed938d9a1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e58e58a3fd113bf4b336c90997"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3c1eb880f298e646d43736e911"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1e5e43bbd58c370c538dac0b17"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d4c182a7adfffa1a57315e8bfc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cf779d00641c3bd276a5a7e4df"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c1c6e1c8d7c7971e234a768419"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ee94e92fccbbf8898221cb4eb5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7c4f8a4d5b859c23c42ab5f984"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_38bcdf0455ac5ab5a925a015ab"`);
		await queryRunner.query(`DROP TABLE "task_view"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "task_view" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "visibilityLevel" integer, "queryParams" text, "filterOptions" text, "displayOptions" text, "properties" text, "isLocked" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, "projectModuleId" varchar, "organizationSprintId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_38bcdf0455ac5ab5a925a015ab" ON "task_view" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c4f8a4d5b859c23c42ab5f984" ON "task_view" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ee94e92fccbbf8898221cb4eb5" ON "task_view" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c1c6e1c8d7c7971e234a768419" ON "task_view" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cf779d00641c3bd276a5a7e4df" ON "task_view" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_d4c182a7adfffa1a57315e8bfc" ON "task_view" ("visibilityLevel") `);
		await queryRunner.query(`CREATE INDEX "IDX_1e5e43bbd58c370c538dac0b17" ON "task_view" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3c1eb880f298e646d43736e911" ON "task_view" ("organizationTeamId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e58e58a3fd113bf4b336c90997" ON "task_view" ("projectModuleId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_4814ca7712537f79bed938d9a1" ON "task_view" ("organizationSprintId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_38bcdf0455ac5ab5a925a015ab"`);
		await queryRunner.query(`DROP INDEX "IDX_7c4f8a4d5b859c23c42ab5f984"`);
		await queryRunner.query(`DROP INDEX "IDX_ee94e92fccbbf8898221cb4eb5"`);
		await queryRunner.query(`DROP INDEX "IDX_c1c6e1c8d7c7971e234a768419"`);
		await queryRunner.query(`DROP INDEX "IDX_cf779d00641c3bd276a5a7e4df"`);
		await queryRunner.query(`DROP INDEX "IDX_d4c182a7adfffa1a57315e8bfc"`);
		await queryRunner.query(`DROP INDEX "IDX_1e5e43bbd58c370c538dac0b17"`);
		await queryRunner.query(`DROP INDEX "IDX_3c1eb880f298e646d43736e911"`);
		await queryRunner.query(`DROP INDEX "IDX_e58e58a3fd113bf4b336c90997"`);
		await queryRunner.query(`DROP INDEX "IDX_4814ca7712537f79bed938d9a1"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_task_view" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "visibilityLevel" integer, "queryParams" text, "filterOptions" text, "displayOptions" text, "properties" text, "isLocked" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, "projectModuleId" varchar, "organizationSprintId" varchar, CONSTRAINT "FK_ee94e92fccbbf8898221cb4eb53" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c1c6e1c8d7c7971e234a768419c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1e5e43bbd58c370c538dac0b17c" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3c1eb880f298e646d43736e911a" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e58e58a3fd113bf4b336c90997b" FOREIGN KEY ("projectModuleId") REFERENCES "organization_project_module" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4814ca7712537f79bed938d9a15" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_task_view"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "visibilityLevel", "queryParams", "filterOptions", "displayOptions", "properties", "isLocked", "projectId", "organizationTeamId", "projectModuleId", "organizationSprintId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "visibilityLevel", "queryParams", "filterOptions", "displayOptions", "properties", "isLocked", "projectId", "organizationTeamId", "projectModuleId", "organizationSprintId" FROM "task_view"`
		);
		await queryRunner.query(`DROP TABLE "task_view"`);
		await queryRunner.query(`ALTER TABLE "temporary_task_view" RENAME TO "task_view"`);
		await queryRunner.query(`CREATE INDEX "IDX_38bcdf0455ac5ab5a925a015ab" ON "task_view" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c4f8a4d5b859c23c42ab5f984" ON "task_view" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ee94e92fccbbf8898221cb4eb5" ON "task_view" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c1c6e1c8d7c7971e234a768419" ON "task_view" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cf779d00641c3bd276a5a7e4df" ON "task_view" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_d4c182a7adfffa1a57315e8bfc" ON "task_view" ("visibilityLevel") `);
		await queryRunner.query(`CREATE INDEX "IDX_1e5e43bbd58c370c538dac0b17" ON "task_view" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3c1eb880f298e646d43736e911" ON "task_view" ("organizationTeamId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e58e58a3fd113bf4b336c90997" ON "task_view" ("projectModuleId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_4814ca7712537f79bed938d9a1" ON "task_view" ("organizationSprintId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_4814ca7712537f79bed938d9a1"`);
		await queryRunner.query(`DROP INDEX "IDX_e58e58a3fd113bf4b336c90997"`);
		await queryRunner.query(`DROP INDEX "IDX_3c1eb880f298e646d43736e911"`);
		await queryRunner.query(`DROP INDEX "IDX_1e5e43bbd58c370c538dac0b17"`);
		await queryRunner.query(`DROP INDEX "IDX_d4c182a7adfffa1a57315e8bfc"`);
		await queryRunner.query(`DROP INDEX "IDX_cf779d00641c3bd276a5a7e4df"`);
		await queryRunner.query(`DROP INDEX "IDX_c1c6e1c8d7c7971e234a768419"`);
		await queryRunner.query(`DROP INDEX "IDX_ee94e92fccbbf8898221cb4eb5"`);
		await queryRunner.query(`DROP INDEX "IDX_7c4f8a4d5b859c23c42ab5f984"`);
		await queryRunner.query(`DROP INDEX "IDX_38bcdf0455ac5ab5a925a015ab"`);
		await queryRunner.query(`ALTER TABLE "task_view" RENAME TO "temporary_task_view"`);
		await queryRunner.query(
			`CREATE TABLE "task_view" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "visibilityLevel" integer, "queryParams" text, "filterOptions" text, "displayOptions" text, "properties" text, "isLocked" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, "projectModuleId" varchar, "organizationSprintId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "task_view"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "visibilityLevel", "queryParams", "filterOptions", "displayOptions", "properties", "isLocked", "projectId", "organizationTeamId", "projectModuleId", "organizationSprintId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "visibilityLevel", "queryParams", "filterOptions", "displayOptions", "properties", "isLocked", "projectId", "organizationTeamId", "projectModuleId", "organizationSprintId" FROM "temporary_task_view"`
		);
		await queryRunner.query(`DROP TABLE "temporary_task_view"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_4814ca7712537f79bed938d9a1" ON "task_view" ("organizationSprintId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e58e58a3fd113bf4b336c90997" ON "task_view" ("projectModuleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3c1eb880f298e646d43736e911" ON "task_view" ("organizationTeamId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1e5e43bbd58c370c538dac0b17" ON "task_view" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d4c182a7adfffa1a57315e8bfc" ON "task_view" ("visibilityLevel") `);
		await queryRunner.query(`CREATE INDEX "IDX_cf779d00641c3bd276a5a7e4df" ON "task_view" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_c1c6e1c8d7c7971e234a768419" ON "task_view" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ee94e92fccbbf8898221cb4eb5" ON "task_view" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c4f8a4d5b859c23c42ab5f984" ON "task_view" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_38bcdf0455ac5ab5a925a015ab" ON "task_view" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_4814ca7712537f79bed938d9a1"`);
		await queryRunner.query(`DROP INDEX "IDX_e58e58a3fd113bf4b336c90997"`);
		await queryRunner.query(`DROP INDEX "IDX_3c1eb880f298e646d43736e911"`);
		await queryRunner.query(`DROP INDEX "IDX_1e5e43bbd58c370c538dac0b17"`);
		await queryRunner.query(`DROP INDEX "IDX_d4c182a7adfffa1a57315e8bfc"`);
		await queryRunner.query(`DROP INDEX "IDX_cf779d00641c3bd276a5a7e4df"`);
		await queryRunner.query(`DROP INDEX "IDX_c1c6e1c8d7c7971e234a768419"`);
		await queryRunner.query(`DROP INDEX "IDX_ee94e92fccbbf8898221cb4eb5"`);
		await queryRunner.query(`DROP INDEX "IDX_7c4f8a4d5b859c23c42ab5f984"`);
		await queryRunner.query(`DROP INDEX "IDX_38bcdf0455ac5ab5a925a015ab"`);
		await queryRunner.query(`DROP TABLE "task_view"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`task_view\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` text NULL, \`visibilityLevel\` int NULL, \`queryParams\` json NULL, \`filterOptions\` json NULL, \`displayOptions\` json NULL, \`properties\` json NULL, \`isLocked\` tinyint NOT NULL DEFAULT 0, \`projectId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NULL, \`projectModuleId\` varchar(255) NULL, \`organizationSprintId\` varchar(255) NULL, INDEX \`IDX_38bcdf0455ac5ab5a925a015ab\` (\`isActive\`), INDEX \`IDX_7c4f8a4d5b859c23c42ab5f984\` (\`isArchived\`), INDEX \`IDX_ee94e92fccbbf8898221cb4eb5\` (\`tenantId\`), INDEX \`IDX_c1c6e1c8d7c7971e234a768419\` (\`organizationId\`), INDEX \`IDX_cf779d00641c3bd276a5a7e4df\` (\`name\`), INDEX \`IDX_d4c182a7adfffa1a57315e8bfc\` (\`visibilityLevel\`), INDEX \`IDX_1e5e43bbd58c370c538dac0b17\` (\`projectId\`), INDEX \`IDX_3c1eb880f298e646d43736e911\` (\`organizationTeamId\`), INDEX \`IDX_e58e58a3fd113bf4b336c90997\` (\`projectModuleId\`), INDEX \`IDX_4814ca7712537f79bed938d9a1\` (\`organizationSprintId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_view\` ADD CONSTRAINT \`FK_ee94e92fccbbf8898221cb4eb53\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_view\` ADD CONSTRAINT \`FK_c1c6e1c8d7c7971e234a768419c\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_view\` ADD CONSTRAINT \`FK_1e5e43bbd58c370c538dac0b17c\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_view\` ADD CONSTRAINT \`FK_3c1eb880f298e646d43736e911a\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_view\` ADD CONSTRAINT \`FK_e58e58a3fd113bf4b336c90997b\` FOREIGN KEY (\`projectModuleId\`) REFERENCES \`organization_project_module\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_view\` ADD CONSTRAINT \`FK_4814ca7712537f79bed938d9a15\` FOREIGN KEY (\`organizationSprintId\`) REFERENCES \`organization_sprint\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`task_view\` DROP FOREIGN KEY \`FK_4814ca7712537f79bed938d9a15\``);
		await queryRunner.query(`ALTER TABLE \`task_view\` DROP FOREIGN KEY \`FK_e58e58a3fd113bf4b336c90997b\``);
		await queryRunner.query(`ALTER TABLE \`task_view\` DROP FOREIGN KEY \`FK_3c1eb880f298e646d43736e911a\``);
		await queryRunner.query(`ALTER TABLE \`task_view\` DROP FOREIGN KEY \`FK_1e5e43bbd58c370c538dac0b17c\``);
		await queryRunner.query(`ALTER TABLE \`task_view\` DROP FOREIGN KEY \`FK_c1c6e1c8d7c7971e234a768419c\``);
		await queryRunner.query(`ALTER TABLE \`task_view\` DROP FOREIGN KEY \`FK_ee94e92fccbbf8898221cb4eb53\``);
		await queryRunner.query(`DROP INDEX \`IDX_4814ca7712537f79bed938d9a1\` ON \`task_view\``);
		await queryRunner.query(`DROP INDEX \`IDX_e58e58a3fd113bf4b336c90997\` ON \`task_view\``);
		await queryRunner.query(`DROP INDEX \`IDX_3c1eb880f298e646d43736e911\` ON \`task_view\``);
		await queryRunner.query(`DROP INDEX \`IDX_1e5e43bbd58c370c538dac0b17\` ON \`task_view\``);
		await queryRunner.query(`DROP INDEX \`IDX_d4c182a7adfffa1a57315e8bfc\` ON \`task_view\``);
		await queryRunner.query(`DROP INDEX \`IDX_cf779d00641c3bd276a5a7e4df\` ON \`task_view\``);
		await queryRunner.query(`DROP INDEX \`IDX_c1c6e1c8d7c7971e234a768419\` ON \`task_view\``);
		await queryRunner.query(`DROP INDEX \`IDX_ee94e92fccbbf8898221cb4eb5\` ON \`task_view\``);
		await queryRunner.query(`DROP INDEX \`IDX_7c4f8a4d5b859c23c42ab5f984\` ON \`task_view\``);
		await queryRunner.query(`DROP INDEX \`IDX_38bcdf0455ac5ab5a925a015ab\` ON \`task_view\``);
		await queryRunner.query(`DROP TABLE \`task_view\``);
	}
}
