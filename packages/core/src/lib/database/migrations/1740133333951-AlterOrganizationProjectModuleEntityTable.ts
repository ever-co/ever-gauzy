import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterOrganizationProjectModuleEntityTable1740133333951 implements MigrationInterface {
	name = 'AlterOrganizationProjectModuleEntityTable1740133333951';

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
			`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_8f2054a6a2d4b9c17624b9c8a0"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" RENAME COLUMN "creatorId" TO "createdByUserId"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4bb6fbfa64cf5d5977c2e5346a" ON "organization_project_module" ("parentId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1b1fecc4a41d0a5c4d9493bd9d" ON "organization_project_module" ("createdByUserId") `
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_1b1fecc4a41d0a5c4d9493bd9de" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_1b1fecc4a41d0a5c4d9493bd9de"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_1b1fecc4a41d0a5c4d9493bd9d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4bb6fbfa64cf5d5977c2e5346a"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" RENAME COLUMN "createdByUserId" TO "creatorId"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0" ON "organization_project_module" ("creatorId") `
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0"`);
		await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
		await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
		await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
		await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
		await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
		await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "creatorId" varchar, "archivedAt" datetime, CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "archivedAt") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "archivedAt" FROM "organization_project_module"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_module"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_module" RENAME TO "organization_project_module"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0" ON "organization_project_module" ("creatorId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `
		);
		await queryRunner.query(`DROP INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0"`);
		await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
		await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
		await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
		await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
		await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
		await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "createdByUserId" varchar, "archivedAt" datetime, CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "createdByUserId", "archivedAt") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "archivedAt" FROM "organization_project_module"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_module"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_module" RENAME TO "organization_project_module"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4bb6fbfa64cf5d5977c2e5346a" ON "organization_project_module" ("parentId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1b1fecc4a41d0a5c4d9493bd9d" ON "organization_project_module" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
		await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
		await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
		await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
		await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
		await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
		await queryRunner.query(`DROP INDEX "IDX_4bb6fbfa64cf5d5977c2e5346a"`);
		await queryRunner.query(`DROP INDEX "IDX_1b1fecc4a41d0a5c4d9493bd9d"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "createdByUserId" varchar, "archivedAt" datetime, CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1b1fecc4a41d0a5c4d9493bd9de" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "createdByUserId", "archivedAt") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "createdByUserId", "archivedAt" FROM "organization_project_module"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_module"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_module" RENAME TO "organization_project_module"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4bb6fbfa64cf5d5977c2e5346a" ON "organization_project_module" ("parentId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1b1fecc4a41d0a5c4d9493bd9d" ON "organization_project_module" ("createdByUserId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_1b1fecc4a41d0a5c4d9493bd9d"`);
		await queryRunner.query(`DROP INDEX "IDX_4bb6fbfa64cf5d5977c2e5346a"`);
		await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
		await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
		await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
		await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
		await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
		await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" RENAME TO "temporary_organization_project_module"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "createdByUserId" varchar, "archivedAt" datetime, CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "createdByUserId", "archivedAt") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "createdByUserId", "archivedAt" FROM "temporary_organization_project_module"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_module"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_1b1fecc4a41d0a5c4d9493bd9d" ON "organization_project_module" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4bb6fbfa64cf5d5977c2e5346a" ON "organization_project_module" ("parentId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_1b1fecc4a41d0a5c4d9493bd9d"`);
		await queryRunner.query(`DROP INDEX "IDX_4bb6fbfa64cf5d5977c2e5346a"`);
		await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
		await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
		await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
		await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
		await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
		await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" RENAME TO "temporary_organization_project_module"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "creatorId" varchar, "archivedAt" datetime, CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "archivedAt") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "createdByUserId", "archivedAt" FROM "temporary_organization_project_module"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_module"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0" ON "organization_project_module" ("creatorId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
		await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
		await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
		await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
		await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
		await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
		await queryRunner.query(`DROP INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" RENAME TO "temporary_organization_project_module"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "creatorId" varchar, "archivedAt" datetime, CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "archivedAt") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "archivedAt" FROM "temporary_organization_project_module"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_module"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0" ON "organization_project_module" ("creatorId") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}
}
