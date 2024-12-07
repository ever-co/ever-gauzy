import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddColumnsToOrganizationProjectEntity1725956395183 implements MigrationInterface {
	name = 'AddColumnsToOrganizationProjectEntity1725956395183';

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
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "icon" character varying`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "status" character varying`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "archiveTasksIn" numeric`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "closeTasksIn" numeric`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "defaultAssigneeId" uuid`);
		await queryRunner.query(`CREATE INDEX "IDX_a414a803f8de400b689c9a926a" ON "organization_project" ("icon") `);
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6e002ae2ed0e1b0c9a52d8acf" ON "organization_project" ("archiveTasksIn") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f44648e75dbfafe2a807bd25df" ON "organization_project" ("closeTasksIn") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project" ADD CONSTRAINT "FK_489012234f53089d4b508f4aa12" FOREIGN KEY ("defaultAssigneeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "organization_project" DROP CONSTRAINT "FK_489012234f53089d4b508f4aa12"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f44648e75dbfafe2a807bd25df"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d6e002ae2ed0e1b0c9a52d8acf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_16c34de330ae8d59d9b31cce14"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a414a803f8de400b689c9a926a"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "defaultAssigneeId"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "closeTasksIn"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "archiveTasksIn"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "status"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "icon"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
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
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, "deletedAt" datetime, "fix_relational_custom_fields" boolean, "archivedAt" datetime, "icon" varchar, "status" varchar, "archiveTasksIn" decimal, "closeTasksIn" decimal, "defaultAssigneeId" varchar, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt" FROM "organization_project"`
		);
		await queryRunner.query(`DROP TABLE "organization_project"`);
		await queryRunner.query(`ALTER TABLE "temporary_organization_project" RENAME TO "organization_project"`);
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
		await queryRunner.query(`CREATE INDEX "IDX_a414a803f8de400b689c9a926a" ON "organization_project" ("icon") `);
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6e002ae2ed0e1b0c9a52d8acf" ON "organization_project" ("archiveTasksIn") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f44648e75dbfafe2a807bd25df" ON "organization_project" ("closeTasksIn") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
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
		await queryRunner.query(`DROP INDEX "IDX_a414a803f8de400b689c9a926a"`);
		await queryRunner.query(`DROP INDEX "IDX_16c34de330ae8d59d9b31cce14"`);
		await queryRunner.query(`DROP INDEX "IDX_d6e002ae2ed0e1b0c9a52d8acf"`);
		await queryRunner.query(`DROP INDEX "IDX_f44648e75dbfafe2a807bd25df"`);
		await queryRunner.query(`DROP INDEX "IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, "deletedAt" datetime, "fix_relational_custom_fields" boolean, "archivedAt" datetime, "icon" varchar, "status" varchar, "archiveTasksIn" decimal, "closeTasksIn" decimal, "defaultAssigneeId" varchar, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_489012234f53089d4b508f4aa12" FOREIGN KEY ("defaultAssigneeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt", "icon", "status", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt", "icon", "status", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId" FROM "organization_project"`
		);
		await queryRunner.query(`DROP TABLE "organization_project"`);
		await queryRunner.query(`ALTER TABLE "temporary_organization_project" RENAME TO "organization_project"`);
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
		await queryRunner.query(`CREATE INDEX "IDX_a414a803f8de400b689c9a926a" ON "organization_project" ("icon") `);
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6e002ae2ed0e1b0c9a52d8acf" ON "organization_project" ("archiveTasksIn") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f44648e75dbfafe2a807bd25df" ON "organization_project" ("closeTasksIn") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(`DROP INDEX "IDX_f44648e75dbfafe2a807bd25df"`);
		await queryRunner.query(`DROP INDEX "IDX_d6e002ae2ed0e1b0c9a52d8acf"`);
		await queryRunner.query(`DROP INDEX "IDX_16c34de330ae8d59d9b31cce14"`);
		await queryRunner.query(`DROP INDEX "IDX_a414a803f8de400b689c9a926a"`);
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
		await queryRunner.query(`ALTER TABLE "organization_project" RENAME TO "temporary_organization_project"`);
		await queryRunner.query(
			`CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, "deletedAt" datetime, "fix_relational_custom_fields" boolean, "archivedAt" datetime, "icon" varchar, "status" varchar, "archiveTasksIn" decimal, "closeTasksIn" decimal, "defaultAssigneeId" varchar, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt", "icon", "status", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt", "icon", "status", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId" FROM "temporary_organization_project"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f44648e75dbfafe2a807bd25df" ON "organization_project" ("closeTasksIn") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6e002ae2ed0e1b0c9a52d8acf" ON "organization_project" ("archiveTasksIn") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_a414a803f8de400b689c9a926a" ON "organization_project" ("icon") `);
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
		await queryRunner.query(`DROP INDEX "IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(`DROP INDEX "IDX_f44648e75dbfafe2a807bd25df"`);
		await queryRunner.query(`DROP INDEX "IDX_d6e002ae2ed0e1b0c9a52d8acf"`);
		await queryRunner.query(`DROP INDEX "IDX_16c34de330ae8d59d9b31cce14"`);
		await queryRunner.query(`DROP INDEX "IDX_a414a803f8de400b689c9a926a"`);
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
		await queryRunner.query(`ALTER TABLE "organization_project" RENAME TO "temporary_organization_project"`);
		await queryRunner.query(
			`CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, "deletedAt" datetime, "fix_relational_custom_fields" boolean, "archivedAt" datetime, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt" FROM "temporary_organization_project"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project"`);
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
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`organization_project\` ADD \`icon\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project\` ADD \`status\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project\` ADD \`archiveTasksIn\` decimal NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project\` ADD \`closeTasksIn\` decimal NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project\` ADD \`defaultAssigneeId\` varchar(255) NULL`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_a414a803f8de400b689c9a926a\` ON \`organization_project\` (\`icon\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_16c34de330ae8d59d9b31cce14\` ON \`organization_project\` (\`status\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_d6e002ae2ed0e1b0c9a52d8acf\` ON \`organization_project\` (\`archiveTasksIn\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_f44648e75dbfafe2a807bd25df\` ON \`organization_project\` (\`closeTasksIn\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_489012234f53089d4b508f4aa1\` ON \`organization_project\` (\`defaultAssigneeId\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` ADD CONSTRAINT \`FK_489012234f53089d4b508f4aa12\` FOREIGN KEY (\`defaultAssigneeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` DROP FOREIGN KEY \`FK_489012234f53089d4b508f4aa12\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_489012234f53089d4b508f4aa1\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_f44648e75dbfafe2a807bd25df\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_d6e002ae2ed0e1b0c9a52d8acf\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_16c34de330ae8d59d9b31cce14\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_a414a803f8de400b689c9a926a\` ON \`organization_project\``);
		await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`defaultAssigneeId\``);
		await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`closeTasksIn\``);
		await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`archiveTasksIn\``);
		await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`status\``);
		await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`icon\``);
	}
}
