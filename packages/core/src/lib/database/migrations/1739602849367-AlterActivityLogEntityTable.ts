import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterActivityLogEntityTable1739602849367 implements MigrationInterface {
	name = 'AlterActivityLogEntityTable1739602849367';

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
		// Step 1: Drop the existing foreign key constraint on "creatorId" in the "activity_log" table.
		console.log('Step 1: Dropping foreign key constraint on "creatorId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" DROP CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b"`);

		// Step 2: Drop the existing index on "creatorId".
		console.log('Step 2: Dropping index "creatorId" from "activity_log"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);

		// Step 3: Add new column "employeeId" of type uuid.
		console.log('Step 3: Adding new column "employeeId" to "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" ADD "employeeId" uuid`);

		// Step 4: Copy data from "creatorId" to "employeeId" using employee mapping.
		console.log('Step 4: Copying data from "creatorId" to "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "activity_log" al
			SET "employeeId" = (
				SELECT e.id
				FROM "employee" e
				WHERE e."userId" = al."creatorId"
				ORDER BY e."createdAt" DESC
				LIMIT 1
			)
			WHERE al."creatorId" IS NOT NULL
		`);

		// Step 5: Drop the old "creatorId" column.
		console.log('Step 5: Dropping column "creatorId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" DROP COLUMN "creatorId"`);

		// Step 6: Recreate the index on "employeeId" in "activity_log".
		console.log('Step 6: Recreate the index on "employeeId" in "activity_log"...');
		await queryRunner.query(`CREATE INDEX "IDX_071945a9d4a2322fde08010292" ON "activity_log" ("employeeId")`);

		// Step 7: Add a new foreign key constraint on "employeeId" referencing "employee"("id").
		console.log('Step 7: Adding foreign key constraint on "employeeId" referencing "employee"(id)...');
		await queryRunner.query(`
		   ALTER TABLE "activity_log"
		   ADD CONSTRAINT "FK_071945a9d4a2322fde08010292c"
		   FOREIGN KEY ("employeeId") REFERENCES "employee"("id")
		   ON DELETE CASCADE
		   ON UPDATE NO ACTION
		`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on column "employeeId".
		console.log('Step 1: Dropping foreign key constraint on "employeeId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" DROP CONSTRAINT "FK_071945a9d4a2322fde08010292c"`);

		// Step 2: Drop the index on "employeeId".
		console.log('Step 2: Dropping index "IDX_071945a9d4a2322fde08010292" from "activity_log"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_071945a9d4a2322fde08010292"`);

		// Step 3: Add back the old column "creatorId".
		console.log('Step 3: Adding column "creatorId" back to "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" ADD "creatorId" uuid`);

		// Step 4: Copy data from "employeeId" to "creatorId" using employee mapping.
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "activity_log" AS al
			SET "creatorId" = (
				SELECT e."userId"
				FROM "employee" AS e
				WHERE e."id" = al."employeeId"
				ORDER BY e."createdAt" DESC
				LIMIT 1
			)
			WHERE al."employeeId" IS NOT NULL;
		`);

		// Step 5: Drop the new column "employeeId".
		console.log('Step 5: Dropping column "employeeId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" DROP COLUMN "employeeId"`);

		// Step 6: Recreate the index on the restored "creatorId" column.
		console.log('Step 6: Creating index on "creatorId" in "activity_log"...');
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId")`);

		// Step 7: Re-add the original foreign key constraint on "creatorId" referencing "user"(id).
		console.log('Step 7: Adding foreign key constraint on "creatorId" referencing "user"(id)...');
		await queryRunner.query(`
			ALTER TABLE "activity_log"
			ADD CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b"
			FOREIGN KEY ("creatorId") REFERENCES "user"("id")
			ON DELETE CASCADE
			ON UPDATE NO ACTION
		`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes from the current "activity_log" table.
		console.log('Step 1: Dropping existing indexes from "activity_log"...');
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);

		// Step 2: Create the temporary table "temporary_activity_log" with extra columns.
		console.log('Step 2: Creating temporary table "temporary_activity_log" with new columns...');
		await queryRunner.query(`
			CREATE TABLE "temporary_activity_log" (
				"deletedAt"           datetime,
				"id"                  varchar PRIMARY KEY NOT NULL,
				"createdAt"           datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"           datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"            boolean DEFAULT (1),
				"isArchived"          boolean DEFAULT (0),
				"archivedAt"          datetime,
				"tenantId"            varchar,
				"organizationId"      varchar,
				"entity"              varchar NOT NULL,
				"entityId"            varchar NOT NULL,
				"action"              varchar NOT NULL,
				"actorType"           integer,
				"description"         text,
				"updatedFields"       text,
				"previousValues"      text,
				"updatedValues"       text,
				"previousEntities"    text,
				"updatedEntities"     text,
				"data"                text,
				"creatorId"           varchar,
				"employeeId"          varchar,
				CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_071945a9d4a2322fde08010292c" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 3: Copy data from the old "activity_log" table into "temporary_activity_log".
		console.log('Step 3: Copying data from "activity_log" into "temporary_activity_log"...');
		await queryRunner.query(`
			INSERT INTO "temporary_activity_log" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"action",
				"actorType",
				"description",
				"updatedFields",
				"previousValues",
				"updatedValues",
				"previousEntities",
				"updatedEntities",
				"data",
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
				"entity",
				"entityId",
				"action",
				"actorType",
				"description",
				"updatedFields",
				"previousValues",
				"updatedValues",
				"previousEntities",
				"updatedEntities",
				"data",
				"creatorId"
			FROM "activity_log"
		`);

		// Step 4: Copy data from "creatorId" to "employeeId" using employee mapping.
		console.log('Step 4: Updating "employeeId" from "creatorId"...');
		await queryRunner.query(`
			UPDATE "temporary_activity_log"
			SET "employeeId" = (
				SELECT e."id"
				FROM "employee" e
				WHERE e."userId" = "temporary_activity_log"."creatorId"
				LIMIT 1
			)
			WHERE "creatorId" IS NOT NULL
		`);

		// Step 5: Drop the old "activity_log" table and rename the temporary table.
		console.log('Step 5: Dropping the old "activity_log" table and renaming the temporary table...');
		await queryRunner.query(`DROP TABLE "activity_log"`);
		await queryRunner.query(`ALTER TABLE "temporary_activity_log" RENAME TO "activity_log"`);

		// Step 6: Create the temporary table "temporary_activity_log" with the extended schema.
		console.log('Step 6: Creating temporary table "temporary_activity_log" with extended schema...');
		await queryRunner.query(`
			CREATE TABLE "temporary_activity_log" (
				"deletedAt"           datetime,
				"id"                  varchar PRIMARY KEY NOT NULL,
				"createdAt"           datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"           datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"            boolean DEFAULT (1),
				"isArchived"          boolean DEFAULT (0),
				"archivedAt"          datetime,
				"tenantId"            varchar,
				"organizationId"      varchar,
				"entity"              varchar NOT NULL,
				"entityId"            varchar NOT NULL,
				"action"              varchar NOT NULL,
				"actorType"           integer,
				"description"         text,
				"updatedFields"       text,
				"previousValues"      text,
				"updatedValues"       text,
				"previousEntities"    text,
				"updatedEntities"     text,
				"data"                text,
				"employeeId"          varchar,
				CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_071945a9d4a2322fde08010292c" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 7: Copy data from the existing "activity_log" table into "temporary_activity_log".
		console.log('Step 7: Copying data from "activity_log" into "temporary_activity_log"...');
		await queryRunner.query(`
			INSERT INTO "temporary_activity_log" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"action",
				"actorType",
				"description",
				"updatedFields",
				"previousValues",
				"updatedValues",
				"previousEntities",
				"updatedEntities",
				"data",
				"employeeId"
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
				"entity",
				"entityId",
				"action",
				"actorType",
				"description",
				"updatedFields",
				"previousValues",
				"updatedValues",
				"previousEntities",
				"updatedEntities",
				"data",
				"employeeId"
			FROM "activity_log"
		`);

		// Step 8: Drop the old "activity_log" table and rename the new clean table.
		console.log(
			'Step 8: Dropping old "activity_log" table and renaming "temporary_activity_log" to "activity_log"...'
		);
		await queryRunner.query(`DROP TABLE "activity_log"`);
		await queryRunner.query(`ALTER TABLE "temporary_activity_log" RENAME TO "activity_log"`);

		// Step 9: Create final indexes on the new "activity_log" table.
		console.log('Step 9: Creating indexes on the new "activity_log" table...');
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_071945a9d4a2322fde08010292" ON "activity_log" ("employeeId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes from the final "activity_log" table.
		console.log('Step 1: Dropping existing indexes from "activity_log"...');
		await queryRunner.query(`DROP INDEX "IDX_071945a9d4a2322fde08010292"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);

		// Step 2: Rename the current "activity_log" table to "temporary_activity_log".
		console.log('Step 2: Renaming "activity_log" to "temporary_activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" RENAME TO "temporary_activity_log"`);

		// Step 3: Create the new "activity_log" table with the restored schema.
		console.log('Step 3: Creating new "activity_log" table with restored schema...');
		await queryRunner.query(`
			CREATE TABLE "activity_log" (
				"deletedAt"       datetime,
				"id"              varchar PRIMARY KEY NOT NULL,
				"createdAt"       datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"       datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"        boolean DEFAULT (1),
				"isArchived"      boolean DEFAULT (0),
				"archivedAt"      datetime,
				"tenantId"        varchar,
				"organizationId"  varchar,
				"entity"          varchar NOT NULL,
				"entityId"        varchar NOT NULL,
				"action"          varchar NOT NULL,
				"actorType"       integer,
				"description"     text,
				"updatedFields"   text,
				"previousValues"  text,
				"updatedValues"   text,
				"previousEntities" text,
				"updatedEntities" text,
				"data"            text,
				"creatorId"       varchar,
				"employeeId"      varchar,
				CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 4: Insert data into the new "activity_log" table from "temporary_activity_log".
		console.log('Step 4: Inserting data into "activity_log" from "temporary_activity_log"...');
		await queryRunner.query(`
			INSERT INTO "activity_log" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"action",
				"actorType",
				"description",
				"updatedFields",
				"previousValues",
				"updatedValues",
				"previousEntities",
				"updatedEntities",
				"data",
				"employeeId"
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
				"entity",
				"entityId",
				"action",
				"actorType",
				"description",
				"updatedFields",
				"previousValues",
				"updatedValues",
				"previousEntities",
				"updatedEntities",
				"data",
				"employeeId"
			FROM "temporary_activity_log"
		`);

		// Step 5: Update "creatorId" from "employeeId" using employee table mapping
		console.log('Step 5: Updating "creatorId" from "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "activity_log"
			SET "creatorId" = (
				SELECT e."userId"
				FROM "employee" e
				WHERE e."id" = "activity_log"."employeeId"
				LIMIT 1
			)
			WHERE "employeeId" IS NOT NULL
		`);

		// Step 6: Drop the old "activity_log" table and rename the temporary table.
		console.log('Step 6: Dropping the old "temporary_activity_log" table and renaming the "activity_log" table...');
		await queryRunner.query(`DROP TABLE "temporary_activity_log"`);
		await queryRunner.query(`ALTER TABLE "activity_log" RENAME TO "temporary_activity_log"`);

		// Step 7: Create the new "activity_log" table with the restored original schema.
		console.log('Step 7: Creating new "activity_log" table with restored schema (including "creatorId")...');
		await queryRunner.query(`
			CREATE TABLE "activity_log" (
				"deletedAt"       datetime,
				"id"              varchar PRIMARY KEY NOT NULL,
				"createdAt"       datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"       datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"        boolean DEFAULT (1),
				"isArchived"      boolean DEFAULT (0),
				"archivedAt"      datetime,
				"tenantId"        varchar,
				"organizationId"  varchar,
				"entity"          varchar NOT NULL,
				"entityId"        varchar NOT NULL,
				"action"          varchar NOT NULL,
				"actorType"       integer,
				"description"     text,
				"updatedFields"   text,
				"previousValues"  text,
				"updatedValues"   text,
				"previousEntities" text,
				"updatedEntities" text,
				"data"            text,
				"creatorId"       varchar,
				CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 8: Copy data from "temporary_activity_log" into the new "activity_log" table.
		console.log('Step 8: Inserting data into "activity_log" from "temporary_activity_log"...');
		await queryRunner.query(`
			INSERT INTO "activity_log" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"action",
				"actorType",
				"description",
				"updatedFields",
				"previousValues",
				"updatedValues",
				"previousEntities",
				"updatedEntities",
				"data",
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
				"entity",
				"entityId",
				"action",
				"actorType",
				"description",
				"updatedFields",
				"previousValues",
				"updatedValues",
				"previousEntities",
				"updatedEntities",
				"data",
				"creatorId"
			FROM "temporary_activity_log"
		`);

		// Step 9: Dropping the old "temporary_activity_log" table.
		console.log('Step 9: Dropping the old "temporary_activity_log" table...');
		await queryRunner.query(`DROP TABLE "temporary_activity_log"`);

		// Step 10: Create final indexes on the new "activity_log" table.
		console.log('Step 10: Creating indexes on the new "activity_log" table...');
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the existing foreign key constraint on "creatorId".
		console.log('Step 1: Dropping foreign key constraint on "creatorId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE \`activity_log\` DROP FOREIGN KEY \`FK_b6e9a5c3e1ee65a3bcb8a00de2b\``);

		// Step 2: Drop the existing index on "creatorId".
		console.log('Step 2: Dropping index "creatorId" from "activity_log"...');
		await queryRunner.query(`DROP INDEX \`IDX_b6e9a5c3e1ee65a3bcb8a00de2\` ON \`activity_log\``);

		// Step 3: Add new column "employeeId".
		console.log('Step 3: Adding new column "employeeId" to "activity_log"...');
		await queryRunner.query(`ALTER TABLE \`activity_log\` ADD \`employeeId\` varchar(255) NULL`);

		// Step 4: Copy data from "creatorId" to "employeeId" using employee mapping.
		console.log('Step 4: Copying data from "creatorId" to "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`activity_log\` AS al
			SET al.\`employeeId\` = (
				SELECT e.\`id\`
				FROM \`employee\` AS e
				WHERE al.\`creatorId\` = e.\`userId\`
				ORDER BY e.\`createdAt\` DESC
				LIMIT 1
			)
			WHERE al.\`creatorId\` IS NOT NULL
		`);

		// Step 5: Drop the old "creatorId" column.
		console.log('Step 5: Dropping column "creatorId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE \`activity_log\` DROP COLUMN \`creatorId\``);

		// Step 6: Recreate the index on "employeeId" in "activity_log".
		console.log('Step 6: Recreate the index on "employeeId" in "activity_log"...');
		await queryRunner.query(`CREATE INDEX \`IDX_071945a9d4a2322fde08010292\` ON \`activity_log\` (\`employeeId\`)`);

		// Step 7: Add a new foreign key constraint on "employeeId" referencing "employee"(id).
		console.log('Step 7: Adding foreign key constraint on "employeeId" referencing "employee"(id)...');
		await queryRunner.query(`
			ALTER TABLE \`activity_log\`
			ADD CONSTRAINT \`FK_071945a9d4a2322fde08010292c\`
			FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`)
			ON DELETE CASCADE
			ON UPDATE NO ACTION
		`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "employeeId".
		console.log('Step 1: Dropping foreign key constraint on "employeeId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE \`activity_log\` DROP FOREIGN KEY \`FK_071945a9d4a2322fde08010292c\``);

		// Step 2: Drop the index on "employeeId".
		console.log('Step 2: Dropping index "IDX_071945a9d4a2322fde08010292" from "activity_log"...');
		await queryRunner.query(`DROP INDEX \`IDX_071945a9d4a2322fde08010292\` ON \`activity_log\``);

		// Step 3: Add back the old column "creatorId" back to "activity_log".
		console.log('Step 3: Adding column "creatorId" back to "activity_log"...');
		await queryRunner.query(`ALTER TABLE \`activity_log\` ADD \`creatorId\` varchar(255) NULL`);

		// Step 4: Copy data from "employeeId" to "creatorId" using employee mapping.
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`activity_log\` AS al
			SET al.\`creatorId\` = (
				SELECT e.\`userId\`
				FROM \`employee\` AS e
				WHERE e.\`id\` = al.\`employeeId\`
				ORDER BY e.\`createdAt\` DESC
				LIMIT 1
			)
			WHERE al.\`employeeId\` IS NOT NULL
		`);

		// Step 5: Drop the new column "employeeId".
		console.log('Step 5: Dropping column "employeeId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE \`activity_log\` DROP COLUMN \`employeeId\``);

		// Step 6: Recreate the index on the restored "creatorId" column.
		console.log('Step 6: Recreate the index on "creatorId" in "activity_log"...');
		await queryRunner.query(`CREATE INDEX \`IDX_b6e9a5c3e1ee65a3bcb8a00de2\` ON \`activity_log\` (\`creatorId\`)`);

		// Step 7: Re-add the original foreign key constraint on "creatorId" referencing "user"(id).
		console.log('Step 7: Adding foreign key constraint on "creatorId" referencing "user"(id) in "activity_log"...');
		await queryRunner.query(`
			ALTER TABLE \`activity_log\`
			ADD CONSTRAINT \`FK_b6e9a5c3e1ee65a3bcb8a00de2b\`
			FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`)
			ON DELETE CASCADE
			ON UPDATE NO ACTION
		`);
	}
}
