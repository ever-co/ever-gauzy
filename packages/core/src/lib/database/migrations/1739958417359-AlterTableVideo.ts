import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterTableVideo1739958417359 implements MigrationInterface {
	name = 'AlterTableVideo1739958417359';

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
		await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
		await queryRunner.query(`ALTER TABLE "video" DROP COLUMN "duration"`);
		await queryRunner.query(`ALTER TABLE "video" ADD "duration" real`);
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
		await queryRunner.query(`ALTER TABLE "video" DROP COLUMN "duration"`);
		await queryRunner.query(`ALTER TABLE "video" ADD "duration" integer`);
		await queryRunner.query(
			`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
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
		await queryRunner.query(`DROP INDEX "IDX_f42d8d7033aacb69287d0dcfd9"`);
		await queryRunner.query(`DROP INDEX "IDX_a0c8486c125418dc0cc2e38470"`);
		await queryRunner.query(`DROP INDEX "IDX_1be826cc802f4cf0abb36ab365"`);
		await queryRunner.query(`DROP INDEX "IDX_95bba1c05216311bf162f6d835"`);
		await queryRunner.query(`DROP INDEX "IDX_061902beee13424f6372ac19f0"`);
		await queryRunner.query(`DROP INDEX "IDX_6fd9144466152ccef62e39d853"`);
		await queryRunner.query(`DROP INDEX "IDX_158647e790ce90499ed5a53c9b"`);
		await queryRunner.query(`DROP INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_video" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "file" varchar NOT NULL, "recordedAt" datetime, "duration" integer, "size" integer, "fullUrl" varchar, "description" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "resolution" varchar DEFAULT ('1920:1080'), "codec" varchar DEFAULT ('libx264'), "frameRate" integer DEFAULT (15), "timeSlotId" varchar, "uploadedById" varchar, CONSTRAINT "FK_f42d8d7033aacb69287d0dcfd9a" FOREIGN KEY ("uploadedById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a0c8486c125418dc0cc2e384703" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_061902beee13424f6372ac19f02" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6fd9144466152ccef62e39d853e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_video"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById" FROM "video"`
		);
		await queryRunner.query(`DROP TABLE "video"`);
		await queryRunner.query(`ALTER TABLE "temporary_video" RENAME TO "video"`);
		await queryRunner.query(`CREATE INDEX "IDX_f42d8d7033aacb69287d0dcfd9" ON "video" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_a0c8486c125418dc0cc2e38470" ON "video" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1be826cc802f4cf0abb36ab365" ON "video" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_95bba1c05216311bf162f6d835" ON "video" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_061902beee13424f6372ac19f0" ON "video" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6fd9144466152ccef62e39d853" ON "video" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_158647e790ce90499ed5a53c9b" ON "video" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca" ON "video" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_f42d8d7033aacb69287d0dcfd9"`);
		await queryRunner.query(`DROP INDEX "IDX_a0c8486c125418dc0cc2e38470"`);
		await queryRunner.query(`DROP INDEX "IDX_1be826cc802f4cf0abb36ab365"`);
		await queryRunner.query(`DROP INDEX "IDX_95bba1c05216311bf162f6d835"`);
		await queryRunner.query(`DROP INDEX "IDX_061902beee13424f6372ac19f0"`);
		await queryRunner.query(`DROP INDEX "IDX_6fd9144466152ccef62e39d853"`);
		await queryRunner.query(`DROP INDEX "IDX_158647e790ce90499ed5a53c9b"`);
		await queryRunner.query(`DROP INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_video" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "file" varchar NOT NULL, "recordedAt" datetime, "duration" real, "size" integer, "fullUrl" varchar, "description" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "resolution" varchar DEFAULT ('1920:1080'), "codec" varchar DEFAULT ('libx264'), "frameRate" integer DEFAULT (15), "timeSlotId" varchar, "uploadedById" varchar, CONSTRAINT "FK_f42d8d7033aacb69287d0dcfd9a" FOREIGN KEY ("uploadedById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a0c8486c125418dc0cc2e384703" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_061902beee13424f6372ac19f02" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6fd9144466152ccef62e39d853e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_video"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById" FROM "video"`
		);
		await queryRunner.query(`DROP TABLE "video"`);
		await queryRunner.query(`ALTER TABLE "temporary_video" RENAME TO "video"`);
		await queryRunner.query(`CREATE INDEX "IDX_f42d8d7033aacb69287d0dcfd9" ON "video" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_a0c8486c125418dc0cc2e38470" ON "video" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1be826cc802f4cf0abb36ab365" ON "video" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_95bba1c05216311bf162f6d835" ON "video" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_061902beee13424f6372ac19f0" ON "video" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6fd9144466152ccef62e39d853" ON "video" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_158647e790ce90499ed5a53c9b" ON "video" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca" ON "video" ("isActive") `);
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
		await queryRunner.query(`DROP INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca"`);
		await queryRunner.query(`DROP INDEX "IDX_158647e790ce90499ed5a53c9b"`);
		await queryRunner.query(`DROP INDEX "IDX_6fd9144466152ccef62e39d853"`);
		await queryRunner.query(`DROP INDEX "IDX_061902beee13424f6372ac19f0"`);
		await queryRunner.query(`DROP INDEX "IDX_95bba1c05216311bf162f6d835"`);
		await queryRunner.query(`DROP INDEX "IDX_1be826cc802f4cf0abb36ab365"`);
		await queryRunner.query(`DROP INDEX "IDX_a0c8486c125418dc0cc2e38470"`);
		await queryRunner.query(`DROP INDEX "IDX_f42d8d7033aacb69287d0dcfd9"`);
		await queryRunner.query(`ALTER TABLE "video" RENAME TO "temporary_video"`);
		await queryRunner.query(
			`CREATE TABLE "video" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "file" varchar NOT NULL, "recordedAt" datetime, "duration" integer, "size" integer, "fullUrl" varchar, "description" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "resolution" varchar DEFAULT ('1920:1080'), "codec" varchar DEFAULT ('libx264'), "frameRate" integer DEFAULT (15), "timeSlotId" varchar, "uploadedById" varchar, CONSTRAINT "FK_f42d8d7033aacb69287d0dcfd9a" FOREIGN KEY ("uploadedById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a0c8486c125418dc0cc2e384703" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_061902beee13424f6372ac19f02" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6fd9144466152ccef62e39d853e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "video"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById" FROM "temporary_video"`
		);
		await queryRunner.query(`DROP TABLE "temporary_video"`);
		await queryRunner.query(`CREATE INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca" ON "video" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_158647e790ce90499ed5a53c9b" ON "video" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_6fd9144466152ccef62e39d853" ON "video" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_061902beee13424f6372ac19f0" ON "video" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_95bba1c05216311bf162f6d835" ON "video" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_1be826cc802f4cf0abb36ab365" ON "video" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_a0c8486c125418dc0cc2e38470" ON "video" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f42d8d7033aacb69287d0dcfd9" ON "video" ("uploadedById") `);
		await queryRunner.query(`DROP INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca"`);
		await queryRunner.query(`DROP INDEX "IDX_158647e790ce90499ed5a53c9b"`);
		await queryRunner.query(`DROP INDEX "IDX_6fd9144466152ccef62e39d853"`);
		await queryRunner.query(`DROP INDEX "IDX_061902beee13424f6372ac19f0"`);
		await queryRunner.query(`DROP INDEX "IDX_95bba1c05216311bf162f6d835"`);
		await queryRunner.query(`DROP INDEX "IDX_1be826cc802f4cf0abb36ab365"`);
		await queryRunner.query(`DROP INDEX "IDX_a0c8486c125418dc0cc2e38470"`);
		await queryRunner.query(`DROP INDEX "IDX_f42d8d7033aacb69287d0dcfd9"`);
		await queryRunner.query(`ALTER TABLE "video" RENAME TO "temporary_video"`);
		await queryRunner.query(
			`CREATE TABLE "video" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "file" varchar NOT NULL, "recordedAt" datetime, "duration" integer, "size" integer, "fullUrl" varchar, "description" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "resolution" varchar DEFAULT ('1920:1080'), "codec" varchar DEFAULT ('libx264'), "frameRate" integer DEFAULT (15), "timeSlotId" varchar, "uploadedById" varchar, CONSTRAINT "FK_f42d8d7033aacb69287d0dcfd9a" FOREIGN KEY ("uploadedById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a0c8486c125418dc0cc2e384703" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_061902beee13424f6372ac19f02" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6fd9144466152ccef62e39d853e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "video"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "description", "storageProvider", "resolution", "codec", "frameRate", "timeSlotId", "uploadedById" FROM "temporary_video"`
		);
		await queryRunner.query(`DROP TABLE "temporary_video"`);
		await queryRunner.query(`CREATE INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca" ON "video" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_158647e790ce90499ed5a53c9b" ON "video" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_6fd9144466152ccef62e39d853" ON "video" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_061902beee13424f6372ac19f0" ON "video" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_95bba1c05216311bf162f6d835" ON "video" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_1be826cc802f4cf0abb36ab365" ON "video" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_a0c8486c125418dc0cc2e38470" ON "video" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f42d8d7033aacb69287d0dcfd9" ON "video" ("uploadedById") `);
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
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(`ALTER TABLE \`video\` DROP COLUMN \`duration\``);
		await queryRunner.query(`ALTER TABLE \`video\` ADD \`duration\` double NULL`);
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
		await queryRunner.query(`ALTER TABLE \`video\` DROP COLUMN \`duration\``);
		await queryRunner.query(`ALTER TABLE \`video\` ADD \`duration\` int NULL`);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}
}
