import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTableSoundshots1749670722376 implements MigrationInterface {
	name = 'CreateTableSoundshots1749670722376';

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
		await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
		await queryRunner.query(
			`CREATE TYPE "public"."soundshots_storageprovider_enum" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN')`
		);
		await queryRunner.query(
			`CREATE TABLE "soundshots" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "fileKey" character varying NOT NULL, "storageProvider" "public"."soundshots_storageprovider_enum", "recordedAt" TIMESTAMP, "fullUrl" character varying, "size" integer, "channels" integer, "rate" integer, "duration" double precision, "timeSlotId" uuid, "uploadedById" uuid, "userId" uuid, CONSTRAINT "PK_c257053068c98f8792fd2b408e4" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_e8346a8a54e1fdfe54297b0297" ON "soundshots" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8e6ff08e6d1dcf820bb24c545a" ON "soundshots" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_216d2023361c849e419146f330" ON "soundshots" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c9e109a42474777c10980d6b8" ON "soundshots" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b84e5ab1677381630c333257e4" ON "soundshots" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7de627bf0f59aa175f971b6d64" ON "soundshots" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6d2c1146b1e3de4209b6aada01" ON "soundshots" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e4fc52e90217d1f22ee223fb1e" ON "soundshots" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_8abb4ce1e6fa3af641199070c1" ON "soundshots" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6f509649ae24881b1a74049f2" ON "soundshots" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fa9d656c6685b38aa0a36d0054" ON "soundshots" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_1f078ed6d16319d2fcf8344f7a" ON "soundshots" ("userId") `);
		await queryRunner.query(
			`ALTER TABLE "soundshots" ADD CONSTRAINT "FK_e8346a8a54e1fdfe54297b0297f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "soundshots" ADD CONSTRAINT "FK_8e6ff08e6d1dcf820bb24c545a4" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "soundshots" ADD CONSTRAINT "FK_216d2023361c849e419146f330c" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "soundshots" ADD CONSTRAINT "FK_7de627bf0f59aa175f971b6d642" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "soundshots" ADD CONSTRAINT "FK_6d2c1146b1e3de4209b6aada016" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "soundshots" ADD CONSTRAINT "FK_b6f509649ae24881b1a74049f24" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "soundshots" ADD CONSTRAINT "FK_fa9d656c6685b38aa0a36d0054b" FOREIGN KEY ("uploadedById") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "soundshots" ADD CONSTRAINT "FK_1f078ed6d16319d2fcf8344f7a2" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
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
		await queryRunner.query(`ALTER TABLE "soundshots" DROP CONSTRAINT "FK_1f078ed6d16319d2fcf8344f7a2"`);
		await queryRunner.query(`ALTER TABLE "soundshots" DROP CONSTRAINT "FK_fa9d656c6685b38aa0a36d0054b"`);
		await queryRunner.query(`ALTER TABLE "soundshots" DROP CONSTRAINT "FK_b6f509649ae24881b1a74049f24"`);
		await queryRunner.query(`ALTER TABLE "soundshots" DROP CONSTRAINT "FK_6d2c1146b1e3de4209b6aada016"`);
		await queryRunner.query(`ALTER TABLE "soundshots" DROP CONSTRAINT "FK_7de627bf0f59aa175f971b6d642"`);
		await queryRunner.query(`ALTER TABLE "soundshots" DROP CONSTRAINT "FK_216d2023361c849e419146f330c"`);
		await queryRunner.query(`ALTER TABLE "soundshots" DROP CONSTRAINT "FK_8e6ff08e6d1dcf820bb24c545a4"`);
		await queryRunner.query(`ALTER TABLE "soundshots" DROP CONSTRAINT "FK_e8346a8a54e1fdfe54297b0297f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1f078ed6d16319d2fcf8344f7a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fa9d656c6685b38aa0a36d0054"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b6f509649ae24881b1a74049f2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8abb4ce1e6fa3af641199070c1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e4fc52e90217d1f22ee223fb1e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6d2c1146b1e3de4209b6aada01"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7de627bf0f59aa175f971b6d64"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b84e5ab1677381630c333257e4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7c9e109a42474777c10980d6b8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_216d2023361c849e419146f330"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8e6ff08e6d1dcf820bb24c545a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e8346a8a54e1fdfe54297b0297"`);
		await queryRunner.query(`DROP TABLE "soundshots"`);
		await queryRunner.query(`DROP TYPE "public"."soundshots_storageprovider_enum"`);
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
		await queryRunner.query(
			`CREATE TABLE "soundshots" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "fileKey" varchar NOT NULL, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "recordedAt" datetime, "fullUrl" varchar, "size" integer, "channels" integer, "rate" integer, "duration" float, "timeSlotId" varchar, "uploadedById" varchar, "userId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_e8346a8a54e1fdfe54297b0297" ON "soundshots" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8e6ff08e6d1dcf820bb24c545a" ON "soundshots" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_216d2023361c849e419146f330" ON "soundshots" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c9e109a42474777c10980d6b8" ON "soundshots" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b84e5ab1677381630c333257e4" ON "soundshots" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7de627bf0f59aa175f971b6d64" ON "soundshots" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6d2c1146b1e3de4209b6aada01" ON "soundshots" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e4fc52e90217d1f22ee223fb1e" ON "soundshots" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_8abb4ce1e6fa3af641199070c1" ON "soundshots" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6f509649ae24881b1a74049f2" ON "soundshots" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fa9d656c6685b38aa0a36d0054" ON "soundshots" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_1f078ed6d16319d2fcf8344f7a" ON "soundshots" ("userId") `);
		await queryRunner.query(`DROP INDEX "IDX_e8346a8a54e1fdfe54297b0297"`);
		await queryRunner.query(`DROP INDEX "IDX_8e6ff08e6d1dcf820bb24c545a"`);
		await queryRunner.query(`DROP INDEX "IDX_216d2023361c849e419146f330"`);
		await queryRunner.query(`DROP INDEX "IDX_7c9e109a42474777c10980d6b8"`);
		await queryRunner.query(`DROP INDEX "IDX_b84e5ab1677381630c333257e4"`);
		await queryRunner.query(`DROP INDEX "IDX_7de627bf0f59aa175f971b6d64"`);
		await queryRunner.query(`DROP INDEX "IDX_6d2c1146b1e3de4209b6aada01"`);
		await queryRunner.query(`DROP INDEX "IDX_e4fc52e90217d1f22ee223fb1e"`);
		await queryRunner.query(`DROP INDEX "IDX_8abb4ce1e6fa3af641199070c1"`);
		await queryRunner.query(`DROP INDEX "IDX_b6f509649ae24881b1a74049f2"`);
		await queryRunner.query(`DROP INDEX "IDX_fa9d656c6685b38aa0a36d0054"`);
		await queryRunner.query(`DROP INDEX "IDX_1f078ed6d16319d2fcf8344f7a"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_soundshots" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "fileKey" varchar NOT NULL, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "recordedAt" datetime, "fullUrl" varchar, "size" integer, "channels" integer, "rate" integer, "duration" float, "timeSlotId" varchar, "uploadedById" varchar, "userId" varchar, CONSTRAINT "FK_e8346a8a54e1fdfe54297b0297f" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8e6ff08e6d1dcf820bb24c545a4" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_216d2023361c849e419146f330c" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7de627bf0f59aa175f971b6d642" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6d2c1146b1e3de4209b6aada016" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b6f509649ae24881b1a74049f24" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fa9d656c6685b38aa0a36d0054b" FOREIGN KEY ("uploadedById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1f078ed6d16319d2fcf8344f7a2" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_soundshots"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "fileKey", "storageProvider", "recordedAt", "fullUrl", "size", "channels", "rate", "duration", "timeSlotId", "uploadedById", "userId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "fileKey", "storageProvider", "recordedAt", "fullUrl", "size", "channels", "rate", "duration", "timeSlotId", "uploadedById", "userId" FROM "soundshots"`
		);
		await queryRunner.query(`DROP TABLE "soundshots"`);
		await queryRunner.query(`ALTER TABLE "temporary_soundshots" RENAME TO "soundshots"`);
		await queryRunner.query(`CREATE INDEX "IDX_e8346a8a54e1fdfe54297b0297" ON "soundshots" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8e6ff08e6d1dcf820bb24c545a" ON "soundshots" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_216d2023361c849e419146f330" ON "soundshots" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c9e109a42474777c10980d6b8" ON "soundshots" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b84e5ab1677381630c333257e4" ON "soundshots" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7de627bf0f59aa175f971b6d64" ON "soundshots" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6d2c1146b1e3de4209b6aada01" ON "soundshots" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e4fc52e90217d1f22ee223fb1e" ON "soundshots" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_8abb4ce1e6fa3af641199070c1" ON "soundshots" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6f509649ae24881b1a74049f2" ON "soundshots" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fa9d656c6685b38aa0a36d0054" ON "soundshots" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_1f078ed6d16319d2fcf8344f7a" ON "soundshots" ("userId") `);
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
		await queryRunner.query(`DROP INDEX "IDX_1f078ed6d16319d2fcf8344f7a"`);
		await queryRunner.query(`DROP INDEX "IDX_fa9d656c6685b38aa0a36d0054"`);
		await queryRunner.query(`DROP INDEX "IDX_b6f509649ae24881b1a74049f2"`);
		await queryRunner.query(`DROP INDEX "IDX_8abb4ce1e6fa3af641199070c1"`);
		await queryRunner.query(`DROP INDEX "IDX_e4fc52e90217d1f22ee223fb1e"`);
		await queryRunner.query(`DROP INDEX "IDX_6d2c1146b1e3de4209b6aada01"`);
		await queryRunner.query(`DROP INDEX "IDX_7de627bf0f59aa175f971b6d64"`);
		await queryRunner.query(`DROP INDEX "IDX_b84e5ab1677381630c333257e4"`);
		await queryRunner.query(`DROP INDEX "IDX_7c9e109a42474777c10980d6b8"`);
		await queryRunner.query(`DROP INDEX "IDX_216d2023361c849e419146f330"`);
		await queryRunner.query(`DROP INDEX "IDX_8e6ff08e6d1dcf820bb24c545a"`);
		await queryRunner.query(`DROP INDEX "IDX_e8346a8a54e1fdfe54297b0297"`);
		await queryRunner.query(`ALTER TABLE "soundshots" RENAME TO "temporary_soundshots"`);
		await queryRunner.query(
			`CREATE TABLE "soundshots" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "fileKey" varchar NOT NULL, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "recordedAt" datetime, "fullUrl" varchar, "size" integer, "channels" integer, "rate" integer, "duration" float, "timeSlotId" varchar, "uploadedById" varchar, "userId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "soundshots"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "fileKey", "storageProvider", "recordedAt", "fullUrl", "size", "channels", "rate", "duration", "timeSlotId", "uploadedById", "userId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "fileKey", "storageProvider", "recordedAt", "fullUrl", "size", "channels", "rate", "duration", "timeSlotId", "uploadedById", "userId" FROM "temporary_soundshots"`
		);
		await queryRunner.query(`DROP TABLE "temporary_soundshots"`);
		await queryRunner.query(`CREATE INDEX "IDX_1f078ed6d16319d2fcf8344f7a" ON "soundshots" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fa9d656c6685b38aa0a36d0054" ON "soundshots" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6f509649ae24881b1a74049f2" ON "soundshots" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8abb4ce1e6fa3af641199070c1" ON "soundshots" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_e4fc52e90217d1f22ee223fb1e" ON "soundshots" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_6d2c1146b1e3de4209b6aada01" ON "soundshots" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7de627bf0f59aa175f971b6d64" ON "soundshots" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b84e5ab1677381630c333257e4" ON "soundshots" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c9e109a42474777c10980d6b8" ON "soundshots" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_216d2023361c849e419146f330" ON "soundshots" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8e6ff08e6d1dcf820bb24c545a" ON "soundshots" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e8346a8a54e1fdfe54297b0297" ON "soundshots" ("createdByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_1f078ed6d16319d2fcf8344f7a"`);
		await queryRunner.query(`DROP INDEX "IDX_fa9d656c6685b38aa0a36d0054"`);
		await queryRunner.query(`DROP INDEX "IDX_b6f509649ae24881b1a74049f2"`);
		await queryRunner.query(`DROP INDEX "IDX_8abb4ce1e6fa3af641199070c1"`);
		await queryRunner.query(`DROP INDEX "IDX_e4fc52e90217d1f22ee223fb1e"`);
		await queryRunner.query(`DROP INDEX "IDX_6d2c1146b1e3de4209b6aada01"`);
		await queryRunner.query(`DROP INDEX "IDX_7de627bf0f59aa175f971b6d64"`);
		await queryRunner.query(`DROP INDEX "IDX_b84e5ab1677381630c333257e4"`);
		await queryRunner.query(`DROP INDEX "IDX_7c9e109a42474777c10980d6b8"`);
		await queryRunner.query(`DROP INDEX "IDX_216d2023361c849e419146f330"`);
		await queryRunner.query(`DROP INDEX "IDX_8e6ff08e6d1dcf820bb24c545a"`);
		await queryRunner.query(`DROP INDEX "IDX_e8346a8a54e1fdfe54297b0297"`);
		await queryRunner.query(`DROP TABLE "soundshots"`);
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
			`CREATE TABLE \`soundshots\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`fileKey\` varchar(255) NOT NULL, \`storageProvider\` enum ('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN') NULL, \`recordedAt\` datetime NULL, \`fullUrl\` varchar(255) NULL, \`size\` int NULL, \`channels\` int NULL, \`rate\` int NULL, \`duration\` float NULL, \`timeSlotId\` varchar(255) NULL, \`uploadedById\` varchar(255) NULL, \`userId\` varchar(255) NULL, INDEX \`IDX_e8346a8a54e1fdfe54297b0297\` (\`createdByUserId\`), INDEX \`IDX_8e6ff08e6d1dcf820bb24c545a\` (\`updatedByUserId\`), INDEX \`IDX_216d2023361c849e419146f330\` (\`deletedByUserId\`), INDEX \`IDX_7c9e109a42474777c10980d6b8\` (\`isActive\`), INDEX \`IDX_b84e5ab1677381630c333257e4\` (\`isArchived\`), INDEX \`IDX_7de627bf0f59aa175f971b6d64\` (\`tenantId\`), INDEX \`IDX_6d2c1146b1e3de4209b6aada01\` (\`organizationId\`), INDEX \`IDX_e4fc52e90217d1f22ee223fb1e\` (\`storageProvider\`), INDEX \`IDX_8abb4ce1e6fa3af641199070c1\` (\`recordedAt\`), INDEX \`IDX_b6f509649ae24881b1a74049f2\` (\`timeSlotId\`), INDEX \`IDX_fa9d656c6685b38aa0a36d0054\` (\`uploadedById\`), INDEX \`IDX_1f078ed6d16319d2fcf8344f7a\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`soundshots\` ADD CONSTRAINT \`FK_e8346a8a54e1fdfe54297b0297f\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`soundshots\` ADD CONSTRAINT \`FK_8e6ff08e6d1dcf820bb24c545a4\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`soundshots\` ADD CONSTRAINT \`FK_216d2023361c849e419146f330c\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`soundshots\` ADD CONSTRAINT \`FK_7de627bf0f59aa175f971b6d642\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`soundshots\` ADD CONSTRAINT \`FK_6d2c1146b1e3de4209b6aada016\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`soundshots\` ADD CONSTRAINT \`FK_b6f509649ae24881b1a74049f24\` FOREIGN KEY (\`timeSlotId\`) REFERENCES \`time_slot\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`soundshots\` ADD CONSTRAINT \`FK_fa9d656c6685b38aa0a36d0054b\` FOREIGN KEY (\`uploadedById\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`soundshots\` ADD CONSTRAINT \`FK_1f078ed6d16319d2fcf8344f7a2\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
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
		await queryRunner.query(`ALTER TABLE \`soundshots\` DROP FOREIGN KEY \`FK_1f078ed6d16319d2fcf8344f7a2\``);
		await queryRunner.query(`ALTER TABLE \`soundshots\` DROP FOREIGN KEY \`FK_fa9d656c6685b38aa0a36d0054b\``);
		await queryRunner.query(`ALTER TABLE \`soundshots\` DROP FOREIGN KEY \`FK_b6f509649ae24881b1a74049f24\``);
		await queryRunner.query(`ALTER TABLE \`soundshots\` DROP FOREIGN KEY \`FK_6d2c1146b1e3de4209b6aada016\``);
		await queryRunner.query(`ALTER TABLE \`soundshots\` DROP FOREIGN KEY \`FK_7de627bf0f59aa175f971b6d642\``);
		await queryRunner.query(`ALTER TABLE \`soundshots\` DROP FOREIGN KEY \`FK_216d2023361c849e419146f330c\``);
		await queryRunner.query(`ALTER TABLE \`soundshots\` DROP FOREIGN KEY \`FK_8e6ff08e6d1dcf820bb24c545a4\``);
		await queryRunner.query(`ALTER TABLE \`soundshots\` DROP FOREIGN KEY \`FK_e8346a8a54e1fdfe54297b0297f\``);
		await queryRunner.query(`DROP INDEX \`IDX_1f078ed6d16319d2fcf8344f7a\` ON \`soundshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_fa9d656c6685b38aa0a36d0054\` ON \`soundshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_b6f509649ae24881b1a74049f2\` ON \`soundshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_8abb4ce1e6fa3af641199070c1\` ON \`soundshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_e4fc52e90217d1f22ee223fb1e\` ON \`soundshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_6d2c1146b1e3de4209b6aada01\` ON \`soundshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_7de627bf0f59aa175f971b6d64\` ON \`soundshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_b84e5ab1677381630c333257e4\` ON \`soundshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_7c9e109a42474777c10980d6b8\` ON \`soundshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_216d2023361c849e419146f330\` ON \`soundshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_8e6ff08e6d1dcf820bb24c545a\` ON \`soundshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_e8346a8a54e1fdfe54297b0297\` ON \`soundshots\``);
		await queryRunner.query(`DROP TABLE \`soundshots\``);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}
}
