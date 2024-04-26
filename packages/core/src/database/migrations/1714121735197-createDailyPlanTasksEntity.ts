import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateDailyPlanTasksEntity1714121735197 implements MigrationInterface {
	name = 'CreateDailyPlanTasksEntity1714121735197';

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
		await queryRunner.query(
			`CREATE TABLE "daily_plan" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "date" datetime NOT NULL, "workTimePlanned" datetime NOT NULL, "status" varchar NOT NULL, "employeeId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
		await queryRunner.query(
			`CREATE TABLE "daily_plan_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "dailyPlanId" varchar, "taskId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_fbe6399dd99e8b4bc1ed9a4fc1" ON "daily_plan_task" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_1a541bae1d230b11bbdd256e09" ON "daily_plan_task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_559a1e1055d1ef1bd83e33f9ff" ON "daily_plan_task" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b0a8166ba2272bc6868b7042e6" ON "daily_plan_task" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0" ON "daily_plan_task" ("dailyPlanId") `);
		await queryRunner.query(`CREATE INDEX "IDX_791067c0a03b37ab50578e60d4" ON "daily_plan_task" ("taskId") `);
		await queryRunner.query(`DROP INDEX "IDX_01856a9a730b7e79d70aa661cb"`);
		await queryRunner.query(`DROP INDEX "IDX_d3675304df9971cccf96d9a7c3"`);
		await queryRunner.query(`DROP INDEX "IDX_9d44ce9eb8689e578b941a6a54"`);
		await queryRunner.query(`DROP INDEX "IDX_af1a212cb378bb0eed51c1b2bc"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_image_asset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "url" varchar NOT NULL, "width" integer NOT NULL DEFAULT (0), "height" integer NOT NULL DEFAULT (0), "isFeatured" boolean NOT NULL DEFAULT (0), "thumb" varchar, "size" numeric, "externalProviderId" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('DEBUG','LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "deletedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), CONSTRAINT "FK_01856a9a730b7e79d70aa661cb0" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d3675304df9971cccf96d9a7c34" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_image_asset"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured", "thumb", "size", "externalProviderId", "storageProvider", "deletedAt", "isActive", "isArchived") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured", "thumb", "size", "externalProviderId", "storageProvider", "deletedAt", "isActive", "isArchived" FROM "image_asset"`
		);
		await queryRunner.query(`DROP TABLE "image_asset"`);
		await queryRunner.query(`ALTER TABLE "temporary_image_asset" RENAME TO "image_asset"`);
		await queryRunner.query(`CREATE INDEX "IDX_01856a9a730b7e79d70aa661cb" ON "image_asset" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d3675304df9971cccf96d9a7c3" ON "image_asset" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9d44ce9eb8689e578b941a6a54" ON "image_asset" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_af1a212cb378bb0eed51c1b2bc" ON "image_asset" ("isArchived") `);
		await queryRunner.query(`DROP INDEX "IDX_903b08cd4c8025e73316342452"`);
		await queryRunner.query(`DROP INDEX "IDX_ce5e588780497b05cd6267e20e"`);
		await queryRunner.query(`DROP INDEX "IDX_ecb357a3764a7344c633a257d7"`);
		await queryRunner.query(`DROP INDEX "IDX_9779a35ef1338bafb7b90714f1"`);
		await queryRunner.query(`DROP INDEX "IDX_f2cf366f3f08e31784b056df88"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_daily_plan" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "date" datetime NOT NULL, "workTimePlanned" datetime NOT NULL, "status" varchar NOT NULL, "employeeId" varchar, CONSTRAINT "FK_ecb357a3764a7344c633a257d76" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9779a35ef1338bafb7b90714f16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f2cf366f3f08e31784b056df880" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_daily_plan"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId" FROM "daily_plan"`
		);
		await queryRunner.query(`DROP TABLE "daily_plan"`);
		await queryRunner.query(`ALTER TABLE "temporary_daily_plan" RENAME TO "daily_plan"`);
		await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
		await queryRunner.query(`DROP INDEX "IDX_fbe6399dd99e8b4bc1ed9a4fc1"`);
		await queryRunner.query(`DROP INDEX "IDX_1a541bae1d230b11bbdd256e09"`);
		await queryRunner.query(`DROP INDEX "IDX_559a1e1055d1ef1bd83e33f9ff"`);
		await queryRunner.query(`DROP INDEX "IDX_b0a8166ba2272bc6868b7042e6"`);
		await queryRunner.query(`DROP INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0"`);
		await queryRunner.query(`DROP INDEX "IDX_791067c0a03b37ab50578e60d4"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_daily_plan_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "dailyPlanId" varchar, "taskId" varchar, CONSTRAINT "FK_559a1e1055d1ef1bd83e33f9ffc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b0a8166ba2272bc6868b7042e6d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_44d86eb47db0ffbf7e79bf7ff0d" FOREIGN KEY ("dailyPlanId") REFERENCES "daily_plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_791067c0a03b37ab50578e60d4d" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_daily_plan_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "dailyPlanId", "taskId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "dailyPlanId", "taskId" FROM "daily_plan_task"`
		);
		await queryRunner.query(`DROP TABLE "daily_plan_task"`);
		await queryRunner.query(`ALTER TABLE "temporary_daily_plan_task" RENAME TO "daily_plan_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_fbe6399dd99e8b4bc1ed9a4fc1" ON "daily_plan_task" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_1a541bae1d230b11bbdd256e09" ON "daily_plan_task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_559a1e1055d1ef1bd83e33f9ff" ON "daily_plan_task" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b0a8166ba2272bc6868b7042e6" ON "daily_plan_task" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0" ON "daily_plan_task" ("dailyPlanId") `);
		await queryRunner.query(`CREATE INDEX "IDX_791067c0a03b37ab50578e60d4" ON "daily_plan_task" ("taskId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_791067c0a03b37ab50578e60d4"`);
		await queryRunner.query(`DROP INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0"`);
		await queryRunner.query(`DROP INDEX "IDX_b0a8166ba2272bc6868b7042e6"`);
		await queryRunner.query(`DROP INDEX "IDX_559a1e1055d1ef1bd83e33f9ff"`);
		await queryRunner.query(`DROP INDEX "IDX_1a541bae1d230b11bbdd256e09"`);
		await queryRunner.query(`DROP INDEX "IDX_fbe6399dd99e8b4bc1ed9a4fc1"`);
		await queryRunner.query(`ALTER TABLE "daily_plan_task" RENAME TO "temporary_daily_plan_task"`);
		await queryRunner.query(
			`CREATE TABLE "daily_plan_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "dailyPlanId" varchar, "taskId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "daily_plan_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "dailyPlanId", "taskId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "dailyPlanId", "taskId" FROM "temporary_daily_plan_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_daily_plan_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_791067c0a03b37ab50578e60d4" ON "daily_plan_task" ("taskId") `);
		await queryRunner.query(`CREATE INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0" ON "daily_plan_task" ("dailyPlanId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b0a8166ba2272bc6868b7042e6" ON "daily_plan_task" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_559a1e1055d1ef1bd83e33f9ff" ON "daily_plan_task" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1a541bae1d230b11bbdd256e09" ON "daily_plan_task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_fbe6399dd99e8b4bc1ed9a4fc1" ON "daily_plan_task" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_f2cf366f3f08e31784b056df88"`);
		await queryRunner.query(`DROP INDEX "IDX_9779a35ef1338bafb7b90714f1"`);
		await queryRunner.query(`DROP INDEX "IDX_ecb357a3764a7344c633a257d7"`);
		await queryRunner.query(`DROP INDEX "IDX_ce5e588780497b05cd6267e20e"`);
		await queryRunner.query(`DROP INDEX "IDX_903b08cd4c8025e73316342452"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" RENAME TO "temporary_daily_plan"`);
		await queryRunner.query(
			`CREATE TABLE "daily_plan" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "date" datetime NOT NULL, "workTimePlanned" datetime NOT NULL, "status" varchar NOT NULL, "employeeId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "daily_plan"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId" FROM "temporary_daily_plan"`
		);
		await queryRunner.query(`DROP TABLE "temporary_daily_plan"`);
		await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_af1a212cb378bb0eed51c1b2bc"`);
		await queryRunner.query(`DROP INDEX "IDX_9d44ce9eb8689e578b941a6a54"`);
		await queryRunner.query(`DROP INDEX "IDX_d3675304df9971cccf96d9a7c3"`);
		await queryRunner.query(`DROP INDEX "IDX_01856a9a730b7e79d70aa661cb"`);
		await queryRunner.query(`ALTER TABLE "image_asset" RENAME TO "temporary_image_asset"`);
		await queryRunner.query(
			`CREATE TABLE "image_asset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "url" varchar NOT NULL, "width" integer NOT NULL DEFAULT (0), "height" integer NOT NULL DEFAULT (0), "isFeatured" boolean NOT NULL DEFAULT (0), "thumb" varchar, "size" numeric, "externalProviderId" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "deletedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), CONSTRAINT "FK_01856a9a730b7e79d70aa661cb0" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d3675304df9971cccf96d9a7c34" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`INSERT INTO "image_asset"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured", "thumb", "size", "externalProviderId", "storageProvider", "deletedAt", "isActive", "isArchived") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured", "thumb", "size", "externalProviderId", "storageProvider", "deletedAt", "isActive", "isArchived" FROM "temporary_image_asset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_image_asset"`);
		await queryRunner.query(`CREATE INDEX "IDX_af1a212cb378bb0eed51c1b2bc" ON "image_asset" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_9d44ce9eb8689e578b941a6a54" ON "image_asset" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_d3675304df9971cccf96d9a7c3" ON "image_asset" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_01856a9a730b7e79d70aa661cb" ON "image_asset" ("tenantId") `);
		await queryRunner.query(`DROP INDEX "IDX_791067c0a03b37ab50578e60d4"`);
		await queryRunner.query(`DROP INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0"`);
		await queryRunner.query(`DROP INDEX "IDX_b0a8166ba2272bc6868b7042e6"`);
		await queryRunner.query(`DROP INDEX "IDX_559a1e1055d1ef1bd83e33f9ff"`);
		await queryRunner.query(`DROP INDEX "IDX_1a541bae1d230b11bbdd256e09"`);
		await queryRunner.query(`DROP INDEX "IDX_fbe6399dd99e8b4bc1ed9a4fc1"`);
		await queryRunner.query(`DROP TABLE "daily_plan_task"`);
		await queryRunner.query(`DROP INDEX "IDX_f2cf366f3f08e31784b056df88"`);
		await queryRunner.query(`DROP INDEX "IDX_9779a35ef1338bafb7b90714f1"`);
		await queryRunner.query(`DROP INDEX "IDX_ecb357a3764a7344c633a257d7"`);
		await queryRunner.query(`DROP INDEX "IDX_ce5e588780497b05cd6267e20e"`);
		await queryRunner.query(`DROP INDEX "IDX_903b08cd4c8025e73316342452"`);
		await queryRunner.query(`DROP TABLE "daily_plan"`);
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
