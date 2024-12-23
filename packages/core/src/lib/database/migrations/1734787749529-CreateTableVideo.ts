import { DatabaseTypeEnum } from '@gauzy/config';
import { Logger } from '@nestjs/common';
import { yellow } from 'chalk';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTableVideo1734787749529 implements MigrationInterface {
	name = 'CreateTableVideo1734787749529';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		Logger.debug(yellow(this.name + ' start running!'), 'Migration');

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
		await queryRunner.query(
			`CREATE TYPE "public"."videos_storageprovider_enum" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN')`
		);
		await queryRunner.query(
			`CREATE TABLE "videos" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "title" character varying NOT NULL, "file" character varying NOT NULL, "recordedAt" TIMESTAMP, "duration" integer, "size" integer DEFAULT '0', "fullUrl" character varying, "storageProvider" "public"."videos_storageprovider_enum", "description" character varying, "timeSlotId" uuid, "resolution" character varying DEFAULT '1920:1080', "codec" character varying DEFAULT 'libx264', "frameRate" integer DEFAULT '15', "uploadedById" uuid, CONSTRAINT "PK_e4c86c0cf95aff16e9fb8220f6b" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_eea665c6f09c4cd9a520a028d1" ON "videos" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_4adb6b1409e7b614d06e44fb84" ON "videos" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_1f9ad46e9fbeddbc609af9976a" ON "videos" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_dcbf77e688d65ced41055c3faf" ON "videos" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb34a3e97002e3af9cc219f4e4" ON "videos" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_b3e784ea168736c83f4d647abf" ON "videos" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_d5a38b4293d90e31a6b1f3189e" ON "videos" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_159f8e5c7959016a0863ec419a" ON "videos" ("uploadedById") `);
		await queryRunner.query(
			`ALTER TABLE "videos" ADD CONSTRAINT "FK_1f9ad46e9fbeddbc609af9976ae" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "videos" ADD CONSTRAINT "FK_dcbf77e688d65ced41055c3fafe" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "videos" ADD CONSTRAINT "FK_d5a38b4293d90e31a6b1f3189e1" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "videos" ADD CONSTRAINT "FK_159f8e5c7959016a0863ec419a3" FOREIGN KEY ("uploadedById") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
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
		await queryRunner.query(`ALTER TABLE "videos" DROP CONSTRAINT "FK_159f8e5c7959016a0863ec419a3"`);
		await queryRunner.query(`ALTER TABLE "videos" DROP CONSTRAINT "FK_d5a38b4293d90e31a6b1f3189e1"`);
		await queryRunner.query(`ALTER TABLE "videos" DROP CONSTRAINT "FK_dcbf77e688d65ced41055c3fafe"`);
		await queryRunner.query(`ALTER TABLE "videos" DROP CONSTRAINT "FK_1f9ad46e9fbeddbc609af9976ae"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_159f8e5c7959016a0863ec419a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d5a38b4293d90e31a6b1f3189e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b3e784ea168736c83f4d647abf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cb34a3e97002e3af9cc219f4e4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_dcbf77e688d65ced41055c3faf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1f9ad46e9fbeddbc609af9976a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4adb6b1409e7b614d06e44fb84"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_eea665c6f09c4cd9a520a028d1"`);
		await queryRunner.query(`DROP TABLE "videos"`);
		await queryRunner.query(`DROP TYPE "public"."videos_storageprovider_enum"`);
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
		await queryRunner.query(
			`CREATE TABLE "videos" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "file" varchar NOT NULL, "recordedAt" datetime, "duration" integer, "size" integer DEFAULT (0), "fullUrl" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "description" varchar, "timeSlotId" varchar, "resolution" varchar DEFAULT ('1920:1080'), "codec" varchar DEFAULT ('libx264'), "frameRate" integer DEFAULT (15), "uploadedById" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_eea665c6f09c4cd9a520a028d1" ON "videos" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_4adb6b1409e7b614d06e44fb84" ON "videos" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_1f9ad46e9fbeddbc609af9976a" ON "videos" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_dcbf77e688d65ced41055c3faf" ON "videos" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb34a3e97002e3af9cc219f4e4" ON "videos" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_b3e784ea168736c83f4d647abf" ON "videos" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_d5a38b4293d90e31a6b1f3189e" ON "videos" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_159f8e5c7959016a0863ec419a" ON "videos" ("uploadedById") `);
		await queryRunner.query(`DROP INDEX "IDX_eea665c6f09c4cd9a520a028d1"`);
		await queryRunner.query(`DROP INDEX "IDX_4adb6b1409e7b614d06e44fb84"`);
		await queryRunner.query(`DROP INDEX "IDX_1f9ad46e9fbeddbc609af9976a"`);
		await queryRunner.query(`DROP INDEX "IDX_dcbf77e688d65ced41055c3faf"`);
		await queryRunner.query(`DROP INDEX "IDX_cb34a3e97002e3af9cc219f4e4"`);
		await queryRunner.query(`DROP INDEX "IDX_b3e784ea168736c83f4d647abf"`);
		await queryRunner.query(`DROP INDEX "IDX_d5a38b4293d90e31a6b1f3189e"`);
		await queryRunner.query(`DROP INDEX "IDX_159f8e5c7959016a0863ec419a"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_videos" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "file" varchar NOT NULL, "recordedAt" datetime, "duration" integer, "size" integer DEFAULT (0), "fullUrl" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "description" varchar, "timeSlotId" varchar, "resolution" varchar DEFAULT ('1920:1080'), "codec" varchar DEFAULT ('libx264'), "frameRate" integer DEFAULT (15), "uploadedById" varchar, CONSTRAINT "FK_1f9ad46e9fbeddbc609af9976ae" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_dcbf77e688d65ced41055c3fafe" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d5a38b4293d90e31a6b1f3189e1" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_159f8e5c7959016a0863ec419a3" FOREIGN KEY ("uploadedById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_videos"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "storageProvider", "description", "timeSlotId", "resolution", "codec", "frameRate", "uploadedById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "storageProvider", "description", "timeSlotId", "resolution", "codec", "frameRate", "uploadedById" FROM "videos"`
		);
		await queryRunner.query(`DROP TABLE "videos"`);
		await queryRunner.query(`ALTER TABLE "temporary_videos" RENAME TO "videos"`);
		await queryRunner.query(`CREATE INDEX "IDX_eea665c6f09c4cd9a520a028d1" ON "videos" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_4adb6b1409e7b614d06e44fb84" ON "videos" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_1f9ad46e9fbeddbc609af9976a" ON "videos" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_dcbf77e688d65ced41055c3faf" ON "videos" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb34a3e97002e3af9cc219f4e4" ON "videos" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_b3e784ea168736c83f4d647abf" ON "videos" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_d5a38b4293d90e31a6b1f3189e" ON "videos" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_159f8e5c7959016a0863ec419a" ON "videos" ("uploadedById") `);
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
		await queryRunner.query(`DROP INDEX "IDX_159f8e5c7959016a0863ec419a"`);
		await queryRunner.query(`DROP INDEX "IDX_d5a38b4293d90e31a6b1f3189e"`);
		await queryRunner.query(`DROP INDEX "IDX_b3e784ea168736c83f4d647abf"`);
		await queryRunner.query(`DROP INDEX "IDX_cb34a3e97002e3af9cc219f4e4"`);
		await queryRunner.query(`DROP INDEX "IDX_dcbf77e688d65ced41055c3faf"`);
		await queryRunner.query(`DROP INDEX "IDX_1f9ad46e9fbeddbc609af9976a"`);
		await queryRunner.query(`DROP INDEX "IDX_4adb6b1409e7b614d06e44fb84"`);
		await queryRunner.query(`DROP INDEX "IDX_eea665c6f09c4cd9a520a028d1"`);
		await queryRunner.query(`ALTER TABLE "videos" RENAME TO "temporary_videos"`);
		await queryRunner.query(
			`CREATE TABLE "videos" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "file" varchar NOT NULL, "recordedAt" datetime, "duration" integer, "size" integer DEFAULT (0), "fullUrl" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "description" varchar, "timeSlotId" varchar, "resolution" varchar DEFAULT ('1920:1080'), "codec" varchar DEFAULT ('libx264'), "frameRate" integer DEFAULT (15), "uploadedById" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "videos"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "storageProvider", "description", "timeSlotId", "resolution", "codec", "frameRate", "uploadedById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "file", "recordedAt", "duration", "size", "fullUrl", "storageProvider", "description", "timeSlotId", "resolution", "codec", "frameRate", "uploadedById" FROM "temporary_videos"`
		);
		await queryRunner.query(`DROP TABLE "temporary_videos"`);
		await queryRunner.query(`CREATE INDEX "IDX_159f8e5c7959016a0863ec419a" ON "videos" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_d5a38b4293d90e31a6b1f3189e" ON "videos" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b3e784ea168736c83f4d647abf" ON "videos" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb34a3e97002e3af9cc219f4e4" ON "videos" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_dcbf77e688d65ced41055c3faf" ON "videos" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1f9ad46e9fbeddbc609af9976a" ON "videos" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4adb6b1409e7b614d06e44fb84" ON "videos" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_eea665c6f09c4cd9a520a028d1" ON "videos" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_159f8e5c7959016a0863ec419a"`);
		await queryRunner.query(`DROP INDEX "IDX_d5a38b4293d90e31a6b1f3189e"`);
		await queryRunner.query(`DROP INDEX "IDX_b3e784ea168736c83f4d647abf"`);
		await queryRunner.query(`DROP INDEX "IDX_cb34a3e97002e3af9cc219f4e4"`);
		await queryRunner.query(`DROP INDEX "IDX_dcbf77e688d65ced41055c3faf"`);
		await queryRunner.query(`DROP INDEX "IDX_1f9ad46e9fbeddbc609af9976a"`);
		await queryRunner.query(`DROP INDEX "IDX_4adb6b1409e7b614d06e44fb84"`);
		await queryRunner.query(`DROP INDEX "IDX_eea665c6f09c4cd9a520a028d1"`);
		await queryRunner.query(`DROP TABLE "videos"`);
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
		await queryRunner.query(
			`CREATE TABLE \`videos\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`title\` varchar(255) NOT NULL, \`file\` varchar(255) NOT NULL, \`recordedAt\` datetime NULL, \`duration\` int NULL, \`size\` int NULL DEFAULT '0', \`fullUrl\` varchar(255) NULL, \`storageProvider\` enum ('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN') NULL, \`description\` varchar(255) NULL, \`timeSlotId\` varchar(255) NULL, \`resolution\` varchar(255) NULL DEFAULT '1920:1080', \`codec\` varchar(255) NULL DEFAULT 'libx264', \`frameRate\` int NULL DEFAULT '15', \`uploadedById\` varchar(255) NULL, INDEX \`IDX_eea665c6f09c4cd9a520a028d1\` (\`isActive\`), INDEX \`IDX_4adb6b1409e7b614d06e44fb84\` (\`isArchived\`), INDEX \`IDX_1f9ad46e9fbeddbc609af9976a\` (\`tenantId\`), INDEX \`IDX_dcbf77e688d65ced41055c3faf\` (\`organizationId\`), INDEX \`IDX_cb34a3e97002e3af9cc219f4e4\` (\`recordedAt\`), INDEX \`IDX_b3e784ea168736c83f4d647abf\` (\`storageProvider\`), INDEX \`IDX_d5a38b4293d90e31a6b1f3189e\` (\`timeSlotId\`), INDEX \`IDX_159f8e5c7959016a0863ec419a\` (\`uploadedById\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`videos\` ADD CONSTRAINT \`FK_1f9ad46e9fbeddbc609af9976ae\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`videos\` ADD CONSTRAINT \`FK_dcbf77e688d65ced41055c3fafe\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`videos\` ADD CONSTRAINT \`FK_d5a38b4293d90e31a6b1f3189e1\` FOREIGN KEY (\`timeSlotId\`) REFERENCES \`time_slot\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`videos\` ADD CONSTRAINT \`FK_159f8e5c7959016a0863ec419a3\` FOREIGN KEY (\`uploadedById\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
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
		await queryRunner.query(`ALTER TABLE \`videos\` DROP FOREIGN KEY \`FK_159f8e5c7959016a0863ec419a3\``);
		await queryRunner.query(`ALTER TABLE \`videos\` DROP FOREIGN KEY \`FK_d5a38b4293d90e31a6b1f3189e1\``);
		await queryRunner.query(`ALTER TABLE \`videos\` DROP FOREIGN KEY \`FK_dcbf77e688d65ced41055c3fafe\``);
		await queryRunner.query(`ALTER TABLE \`videos\` DROP FOREIGN KEY \`FK_1f9ad46e9fbeddbc609af9976ae\``);
		await queryRunner.query(`DROP INDEX \`IDX_159f8e5c7959016a0863ec419a\` ON \`videos\``);
		await queryRunner.query(`DROP INDEX \`IDX_d5a38b4293d90e31a6b1f3189e\` ON \`videos\``);
		await queryRunner.query(`DROP INDEX \`IDX_b3e784ea168736c83f4d647abf\` ON \`videos\``);
		await queryRunner.query(`DROP INDEX \`IDX_cb34a3e97002e3af9cc219f4e4\` ON \`videos\``);
		await queryRunner.query(`DROP INDEX \`IDX_dcbf77e688d65ced41055c3faf\` ON \`videos\``);
		await queryRunner.query(`DROP INDEX \`IDX_1f9ad46e9fbeddbc609af9976a\` ON \`videos\``);
		await queryRunner.query(`DROP INDEX \`IDX_4adb6b1409e7b614d06e44fb84\` ON \`videos\``);
		await queryRunner.query(`DROP INDEX \`IDX_eea665c6f09c4cd9a520a028d1\` ON \`videos\``);
		await queryRunner.query(`DROP TABLE \`videos\``);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}
}
