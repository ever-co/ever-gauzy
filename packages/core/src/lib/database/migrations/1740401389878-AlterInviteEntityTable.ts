import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterInviteEntityTable1740401389878 implements MigrationInterface {
	name = 'AlterInviteEntityTable1740401389878';

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
		await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5a182e8b3e225b14ddf6df7e6c"`);
		await queryRunner.query(`ALTER TABLE "invite" RENAME COLUMN "invitedById" TO "invitedByUserId"`);
		await queryRunner.query(`CREATE INDEX "IDX_044d4be3cf3d789d0bfd7aaaba" ON "invite" ("invitedByUserId") `);
		await queryRunner.query(
			`ALTER TABLE "invite" ADD CONSTRAINT "FK_044d4be3cf3d789d0bfd7aaaba0" FOREIGN KEY ("invitedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "FK_044d4be3cf3d789d0bfd7aaaba0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_044d4be3cf3d789d0bfd7aaaba"`);
		await queryRunner.query(`ALTER TABLE "invite" RENAME COLUMN "invitedByUserId" TO "invitedById"`);
		await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
		await queryRunner.query(
			`ALTER TABLE "invite" ADD CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_3cef860504647ccd52d39d7dc2"`);
		await queryRunner.query(`DROP INDEX "IDX_bd44bcb10034bc0c5fe4427b3e"`);
		await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
		await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
		await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
		await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
		await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" varchar, "fullName" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "invite"`
		);
		await queryRunner.query(`DROP TABLE "invite"`);
		await queryRunner.query(`ALTER TABLE "temporary_invite" RENAME TO "invite"`);
		await queryRunner.query(`CREATE INDEX "IDX_3cef860504647ccd52d39d7dc2" ON "invite" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_bd44bcb10034bc0c5fe4427b3e" ON "invite" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "employee_job_preset"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
		await queryRunner.query(`DROP INDEX "IDX_3cef860504647ccd52d39d7dc2"`);
		await queryRunner.query(`DROP INDEX "IDX_bd44bcb10034bc0c5fe4427b3e"`);
		await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
		await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
		await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
		await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedByUserId" varchar, "roleId" varchar, "code" varchar, "fullName" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedByUserId", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "invite"`
		);
		await queryRunner.query(`DROP TABLE "invite"`);
		await queryRunner.query(`ALTER TABLE "temporary_invite" RENAME TO "invite"`);
		await queryRunner.query(`CREATE INDEX "IDX_3cef860504647ccd52d39d7dc2" ON "invite" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_bd44bcb10034bc0c5fe4427b3e" ON "invite" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_044d4be3cf3d789d0bfd7aaaba" ON "invite" ("invitedByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_3cef860504647ccd52d39d7dc2"`);
		await queryRunner.query(`DROP INDEX "IDX_bd44bcb10034bc0c5fe4427b3e"`);
		await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
		await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
		await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
		await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
		await queryRunner.query(`DROP INDEX "IDX_044d4be3cf3d789d0bfd7aaaba"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedByUserId" varchar, "roleId" varchar, "code" varchar, "fullName" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_044d4be3cf3d789d0bfd7aaaba0" FOREIGN KEY ("invitedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedByUserId", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedByUserId", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "invite"`
		);
		await queryRunner.query(`DROP TABLE "invite"`);
		await queryRunner.query(`ALTER TABLE "temporary_invite" RENAME TO "invite"`);
		await queryRunner.query(`CREATE INDEX "IDX_3cef860504647ccd52d39d7dc2" ON "invite" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_bd44bcb10034bc0c5fe4427b3e" ON "invite" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_044d4be3cf3d789d0bfd7aaaba" ON "invite" ("invitedByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "employee_job_preset"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_044d4be3cf3d789d0bfd7aaaba"`);
		await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
		await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
		await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
		await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
		await queryRunner.query(`DROP INDEX "IDX_bd44bcb10034bc0c5fe4427b3e"`);
		await queryRunner.query(`DROP INDEX "IDX_3cef860504647ccd52d39d7dc2"`);
		await queryRunner.query(`ALTER TABLE "invite" RENAME TO "temporary_invite"`);
		await queryRunner.query(
			`CREATE TABLE "invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedByUserId" varchar, "roleId" varchar, "code" varchar, "fullName" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedByUserId", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedByUserId", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "temporary_invite"`
		);
		await queryRunner.query(`DROP TABLE "temporary_invite"`);
		await queryRunner.query(`CREATE INDEX "IDX_044d4be3cf3d789d0bfd7aaaba" ON "invite" ("invitedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_bd44bcb10034bc0c5fe4427b3e" ON "invite" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_3cef860504647ccd52d39d7dc2" ON "invite" ("isArchived") `);
		await queryRunner.query(`DROP INDEX "IDX_044d4be3cf3d789d0bfd7aaaba"`);
		await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
		await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
		await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
		await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
		await queryRunner.query(`DROP INDEX "IDX_bd44bcb10034bc0c5fe4427b3e"`);
		await queryRunner.query(`DROP INDEX "IDX_3cef860504647ccd52d39d7dc2"`);
		await queryRunner.query(`ALTER TABLE "invite" RENAME TO "temporary_invite"`);
		await queryRunner.query(
			`CREATE TABLE "invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" varchar, "fullName" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedByUserId", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "temporary_invite"`
		);
		await queryRunner.query(`DROP TABLE "temporary_invite"`);
		await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_bd44bcb10034bc0c5fe4427b3e" ON "invite" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_3cef860504647ccd52d39d7dc2" ON "invite" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
		await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
		await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
		await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
		await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
		await queryRunner.query(`DROP INDEX "IDX_bd44bcb10034bc0c5fe4427b3e"`);
		await queryRunner.query(`DROP INDEX "IDX_3cef860504647ccd52d39d7dc2"`);
		await queryRunner.query(`ALTER TABLE "invite" RENAME TO "temporary_invite"`);
		await queryRunner.query(
			`CREATE TABLE "invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" varchar, "fullName" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "temporary_invite"`
		);
		await queryRunner.query(`DROP TABLE "temporary_invite"`);
		await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_bd44bcb10034bc0c5fe4427b3e" ON "invite" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_3cef860504647ccd52d39d7dc2" ON "invite" ("isArchived") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`invite\` DROP FOREIGN KEY \`FK_5a182e8b3e225b14ddf6df7e6c3\``);
		await queryRunner.query(`DROP INDEX \`IDX_5a182e8b3e225b14ddf6df7e6c\` ON \`invite\``);
		await queryRunner.query(`ALTER TABLE \`invite\` CHANGE \`invitedById\` \`invitedByUserId\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_044d4be3cf3d789d0bfd7aaaba\` ON \`invite\` (\`invitedByUserId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`invite\` ADD CONSTRAINT \`FK_044d4be3cf3d789d0bfd7aaaba0\` FOREIGN KEY (\`invitedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`invite\` DROP FOREIGN KEY \`FK_044d4be3cf3d789d0bfd7aaaba0\``);
		await queryRunner.query(`DROP INDEX \`IDX_044d4be3cf3d789d0bfd7aaaba\` ON \`invite\``);
		await queryRunner.query(`ALTER TABLE \`invite\` CHANGE \`invitedByUserId\` \`invitedById\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_5a182e8b3e225b14ddf6df7e6c\` ON \`invite\` (\`invitedById\`)`);
		await queryRunner.query(
			`ALTER TABLE \`invite\` ADD CONSTRAINT \`FK_5a182e8b3e225b14ddf6df7e6c3\` FOREIGN KEY (\`invitedById\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}
}
