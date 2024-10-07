import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class MigrateOrganizationSprintsRelatedEntities1728301971790 implements MigrationInterface {
	name = 'MigrateOrganizationSprintsRelatedEntities1728301971790';

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
			`CREATE TABLE "organization_sprint_employee" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "isManager" boolean DEFAULT false, "assignedAt" TIMESTAMP, "organizationSprintId" uuid NOT NULL, "employeeId" uuid NOT NULL, "roleId" uuid, CONSTRAINT "PK_b31f2517142a7bf8b5c863a5f72" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fa0d179e320c8680cc32a41d70" ON "organization_sprint_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_62b4c285d16b0759ae29791dd5" ON "organization_sprint_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_30d8b0ec5e73c133f3e3d9afef" ON "organization_sprint_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2e74f97c99716d6a0a892ec6de" ON "organization_sprint_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_953b6df10eaabf11f5762bbee0" ON "organization_sprint_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fbcc76b45f43996c20936f229c" ON "organization_sprint_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68ea808c69795593450737c992" ON "organization_sprint_employee" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e5ec88b5022e0d71ac88d876de" ON "organization_sprint_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f516713776cfc5662cdbf2f3c4" ON "organization_sprint_employee" ("roleId") `
		);
		await queryRunner.query(
			`CREATE TABLE "organization_sprint_task" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "totalWorkedHours" integer, "organizationSprintId" uuid NOT NULL, "taskId" uuid NOT NULL, CONSTRAINT "PK_7baee3cc404e521605aaf5a74d2" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ceba05d5de64b36d361af6a34" ON "organization_sprint_task" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b0a8b958a5716e73467c1937ec" ON "organization_sprint_task" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_be3cb56b953b535835ad868391" ON "organization_sprint_task" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6a84b0cec9f10178a027f20098" ON "organization_sprint_task" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_434665081d927127495623ad27" ON "organization_sprint_task" ("totalWorkedHours") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_889c9fd5c577a89f5f30facde4" ON "organization_sprint_task" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e50cfbf82eec3f0b1d004a5c6e" ON "organization_sprint_task" ("taskId") `
		);
		await queryRunner.query(
			`CREATE TABLE "organization_sprint_task_history" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "reason" text, "taskId" uuid NOT NULL, "fromSprintId" uuid NOT NULL, "toSprintId" uuid NOT NULL, "movedById" uuid, CONSTRAINT "PK_372b66962438094dc3c6ab926b5" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_92db6225d2efc127ded3bdb5f1" ON "organization_sprint_task_history" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8cde33e0a580277a2c1ed36a6b" ON "organization_sprint_task_history" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d5203d63179a7baf703e29a628" ON "organization_sprint_task_history" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f686ac0104c90e95ef10f6c22" ON "organization_sprint_task_history" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ca809b0756488e63bc88918950" ON "organization_sprint_task_history" ("reason") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3030e5dca58343e09ae1af0108" ON "organization_sprint_task_history" ("taskId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_555c5952e67b2e93d4c7067f72" ON "organization_sprint_task_history" ("fromSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_da46a676d25c64bb06fc4536b3" ON "organization_sprint_task_history" ("toSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7723913546575c33ab09ecfd50" ON "organization_sprint_task_history" ("movedById") `
		);
		await queryRunner.query(`ALTER TABLE "organization_sprint" ADD "status" character varying`);
		await queryRunner.query(`ALTER TABLE "organization_sprint" ADD "sprintProgress" jsonb`);
		await queryRunner.query(`CREATE INDEX "IDX_1cbe898fb849e4cffbddb60a87" ON "organization_sprint" ("status") `);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" ADD CONSTRAINT "FK_30d8b0ec5e73c133f3e3d9afef1" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" ADD CONSTRAINT "FK_2e74f97c99716d6a0a892ec6de7" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" ADD CONSTRAINT "FK_68ea808c69795593450737c9923" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" ADD CONSTRAINT "FK_e5ec88b5022e0d71ac88d876de2" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" ADD CONSTRAINT "FK_f516713776cfc5662cdbf2f3c4b" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" ADD CONSTRAINT "FK_be3cb56b953b535835ad8683916" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" ADD CONSTRAINT "FK_6a84b0cec9f10178a027f200981" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" ADD CONSTRAINT "FK_889c9fd5c577a89f5f30facde42" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" ADD CONSTRAINT "FK_e50cfbf82eec3f0b1d004a5c6e8" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" ADD CONSTRAINT "FK_d5203d63179a7baf703e29a628c" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" ADD CONSTRAINT "FK_8f686ac0104c90e95ef10f6c229" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" ADD CONSTRAINT "FK_3030e5dca58343e09ae1af01082" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" ADD CONSTRAINT "FK_555c5952e67b2e93d4c7067f72d" FOREIGN KEY ("fromSprintId") REFERENCES "organization_sprint"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" ADD CONSTRAINT "FK_da46a676d25c64bb06fc4536b34" FOREIGN KEY ("toSprintId") REFERENCES "organization_sprint"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" ADD CONSTRAINT "FK_7723913546575c33ab09ecfd508" FOREIGN KEY ("movedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" DROP CONSTRAINT "FK_7723913546575c33ab09ecfd508"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" DROP CONSTRAINT "FK_da46a676d25c64bb06fc4536b34"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" DROP CONSTRAINT "FK_555c5952e67b2e93d4c7067f72d"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" DROP CONSTRAINT "FK_3030e5dca58343e09ae1af01082"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" DROP CONSTRAINT "FK_8f686ac0104c90e95ef10f6c229"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" DROP CONSTRAINT "FK_d5203d63179a7baf703e29a628c"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" DROP CONSTRAINT "FK_e50cfbf82eec3f0b1d004a5c6e8"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" DROP CONSTRAINT "FK_889c9fd5c577a89f5f30facde42"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" DROP CONSTRAINT "FK_6a84b0cec9f10178a027f200981"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" DROP CONSTRAINT "FK_be3cb56b953b535835ad8683916"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" DROP CONSTRAINT "FK_f516713776cfc5662cdbf2f3c4b"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" DROP CONSTRAINT "FK_e5ec88b5022e0d71ac88d876de2"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" DROP CONSTRAINT "FK_68ea808c69795593450737c9923"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" DROP CONSTRAINT "FK_2e74f97c99716d6a0a892ec6de7"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" DROP CONSTRAINT "FK_30d8b0ec5e73c133f3e3d9afef1"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_1cbe898fb849e4cffbddb60a87"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint" DROP COLUMN "sprintProgress"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint" DROP COLUMN "status"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7723913546575c33ab09ecfd50"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_da46a676d25c64bb06fc4536b3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_555c5952e67b2e93d4c7067f72"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3030e5dca58343e09ae1af0108"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ca809b0756488e63bc88918950"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8f686ac0104c90e95ef10f6c22"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d5203d63179a7baf703e29a628"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8cde33e0a580277a2c1ed36a6b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_92db6225d2efc127ded3bdb5f1"`);
		await queryRunner.query(`DROP TABLE "organization_sprint_task_history"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e50cfbf82eec3f0b1d004a5c6e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_889c9fd5c577a89f5f30facde4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_434665081d927127495623ad27"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6a84b0cec9f10178a027f20098"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_be3cb56b953b535835ad868391"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b0a8b958a5716e73467c1937ec"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2ceba05d5de64b36d361af6a34"`);
		await queryRunner.query(`DROP TABLE "organization_sprint_task"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f516713776cfc5662cdbf2f3c4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e5ec88b5022e0d71ac88d876de"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_68ea808c69795593450737c992"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fbcc76b45f43996c20936f229c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_953b6df10eaabf11f5762bbee0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2e74f97c99716d6a0a892ec6de"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_30d8b0ec5e73c133f3e3d9afef"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_62b4c285d16b0759ae29791dd5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fa0d179e320c8680cc32a41d70"`);
		await queryRunner.query(`DROP TABLE "organization_sprint_employee"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "organization_sprint_employee" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "organizationSprintId" varchar NOT NULL, "employeeId" varchar NOT NULL, "roleId" varchar)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fa0d179e320c8680cc32a41d70" ON "organization_sprint_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_62b4c285d16b0759ae29791dd5" ON "organization_sprint_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_30d8b0ec5e73c133f3e3d9afef" ON "organization_sprint_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2e74f97c99716d6a0a892ec6de" ON "organization_sprint_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_953b6df10eaabf11f5762bbee0" ON "organization_sprint_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fbcc76b45f43996c20936f229c" ON "organization_sprint_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68ea808c69795593450737c992" ON "organization_sprint_employee" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e5ec88b5022e0d71ac88d876de" ON "organization_sprint_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f516713776cfc5662cdbf2f3c4" ON "organization_sprint_employee" ("roleId") `
		);
		await queryRunner.query(
			`CREATE TABLE "organization_sprint_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "totalWorkedHours" integer, "organizationSprintId" varchar NOT NULL, "taskId" varchar NOT NULL)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ceba05d5de64b36d361af6a34" ON "organization_sprint_task" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b0a8b958a5716e73467c1937ec" ON "organization_sprint_task" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_be3cb56b953b535835ad868391" ON "organization_sprint_task" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6a84b0cec9f10178a027f20098" ON "organization_sprint_task" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_434665081d927127495623ad27" ON "organization_sprint_task" ("totalWorkedHours") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_889c9fd5c577a89f5f30facde4" ON "organization_sprint_task" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e50cfbf82eec3f0b1d004a5c6e" ON "organization_sprint_task" ("taskId") `
		);
		await queryRunner.query(
			`CREATE TABLE "organization_sprint_task_history" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "reason" text, "taskId" varchar NOT NULL, "fromSprintId" varchar NOT NULL, "toSprintId" varchar NOT NULL, "movedById" varchar)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_92db6225d2efc127ded3bdb5f1" ON "organization_sprint_task_history" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8cde33e0a580277a2c1ed36a6b" ON "organization_sprint_task_history" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d5203d63179a7baf703e29a628" ON "organization_sprint_task_history" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f686ac0104c90e95ef10f6c22" ON "organization_sprint_task_history" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ca809b0756488e63bc88918950" ON "organization_sprint_task_history" ("reason") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3030e5dca58343e09ae1af0108" ON "organization_sprint_task_history" ("taskId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_555c5952e67b2e93d4c7067f72" ON "organization_sprint_task_history" ("fromSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_da46a676d25c64bb06fc4536b3" ON "organization_sprint_task_history" ("toSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7723913546575c33ab09ecfd50" ON "organization_sprint_task_history" ("movedById") `
		);
		await queryRunner.query(`DROP INDEX "IDX_76e53f9609ca05477d50980743"`);
		await queryRunner.query(`DROP INDEX "IDX_5596b4fa7fb2ceb0955580becd"`);
		await queryRunner.query(`DROP INDEX "IDX_f57ad03c4e471bd8530494ea63"`);
		await queryRunner.query(`DROP INDEX "IDX_8a1fe8afb3aa672bae5993fbe7"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_sprint" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "projectId" varchar NOT NULL, "goal" varchar, "length" integer NOT NULL DEFAULT (7), "startDate" datetime, "endDate" datetime, "dayStart" integer, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "status" varchar, "sprintProgress" text, CONSTRAINT "FK_f57ad03c4e471bd8530494ea63d" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8a1fe8afb3aa672bae5993fbe7d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a140b7e30ff3455551a0fd599fb" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_sprint"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "projectId", "goal", "length", "startDate", "endDate", "dayStart", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "projectId", "goal", "length", "startDate", "endDate", "dayStart", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "organization_sprint"`
		);
		await queryRunner.query(`DROP TABLE "organization_sprint"`);
		await queryRunner.query(`ALTER TABLE "temporary_organization_sprint" RENAME TO "organization_sprint"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_76e53f9609ca05477d50980743" ON "organization_sprint" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5596b4fa7fb2ceb0955580becd" ON "organization_sprint" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_f57ad03c4e471bd8530494ea63" ON "organization_sprint" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a1fe8afb3aa672bae5993fbe7" ON "organization_sprint" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_1cbe898fb849e4cffbddb60a87" ON "organization_sprint" ("status") `);
		await queryRunner.query(`DROP INDEX "IDX_fa0d179e320c8680cc32a41d70"`);
		await queryRunner.query(`DROP INDEX "IDX_62b4c285d16b0759ae29791dd5"`);
		await queryRunner.query(`DROP INDEX "IDX_30d8b0ec5e73c133f3e3d9afef"`);
		await queryRunner.query(`DROP INDEX "IDX_2e74f97c99716d6a0a892ec6de"`);
		await queryRunner.query(`DROP INDEX "IDX_953b6df10eaabf11f5762bbee0"`);
		await queryRunner.query(`DROP INDEX "IDX_fbcc76b45f43996c20936f229c"`);
		await queryRunner.query(`DROP INDEX "IDX_68ea808c69795593450737c992"`);
		await queryRunner.query(`DROP INDEX "IDX_e5ec88b5022e0d71ac88d876de"`);
		await queryRunner.query(`DROP INDEX "IDX_f516713776cfc5662cdbf2f3c4"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_sprint_employee" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "organizationSprintId" varchar NOT NULL, "employeeId" varchar NOT NULL, "roleId" varchar, CONSTRAINT "FK_30d8b0ec5e73c133f3e3d9afef1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2e74f97c99716d6a0a892ec6de7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_68ea808c69795593450737c9923" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e5ec88b5022e0d71ac88d876de2" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f516713776cfc5662cdbf2f3c4b" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_sprint_employee"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "organizationSprintId", "employeeId", "roleId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "organizationSprintId", "employeeId", "roleId" FROM "organization_sprint_employee"`
		);
		await queryRunner.query(`DROP TABLE "organization_sprint_employee"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_sprint_employee" RENAME TO "organization_sprint_employee"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fa0d179e320c8680cc32a41d70" ON "organization_sprint_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_62b4c285d16b0759ae29791dd5" ON "organization_sprint_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_30d8b0ec5e73c133f3e3d9afef" ON "organization_sprint_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2e74f97c99716d6a0a892ec6de" ON "organization_sprint_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_953b6df10eaabf11f5762bbee0" ON "organization_sprint_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fbcc76b45f43996c20936f229c" ON "organization_sprint_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68ea808c69795593450737c992" ON "organization_sprint_employee" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e5ec88b5022e0d71ac88d876de" ON "organization_sprint_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f516713776cfc5662cdbf2f3c4" ON "organization_sprint_employee" ("roleId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_2ceba05d5de64b36d361af6a34"`);
		await queryRunner.query(`DROP INDEX "IDX_b0a8b958a5716e73467c1937ec"`);
		await queryRunner.query(`DROP INDEX "IDX_be3cb56b953b535835ad868391"`);
		await queryRunner.query(`DROP INDEX "IDX_6a84b0cec9f10178a027f20098"`);
		await queryRunner.query(`DROP INDEX "IDX_434665081d927127495623ad27"`);
		await queryRunner.query(`DROP INDEX "IDX_889c9fd5c577a89f5f30facde4"`);
		await queryRunner.query(`DROP INDEX "IDX_e50cfbf82eec3f0b1d004a5c6e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_sprint_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "totalWorkedHours" integer, "organizationSprintId" varchar NOT NULL, "taskId" varchar NOT NULL, CONSTRAINT "FK_be3cb56b953b535835ad8683916" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6a84b0cec9f10178a027f200981" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_889c9fd5c577a89f5f30facde42" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e50cfbf82eec3f0b1d004a5c6e8" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_sprint_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "totalWorkedHours", "organizationSprintId", "taskId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "totalWorkedHours", "organizationSprintId", "taskId" FROM "organization_sprint_task"`
		);
		await queryRunner.query(`DROP TABLE "organization_sprint_task"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_sprint_task" RENAME TO "organization_sprint_task"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ceba05d5de64b36d361af6a34" ON "organization_sprint_task" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b0a8b958a5716e73467c1937ec" ON "organization_sprint_task" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_be3cb56b953b535835ad868391" ON "organization_sprint_task" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6a84b0cec9f10178a027f20098" ON "organization_sprint_task" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_434665081d927127495623ad27" ON "organization_sprint_task" ("totalWorkedHours") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_889c9fd5c577a89f5f30facde4" ON "organization_sprint_task" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e50cfbf82eec3f0b1d004a5c6e" ON "organization_sprint_task" ("taskId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_92db6225d2efc127ded3bdb5f1"`);
		await queryRunner.query(`DROP INDEX "IDX_8cde33e0a580277a2c1ed36a6b"`);
		await queryRunner.query(`DROP INDEX "IDX_d5203d63179a7baf703e29a628"`);
		await queryRunner.query(`DROP INDEX "IDX_8f686ac0104c90e95ef10f6c22"`);
		await queryRunner.query(`DROP INDEX "IDX_ca809b0756488e63bc88918950"`);
		await queryRunner.query(`DROP INDEX "IDX_3030e5dca58343e09ae1af0108"`);
		await queryRunner.query(`DROP INDEX "IDX_555c5952e67b2e93d4c7067f72"`);
		await queryRunner.query(`DROP INDEX "IDX_da46a676d25c64bb06fc4536b3"`);
		await queryRunner.query(`DROP INDEX "IDX_7723913546575c33ab09ecfd50"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_sprint_task_history" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "reason" text, "taskId" varchar NOT NULL, "fromSprintId" varchar NOT NULL, "toSprintId" varchar NOT NULL, "movedById" varchar, CONSTRAINT "FK_d5203d63179a7baf703e29a628c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8f686ac0104c90e95ef10f6c229" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3030e5dca58343e09ae1af01082" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_555c5952e67b2e93d4c7067f72d" FOREIGN KEY ("fromSprintId") REFERENCES "organization_sprint" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_da46a676d25c64bb06fc4536b34" FOREIGN KEY ("toSprintId") REFERENCES "organization_sprint" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7723913546575c33ab09ecfd508" FOREIGN KEY ("movedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_sprint_task_history"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "reason", "taskId", "fromSprintId", "toSprintId", "movedById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "reason", "taskId", "fromSprintId", "toSprintId", "movedById" FROM "organization_sprint_task_history"`
		);
		await queryRunner.query(`DROP TABLE "organization_sprint_task_history"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_sprint_task_history" RENAME TO "organization_sprint_task_history"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_92db6225d2efc127ded3bdb5f1" ON "organization_sprint_task_history" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8cde33e0a580277a2c1ed36a6b" ON "organization_sprint_task_history" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d5203d63179a7baf703e29a628" ON "organization_sprint_task_history" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f686ac0104c90e95ef10f6c22" ON "organization_sprint_task_history" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ca809b0756488e63bc88918950" ON "organization_sprint_task_history" ("reason") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3030e5dca58343e09ae1af0108" ON "organization_sprint_task_history" ("taskId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_555c5952e67b2e93d4c7067f72" ON "organization_sprint_task_history" ("fromSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_da46a676d25c64bb06fc4536b3" ON "organization_sprint_task_history" ("toSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7723913546575c33ab09ecfd50" ON "organization_sprint_task_history" ("movedById") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_7723913546575c33ab09ecfd50"`);
		await queryRunner.query(`DROP INDEX "IDX_da46a676d25c64bb06fc4536b3"`);
		await queryRunner.query(`DROP INDEX "IDX_555c5952e67b2e93d4c7067f72"`);
		await queryRunner.query(`DROP INDEX "IDX_3030e5dca58343e09ae1af0108"`);
		await queryRunner.query(`DROP INDEX "IDX_ca809b0756488e63bc88918950"`);
		await queryRunner.query(`DROP INDEX "IDX_8f686ac0104c90e95ef10f6c22"`);
		await queryRunner.query(`DROP INDEX "IDX_d5203d63179a7baf703e29a628"`);
		await queryRunner.query(`DROP INDEX "IDX_8cde33e0a580277a2c1ed36a6b"`);
		await queryRunner.query(`DROP INDEX "IDX_92db6225d2efc127ded3bdb5f1"`);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" RENAME TO "temporary_organization_sprint_task_history"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_sprint_task_history" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "reason" text, "taskId" varchar NOT NULL, "fromSprintId" varchar NOT NULL, "toSprintId" varchar NOT NULL, "movedById" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_sprint_task_history"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "reason", "taskId", "fromSprintId", "toSprintId", "movedById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "reason", "taskId", "fromSprintId", "toSprintId", "movedById" FROM "temporary_organization_sprint_task_history"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_sprint_task_history"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7723913546575c33ab09ecfd50" ON "organization_sprint_task_history" ("movedById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_da46a676d25c64bb06fc4536b3" ON "organization_sprint_task_history" ("toSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_555c5952e67b2e93d4c7067f72" ON "organization_sprint_task_history" ("fromSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3030e5dca58343e09ae1af0108" ON "organization_sprint_task_history" ("taskId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ca809b0756488e63bc88918950" ON "organization_sprint_task_history" ("reason") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f686ac0104c90e95ef10f6c22" ON "organization_sprint_task_history" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d5203d63179a7baf703e29a628" ON "organization_sprint_task_history" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8cde33e0a580277a2c1ed36a6b" ON "organization_sprint_task_history" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_92db6225d2efc127ded3bdb5f1" ON "organization_sprint_task_history" ("isActive") `
		);
		await queryRunner.query(`DROP INDEX "IDX_e50cfbf82eec3f0b1d004a5c6e"`);
		await queryRunner.query(`DROP INDEX "IDX_889c9fd5c577a89f5f30facde4"`);
		await queryRunner.query(`DROP INDEX "IDX_434665081d927127495623ad27"`);
		await queryRunner.query(`DROP INDEX "IDX_6a84b0cec9f10178a027f20098"`);
		await queryRunner.query(`DROP INDEX "IDX_be3cb56b953b535835ad868391"`);
		await queryRunner.query(`DROP INDEX "IDX_b0a8b958a5716e73467c1937ec"`);
		await queryRunner.query(`DROP INDEX "IDX_2ceba05d5de64b36d361af6a34"`);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" RENAME TO "temporary_organization_sprint_task"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_sprint_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "totalWorkedHours" integer, "organizationSprintId" varchar NOT NULL, "taskId" varchar NOT NULL)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_sprint_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "totalWorkedHours", "organizationSprintId", "taskId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "totalWorkedHours", "organizationSprintId", "taskId" FROM "temporary_organization_sprint_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_sprint_task"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_e50cfbf82eec3f0b1d004a5c6e" ON "organization_sprint_task" ("taskId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_889c9fd5c577a89f5f30facde4" ON "organization_sprint_task" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_434665081d927127495623ad27" ON "organization_sprint_task" ("totalWorkedHours") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6a84b0cec9f10178a027f20098" ON "organization_sprint_task" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_be3cb56b953b535835ad868391" ON "organization_sprint_task" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b0a8b958a5716e73467c1937ec" ON "organization_sprint_task" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ceba05d5de64b36d361af6a34" ON "organization_sprint_task" ("isActive") `
		);
		await queryRunner.query(`DROP INDEX "IDX_f516713776cfc5662cdbf2f3c4"`);
		await queryRunner.query(`DROP INDEX "IDX_e5ec88b5022e0d71ac88d876de"`);
		await queryRunner.query(`DROP INDEX "IDX_68ea808c69795593450737c992"`);
		await queryRunner.query(`DROP INDEX "IDX_fbcc76b45f43996c20936f229c"`);
		await queryRunner.query(`DROP INDEX "IDX_953b6df10eaabf11f5762bbee0"`);
		await queryRunner.query(`DROP INDEX "IDX_2e74f97c99716d6a0a892ec6de"`);
		await queryRunner.query(`DROP INDEX "IDX_30d8b0ec5e73c133f3e3d9afef"`);
		await queryRunner.query(`DROP INDEX "IDX_62b4c285d16b0759ae29791dd5"`);
		await queryRunner.query(`DROP INDEX "IDX_fa0d179e320c8680cc32a41d70"`);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" RENAME TO "temporary_organization_sprint_employee"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_sprint_employee" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "organizationSprintId" varchar NOT NULL, "employeeId" varchar NOT NULL, "roleId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_sprint_employee"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "organizationSprintId", "employeeId", "roleId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "organizationSprintId", "employeeId", "roleId" FROM "temporary_organization_sprint_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_sprint_employee"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_f516713776cfc5662cdbf2f3c4" ON "organization_sprint_employee" ("roleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e5ec88b5022e0d71ac88d876de" ON "organization_sprint_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68ea808c69795593450737c992" ON "organization_sprint_employee" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fbcc76b45f43996c20936f229c" ON "organization_sprint_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_953b6df10eaabf11f5762bbee0" ON "organization_sprint_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2e74f97c99716d6a0a892ec6de" ON "organization_sprint_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_30d8b0ec5e73c133f3e3d9afef" ON "organization_sprint_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_62b4c285d16b0759ae29791dd5" ON "organization_sprint_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fa0d179e320c8680cc32a41d70" ON "organization_sprint_employee" ("isActive") `
		);
		await queryRunner.query(`DROP INDEX "IDX_1cbe898fb849e4cffbddb60a87"`);
		await queryRunner.query(`DROP INDEX "IDX_8a1fe8afb3aa672bae5993fbe7"`);
		await queryRunner.query(`DROP INDEX "IDX_f57ad03c4e471bd8530494ea63"`);
		await queryRunner.query(`DROP INDEX "IDX_5596b4fa7fb2ceb0955580becd"`);
		await queryRunner.query(`DROP INDEX "IDX_76e53f9609ca05477d50980743"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint" RENAME TO "temporary_organization_sprint"`);
		await queryRunner.query(
			`CREATE TABLE "organization_sprint" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "projectId" varchar NOT NULL, "goal" varchar, "length" integer NOT NULL DEFAULT (7), "startDate" datetime, "endDate" datetime, "dayStart" integer, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_f57ad03c4e471bd8530494ea63d" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8a1fe8afb3aa672bae5993fbe7d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a140b7e30ff3455551a0fd599fb" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_sprint"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "projectId", "goal", "length", "startDate", "endDate", "dayStart", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "projectId", "goal", "length", "startDate", "endDate", "dayStart", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "temporary_organization_sprint"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_sprint"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a1fe8afb3aa672bae5993fbe7" ON "organization_sprint" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f57ad03c4e471bd8530494ea63" ON "organization_sprint" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_5596b4fa7fb2ceb0955580becd" ON "organization_sprint" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_76e53f9609ca05477d50980743" ON "organization_sprint" ("isArchived") `
		);
		await queryRunner.query(`DROP INDEX "IDX_7723913546575c33ab09ecfd50"`);
		await queryRunner.query(`DROP INDEX "IDX_da46a676d25c64bb06fc4536b3"`);
		await queryRunner.query(`DROP INDEX "IDX_555c5952e67b2e93d4c7067f72"`);
		await queryRunner.query(`DROP INDEX "IDX_3030e5dca58343e09ae1af0108"`);
		await queryRunner.query(`DROP INDEX "IDX_ca809b0756488e63bc88918950"`);
		await queryRunner.query(`DROP INDEX "IDX_8f686ac0104c90e95ef10f6c22"`);
		await queryRunner.query(`DROP INDEX "IDX_d5203d63179a7baf703e29a628"`);
		await queryRunner.query(`DROP INDEX "IDX_8cde33e0a580277a2c1ed36a6b"`);
		await queryRunner.query(`DROP INDEX "IDX_92db6225d2efc127ded3bdb5f1"`);
		await queryRunner.query(`DROP TABLE "organization_sprint_task_history"`);
		await queryRunner.query(`DROP INDEX "IDX_e50cfbf82eec3f0b1d004a5c6e"`);
		await queryRunner.query(`DROP INDEX "IDX_889c9fd5c577a89f5f30facde4"`);
		await queryRunner.query(`DROP INDEX "IDX_434665081d927127495623ad27"`);
		await queryRunner.query(`DROP INDEX "IDX_6a84b0cec9f10178a027f20098"`);
		await queryRunner.query(`DROP INDEX "IDX_be3cb56b953b535835ad868391"`);
		await queryRunner.query(`DROP INDEX "IDX_b0a8b958a5716e73467c1937ec"`);
		await queryRunner.query(`DROP INDEX "IDX_2ceba05d5de64b36d361af6a34"`);
		await queryRunner.query(`DROP TABLE "organization_sprint_task"`);
		await queryRunner.query(`DROP INDEX "IDX_f516713776cfc5662cdbf2f3c4"`);
		await queryRunner.query(`DROP INDEX "IDX_e5ec88b5022e0d71ac88d876de"`);
		await queryRunner.query(`DROP INDEX "IDX_68ea808c69795593450737c992"`);
		await queryRunner.query(`DROP INDEX "IDX_fbcc76b45f43996c20936f229c"`);
		await queryRunner.query(`DROP INDEX "IDX_953b6df10eaabf11f5762bbee0"`);
		await queryRunner.query(`DROP INDEX "IDX_2e74f97c99716d6a0a892ec6de"`);
		await queryRunner.query(`DROP INDEX "IDX_30d8b0ec5e73c133f3e3d9afef"`);
		await queryRunner.query(`DROP INDEX "IDX_62b4c285d16b0759ae29791dd5"`);
		await queryRunner.query(`DROP INDEX "IDX_fa0d179e320c8680cc32a41d70"`);
		await queryRunner.query(`DROP TABLE "organization_sprint_employee"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`organization_sprint_employee\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`isManager\` tinyint NULL DEFAULT 0, \`assignedAt\` datetime NULL, \`organizationSprintId\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NOT NULL, \`roleId\` varchar(255) NULL, INDEX \`IDX_fa0d179e320c8680cc32a41d70\` (\`isActive\`), INDEX \`IDX_62b4c285d16b0759ae29791dd5\` (\`isArchived\`), INDEX \`IDX_30d8b0ec5e73c133f3e3d9afef\` (\`tenantId\`), INDEX \`IDX_2e74f97c99716d6a0a892ec6de\` (\`organizationId\`), INDEX \`IDX_953b6df10eaabf11f5762bbee0\` (\`isManager\`), INDEX \`IDX_fbcc76b45f43996c20936f229c\` (\`assignedAt\`), INDEX \`IDX_68ea808c69795593450737c992\` (\`organizationSprintId\`), INDEX \`IDX_e5ec88b5022e0d71ac88d876de\` (\`employeeId\`), INDEX \`IDX_f516713776cfc5662cdbf2f3c4\` (\`roleId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_sprint_task\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`totalWorkedHours\` int NULL, \`organizationSprintId\` varchar(255) NOT NULL, \`taskId\` varchar(255) NOT NULL, INDEX \`IDX_2ceba05d5de64b36d361af6a34\` (\`isActive\`), INDEX \`IDX_b0a8b958a5716e73467c1937ec\` (\`isArchived\`), INDEX \`IDX_be3cb56b953b535835ad868391\` (\`tenantId\`), INDEX \`IDX_6a84b0cec9f10178a027f20098\` (\`organizationId\`), INDEX \`IDX_434665081d927127495623ad27\` (\`totalWorkedHours\`), INDEX \`IDX_889c9fd5c577a89f5f30facde4\` (\`organizationSprintId\`), INDEX \`IDX_e50cfbf82eec3f0b1d004a5c6e\` (\`taskId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_sprint_task_history\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`reason\` text NULL, \`taskId\` varchar(255) NOT NULL, \`fromSprintId\` varchar(255) NOT NULL, \`toSprintId\` varchar(255) NOT NULL, \`movedById\` varchar(255) NULL, INDEX \`IDX_92db6225d2efc127ded3bdb5f1\` (\`isActive\`), INDEX \`IDX_8cde33e0a580277a2c1ed36a6b\` (\`isArchived\`), INDEX \`IDX_d5203d63179a7baf703e29a628\` (\`tenantId\`), INDEX \`IDX_8f686ac0104c90e95ef10f6c22\` (\`organizationId\`), INDEX \`IDX_ca809b0756488e63bc88918950\` (\`reason\`), INDEX \`IDX_3030e5dca58343e09ae1af0108\` (\`taskId\`), INDEX \`IDX_555c5952e67b2e93d4c7067f72\` (\`fromSprintId\`), INDEX \`IDX_da46a676d25c64bb06fc4536b3\` (\`toSprintId\`), INDEX \`IDX_7723913546575c33ab09ecfd50\` (\`movedById\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(`ALTER TABLE \`organization_sprint\` ADD \`status\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_sprint\` ADD \`sprintProgress\` json NULL`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_1cbe898fb849e4cffbddb60a87\` ON \`organization_sprint\` (\`status\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_employee\` ADD CONSTRAINT \`FK_30d8b0ec5e73c133f3e3d9afef1\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_employee\` ADD CONSTRAINT \`FK_2e74f97c99716d6a0a892ec6de7\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_employee\` ADD CONSTRAINT \`FK_68ea808c69795593450737c9923\` FOREIGN KEY (\`organizationSprintId\`) REFERENCES \`organization_sprint\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_employee\` ADD CONSTRAINT \`FK_e5ec88b5022e0d71ac88d876de2\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_employee\` ADD CONSTRAINT \`FK_f516713776cfc5662cdbf2f3c4b\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task\` ADD CONSTRAINT \`FK_be3cb56b953b535835ad8683916\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task\` ADD CONSTRAINT \`FK_6a84b0cec9f10178a027f200981\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task\` ADD CONSTRAINT \`FK_889c9fd5c577a89f5f30facde42\` FOREIGN KEY (\`organizationSprintId\`) REFERENCES \`organization_sprint\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task\` ADD CONSTRAINT \`FK_e50cfbf82eec3f0b1d004a5c6e8\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` ADD CONSTRAINT \`FK_d5203d63179a7baf703e29a628c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` ADD CONSTRAINT \`FK_8f686ac0104c90e95ef10f6c229\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` ADD CONSTRAINT \`FK_3030e5dca58343e09ae1af01082\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` ADD CONSTRAINT \`FK_555c5952e67b2e93d4c7067f72d\` FOREIGN KEY (\`fromSprintId\`) REFERENCES \`organization_sprint\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` ADD CONSTRAINT \`FK_da46a676d25c64bb06fc4536b34\` FOREIGN KEY (\`toSprintId\`) REFERENCES \`organization_sprint\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` ADD CONSTRAINT \`FK_7723913546575c33ab09ecfd508\` FOREIGN KEY (\`movedById\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` DROP FOREIGN KEY \`FK_7723913546575c33ab09ecfd508\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` DROP FOREIGN KEY \`FK_da46a676d25c64bb06fc4536b34\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` DROP FOREIGN KEY \`FK_555c5952e67b2e93d4c7067f72d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` DROP FOREIGN KEY \`FK_3030e5dca58343e09ae1af01082\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` DROP FOREIGN KEY \`FK_8f686ac0104c90e95ef10f6c229\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task_history\` DROP FOREIGN KEY \`FK_d5203d63179a7baf703e29a628c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task\` DROP FOREIGN KEY \`FK_e50cfbf82eec3f0b1d004a5c6e8\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task\` DROP FOREIGN KEY \`FK_889c9fd5c577a89f5f30facde42\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task\` DROP FOREIGN KEY \`FK_6a84b0cec9f10178a027f200981\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_task\` DROP FOREIGN KEY \`FK_be3cb56b953b535835ad8683916\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_employee\` DROP FOREIGN KEY \`FK_f516713776cfc5662cdbf2f3c4b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_employee\` DROP FOREIGN KEY \`FK_e5ec88b5022e0d71ac88d876de2\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_employee\` DROP FOREIGN KEY \`FK_68ea808c69795593450737c9923\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_employee\` DROP FOREIGN KEY \`FK_2e74f97c99716d6a0a892ec6de7\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint_employee\` DROP FOREIGN KEY \`FK_30d8b0ec5e73c133f3e3d9afef1\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_1cbe898fb849e4cffbddb60a87\` ON \`organization_sprint\``);
		await queryRunner.query(`ALTER TABLE \`organization_sprint\` DROP COLUMN \`sprintProgress\``);
		await queryRunner.query(`ALTER TABLE \`organization_sprint\` DROP COLUMN \`status\``);
		await queryRunner.query(
			`DROP INDEX \`IDX_7723913546575c33ab09ecfd50\` ON \`organization_sprint_task_history\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_da46a676d25c64bb06fc4536b3\` ON \`organization_sprint_task_history\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_555c5952e67b2e93d4c7067f72\` ON \`organization_sprint_task_history\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_3030e5dca58343e09ae1af0108\` ON \`organization_sprint_task_history\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_ca809b0756488e63bc88918950\` ON \`organization_sprint_task_history\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_8f686ac0104c90e95ef10f6c22\` ON \`organization_sprint_task_history\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_d5203d63179a7baf703e29a628\` ON \`organization_sprint_task_history\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_8cde33e0a580277a2c1ed36a6b\` ON \`organization_sprint_task_history\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_92db6225d2efc127ded3bdb5f1\` ON \`organization_sprint_task_history\``
		);
		await queryRunner.query(`DROP TABLE \`organization_sprint_task_history\``);
		await queryRunner.query(`DROP INDEX \`IDX_e50cfbf82eec3f0b1d004a5c6e\` ON \`organization_sprint_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_889c9fd5c577a89f5f30facde4\` ON \`organization_sprint_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_434665081d927127495623ad27\` ON \`organization_sprint_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_6a84b0cec9f10178a027f20098\` ON \`organization_sprint_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_be3cb56b953b535835ad868391\` ON \`organization_sprint_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_b0a8b958a5716e73467c1937ec\` ON \`organization_sprint_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_2ceba05d5de64b36d361af6a34\` ON \`organization_sprint_task\``);
		await queryRunner.query(`DROP TABLE \`organization_sprint_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_f516713776cfc5662cdbf2f3c4\` ON \`organization_sprint_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_e5ec88b5022e0d71ac88d876de\` ON \`organization_sprint_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_68ea808c69795593450737c992\` ON \`organization_sprint_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_fbcc76b45f43996c20936f229c\` ON \`organization_sprint_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_953b6df10eaabf11f5762bbee0\` ON \`organization_sprint_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_2e74f97c99716d6a0a892ec6de\` ON \`organization_sprint_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_30d8b0ec5e73c133f3e3d9afef\` ON \`organization_sprint_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_62b4c285d16b0759ae29791dd5\` ON \`organization_sprint_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_fa0d179e320c8680cc32a41d70\` ON \`organization_sprint_employee\``);
		await queryRunner.query(`DROP TABLE \`organization_sprint_employee\``);
	}
}
