import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddColumnsToOrganizationProjectEmployeeEntity1725982927532 implements MigrationInterface {
	name = 'AddColumnsToOrganizationProjectEmployeeEntity1725982927532';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(yellow(this.name + ' start running!'));

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
		// Drop unnecessary foreign key constraints
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT IF EXISTS "FK_2ba868f42c2301075b7c141359e"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT IF EXISTS "FK_6b5b0c3d994f59d9c800922257f"`
		);

		// Add necessary columns
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "deletedAt" TIMESTAMP`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "id" uuid NOT NULL DEFAULT gen_random_uuid()`
		);

		// Drop old primary key
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT IF EXISTS "PK_5be2464327d74ba4e2b2240aac4"`
		);

		// Add new primary key (combination of id, employeeId, and organizationProjectId)
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36" PRIMARY KEY ("id", "employeeId", "organizationProjectId")`
		);

		// Add additional necessary columns
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`
		);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "isActive" boolean DEFAULT true`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "isArchived" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "tenantId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "organizationId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "roleId" uuid`);

		// Create indexes
		await queryRunner.query(
			`CREATE INDEX "IDX_f3d1102a8aa6442cdfce5d57c3" ON "organization_project_employee" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_abbe29504bb642647a69959cc0" ON "organization_project_employee" ("isArchived")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a9abd98013154ec1edfa1ec18c" ON "organization_project_employee" ("tenantId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a77a507b7402f0adb6a6b41e41" ON "organization_project_employee" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId")`
		);

		// Re-add foreign key constraints
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_a9abd98013154ec1edfa1ec18cd" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_a77a507b7402f0adb6a6b41e412" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_1c5e006185395a6193ede3456c6" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Drop foreign key constraints
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT IF EXISTS "FK_1c5e006185395a6193ede3456c6"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT IF EXISTS "FK_6b5b0c3d994f59d9c800922257f"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT IF EXISTS "FK_2ba868f42c2301075b7c141359e"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT IF EXISTS "FK_a77a507b7402f0adb6a6b41e412"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT IF EXISTS "FK_a9abd98013154ec1edfa1ec18cd"`
		);

		// Drop indexes
		await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_f3d1102a8aa6442cdfce5d57c3"`);

		// Drop primary key
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT IF EXISTS "PK_ce1fc15962d70f8776be4e19c36"`
		);

		// Remove added columns
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN IF EXISTS "roleId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN IF EXISTS "organizationId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN IF EXISTS "tenantId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN IF EXISTS "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN IF EXISTS "isArchived"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN IF EXISTS "isActive"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN IF EXISTS "updatedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN IF EXISTS "createdAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN IF EXISTS "deletedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN IF EXISTS "id"`);

		// Restore the original primary key
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_5be2464327d74ba4e2b2240aac4" PRIMARY KEY ("employeeId", "organizationProjectId")`
		);

		// Restore the original foreign key constraints
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, PRIMARY KEY ("employeeId", "organizationProjectId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_employee"("employeeId", "organizationProjectId") SELECT "employeeId", "organizationProjectId" FROM "organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_employee"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_employee" RENAME TO "organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "roleId" varchar, PRIMARY KEY ("employeeId", "organizationProjectId", "id"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_employee"("employeeId", "organizationProjectId") SELECT "employeeId", "organizationProjectId" FROM "organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_employee"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_employee" RENAME TO "organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "roleId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId" FROM "organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_employee"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_employee" RENAME TO "organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "roleId" varchar, PRIMARY KEY ("employeeId", "organizationProjectId", "id"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId" FROM "organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_employee"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_employee" RENAME TO "organization_project_employee"`
		);
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
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "roleId" varchar, CONSTRAINT "FK_a9abd98013154ec1edfa1ec18cd" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a77a507b7402f0adb6a6b41e412" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1c5e006185395a6193ede3456c6" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("employeeId", "organizationProjectId", "id"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId" FROM "organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_employee"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_employee" RENAME TO "organization_project_employee"`
		);
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
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(`DROP INDEX "IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" RENAME TO "temporary_organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "roleId" varchar, PRIMARY KEY ("employeeId", "organizationProjectId", "id"))`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId" FROM "temporary_organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_employee"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
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
		await queryRunner.query(`DROP INDEX "IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(`DROP INDEX "IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" RENAME TO "temporary_organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "roleId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId" FROM "temporary_organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_employee"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" RENAME TO "temporary_organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "roleId" varchar, PRIMARY KEY ("employeeId", "organizationProjectId", "id"))`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "roleId" FROM "temporary_organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_employee"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" RENAME TO "temporary_organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, PRIMARY KEY ("employeeId", "organizationProjectId"))`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_employee"("employeeId", "organizationProjectId") SELECT "employeeId", "organizationProjectId" FROM "temporary_organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_employee"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" RENAME TO "temporary_organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("employeeId", "organizationProjectId"))`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_employee"("employeeId", "organizationProjectId") SELECT "employeeId", "organizationProjectId" FROM "temporary_organization_project_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_employee"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_2ba868f42c2301075b7c141359e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_6b5b0c3d994f59d9c800922257f\``
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD \`deletedAt\` datetime(6) NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD \`id\` varchar(36) NOT NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`employeeId\`, \`organizationProjectId\`, \`id\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`isActive\` tinyint NULL DEFAULT 1`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`isArchived\` tinyint NULL DEFAULT 0`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD \`tenantId\` varchar(255) NULL`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`organizationId\` varchar(255) NULL`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD \`roleId\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`employeeId\`, \`organizationProjectId\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`employeeId\`, \`id\`)`
		);
		await queryRunner.query(`DROP INDEX \`IDX_2ba868f42c2301075b7c141359\` ON \`organization_project_employee\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`organizationProjectId\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`organizationProjectId\` varchar(255) NOT NULL`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`id\`)`);
		await queryRunner.query(`DROP INDEX \`IDX_6b5b0c3d994f59d9c800922257\` ON \`organization_project_employee\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`employeeId\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`employeeId\` varchar(255) NOT NULL`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`employeeId\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`employeeId\` varchar(36) NOT NULL`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`id\`, \`employeeId\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`organizationProjectId\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`organizationProjectId\` varchar(36) NOT NULL`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`id\`, \`employeeId\`, \`organizationProjectId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_f3d1102a8aa6442cdfce5d57c3\` ON \`organization_project_employee\` (\`isActive\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_abbe29504bb642647a69959cc0\` ON \`organization_project_employee\` (\`isArchived\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_a9abd98013154ec1edfa1ec18c\` ON \`organization_project_employee\` (\`tenantId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_a77a507b7402f0adb6a6b41e41\` ON \`organization_project_employee\` (\`organizationId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_2ba868f42c2301075b7c141359\` ON \`organization_project_employee\` (\`organizationProjectId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_6b5b0c3d994f59d9c800922257\` ON \`organization_project_employee\` (\`employeeId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_1c5e006185395a6193ede3456c\` ON \`organization_project_employee\` (\`roleId\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_a9abd98013154ec1edfa1ec18cd\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_a77a507b7402f0adb6a6b41e412\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_2ba868f42c2301075b7c141359e\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_6b5b0c3d994f59d9c800922257f\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_1c5e006185395a6193ede3456c6\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_1c5e006185395a6193ede3456c6\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_6b5b0c3d994f59d9c800922257f\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_2ba868f42c2301075b7c141359e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_a77a507b7402f0adb6a6b41e412\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_a9abd98013154ec1edfa1ec18cd\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_1c5e006185395a6193ede3456c\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_6b5b0c3d994f59d9c800922257\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_2ba868f42c2301075b7c141359\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_a77a507b7402f0adb6a6b41e41\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_a9abd98013154ec1edfa1ec18c\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_abbe29504bb642647a69959cc0\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_f3d1102a8aa6442cdfce5d57c3\` ON \`organization_project_employee\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`id\`, \`employeeId\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`organizationProjectId\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`organizationProjectId\` varchar(255) NOT NULL`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`id\`)`);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`employeeId\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`employeeId\` varchar(255) NOT NULL`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`employeeId\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`employeeId\` varchar(36) NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_6b5b0c3d994f59d9c800922257\` ON \`organization_project_employee\` (\`employeeId\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`employeeId\`, \`id\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`organizationProjectId\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`organizationProjectId\` varchar(36) NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_2ba868f42c2301075b7c141359\` ON \`organization_project_employee\` (\`organizationProjectId\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`employeeId\`, \`organizationProjectId\`, \`id\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`employeeId\`, \`organizationProjectId\`, \`id\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`roleId\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`organizationId\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`tenantId\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`isArchived\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`isActive\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`updatedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`createdAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`employeeId\`, \`organizationProjectId\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`id\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`deletedAt\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_6b5b0c3d994f59d9c800922257f\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_2ba868f42c2301075b7c141359e\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}
}
