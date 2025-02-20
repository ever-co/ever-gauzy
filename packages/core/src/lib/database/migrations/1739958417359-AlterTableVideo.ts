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
		await queryRunner.query(`ALTER TABLE "video" ALTER COLUMN "duration" TYPE REAL`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "video" ALTER COLUMN "duration" TYPE INTEGER`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop all the indexes on the old "video" table
		await queryRunner.query(`DROP INDEX "IDX_f42d8d7033aacb69287d0dcfd9"`);
		await queryRunner.query(`DROP INDEX "IDX_a0c8486c125418dc0cc2e38470"`);
		await queryRunner.query(`DROP INDEX "IDX_1be826cc802f4cf0abb36ab365"`);
		await queryRunner.query(`DROP INDEX "IDX_95bba1c05216311bf162f6d835"`);
		await queryRunner.query(`DROP INDEX "IDX_061902beee13424f6372ac19f0"`);
		await queryRunner.query(`DROP INDEX "IDX_6fd9144466152ccef62e39d853"`);
		await queryRunner.query(`DROP INDEX "IDX_158647e790ce90499ed5a53c9b"`);
		await queryRunner.query(`DROP INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca"`);

		// Step 2: Create a new temporary "temporary_video" table
		await queryRunner.query(
			`CREATE TABLE "temporary_video" (
				"deletedAt" datetime,
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"archivedAt" datetime,
				"tenantId" varchar,
				"organizationId" varchar,
				"title" varchar NOT NULL,
				"file" varchar NOT NULL,
				"recordedAt" datetime,
				"duration" real,
				"size" integer,
				"fullUrl" varchar,
				"description" varchar,
				"storageProvider" varchar CHECK(
					"storageProvider" IN (
						'LOCAL',
						'S3',
						'WASABI',
						'CLOUDINARY',
						'DIGITALOCEAN'
					)
				),
				"resolution" varchar DEFAULT ('1920:1080'),
				"codec" varchar DEFAULT ('libx264'),
				"frameRate" integer DEFAULT (15),
				"timeSlotId" varchar,
				"uploadedById" varchar,
				CONSTRAINT "FK_f42d8d7033aacb69287d0dcfd9a" FOREIGN KEY ("uploadedById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_a0c8486c125418dc0cc2e384703" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_061902beee13424f6372ac19f02" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_6fd9144466152ccef62e39d853e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)`
		);

		// Step 3: Insert the data from the old video table into the new temporary video table
		await queryRunner.query(
			`INSERT INTO "temporary_video" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"title",
				"file",
				"recordedAt",
				"duration",
				"size",
				"fullUrl",
				"description",
				"storageProvider",
				"resolution",
				"codec",
				"frameRate",
				"timeSlotId",
				"uploadedById"
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
				"title",
				"file",
				"recordedAt",
				"duration",
				"size",
				"fullUrl",
				"description",
				"storageProvider",
				"resolution",
				"codec",
				"frameRate",
				"timeSlotId",
				"uploadedById"
			FROM "video"`
		);

		// Step 4: Drop the old video table
		await queryRunner.query(`DROP TABLE "video"`);
		await queryRunner.query(`ALTER TABLE "temporary_video" RENAME TO "video"`);

		// Step 5: Create indexes on the new video table
		await queryRunner.query(`CREATE INDEX "IDX_f42d8d7033aacb69287d0dcfd9" ON "video" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_a0c8486c125418dc0cc2e38470" ON "video" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1be826cc802f4cf0abb36ab365" ON "video" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_95bba1c05216311bf162f6d835" ON "video" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_061902beee13424f6372ac19f0" ON "video" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6fd9144466152ccef62e39d853" ON "video" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_158647e790ce90499ed5a53c9b" ON "video" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca" ON "video" ("isActive") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop all the indexes on the new "video" table
		await queryRunner.query(`DROP INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca"`);
		await queryRunner.query(`DROP INDEX "IDX_158647e790ce90499ed5a53c9b"`);
		await queryRunner.query(`DROP INDEX "IDX_6fd9144466152ccef62e39d853"`);
		await queryRunner.query(`DROP INDEX "IDX_061902beee13424f6372ac19f0"`);
		await queryRunner.query(`DROP INDEX "IDX_95bba1c05216311bf162f6d835"`);
		await queryRunner.query(`DROP INDEX "IDX_1be826cc802f4cf0abb36ab365"`);
		await queryRunner.query(`DROP INDEX "IDX_a0c8486c125418dc0cc2e38470"`);
		await queryRunner.query(`DROP INDEX "IDX_f42d8d7033aacb69287d0dcfd9"`);

		// Step 2: Rename the temporary "video" table to "temporary_video"
		await queryRunner.query(`ALTER TABLE "video" RENAME TO "temporary_video"`);

		// Step 3: Create a new "video" table
		await queryRunner.query(`
			CREATE TABLE "video" (
				"deletedAt" datetime,
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"archivedAt" datetime,
				"tenantId" varchar,
				"organizationId" varchar,
				"title" varchar NOT NULL,
				"file" varchar NOT NULL,
				"recordedAt" datetime,
				"duration" integer,
				"size" integer,
				"fullUrl" varchar,
				"description" varchar,
				"storageProvider" varchar CHECK(
					"storageProvider" IN (
						'LOCAL',
						'S3',
						'WASABI',
						'CLOUDINARY',
						'DIGITALOCEAN'
					)
				),
				"resolution" varchar DEFAULT ('1920:1080'),
				"codec" varchar DEFAULT ('libx264'),
				"frameRate" integer DEFAULT (15),
				"timeSlotId" varchar,
				"uploadedById" varchar,
				CONSTRAINT "FK_f42d8d7033aacb69287d0dcfd9a" FOREIGN KEY ("uploadedById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_a0c8486c125418dc0cc2e384703" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_061902beee13424f6372ac19f02" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_6fd9144466152ccef62e39d853e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 4: Insert the data from the old "temporary_video" table into the new "video" table
		await queryRunner.query(`
			INSERT INTO "video" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"title",
				"file",
				"recordedAt",
				"duration",
				"size",
				"fullUrl",
				"description",
				"storageProvider",
				"resolution",
				"codec",
				"frameRate",
				"timeSlotId",
				"uploadedById"
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
				"title",
				"file",
				"recordedAt",
				"duration",
				"size",
				"fullUrl",
				"description",
				"storageProvider",
				"resolution",
				"codec",
				"frameRate",
				"timeSlotId",
				"uploadedById"
			FROM "temporary_video";
		`);

		// Step 5: Drop the old "temporary_video" table
		await queryRunner.query(`DROP TABLE "temporary_video"`);

		// Step 6: Create indexes on the new "video" table
		await queryRunner.query(`CREATE INDEX "IDX_f57c7e5cac7c7ab9809bfc9aca" ON "video" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_158647e790ce90499ed5a53c9b" ON "video" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_6fd9144466152ccef62e39d853" ON "video" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_061902beee13424f6372ac19f0" ON "video" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_95bba1c05216311bf162f6d835" ON "video" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_1be826cc802f4cf0abb36ab365" ON "video" ("storageProvider") `);
		await queryRunner.query(`CREATE INDEX "IDX_a0c8486c125418dc0cc2e38470" ON "video" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f42d8d7033aacb69287d0dcfd9" ON "video" ("uploadedById") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`video\` MODIFY \`duration\` DOUBLE NULL`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`video\` MODIFY \`duration\` INT NULL`);
	}
}
