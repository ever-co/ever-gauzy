import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateTableCamshots1749490131969 implements MigrationInterface {
	name = 'CreateTableCamshots1749490131969';

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
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

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
			`CREATE TABLE "camshots" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "fileKey" varchar NOT NULL, "thumbKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "recordedAt" datetime, "fullUrl" varchar, "thumbUrl" varchar, "size" integer, "timeSlotId" varchar, "uploadedById" varchar, "userId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_b534f6f40427fa2e210503b42f" ON "camshots" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cd93e672c80ffb5ce5975ca534" ON "camshots" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_20a696a4ed9efc63b759988ab9" ON "camshots" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ec9c18c82b455f9a5c1c429980" ON "camshots" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_49cb91250cb9427c775abd8572" ON "camshots" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ec581c527298029aa27b72b7dd" ON "camshots" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cad3841ce55a5903aa44d6d63d" ON "camshots" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_296c55d1f3203f65af3a8313a1" ON "camshots" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_1ceaa21268b767159b202e3e51" ON "camshots" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2b4988100343a2ee1e5dc10b2" ON "camshots" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9055d166843ea7dc55234a9807" ON "camshots" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_c8001dc9eda72fe5d23031cfba" ON "camshots" ("userId") `);
		await queryRunner.query(`DROP INDEX "IDX_b534f6f40427fa2e210503b42f"`);
		await queryRunner.query(`DROP INDEX "IDX_cd93e672c80ffb5ce5975ca534"`);
		await queryRunner.query(`DROP INDEX "IDX_20a696a4ed9efc63b759988ab9"`);
		await queryRunner.query(`DROP INDEX "IDX_ec9c18c82b455f9a5c1c429980"`);
		await queryRunner.query(`DROP INDEX "IDX_49cb91250cb9427c775abd8572"`);
		await queryRunner.query(`DROP INDEX "IDX_ec581c527298029aa27b72b7dd"`);
		await queryRunner.query(`DROP INDEX "IDX_cad3841ce55a5903aa44d6d63d"`);
		await queryRunner.query(`DROP INDEX "IDX_296c55d1f3203f65af3a8313a1"`);
		await queryRunner.query(`DROP INDEX "IDX_1ceaa21268b767159b202e3e51"`);
		await queryRunner.query(`DROP INDEX "IDX_b2b4988100343a2ee1e5dc10b2"`);
		await queryRunner.query(`DROP INDEX "IDX_9055d166843ea7dc55234a9807"`);
		await queryRunner.query(`DROP INDEX "IDX_c8001dc9eda72fe5d23031cfba"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_camshots" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "fileKey" varchar NOT NULL, "thumbKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "recordedAt" datetime, "fullUrl" varchar, "thumbUrl" varchar, "size" integer, "timeSlotId" varchar, "uploadedById" varchar, "userId" varchar, CONSTRAINT "FK_b534f6f40427fa2e210503b42f3" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd93e672c80ffb5ce5975ca534a" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_20a696a4ed9efc63b759988ab96" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ec581c527298029aa27b72b7ddc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cad3841ce55a5903aa44d6d63d3" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b2b4988100343a2ee1e5dc10b22" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9055d166843ea7dc55234a98073" FOREIGN KEY ("uploadedById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c8001dc9eda72fe5d23031cfba5" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_camshots"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "fileKey", "thumbKey", "storageProvider", "recordedAt", "fullUrl", "thumbUrl", "size", "timeSlotId", "uploadedById", "userId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "fileKey", "thumbKey", "storageProvider", "recordedAt", "fullUrl", "thumbUrl", "size", "timeSlotId", "uploadedById", "userId" FROM "camshots"`
		);
		await queryRunner.query(`DROP TABLE "camshots"`);
		await queryRunner.query(`ALTER TABLE "temporary_camshots" RENAME TO "camshots"`);
		await queryRunner.query(`CREATE INDEX "IDX_b534f6f40427fa2e210503b42f" ON "camshots" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cd93e672c80ffb5ce5975ca534" ON "camshots" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_20a696a4ed9efc63b759988ab9" ON "camshots" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ec9c18c82b455f9a5c1c429980" ON "camshots" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_49cb91250cb9427c775abd8572" ON "camshots" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ec581c527298029aa27b72b7dd" ON "camshots" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cad3841ce55a5903aa44d6d63d" ON "camshots" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_296c55d1f3203f65af3a8313a1" ON "camshots" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_1ceaa21268b767159b202e3e51" ON "camshots" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2b4988100343a2ee1e5dc10b2" ON "camshots" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9055d166843ea7dc55234a9807" ON "camshots" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_c8001dc9eda72fe5d23031cfba" ON "camshots" ("userId") `);
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
		await queryRunner.query(`DROP INDEX "IDX_c8001dc9eda72fe5d23031cfba"`);
		await queryRunner.query(`DROP INDEX "IDX_9055d166843ea7dc55234a9807"`);
		await queryRunner.query(`DROP INDEX "IDX_b2b4988100343a2ee1e5dc10b2"`);
		await queryRunner.query(`DROP INDEX "IDX_1ceaa21268b767159b202e3e51"`);
		await queryRunner.query(`DROP INDEX "IDX_296c55d1f3203f65af3a8313a1"`);
		await queryRunner.query(`DROP INDEX "IDX_cad3841ce55a5903aa44d6d63d"`);
		await queryRunner.query(`DROP INDEX "IDX_ec581c527298029aa27b72b7dd"`);
		await queryRunner.query(`DROP INDEX "IDX_49cb91250cb9427c775abd8572"`);
		await queryRunner.query(`DROP INDEX "IDX_ec9c18c82b455f9a5c1c429980"`);
		await queryRunner.query(`DROP INDEX "IDX_20a696a4ed9efc63b759988ab9"`);
		await queryRunner.query(`DROP INDEX "IDX_cd93e672c80ffb5ce5975ca534"`);
		await queryRunner.query(`DROP INDEX "IDX_b534f6f40427fa2e210503b42f"`);
		await queryRunner.query(`ALTER TABLE "camshots" RENAME TO "temporary_camshots"`);
		await queryRunner.query(
			`CREATE TABLE "camshots" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "fileKey" varchar NOT NULL, "thumbKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "recordedAt" datetime, "fullUrl" varchar, "thumbUrl" varchar, "size" integer, "timeSlotId" varchar, "uploadedById" varchar, "userId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "camshots"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "fileKey", "thumbKey", "storageProvider", "recordedAt", "fullUrl", "thumbUrl", "size", "timeSlotId", "uploadedById", "userId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "fileKey", "thumbKey", "storageProvider", "recordedAt", "fullUrl", "thumbUrl", "size", "timeSlotId", "uploadedById", "userId" FROM "temporary_camshots"`
		);
		await queryRunner.query(`DROP TABLE "temporary_camshots"`);
		await queryRunner.query(`CREATE INDEX "IDX_c8001dc9eda72fe5d23031cfba" ON "camshots" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9055d166843ea7dc55234a9807" ON "camshots" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2b4988100343a2ee1e5dc10b2" ON "camshots" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1ceaa21268b767159b202e3e51" ON "camshots" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_296c55d1f3203f65af3a8313a1" ON "camshots" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_cad3841ce55a5903aa44d6d63d" ON "camshots" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ec581c527298029aa27b72b7dd" ON "camshots" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_49cb91250cb9427c775abd8572" ON "camshots" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ec9c18c82b455f9a5c1c429980" ON "camshots" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_20a696a4ed9efc63b759988ab9" ON "camshots" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cd93e672c80ffb5ce5975ca534" ON "camshots" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b534f6f40427fa2e210503b42f" ON "camshots" ("createdByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_c8001dc9eda72fe5d23031cfba"`);
		await queryRunner.query(`DROP INDEX "IDX_9055d166843ea7dc55234a9807"`);
		await queryRunner.query(`DROP INDEX "IDX_b2b4988100343a2ee1e5dc10b2"`);
		await queryRunner.query(`DROP INDEX "IDX_1ceaa21268b767159b202e3e51"`);
		await queryRunner.query(`DROP INDEX "IDX_296c55d1f3203f65af3a8313a1"`);
		await queryRunner.query(`DROP INDEX "IDX_cad3841ce55a5903aa44d6d63d"`);
		await queryRunner.query(`DROP INDEX "IDX_ec581c527298029aa27b72b7dd"`);
		await queryRunner.query(`DROP INDEX "IDX_49cb91250cb9427c775abd8572"`);
		await queryRunner.query(`DROP INDEX "IDX_ec9c18c82b455f9a5c1c429980"`);
		await queryRunner.query(`DROP INDEX "IDX_20a696a4ed9efc63b759988ab9"`);
		await queryRunner.query(`DROP INDEX "IDX_cd93e672c80ffb5ce5975ca534"`);
		await queryRunner.query(`DROP INDEX "IDX_b534f6f40427fa2e210503b42f"`);
		await queryRunner.query(`DROP TABLE "camshots"`);
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
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}
}
