import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterDashboardEntityTable1739950092274 implements MigrationInterface {
	name = 'AlterDashboardEntityTable1739950092274';

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
		await queryRunner.query(`ALTER TABLE "dashboard" DROP CONSTRAINT "FK_d343751cf98e2bfd85754a35a12"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d343751cf98e2bfd85754a35a1"`);
		await queryRunner.query(`ALTER TABLE "dashboard" DROP COLUMN "creatorId"`);
		await queryRunner.query(`ALTER TABLE "dashboard" ADD "employeeId" uuid`);
		await queryRunner.query(`ALTER TABLE "dashboard" ADD "createdByUserId" uuid NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_b34e5ae765e0f8d674e0604621" ON "dashboard" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_30613c8cd1a1df1b176dfb696b" ON "dashboard" ("createdByUserId") `);
		await queryRunner.query(
			`ALTER TABLE "dashboard" ADD CONSTRAINT "FK_b34e5ae765e0f8d674e06046210" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "dashboard" ADD CONSTRAINT "FK_30613c8cd1a1df1b176dfb696ba" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "dashboard" DROP CONSTRAINT "FK_30613c8cd1a1df1b176dfb696ba"`);
		await queryRunner.query(`ALTER TABLE "dashboard" DROP CONSTRAINT "FK_b34e5ae765e0f8d674e06046210"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_30613c8cd1a1df1b176dfb696b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b34e5ae765e0f8d674e0604621"`);
		await queryRunner.query(`ALTER TABLE "dashboard" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "dashboard" DROP COLUMN "employeeId"`);
		await queryRunner.query(`ALTER TABLE "dashboard" ADD "creatorId" uuid NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_d343751cf98e2bfd85754a35a1" ON "dashboard" ("creatorId") `);
		await queryRunner.query(
			`ALTER TABLE "dashboard" ADD CONSTRAINT "FK_d343751cf98e2bfd85754a35a12" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_d343751cf98e2bfd85754a35a1"`);
		await queryRunner.query(`DROP INDEX "IDX_458f459afdb1dbb19c5d80c276"`);
		await queryRunner.query(`DROP INDEX "IDX_c35744fa39ab7f9326a0b07a81"`);
		await queryRunner.query(`DROP INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba"`);
		await queryRunner.query(`DROP INDEX "IDX_d988d1036760b5841e9e9f5509"`);
		await queryRunner.query(`
			CREATE TABLE "temporary_dashboard" (
				"deletedAt"      datetime,
				"id"             varchar PRIMARY KEY NOT NULL,
				"createdAt"      datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"      datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"       boolean DEFAULT (1),
				"isArchived"     boolean DEFAULT (0),
				"archivedAt"     datetime,
				"tenantId"       varchar,
				"organizationId" varchar,
				"name"           varchar NOT NULL,
				"identifier"     varchar NOT NULL,
				"description"    text,
				"contentHtml"    text,
				"isDefault"      boolean NOT NULL DEFAULT (0),
				"creatorId"      varchar NOT NULL,
				CONSTRAINT "FK_458f459afdb1dbb19c5d80c2767" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_c35744fa39ab7f9326a0b07a812" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			);
		`);
		await queryRunner.query(`
			INSERT INTO "temporary_dashboard" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault",
				"creatorId"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault",
				"creatorId"
			FROM "dashboard";
		`);
		await queryRunner.query(`DROP TABLE "dashboard"`);
		await queryRunner.query(`ALTER TABLE "temporary_dashboard" RENAME TO "dashboard"`);
		await queryRunner.query(`CREATE INDEX "IDX_d343751cf98e2bfd85754a35a1" ON "dashboard" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_458f459afdb1dbb19c5d80c276" ON "dashboard" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c35744fa39ab7f9326a0b07a81" ON "dashboard" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba" ON "dashboard" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d988d1036760b5841e9e9f5509" ON "dashboard" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_d343751cf98e2bfd85754a35a1"`);
		await queryRunner.query(`DROP INDEX "IDX_458f459afdb1dbb19c5d80c276"`);
		await queryRunner.query(`DROP INDEX "IDX_c35744fa39ab7f9326a0b07a81"`);
		await queryRunner.query(`DROP INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba"`);
		await queryRunner.query(`DROP INDEX "IDX_d988d1036760b5841e9e9f5509"`);
		await queryRunner.query(`
			CREATE TABLE "temporary_dashboard" (
				"deletedAt"      datetime,
				"id"             varchar PRIMARY KEY NOT NULL,
				"createdAt"      datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"      datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"       boolean DEFAULT (1),
				"isArchived"     boolean DEFAULT (0),
				"archivedAt"     datetime,
				"tenantId"       varchar,
				"organizationId" varchar,
				"name"           varchar NOT NULL,
				"identifier"     varchar NOT NULL,
				"description"    text,
				"contentHtml"    text,
				"isDefault"      boolean NOT NULL DEFAULT (0),
				CONSTRAINT "FK_458f459afdb1dbb19c5d80c2767" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_c35744fa39ab7f9326a0b07a812" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			);
		`);
		await queryRunner.query(`
			INSERT INTO "temporary_dashboard" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault"
			FROM "dashboard";
		`);
		await queryRunner.query(`DROP TABLE "dashboard"`);
		await queryRunner.query(`ALTER TABLE "temporary_dashboard" RENAME TO "dashboard"`);
		await queryRunner.query(`CREATE INDEX "IDX_458f459afdb1dbb19c5d80c276" ON "dashboard" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c35744fa39ab7f9326a0b07a81" ON "dashboard" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba" ON "dashboard" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d988d1036760b5841e9e9f5509" ON "dashboard" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_458f459afdb1dbb19c5d80c276"`);
		await queryRunner.query(`DROP INDEX "IDX_c35744fa39ab7f9326a0b07a81"`);
		await queryRunner.query(`DROP INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba"`);
		await queryRunner.query(`DROP INDEX "IDX_d988d1036760b5841e9e9f5509"`);
		await queryRunner.query(`
			CREATE TABLE "temporary_dashboard" (
				"deletedAt" datetime,
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"archivedAt" datetime,
				"tenantId" varchar,
				"organizationId" varchar,
				"name" varchar NOT NULL,
				"identifier" varchar NOT NULL,
				"description" text,
				"contentHtml" text,
				"isDefault" boolean NOT NULL DEFAULT (0),
				"employeeId" varchar,
				"createdByUserId" varchar NOT NULL,
				CONSTRAINT "FK_458f459afdb1dbb19c5d80c2767" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_c35744fa39ab7f9326a0b07a812" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			);
		`);
		await queryRunner.query(`
			INSERT INTO "temporary_dashboard" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault"
			FROM "dashboard";
		`);
		await queryRunner.query(`DROP TABLE "dashboard"`);
		await queryRunner.query(`ALTER TABLE "temporary_dashboard" RENAME TO "dashboard"`);
		await queryRunner.query(`CREATE INDEX "IDX_458f459afdb1dbb19c5d80c276" ON "dashboard" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c35744fa39ab7f9326a0b07a81" ON "dashboard" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba" ON "dashboard" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d988d1036760b5841e9e9f5509" ON "dashboard" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b34e5ae765e0f8d674e0604621" ON "dashboard" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_30613c8cd1a1df1b176dfb696b" ON "dashboard" ("createdByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_458f459afdb1dbb19c5d80c276"`);
		await queryRunner.query(`DROP INDEX "IDX_c35744fa39ab7f9326a0b07a81"`);
		await queryRunner.query(`DROP INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba"`);
		await queryRunner.query(`DROP INDEX "IDX_d988d1036760b5841e9e9f5509"`);
		await queryRunner.query(`DROP INDEX "IDX_b34e5ae765e0f8d674e0604621"`);
		await queryRunner.query(`DROP INDEX "IDX_30613c8cd1a1df1b176dfb696b"`);
		await queryRunner.query(`
			CREATE TABLE "temporary_dashboard" (
				"deletedAt" datetime,
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"archivedAt" datetime,
				"tenantId" varchar,
				"organizationId" varchar,
				"name" varchar NOT NULL,
				"identifier" varchar NOT NULL,
				"description" text,
				"contentHtml" text,
				"isDefault" boolean NOT NULL DEFAULT (0),
				"employeeId" varchar,
				"createdByUserId" varchar NOT NULL,
				CONSTRAINT "FK_458f459afdb1dbb19c5d80c2767" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_c35744fa39ab7f9326a0b07a812" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_b34e5ae765e0f8d674e06046210" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_30613c8cd1a1df1b176dfb696ba" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			);
		`);
		await queryRunner.query(
			`INSERT INTO "temporary_dashboard" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault",
				"employeeId",
				"createdByUserId"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault",
				"employeeId",
				"createdByUserId"
			FROM "dashboard"`
		);
		await queryRunner.query(`DROP TABLE "dashboard"`);
		await queryRunner.query(`ALTER TABLE "temporary_dashboard" RENAME TO "dashboard"`);
		await queryRunner.query(`CREATE INDEX "IDX_458f459afdb1dbb19c5d80c276" ON "dashboard" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c35744fa39ab7f9326a0b07a81" ON "dashboard" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba" ON "dashboard" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d988d1036760b5841e9e9f5509" ON "dashboard" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b34e5ae765e0f8d674e0604621" ON "dashboard" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_30613c8cd1a1df1b176dfb696b" ON "dashboard" ("createdByUserId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_30613c8cd1a1df1b176dfb696b"`);
		await queryRunner.query(`DROP INDEX "IDX_b34e5ae765e0f8d674e0604621"`);
		await queryRunner.query(`DROP INDEX "IDX_d988d1036760b5841e9e9f5509"`);
		await queryRunner.query(`DROP INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba"`);
		await queryRunner.query(`DROP INDEX "IDX_c35744fa39ab7f9326a0b07a81"`);
		await queryRunner.query(`DROP INDEX "IDX_458f459afdb1dbb19c5d80c276"`);
		await queryRunner.query(`ALTER TABLE "dashboard" RENAME TO "temporary_dashboard"`);
		await queryRunner.query(`
			CREATE TABLE "temporary_dashboard" (
				"deletedAt"     datetime,
				"id"            varchar PRIMARY KEY NOT NULL,
				"createdAt"     datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"     datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"      boolean DEFAULT (1),
				"isArchived"    boolean DEFAULT (0),
				"archivedAt"    datetime,
				"tenantId"      varchar,
				"organizationId" varchar,
				"name"          varchar NOT NULL,
				"identifier"    varchar NOT NULL,
				"description"   text,
				"contentHtml"   text,
				"isDefault"     boolean NOT NULL DEFAULT (0),
				"creatorId"     varchar NOT NULL,
				CONSTRAINT "FK_organization" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			);
		`);
		await queryRunner.query(`
			INSERT INTO "dashboard" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault",
				"employeeId",
				"createdByUserId"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault",
				"employeeId",
				"createdByUserId"
			FROM "temporary_dashboard";
		`);
		await queryRunner.query(`DROP TABLE "temporary_dashboard"`);
		await queryRunner.query(`CREATE INDEX "IDX_30613c8cd1a1df1b176dfb696b" ON "dashboard" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b34e5ae765e0f8d674e0604621" ON "dashboard" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d988d1036760b5841e9e9f5509" ON "dashboard" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba" ON "dashboard" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_c35744fa39ab7f9326a0b07a81" ON "dashboard" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_458f459afdb1dbb19c5d80c276" ON "dashboard" ("organizationId") `);
		await queryRunner.query(`DROP INDEX "IDX_30613c8cd1a1df1b176dfb696b"`);
		await queryRunner.query(`DROP INDEX "IDX_b34e5ae765e0f8d674e0604621"`);
		await queryRunner.query(`DROP INDEX "IDX_d988d1036760b5841e9e9f5509"`);
		await queryRunner.query(`DROP INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba"`);
		await queryRunner.query(`DROP INDEX "IDX_c35744fa39ab7f9326a0b07a81"`);
		await queryRunner.query(`DROP INDEX "IDX_458f459afdb1dbb19c5d80c276"`);
		await queryRunner.query(`ALTER TABLE "dashboard" RENAME TO "temporary_dashboard"`);
		await queryRunner.query(`
			CREATE TABLE "dashboard" (
				"deletedAt"      datetime,
				"id"             varchar PRIMARY KEY NOT NULL,
				"createdAt"      datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"      datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"       boolean DEFAULT (1),
				"isArchived"     boolean DEFAULT (0),
				"archivedAt"     datetime,
				"tenantId"       varchar,
				"organizationId" varchar,
				"name"           varchar NOT NULL,
				"identifier"     varchar NOT NULL,
				"description"    text,
				"contentHtml"    text,
				"isDefault"      boolean NOT NULL DEFAULT (0),
				CONSTRAINT "FK_organization" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			);
		`);
		await queryRunner.query(`
			INSERT INTO "dashboard" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault"
			FROM "temporary_dashboard";
		`);
		await queryRunner.query(`DROP TABLE "temporary_dashboard"`);
		await queryRunner.query(`CREATE INDEX "IDX_d988d1036760b5841e9e9f5509" ON "dashboard" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba" ON "dashboard" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_c35744fa39ab7f9326a0b07a81" ON "dashboard" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_458f459afdb1dbb19c5d80c276" ON "dashboard" ("organizationId") `);
		await queryRunner.query(`DROP INDEX "IDX_d988d1036760b5841e9e9f5509"`);
		await queryRunner.query(`DROP INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba"`);
		await queryRunner.query(`DROP INDEX "IDX_c35744fa39ab7f9326a0b07a81"`);
		await queryRunner.query(`DROP INDEX "IDX_458f459afdb1dbb19c5d80c276"`);
		await queryRunner.query(`ALTER TABLE "dashboard" RENAME TO "temporary_dashboard"`);
		await queryRunner.query(`
			CREATE TABLE "dashboard" (
				"deletedAt"      datetime,
				"id"             varchar PRIMARY KEY NOT NULL,
				"createdAt"      datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"      datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"       boolean DEFAULT (1),
				"isArchived"     boolean DEFAULT (0),
				"archivedAt"     datetime,
				"tenantId"       varchar,
				"organizationId" varchar,
				"name"           varchar NOT NULL,
				"identifier"     varchar NOT NULL,
				"description"    text,
				"contentHtml"    text,
				"isDefault"      boolean NOT NULL DEFAULT (0),
				"creatorId"      varchar NOT NULL,
				CONSTRAINT "FK_458f459afdb1dbb19c5d80c2767" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_c35744fa39ab7f9326a0b07a812" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			);
		`);
		await queryRunner.query(`
			INSERT INTO "dashboard" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault"
			FROM "temporary_dashboard";
		`);
		await queryRunner.query(`DROP TABLE "temporary_dashboard"`);
		await queryRunner.query(`CREATE INDEX "IDX_d988d1036760b5841e9e9f5509" ON "dashboard" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba" ON "dashboard" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_c35744fa39ab7f9326a0b07a81" ON "dashboard" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_458f459afdb1dbb19c5d80c276" ON "dashboard" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d343751cf98e2bfd85754a35a1" ON "dashboard" ("creatorId") `);
		await queryRunner.query(`DROP INDEX "IDX_d988d1036760b5841e9e9f5509"`);
		await queryRunner.query(`DROP INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba"`);
		await queryRunner.query(`DROP INDEX "IDX_c35744fa39ab7f9326a0b07a81"`);
		await queryRunner.query(`DROP INDEX "IDX_458f459afdb1dbb19c5d80c276"`);
		await queryRunner.query(`DROP INDEX "IDX_d343751cf98e2bfd85754a35a1"`);
		await queryRunner.query(`ALTER TABLE "dashboard" RENAME TO "temporary_dashboard"`);
		await queryRunner.query(`
			CREATE TABLE "dashboard" (
				"deletedAt"      datetime,
				"id"             varchar PRIMARY KEY NOT NULL,
				"createdAt"      datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"      datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"       boolean DEFAULT (1),
				"isArchived"     boolean DEFAULT (0),
				"archivedAt"     datetime,
				"tenantId"       varchar,
				"organizationId" varchar,
				"name"           varchar NOT NULL,
				"identifier"     varchar NOT NULL,
				"description"    text,
				"contentHtml"    text,
				"isDefault"      boolean NOT NULL DEFAULT (0),
				"creatorId"      varchar NOT NULL,
				CONSTRAINT "FK_d343751cf98e2bfd85754a35a12" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_458f459afdb1dbb19c5d80c2767" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_c35744fa39ab7f9326a0b07a812" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			);
		`);
		await queryRunner.query(`
			INSERT INTO "dashboard" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault",
				"creatorId"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"name",
				"identifier",
				"description",
				"contentHtml",
				"isDefault",
				"creatorId"
			FROM "temporary_dashboard";
		`);
		await queryRunner.query(`DROP TABLE "temporary_dashboard"`);
		await queryRunner.query(`CREATE INDEX "IDX_d988d1036760b5841e9e9f5509" ON "dashboard" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0dec9fe24b4c3731c6b30a1ba" ON "dashboard" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_c35744fa39ab7f9326a0b07a81" ON "dashboard" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_458f459afdb1dbb19c5d80c276" ON "dashboard" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d343751cf98e2bfd85754a35a1" ON "dashboard" ("creatorId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`dashboard\` DROP FOREIGN KEY \`FK_d343751cf98e2bfd85754a35a12\``);
		await queryRunner.query(`DROP INDEX \`IDX_d343751cf98e2bfd85754a35a1\` ON \`dashboard\``);
		await queryRunner.query(`ALTER TABLE \`dashboard\` DROP COLUMN \`creatorId\``);
		await queryRunner.query(`ALTER TABLE \`dashboard\` ADD \`employeeId\` varchar(255)`);
		await queryRunner.query(`ALTER TABLE \`dashboard\` ADD \`createdByUserId\` varchar(255) NOT NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_b34e5ae765e0f8d674e0604621\` ON \`dashboard\` (\`employeeId\`)`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_30613c8cd1a1df1b176dfb696b\` ON \`dashboard\` (\`createdByUserId\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`dashboard\` ADD CONSTRAINT \`FK_b34e5ae765e0f8d674e06046210\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`dashboard\` ADD CONSTRAINT \`FK_30613c8cd1a1df1b176dfb696ba\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`dashboard\` DROP FOREIGN KEY \`FK_30613c8cd1a1df1b176dfb696ba\``);
		await queryRunner.query(`ALTER TABLE \`dashboard\` DROP FOREIGN KEY \`FK_b34e5ae765e0f8d674e06046210\``);
		await queryRunner.query(`DROP INDEX \`IDX_30613c8cd1a1df1b176dfb696b\` ON \`dashboard\``);
		await queryRunner.query(`DROP INDEX \`IDX_b34e5ae765e0f8d674e0604621\` ON \`dashboard\``);
		await queryRunner.query(`ALTER TABLE \`dashboard\` DROP COLUMN \`createdByUserId\``);
		await queryRunner.query(`ALTER TABLE \`dashboard\` DROP COLUMN \`employeeId\``);
		await queryRunner.query(`ALTER TABLE \`dashboard\` ADD \`creatorId\` varchar(255) NOT NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_d343751cf98e2bfd85754a35a1\` ON \`dashboard\` (\`creatorId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`dashboard\` ADD CONSTRAINT \`FK_d343751cf98e2bfd85754a35a12\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}
}
