import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterOrganizationProjectAndProjectEmployeeAddFields1725864010006 implements MigrationInterface {
	name = 'AlterOrganizationProjectAndProjectEmployeeAddFields1725864010006';

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
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_2ba868f42c2301075b7c141359e"`
		);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "status" character varying`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "icon" character varying`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "archiveTasksIn" numeric`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "closeTasksIn" numeric`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "defaultAssigneeId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "deletedAt" TIMESTAMP`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "id" uuid NOT NULL DEFAULT gen_random_uuid()`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_5be2464327d74ba4e2b2240aac4"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36" PRIMARY KEY ("employeeId", "organizationProjectId", "id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`
		);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "isActive" boolean DEFAULT true`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "isArchived" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "tenantId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "organizationId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "roleId" uuid`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_5be2464327d74ba4e2b2240aac4" PRIMARY KEY ("employeeId", "organizationProjectId")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd" PRIMARY KEY ("employeeId", "id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_cb8069ff5917c90adbc48139147" PRIMARY KEY ("id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_cb8069ff5917c90adbc48139147"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd" PRIMARY KEY ("id", "employeeId")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36" PRIMARY KEY ("employeeId", "id", "organizationProjectId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
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
		await queryRunner.query(
			`ALTER TABLE "organization_project" ADD CONSTRAINT "FK_489012234f53089d4b508f4aa12" FOREIGN KEY ("defaultAssigneeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
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
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_1c5e006185395a6193ede3456c6"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_2ba868f42c2301075b7c141359e"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_a77a507b7402f0adb6a6b41e412"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_a9abd98013154ec1edfa1ec18cd"`
		);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP CONSTRAINT "FK_489012234f53089d4b508f4aa12"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_16c34de330ae8d59d9b31cce14"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd" PRIMARY KEY ("employeeId", "id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_cb8069ff5917c90adbc48139147" PRIMARY KEY ("id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_cb8069ff5917c90adbc48139147"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd" PRIMARY KEY ("employeeId", "id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36" PRIMARY KEY ("employeeId", "organizationProjectId", "id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_5be2464327d74ba4e2b2240aac4"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36" PRIMARY KEY ("employeeId", "organizationProjectId", "id")`
		);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "roleId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "organizationId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "tenantId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "isArchived"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "isActive"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "updatedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "createdAt"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_5be2464327d74ba4e2b2240aac4" PRIMARY KEY ("employeeId", "organizationProjectId")`
		);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "id"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "deletedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "defaultAssigneeId"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "closeTasksIn"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "archiveTasksIn"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "icon"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "status"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`
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
		await queryRunner.query(`DROP INDEX "IDX_904ae0b765faef6ba2db8b1e69"`);
		await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
		await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
		await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
		await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
		await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
		await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
		await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
		await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
		await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
		await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
		await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, "deletedAt" datetime, "fix_relational_custom_fields" boolean, "status" varchar, "icon" varchar, "archiveTasksIn" decimal, "closeTasksIn" decimal, "defaultAssigneeId" varchar, CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields" FROM "organization_project"`
		);
		await queryRunner.query(`DROP TABLE "organization_project"`);
		await queryRunner.query(`ALTER TABLE "temporary_organization_project" RENAME TO "organization_project"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_904ae0b765faef6ba2db8b1e69" ON "organization_project" ("repositoryId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "roleId" varchar, PRIMARY KEY ("employeeId", "organizationProjectId", "id"))`
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
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "roleId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId" FROM "organization_project_employee"`
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
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "roleId" varchar, PRIMARY KEY ("employeeId", "organizationProjectId", "id"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId" FROM "organization_project_employee"`
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
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
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
		await queryRunner.query(`DROP INDEX "IDX_904ae0b765faef6ba2db8b1e69"`);
		await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
		await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
		await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
		await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
		await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
		await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
		await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
		await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
		await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
		await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
		await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
		await queryRunner.query(`DROP INDEX "IDX_16c34de330ae8d59d9b31cce14"`);
		await queryRunner.query(`DROP INDEX "IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, "deletedAt" datetime, "fix_relational_custom_fields" boolean, "status" varchar, "icon" varchar, "archiveTasksIn" decimal, "closeTasksIn" decimal, "defaultAssigneeId" varchar, CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_489012234f53089d4b508f4aa12" FOREIGN KEY ("defaultAssigneeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "status", "icon", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "status", "icon", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId" FROM "organization_project"`
		);
		await queryRunner.query(`DROP TABLE "organization_project"`);
		await queryRunner.query(`ALTER TABLE "temporary_organization_project" RENAME TO "organization_project"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_904ae0b765faef6ba2db8b1e69" ON "organization_project" ("repositoryId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "roleId" varchar, CONSTRAINT "FK_a9abd98013154ec1edfa1ec18cd" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a77a507b7402f0adb6a6b41e412" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1c5e006185395a6193ede3456c6" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("employeeId", "organizationProjectId", "id"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId" FROM "organization_project_employee"`
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
			`CREATE TABLE "organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "roleId" varchar, PRIMARY KEY ("employeeId", "organizationProjectId", "id"))`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId" FROM "temporary_organization_project_employee"`
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
		await queryRunner.query(`DROP INDEX "IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(`DROP INDEX "IDX_16c34de330ae8d59d9b31cce14"`);
		await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
		await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
		await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
		await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
		await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
		await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
		await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
		await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
		await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
		await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
		await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
		await queryRunner.query(`DROP INDEX "IDX_904ae0b765faef6ba2db8b1e69"`);
		await queryRunner.query(`ALTER TABLE "organization_project" RENAME TO "temporary_organization_project"`);
		await queryRunner.query(
			`CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, "deletedAt" datetime, "fix_relational_custom_fields" boolean, "status" varchar, "icon" varchar, "archiveTasksIn" decimal, "closeTasksIn" decimal, "defaultAssigneeId" varchar, CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "status", "icon", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "status", "icon", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId" FROM "temporary_organization_project"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_904ae0b765faef6ba2db8b1e69" ON "organization_project" ("repositoryId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(`DROP INDEX "IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(`DROP INDEX "IDX_16c34de330ae8d59d9b31cce14"`);
		await queryRunner.query(`DROP INDEX "IDX_6b5b0c3d994f59d9c800922257"`);
		await queryRunner.query(`DROP INDEX "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" RENAME TO "temporary_organization_project_employee"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "roleId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId" FROM "temporary_organization_project_employee"`
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
			`CREATE TABLE "organization_project_employee" ("employeeId" varchar NOT NULL, "organizationProjectId" varchar NOT NULL, "deletedAt" datetime, "id" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "roleId" varchar, PRIMARY KEY ("employeeId", "organizationProjectId", "id"))`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_employee"("employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId") SELECT "employeeId", "organizationProjectId", "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "roleId" FROM "temporary_organization_project_employee"`
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
		await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
		await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
		await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
		await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
		await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
		await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
		await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
		await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
		await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
		await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
		await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
		await queryRunner.query(`DROP INDEX "IDX_904ae0b765faef6ba2db8b1e69"`);
		await queryRunner.query(`ALTER TABLE "organization_project" RENAME TO "temporary_organization_project"`);
		await queryRunner.query(
			`CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, "deletedAt" datetime, "fix_relational_custom_fields" boolean, CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields" FROM "temporary_organization_project"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project"`);
		await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_904ae0b765faef6ba2db8b1e69" ON "organization_project" ("repositoryId") `
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
		await queryRunner.query(`ALTER TABLE \`organization_project\` ADD \`status\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project\` ADD \`icon\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project\` ADD \`archiveTasksIn\` decimal NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project\` ADD \`closeTasksIn\` decimal NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project\` ADD \`defaultAssigneeId\` varchar(255) NULL`);
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
			`CREATE INDEX \`IDX_16c34de330ae8d59d9b31cce14\` ON \`organization_project\` (\`status\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_489012234f53089d4b508f4aa1\` ON \`organization_project\` (\`defaultAssigneeId\`)`
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
			`ALTER TABLE \`organization_project\` ADD CONSTRAINT \`FK_489012234f53089d4b508f4aa12\` FOREIGN KEY (\`defaultAssigneeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
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
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` DROP FOREIGN KEY \`FK_489012234f53089d4b508f4aa12\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_1c5e006185395a6193ede3456c\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_6b5b0c3d994f59d9c800922257\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_2ba868f42c2301075b7c141359\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_a77a507b7402f0adb6a6b41e41\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_a9abd98013154ec1edfa1ec18c\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_abbe29504bb642647a69959cc0\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_f3d1102a8aa6442cdfce5d57c3\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_489012234f53089d4b508f4aa1\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_16c34de330ae8d59d9b31cce14\` ON \`organization_project\``);
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
		await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`defaultAssigneeId\``);
		await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`closeTasksIn\``);
		await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`archiveTasksIn\``);
		await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`icon\``);
		await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`status\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_6b5b0c3d994f59d9c800922257f\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_2ba868f42c2301075b7c141359e\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}
}
