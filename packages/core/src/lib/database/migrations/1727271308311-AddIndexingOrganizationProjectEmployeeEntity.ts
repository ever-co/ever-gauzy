import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddIndexingOrganizationProjectEmployeeEntity1727271308311 implements MigrationInterface {
	name = 'AddIndexingOrganizationProjectEmployeeEntity1727271308311';

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
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log('Step 1: Dropping existing indexes...');
		await queryRunner.query(`DROP INDEX "IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(`DROP INDEX "IDX_25de67f7f3f030438e3ecb1c0e"`);
		await queryRunner.query(`DROP INDEX "IDX_509be755cdaf837c263ffaa6b6"`);
		await queryRunner.query(`DROP INDEX "IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);

		console.log('Step 2: Creating a temporary table with the new schema without foreign key constraints...');
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (DATETIME('now')), "updatedAt" datetime NOT NULL DEFAULT (DATETIME('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "roleId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId" FROM "organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_employee"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_employee" RENAME TO "organization_project_employee"`
		);

		console.log('Step 3: Re-creating indexes after dropping foreign key constraints...');
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_25de67f7f3f030438e3ecb1c0e" ON "organization_project_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_509be755cdaf837c263ffaa6b6" ON "organization_project_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a77a507b7402f0adb6a6b41e41" ON "organization_project_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a9abd98013154ec1edfa1ec18c" ON "organization_project_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_abbe29504bb642647a69959cc0" ON "organization_project_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f3d1102a8aa6442cdfce5d57c3" ON "organization_project_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);

		console.log('Step 4: Dropping existing indexes...');
		await queryRunner.query(`DROP INDEX "IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(`DROP INDEX "IDX_25de67f7f3f030438e3ecb1c0e"`);
		await queryRunner.query(`DROP INDEX "IDX_509be755cdaf837c263ffaa6b6"`);
		await queryRunner.query(`DROP INDEX "IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);

		console.log('Step 5: Creating a temporary table with the new schema...');
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "roleId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId" FROM "organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_employee"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_employee" RENAME TO "organization_project_employee"`
		);

		console.log('Step 6: Re-creating indexes...');
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_25de67f7f3f030438e3ecb1c0e" ON "organization_project_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_509be755cdaf837c263ffaa6b6" ON "organization_project_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a77a507b7402f0adb6a6b41e41" ON "organization_project_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a9abd98013154ec1edfa1ec18c" ON "organization_project_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_abbe29504bb642647a69959cc0" ON "organization_project_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f3d1102a8aa6442cdfce5d57c3" ON "organization_project_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);

		console.log('Step 7: Dropping existing indexes...');
		await queryRunner.query(`DROP INDEX "IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(`DROP INDEX "IDX_25de67f7f3f030438e3ecb1c0e"`);
		await queryRunner.query(`DROP INDEX "IDX_509be755cdaf837c263ffaa6b6"`);
		await queryRunner.query(`DROP INDEX "IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);

		console.log('Step 8: Creating a temporary table with the new schema...');
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "roleId" varchar, CONSTRAINT "FK_a9abd98013154ec1edfa1ec18cd" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a77a507b7402f0adb6a6b41e412" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1c5e006185395a6193ede3456c6" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId" FROM "organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_employee"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_employee" RENAME TO "organization_project_employee"`
		);

		console.log('Step 9: Re-creating indexes...');
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_25de67f7f3f030438e3ecb1c0e" ON "organization_project_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_509be755cdaf837c263ffaa6b6" ON "organization_project_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a77a507b7402f0adb6a6b41e41" ON "organization_project_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a9abd98013154ec1edfa1ec18c" ON "organization_project_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_abbe29504bb642647a69959cc0" ON "organization_project_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f3d1102a8aa6442cdfce5d57c3" ON "organization_project_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log('Step 1: Dropping existing indexes...');
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "IDX_509be755cdaf837c263ffaa6b6"`);
		await queryRunner.query(`DROP INDEX "IDX_25de67f7f3f030438e3ecb1c0e"`);
		await queryRunner.query(`DROP INDEX "IDX_1c5e006185395a6193ede3456c"`);

		console.log('Step 2: Creating a temporary table with the new schema...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" RENAME TO "temporary_organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "roleId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId" FROM "temporary_organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_employee"`);

		console.log('Step 3: Re-creating indexes...');
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f3d1102a8aa6442cdfce5d57c3" ON "organization_project_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_abbe29504bb642647a69959cc0" ON "organization_project_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a9abd98013154ec1edfa1ec18c" ON "organization_project_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a77a507b7402f0adb6a6b41e41" ON "organization_project_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_509be755cdaf837c263ffaa6b6" ON "organization_project_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_25de67f7f3f030438e3ecb1c0e" ON "organization_project_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
		);

		console.log('Step 4: Dropping existing indexes...');
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "IDX_509be755cdaf837c263ffaa6b6"`);
		await queryRunner.query(`DROP INDEX "IDX_25de67f7f3f030438e3ecb1c0e"`);
		await queryRunner.query(`DROP INDEX "IDX_1c5e006185395a6193ede3456c"`);

		console.log('Step 5: Creating a temporary table with the new schema...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" RENAME TO "temporary_organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (DATETIME('now')), "updatedAt" datetime NOT NULL DEFAULT (DATETIME('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "roleId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId" FROM "temporary_organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_employee"`);

		console.log('Step 6: Re-creating indexes...');
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f3d1102a8aa6442cdfce5d57c3" ON "organization_project_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_abbe29504bb642647a69959cc0" ON "organization_project_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a9abd98013154ec1edfa1ec18c" ON "organization_project_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a77a507b7402f0adb6a6b41e41" ON "organization_project_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_509be755cdaf837c263ffaa6b6" ON "organization_project_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_25de67f7f3f030438e3ecb1c0e" ON "organization_project_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
		);

		console.log('Step 7: Dropping existing indexes...');
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "IDX_509be755cdaf837c263ffaa6b6"`);
		await queryRunner.query(`DROP INDEX "IDX_25de67f7f3f030438e3ecb1c0e"`);
		await queryRunner.query(`DROP INDEX "IDX_1c5e006185395a6193ede3456c"`);

		console.log('Step 8: Creating a temporary table with the new schema...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" RENAME TO "temporary_organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (DATETIME('now')), "updatedAt" datetime NOT NULL DEFAULT (DATETIME('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "roleId" varchar, CONSTRAINT "FK_1c5e006185395a6193ede3456c6" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a77a507b7402f0adb6a6b41e412" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a9abd98013154ec1edfa1ec18cd" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "roleId" FROM "temporary_organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_employee"`);

		console.log('Step 9: Re-creating indexes...');
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f3d1102a8aa6442cdfce5d57c3" ON "organization_project_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_abbe29504bb642647a69959cc0" ON "organization_project_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a9abd98013154ec1edfa1ec18c" ON "organization_project_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a77a507b7402f0adb6a6b41e41" ON "organization_project_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_509be755cdaf837c263ffaa6b6" ON "organization_project_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_25de67f7f3f030438e3ecb1c0e" ON "organization_project_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log('Step 1: Dropping existing foreign key constraints...');
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_2ba868f42c2301075b7c141359e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_6b5b0c3d994f59d9c800922257f\``
		);

		console.log('Step 2: Modifying the columns without dropping them...');
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` MODIFY \`organizationProjectId\` varchar(255) NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` MODIFY \`employeeId\` varchar(255) NOT NULL`
		);

		console.log('Step 3: Creating indexes for the columns...');
		await queryRunner.query(
			`CREATE INDEX \`IDX_2ba868f42c2301075b7c141359\` ON \`organization_project_employee\` (\`organizationProjectId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_6b5b0c3d994f59d9c800922257\` ON \`organization_project_employee\` (\`employeeId\`)`
		);

		console.log('Step 4: Adding the foreign key constraints back with the updated columns...');
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_2ba868f42c2301075b7c141359e\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_6b5b0c3d994f59d9c800922257f\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log('Step 1: Dropping existing foreign key constraints...');
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_6b5b0c3d994f59d9c800922257f\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_2ba868f42c2301075b7c141359e\``
		);

		console.log('Step 2: Dropping the indexes created in the up migration...');
		await queryRunner.query(`DROP INDEX \`IDX_6b5b0c3d994f59d9c800922257\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_2ba868f42c2301075b7c141359\` ON \`organization_project_employee\``);

		console.log('Step 3: Modifying the columns back to their original data types...');
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` MODIFY \`employeeId\` varchar(36) NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` MODIFY \`organizationProjectId\` varchar(36) NOT NULL`
		);

		console.log('Step 4: Re-adding the foreign key constraints...');
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_6b5b0c3d994f59d9c800922257f\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_2ba868f42c2301075b7c141359e\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}
}
