import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterRegistryTables1748354102433 implements MigrationInterface {
	name = 'AlterRegistryTables1748354102433';

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
		console.log(chalk.yellow(this.name + ' reverting changes!'));

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
		await queryRunner.query(`ALTER TABLE "plugin_version" DROP CONSTRAINT "FK_e459ef09a96deb0763e27822634"`);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e459ef09a96deb0763e2782263"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" DROP COLUMN "authToken"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" DROP COLUMN "sourceId"`);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_source_operatingsystem_enum" AS ENUM('LINUX', 'MAC', 'WINDOWS', 'UNIVERSAL')`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_source" ADD "operatingSystem" "public"."plugin_source_operatingsystem_enum" NOT NULL DEFAULT 'UNIVERSAL'`
		);
		await queryRunner.query(`CREATE TYPE "public"."plugin_source_architecture_enum" AS ENUM('X64', 'ARM')`);
		await queryRunner.query(
			`ALTER TABLE "plugin_source" ADD "architecture" "public"."plugin_source_architecture_enum" NOT NULL DEFAULT 'X64'`
		);
		await queryRunner.query(`ALTER TABLE "plugin_source" ADD "private" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "plugin_source" ADD "versionId" uuid`);
		await queryRunner.query(`CREATE INDEX "IDX_f2dd1610a6a707db852710519e" ON "plugin_source" ("versionId") `);
		await queryRunner.query(
			`ALTER TABLE "plugin_source" ADD CONSTRAINT "FK_f2dd1610a6a707db852710519e6" FOREIGN KEY ("versionId") REFERENCES "plugin_version"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" DROP CONSTRAINT "FK_f2dd1610a6a707db852710519e6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f2dd1610a6a707db852710519e"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" DROP COLUMN "versionId"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" DROP COLUMN "private"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" DROP COLUMN "architecture"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_source_architecture_enum"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" DROP COLUMN "operatingSystem"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_source_operatingsystem_enum"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" ADD "sourceId" uuid`);
		await queryRunner.query(`ALTER TABLE "plugin_source" ADD "authToken" character varying`);
		await queryRunner.query(`CREATE INDEX "IDX_e459ef09a96deb0763e2782263" ON "plugin_version" ("sourceId") `);
		await queryRunner.query(
			`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_version" ADD CONSTRAINT "FK_e459ef09a96deb0763e27822634" FOREIGN KEY ("sourceId") REFERENCES "plugin_source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "version_number_unique"`);
		await queryRunner.query(`DROP INDEX "IDX_e459ef09a96deb0763e2782263"`);
		await queryRunner.query(`DROP INDEX "IDX_b2675c6a056281d5155b1b7bb8"`);
		await queryRunner.query(`DROP INDEX "IDX_66225a5548f3a7fee54b8f6805"`);
		await queryRunner.query(`DROP INDEX "IDX_ffadd2f2026dac3093d91146b6"`);
		await queryRunner.query(`DROP INDEX "IDX_216cf6b8c20a2e0a9380c17c6b"`);
		await queryRunner.query(`DROP INDEX "IDX_5966e93c557c13baa72ea2812d"`);
		await queryRunner.query(`DROP INDEX "IDX_b113606a9ed1b208e91a090e57"`);
		await queryRunner.query(`DROP INDEX "IDX_1549236e0d968bd869822d1732"`);
		await queryRunner.query(`DROP INDEX "IDX_3971ab167afbeaaba96d6cb9a0"`);
		await queryRunner.query(`DROP INDEX "IDX_26055fbc6d60ce8ef96c77e16c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar NOT NULL, "changelog" varchar NOT NULL, "checksum" varchar, "signature" varchar, "releaseDate" datetime, "downloadCount" integer DEFAULT (0), "pluginId" varchar, "sourceId" varchar, CONSTRAINT "FK_b2675c6a056281d5155b1b7bb86" FOREIGN KEY ("pluginId") REFERENCES "plugin" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ffadd2f2026dac3093d91146b64" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_216cf6b8c20a2e0a9380c17c6b7" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1549236e0d968bd869822d1732f" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3971ab167afbeaaba96d6cb9a05" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_26055fbc6d60ce8ef96c77e16c7" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_version"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId", "sourceId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId", "sourceId" FROM "plugin_version"`
		);
		await queryRunner.query(`DROP TABLE "plugin_version"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_version" RENAME TO "plugin_version"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "version_number_unique" ON "plugin_version" ("number", "pluginId", "organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e459ef09a96deb0763e2782263" ON "plugin_version" ("sourceId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2675c6a056281d5155b1b7bb8" ON "plugin_version" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_66225a5548f3a7fee54b8f6805" ON "plugin_version" ("releaseDate") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ffadd2f2026dac3093d91146b6" ON "plugin_version" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_216cf6b8c20a2e0a9380c17c6b" ON "plugin_version" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_5966e93c557c13baa72ea2812d" ON "plugin_version" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_b113606a9ed1b208e91a090e57" ON "plugin_version" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_1549236e0d968bd869822d1732" ON "plugin_version" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3971ab167afbeaaba96d6cb9a0" ON "plugin_version" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_26055fbc6d60ce8ef96c77e16c" ON "plugin_version" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "employee_job_preset"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_e459ef09a96deb0763e2782263"`);
		await queryRunner.query(`DROP INDEX "IDX_ff61527634c5d822340f3e79ff"`);
		await queryRunner.query(`DROP INDEX "IDX_b93bd5d3d1c0b78e2e87a35130"`);
		await queryRunner.query(`DROP INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5"`);
		await queryRunner.query(`DROP INDEX "IDX_b78c1749e36da714a7d2fe73df"`);
		await queryRunner.query(`DROP INDEX "IDX_753472d9f81abe508cffe15ad8"`);
		await queryRunner.query(`DROP INDEX "IDX_834606ec25b3e69303f59d6589"`);
		await queryRunner.query(`DROP INDEX "IDX_a69a8ef5d1c35133a727915eae"`);
		await queryRunner.query(`DROP INDEX "IDX_27fdaefcb8465eb3cb6c20e186"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_source" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), CONSTRAINT "FK_b93bd5d3d1c0b78e2e87a351305" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_9acdcb59ff7adecbac0a6ebeb5c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_834606ec25b3e69303f59d65893" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a69a8ef5d1c35133a727915eae8" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_27fdaefcb8465eb3cb6c20e1861" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_source"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider" FROM "plugin_source"`
		);
		await queryRunner.query(`DROP TABLE "plugin_source"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_source" RENAME TO "plugin_source"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_ff61527634c5d822340f3e79ff" ON "plugin_source" ("storageProvider") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b93bd5d3d1c0b78e2e87a35130" ON "plugin_source" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5" ON "plugin_source" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b78c1749e36da714a7d2fe73df" ON "plugin_source" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_753472d9f81abe508cffe15ad8" ON "plugin_source" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_834606ec25b3e69303f59d6589" ON "plugin_source" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a69a8ef5d1c35133a727915eae" ON "plugin_source" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_27fdaefcb8465eb3cb6c20e186" ON "plugin_source" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "version_number_unique"`);
		await queryRunner.query(`DROP INDEX "IDX_b2675c6a056281d5155b1b7bb8"`);
		await queryRunner.query(`DROP INDEX "IDX_66225a5548f3a7fee54b8f6805"`);
		await queryRunner.query(`DROP INDEX "IDX_ffadd2f2026dac3093d91146b6"`);
		await queryRunner.query(`DROP INDEX "IDX_216cf6b8c20a2e0a9380c17c6b"`);
		await queryRunner.query(`DROP INDEX "IDX_5966e93c557c13baa72ea2812d"`);
		await queryRunner.query(`DROP INDEX "IDX_b113606a9ed1b208e91a090e57"`);
		await queryRunner.query(`DROP INDEX "IDX_1549236e0d968bd869822d1732"`);
		await queryRunner.query(`DROP INDEX "IDX_3971ab167afbeaaba96d6cb9a0"`);
		await queryRunner.query(`DROP INDEX "IDX_26055fbc6d60ce8ef96c77e16c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar NOT NULL, "changelog" varchar NOT NULL, "checksum" varchar, "signature" varchar, "releaseDate" datetime, "downloadCount" integer DEFAULT (0), "pluginId" varchar, CONSTRAINT "FK_b2675c6a056281d5155b1b7bb86" FOREIGN KEY ("pluginId") REFERENCES "plugin" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ffadd2f2026dac3093d91146b64" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_216cf6b8c20a2e0a9380c17c6b7" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1549236e0d968bd869822d1732f" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3971ab167afbeaaba96d6cb9a05" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_26055fbc6d60ce8ef96c77e16c7" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_version"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId" FROM "plugin_version"`
		);
		await queryRunner.query(`DROP TABLE "plugin_version"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_version" RENAME TO "plugin_version"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "version_number_unique" ON "plugin_version" ("number", "pluginId", "organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b2675c6a056281d5155b1b7bb8" ON "plugin_version" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_66225a5548f3a7fee54b8f6805" ON "plugin_version" ("releaseDate") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ffadd2f2026dac3093d91146b6" ON "plugin_version" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_216cf6b8c20a2e0a9380c17c6b" ON "plugin_version" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_5966e93c557c13baa72ea2812d" ON "plugin_version" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_b113606a9ed1b208e91a090e57" ON "plugin_version" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_1549236e0d968bd869822d1732" ON "plugin_version" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3971ab167afbeaaba96d6cb9a0" ON "plugin_version" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_26055fbc6d60ce8ef96c77e16c" ON "plugin_version" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_ff61527634c5d822340f3e79ff"`);
		await queryRunner.query(`DROP INDEX "IDX_b93bd5d3d1c0b78e2e87a35130"`);
		await queryRunner.query(`DROP INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5"`);
		await queryRunner.query(`DROP INDEX "IDX_b78c1749e36da714a7d2fe73df"`);
		await queryRunner.query(`DROP INDEX "IDX_753472d9f81abe508cffe15ad8"`);
		await queryRunner.query(`DROP INDEX "IDX_834606ec25b3e69303f59d6589"`);
		await queryRunner.query(`DROP INDEX "IDX_a69a8ef5d1c35133a727915eae"`);
		await queryRunner.query(`DROP INDEX "IDX_27fdaefcb8465eb3cb6c20e186"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_source" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "operatingSystem" varchar CHECK( "operatingSystem" IN ('LINUX','MAC','WINDOWS','UNIVERSAL') ) NOT NULL DEFAULT ('UNIVERSAL'), "architecture" varchar CHECK( "architecture" IN ('X64','ARM') ) NOT NULL DEFAULT ('X64'), "private" boolean DEFAULT (0), "versionId" varchar, CONSTRAINT "FK_b93bd5d3d1c0b78e2e87a351305" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_9acdcb59ff7adecbac0a6ebeb5c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_834606ec25b3e69303f59d65893" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a69a8ef5d1c35133a727915eae8" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_27fdaefcb8465eb3cb6c20e1861" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_source"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider" FROM "plugin_source"`
		);
		await queryRunner.query(`DROP TABLE "plugin_source"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_source" RENAME TO "plugin_source"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_ff61527634c5d822340f3e79ff" ON "plugin_source" ("storageProvider") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b93bd5d3d1c0b78e2e87a35130" ON "plugin_source" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5" ON "plugin_source" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b78c1749e36da714a7d2fe73df" ON "plugin_source" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_753472d9f81abe508cffe15ad8" ON "plugin_source" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_834606ec25b3e69303f59d6589" ON "plugin_source" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a69a8ef5d1c35133a727915eae" ON "plugin_source" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_27fdaefcb8465eb3cb6c20e186" ON "plugin_source" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f2dd1610a6a707db852710519e" ON "plugin_source" ("versionId") `);
		await queryRunner.query(`DROP INDEX "IDX_ff61527634c5d822340f3e79ff"`);
		await queryRunner.query(`DROP INDEX "IDX_b93bd5d3d1c0b78e2e87a35130"`);
		await queryRunner.query(`DROP INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5"`);
		await queryRunner.query(`DROP INDEX "IDX_b78c1749e36da714a7d2fe73df"`);
		await queryRunner.query(`DROP INDEX "IDX_753472d9f81abe508cffe15ad8"`);
		await queryRunner.query(`DROP INDEX "IDX_834606ec25b3e69303f59d6589"`);
		await queryRunner.query(`DROP INDEX "IDX_a69a8ef5d1c35133a727915eae"`);
		await queryRunner.query(`DROP INDEX "IDX_27fdaefcb8465eb3cb6c20e186"`);
		await queryRunner.query(`DROP INDEX "IDX_f2dd1610a6a707db852710519e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_source" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "operatingSystem" varchar CHECK( "operatingSystem" IN ('LINUX','MAC','WINDOWS','UNIVERSAL') ) NOT NULL DEFAULT ('UNIVERSAL'), "architecture" varchar CHECK( "architecture" IN ('X64','ARM') ) NOT NULL DEFAULT ('X64'), "private" boolean DEFAULT (0), "versionId" varchar, CONSTRAINT "FK_b93bd5d3d1c0b78e2e87a351305" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_9acdcb59ff7adecbac0a6ebeb5c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_834606ec25b3e69303f59d65893" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a69a8ef5d1c35133a727915eae8" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_27fdaefcb8465eb3cb6c20e1861" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f2dd1610a6a707db852710519e6" FOREIGN KEY ("versionId") REFERENCES "plugin_version" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_source"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider", "operatingSystem", "architecture", "private", "versionId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider", "operatingSystem", "architecture", "private", "versionId" FROM "plugin_source"`
		);
		await queryRunner.query(`DROP TABLE "plugin_source"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_source" RENAME TO "plugin_source"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_ff61527634c5d822340f3e79ff" ON "plugin_source" ("storageProvider") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b93bd5d3d1c0b78e2e87a35130" ON "plugin_source" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5" ON "plugin_source" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b78c1749e36da714a7d2fe73df" ON "plugin_source" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_753472d9f81abe508cffe15ad8" ON "plugin_source" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_834606ec25b3e69303f59d6589" ON "plugin_source" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a69a8ef5d1c35133a727915eae" ON "plugin_source" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_27fdaefcb8465eb3cb6c20e186" ON "plugin_source" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f2dd1610a6a707db852710519e" ON "plugin_source" ("versionId") `);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "employee_job_preset"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_f2dd1610a6a707db852710519e"`);
		await queryRunner.query(`DROP INDEX "IDX_27fdaefcb8465eb3cb6c20e186"`);
		await queryRunner.query(`DROP INDEX "IDX_a69a8ef5d1c35133a727915eae"`);
		await queryRunner.query(`DROP INDEX "IDX_834606ec25b3e69303f59d6589"`);
		await queryRunner.query(`DROP INDEX "IDX_753472d9f81abe508cffe15ad8"`);
		await queryRunner.query(`DROP INDEX "IDX_b78c1749e36da714a7d2fe73df"`);
		await queryRunner.query(`DROP INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5"`);
		await queryRunner.query(`DROP INDEX "IDX_b93bd5d3d1c0b78e2e87a35130"`);
		await queryRunner.query(`DROP INDEX "IDX_ff61527634c5d822340f3e79ff"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" RENAME TO "temporary_plugin_source"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_source" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "operatingSystem" varchar CHECK( "operatingSystem" IN ('LINUX','MAC','WINDOWS','UNIVERSAL') ) NOT NULL DEFAULT ('UNIVERSAL'), "architecture" varchar CHECK( "architecture" IN ('X64','ARM') ) NOT NULL DEFAULT ('X64'), "private" boolean DEFAULT (0), "versionId" varchar, CONSTRAINT "FK_b93bd5d3d1c0b78e2e87a351305" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_9acdcb59ff7adecbac0a6ebeb5c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_834606ec25b3e69303f59d65893" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a69a8ef5d1c35133a727915eae8" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_27fdaefcb8465eb3cb6c20e1861" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_source"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider", "operatingSystem", "architecture", "private", "versionId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider", "operatingSystem", "architecture", "private", "versionId" FROM "temporary_plugin_source"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_source"`);
		await queryRunner.query(`CREATE INDEX "IDX_f2dd1610a6a707db852710519e" ON "plugin_source" ("versionId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_27fdaefcb8465eb3cb6c20e186" ON "plugin_source" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a69a8ef5d1c35133a727915eae" ON "plugin_source" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_834606ec25b3e69303f59d6589" ON "plugin_source" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_753472d9f81abe508cffe15ad8" ON "plugin_source" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b78c1749e36da714a7d2fe73df" ON "plugin_source" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5" ON "plugin_source" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b93bd5d3d1c0b78e2e87a35130" ON "plugin_source" ("organizationId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ff61527634c5d822340f3e79ff" ON "plugin_source" ("storageProvider") `
		);
		await queryRunner.query(`DROP INDEX "IDX_f2dd1610a6a707db852710519e"`);
		await queryRunner.query(`DROP INDEX "IDX_27fdaefcb8465eb3cb6c20e186"`);
		await queryRunner.query(`DROP INDEX "IDX_a69a8ef5d1c35133a727915eae"`);
		await queryRunner.query(`DROP INDEX "IDX_834606ec25b3e69303f59d6589"`);
		await queryRunner.query(`DROP INDEX "IDX_753472d9f81abe508cffe15ad8"`);
		await queryRunner.query(`DROP INDEX "IDX_b78c1749e36da714a7d2fe73df"`);
		await queryRunner.query(`DROP INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5"`);
		await queryRunner.query(`DROP INDEX "IDX_b93bd5d3d1c0b78e2e87a35130"`);
		await queryRunner.query(`DROP INDEX "IDX_ff61527634c5d822340f3e79ff"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" RENAME TO "temporary_plugin_source"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_source" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), CONSTRAINT "FK_b93bd5d3d1c0b78e2e87a351305" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_9acdcb59ff7adecbac0a6ebeb5c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_834606ec25b3e69303f59d65893" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a69a8ef5d1c35133a727915eae8" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_27fdaefcb8465eb3cb6c20e1861" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_source"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider" FROM "temporary_plugin_source"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_source"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_27fdaefcb8465eb3cb6c20e186" ON "plugin_source" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a69a8ef5d1c35133a727915eae" ON "plugin_source" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_834606ec25b3e69303f59d6589" ON "plugin_source" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_753472d9f81abe508cffe15ad8" ON "plugin_source" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b78c1749e36da714a7d2fe73df" ON "plugin_source" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5" ON "plugin_source" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b93bd5d3d1c0b78e2e87a35130" ON "plugin_source" ("organizationId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ff61527634c5d822340f3e79ff" ON "plugin_source" ("storageProvider") `
		);
		await queryRunner.query(`DROP INDEX "IDX_26055fbc6d60ce8ef96c77e16c"`);
		await queryRunner.query(`DROP INDEX "IDX_3971ab167afbeaaba96d6cb9a0"`);
		await queryRunner.query(`DROP INDEX "IDX_1549236e0d968bd869822d1732"`);
		await queryRunner.query(`DROP INDEX "IDX_b113606a9ed1b208e91a090e57"`);
		await queryRunner.query(`DROP INDEX "IDX_5966e93c557c13baa72ea2812d"`);
		await queryRunner.query(`DROP INDEX "IDX_216cf6b8c20a2e0a9380c17c6b"`);
		await queryRunner.query(`DROP INDEX "IDX_ffadd2f2026dac3093d91146b6"`);
		await queryRunner.query(`DROP INDEX "IDX_66225a5548f3a7fee54b8f6805"`);
		await queryRunner.query(`DROP INDEX "IDX_b2675c6a056281d5155b1b7bb8"`);
		await queryRunner.query(`DROP INDEX "version_number_unique"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" RENAME TO "temporary_plugin_version"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar NOT NULL, "changelog" varchar NOT NULL, "checksum" varchar, "signature" varchar, "releaseDate" datetime, "downloadCount" integer DEFAULT (0), "pluginId" varchar, "sourceId" varchar, CONSTRAINT "FK_b2675c6a056281d5155b1b7bb86" FOREIGN KEY ("pluginId") REFERENCES "plugin" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ffadd2f2026dac3093d91146b64" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_216cf6b8c20a2e0a9380c17c6b7" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1549236e0d968bd869822d1732f" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3971ab167afbeaaba96d6cb9a05" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_26055fbc6d60ce8ef96c77e16c7" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_version"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId" FROM "temporary_plugin_version"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_version"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_26055fbc6d60ce8ef96c77e16c" ON "plugin_version" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3971ab167afbeaaba96d6cb9a0" ON "plugin_version" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1549236e0d968bd869822d1732" ON "plugin_version" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b113606a9ed1b208e91a090e57" ON "plugin_version" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_5966e93c557c13baa72ea2812d" ON "plugin_version" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_216cf6b8c20a2e0a9380c17c6b" ON "plugin_version" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ffadd2f2026dac3093d91146b6" ON "plugin_version" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_66225a5548f3a7fee54b8f6805" ON "plugin_version" ("releaseDate") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2675c6a056281d5155b1b7bb8" ON "plugin_version" ("pluginId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "version_number_unique" ON "plugin_version" ("number", "pluginId", "organizationId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_27fdaefcb8465eb3cb6c20e186"`);
		await queryRunner.query(`DROP INDEX "IDX_a69a8ef5d1c35133a727915eae"`);
		await queryRunner.query(`DROP INDEX "IDX_834606ec25b3e69303f59d6589"`);
		await queryRunner.query(`DROP INDEX "IDX_753472d9f81abe508cffe15ad8"`);
		await queryRunner.query(`DROP INDEX "IDX_b78c1749e36da714a7d2fe73df"`);
		await queryRunner.query(`DROP INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5"`);
		await queryRunner.query(`DROP INDEX "IDX_b93bd5d3d1c0b78e2e87a35130"`);
		await queryRunner.query(`DROP INDEX "IDX_ff61527634c5d822340f3e79ff"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" RENAME TO "temporary_plugin_source"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_source" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "authToken" varchar, "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), CONSTRAINT "FK_b93bd5d3d1c0b78e2e87a351305" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_9acdcb59ff7adecbac0a6ebeb5c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_834606ec25b3e69303f59d65893" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a69a8ef5d1c35133a727915eae8" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_27fdaefcb8465eb3cb6c20e1861" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_source"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider" FROM "temporary_plugin_source"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_source"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_27fdaefcb8465eb3cb6c20e186" ON "plugin_source" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a69a8ef5d1c35133a727915eae" ON "plugin_source" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_834606ec25b3e69303f59d6589" ON "plugin_source" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_753472d9f81abe508cffe15ad8" ON "plugin_source" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b78c1749e36da714a7d2fe73df" ON "plugin_source" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5" ON "plugin_source" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b93bd5d3d1c0b78e2e87a35130" ON "plugin_source" ("organizationId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ff61527634c5d822340f3e79ff" ON "plugin_source" ("storageProvider") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e459ef09a96deb0763e2782263" ON "plugin_version" ("sourceId") `);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_26055fbc6d60ce8ef96c77e16c"`);
		await queryRunner.query(`DROP INDEX "IDX_3971ab167afbeaaba96d6cb9a0"`);
		await queryRunner.query(`DROP INDEX "IDX_1549236e0d968bd869822d1732"`);
		await queryRunner.query(`DROP INDEX "IDX_b113606a9ed1b208e91a090e57"`);
		await queryRunner.query(`DROP INDEX "IDX_5966e93c557c13baa72ea2812d"`);
		await queryRunner.query(`DROP INDEX "IDX_216cf6b8c20a2e0a9380c17c6b"`);
		await queryRunner.query(`DROP INDEX "IDX_ffadd2f2026dac3093d91146b6"`);
		await queryRunner.query(`DROP INDEX "IDX_66225a5548f3a7fee54b8f6805"`);
		await queryRunner.query(`DROP INDEX "IDX_b2675c6a056281d5155b1b7bb8"`);
		await queryRunner.query(`DROP INDEX "IDX_e459ef09a96deb0763e2782263"`);
		await queryRunner.query(`DROP INDEX "version_number_unique"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" RENAME TO "temporary_plugin_version"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar NOT NULL, "changelog" varchar NOT NULL, "checksum" varchar, "signature" varchar, "releaseDate" datetime, "downloadCount" integer DEFAULT (0), "pluginId" varchar, "sourceId" varchar, CONSTRAINT "FK_e459ef09a96deb0763e27822634" FOREIGN KEY ("sourceId") REFERENCES "plugin_source" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b2675c6a056281d5155b1b7bb86" FOREIGN KEY ("pluginId") REFERENCES "plugin" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ffadd2f2026dac3093d91146b64" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_216cf6b8c20a2e0a9380c17c6b7" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1549236e0d968bd869822d1732f" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3971ab167afbeaaba96d6cb9a05" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_26055fbc6d60ce8ef96c77e16c7" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_version"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId", "sourceId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId", "sourceId" FROM "temporary_plugin_version"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_version"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_26055fbc6d60ce8ef96c77e16c" ON "plugin_version" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3971ab167afbeaaba96d6cb9a0" ON "plugin_version" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1549236e0d968bd869822d1732" ON "plugin_version" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b113606a9ed1b208e91a090e57" ON "plugin_version" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_5966e93c557c13baa72ea2812d" ON "plugin_version" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_216cf6b8c20a2e0a9380c17c6b" ON "plugin_version" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ffadd2f2026dac3093d91146b6" ON "plugin_version" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_66225a5548f3a7fee54b8f6805" ON "plugin_version" ("releaseDate") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2675c6a056281d5155b1b7bb8" ON "plugin_version" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e459ef09a96deb0763e2782263" ON "plugin_version" ("sourceId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "version_number_unique" ON "plugin_version" ("number", "pluginId", "organizationId") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`plugin_version\` DROP FOREIGN KEY \`FK_e459ef09a96deb0763e27822634\``);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_e459ef09a96deb0763e2782263\` ON \`plugin_version\``);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` DROP COLUMN \`authToken\``);
		await queryRunner.query(`ALTER TABLE \`plugin_version\` DROP COLUMN \`sourceId\``);
		await queryRunner.query(
			`ALTER TABLE \`plugin_source\` ADD \`operatingSystem\` enum ('LINUX', 'MAC', 'WINDOWS', 'UNIVERSAL') NOT NULL DEFAULT 'UNIVERSAL'`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_source\` ADD \`architecture\` enum ('X64', 'ARM') NOT NULL DEFAULT 'X64'`
		);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` ADD \`private\` tinyint NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` ADD \`versionId\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_f2dd1610a6a707db852710519e\` ON \`plugin_source\` (\`versionId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`plugin_source\` ADD CONSTRAINT \`FK_f2dd1610a6a707db852710519e6\` FOREIGN KEY (\`versionId\`) REFERENCES \`plugin_version\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` DROP FOREIGN KEY \`FK_f2dd1610a6a707db852710519e6\``);
		await queryRunner.query(`DROP INDEX \`IDX_f2dd1610a6a707db852710519e\` ON \`plugin_source\``);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` DROP COLUMN \`versionId\``);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` DROP COLUMN \`private\``);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` DROP COLUMN \`architecture\``);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` DROP COLUMN \`operatingSystem\``);
		await queryRunner.query(`ALTER TABLE \`plugin_version\` ADD \`sourceId\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` ADD \`authToken\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_e459ef09a96deb0763e2782263\` ON \`plugin_version\` (\`sourceId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_version\` ADD CONSTRAINT \`FK_e459ef09a96deb0763e27822634\` FOREIGN KEY (\`sourceId\`) REFERENCES \`plugin_source\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}
}
