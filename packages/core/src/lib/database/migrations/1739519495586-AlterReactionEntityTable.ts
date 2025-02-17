import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterReactionEntityTable1739519495586 implements MigrationInterface {
	name = 'AlterReactionEntityTable1739519495586';

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
		// Step 1: Drop the foreign key constraint on "creatorId".
		console.log('Step 1: Dropping foreign key constraint "FK_58350b19ecd6a1e287a09d36a2e" from "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_58350b19ecd6a1e287a09d36a2e"`);

		// Step 2: Drop the index on "creatorId".
		console.log('Step 2: Dropping index "IDX_58350b19ecd6a1e287a09d36a2" from "reaction"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_58350b19ecd6a1e287a09d36a2"`);

		// Step 3: Add new column "actorType".
		console.log('Step 3: Adding new column "actorType" to "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" ADD "actorType" integer`);

		// Step 4: Add new column "employeeId".
		console.log('Step 4: Adding new column "employeeId" to "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" ADD "employeeId" uuid`);

		// Step 5: Copy data from "creatorId" to "employeeId".
		console.log('Step 5: Copying data from "creatorId" to "employeeId"...');
		await queryRunner.query(`
			UPDATE "reaction" r
			SET "employeeId" = (
				SELECT id
				FROM "employee" e
				WHERE e."userId" = r."creatorId"
				ORDER BY e."createdAt" DESC
				LIMIT 1
			),
			"actorType" = 1
			WHERE r."creatorId" IS NOT NULL
		`);

		// Step 6: Drop the old "creatorId" column.
		console.log('Step 6: Dropping column "creatorId" from "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" DROP COLUMN "creatorId"`);

		// Step 7: Create indexes on "actorType" and "employeeId".
		console.log('Step 7: Creating indexes on "actorType" and "employeeId"...');
		await queryRunner.query(`CREATE INDEX "IDX_72b52e83a89835be1b2b95aa84" ON "reaction" ("actorType")`);
		await queryRunner.query(`CREATE INDEX "IDX_b58c2c0e374c57e48dbddc93e1" ON "reaction" ("employeeId")`);

		// Step 8: Add foreign key constraint on "employeeId" referencing "employee".
		console.log('Step 8: Adding foreign key constraint on "employeeId"...');
		await queryRunner.query(
			`ALTER TABLE "reaction"
			ADD CONSTRAINT "FK_b58c2c0e374c57e48dbddc93e1e"
			FOREIGN KEY ("employeeId") REFERENCES "employee"("id")
			ON DELETE CASCADE
			ON UPDATE CASCADE`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "employeeId".
		console.log('Step 1: Dropping foreign key constraint "FK_b58c2c0e374c57e48dbddc93e1e" from "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_b58c2c0e374c57e48dbddc93e1e"`);

		// Step 2: Drop indexes on "employeeId" and "actorType".
		console.log('Step 2: Dropping indexes on "employeeId" and "actorType" from "reaction"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_b58c2c0e374c57e48dbddc93e1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_72b52e83a89835be1b2b95aa84"`);

		// Step 3: Re-add the old column "creatorId".
		console.log('Step 3: Adding column "creatorId" back to "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" ADD "creatorId" uuid`);

		// Step 4: Copy data from "employeeId" to "creatorId" via employee table mapping.
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "reaction" r
			SET "creatorId" = e."userId"
			FROM "employee" e
			WHERE r."employeeId" = e.id AND r."employeeId" IS NOT NULL
		`);

		// Step 5: Drop the new columns "employeeId" and "actorType".
		console.log('Step 5: Dropping columns "employeeId" and "actorType" from "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" DROP COLUMN "employeeId"`);
		await queryRunner.query(`ALTER TABLE "reaction" DROP COLUMN "actorType"`);

		// Step 6: Recreate the index on the restored "creatorId" column.
		console.log('Step 6: Creating index on "creatorId" in "reaction"...');
		await queryRunner.query(`CREATE INDEX "IDX_58350b19ecd6a1e287a09d36a2" ON "reaction" ("creatorId")`);

		// Step 7: Re-add the original foreign key constraint on "creatorId" referencing "user"(id).
		console.log('Step 7: Adding foreign key constraint on "creatorId" referencing "user"(id)...');
		await queryRunner.query(`
			ALTER TABLE "reaction"
			ADD CONSTRAINT "FK_58350b19ecd6a1e287a09d36a2e"
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
		// Step 1: Drop existing indexes from the current "reaction" table.
		console.log('Step 1: Dropping existing indexes from "reaction"...');
		await queryRunner.query(`DROP INDEX "IDX_58350b19ecd6a1e287a09d36a2"`);
		await queryRunner.query(`DROP INDEX "IDX_6cbd023426eaa8c22a894ba7c3"`);
		await queryRunner.query(`DROP INDEX "IDX_0617390fab6cec8855f601b293"`);
		await queryRunner.query(`DROP INDEX "IDX_0f320e545c0e01268d5094c433"`);
		await queryRunner.query(`DROP INDEX "IDX_f27bb1170c29785595c6ea142a"`);
		await queryRunner.query(`DROP INDEX "IDX_910d87dc5f24fdc66b90c4b23e"`);
		await queryRunner.query(`DROP INDEX "IDX_dc28f2b25544432f3d0fddbc3b"`);

		// Step 2: Create the temporary table "temporary_reaction" with extra columns.
		console.log('Step 2: Creating temporary table "temporary_reaction" with new columns...');
		await queryRunner.query(`
			CREATE TABLE "temporary_reaction" (
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
				"emoji"               varchar NOT NULL,
				"creatorId"           varchar,
				"actorType"           integer,
				"employeeId"          varchar,
				CONSTRAINT "FK_0f320e545c0e01268d5094c4339" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_f27bb1170c29785595c6ea142a8" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_b58c2c0e374c57e48dbddc93e1e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
			)
		`);

		// Step 3: Copy data from the old "reaction" table into "temporary_reaction".
		console.log('Step 3: Copying data from the existing "reaction" table into "temporary_reaction"...');
		await queryRunner.query(`
			INSERT INTO "temporary_reaction" (
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
				"emoji",
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
				"emoji",
				"creatorId"
			FROM "reaction"
		`);

		// Step 4: Copy data from "employeeId" and "actorType" using employee mapping.
		console.log('Step 4: Updating "employeeId" from "creatorId" and setting "actorType"...');
		await queryRunner.query(`
			UPDATE "temporary_reaction"
			SET "employeeId" = (
				SELECT e."id"
				FROM "employee" e
				WHERE e."userId" = "temporary_reaction"."creatorId"
				LIMIT 1
			),
			"actorType" = 1
			WHERE "creatorId" IS NOT NULL
		`);

		// Step 5: Drop the old "reaction" table and rename the temporary table to it.
		console.log('Step 5: Dropping the old "reaction" table and renaming the temporary table to it...');
		await queryRunner.query(`DROP TABLE "reaction"`);
		await queryRunner.query(`ALTER TABLE "temporary_reaction" RENAME TO "reaction"`);

		// Step 6: Creating temporary table "temporary_reaction" with additional columns...
		console.log('Step 6: Creating temporary table "temporary_reaction" with additional columns...');
		await queryRunner.query(`
			CREATE TABLE "temporary_reaction" (
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
				"emoji"               varchar NOT NULL,
				"actorType"           integer,
				"employeeId"          varchar,
				CONSTRAINT "FK_0f320e545c0e01268d5094c4339" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_f27bb1170c29785595c6ea142a8" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_b58c2c0e374c57e48dbddc93e1e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
			)
		`);

		// Step 7: Copy data from the old "reaction" table into "temporary_reaction".
		console.log('Step 7: Copying data from "reaction" into "temporary_reaction"...');
		await queryRunner.query(`
			INSERT INTO "temporary_reaction" (
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
				"emoji",
				"actorType",
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
				"emoji",
				"actorType",
				"employeeId"
			FROM "reaction"
		`);

		// Step 8: Drop the old "reaction" table and rename the new clean table.
		console.log('Step 8: Dropping old "reaction" table and renaming "temporary_reaction" to "reaction"...');
		await queryRunner.query(`DROP TABLE "reaction"`);
		await queryRunner.query(`ALTER TABLE "temporary_reaction" RENAME TO "reaction"`);

		// Step 9: Create final indexes on the new "reaction" table.
		console.log('Step 9: Creating indexes on the new "reaction" table...');
		await queryRunner.query(`CREATE INDEX "IDX_6cbd023426eaa8c22a894ba7c3" ON "reaction" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0617390fab6cec8855f601b293" ON "reaction" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_0f320e545c0e01268d5094c433" ON "reaction" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f27bb1170c29785595c6ea142a" ON "reaction" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_910d87dc5f24fdc66b90c4b23e" ON "reaction" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_dc28f2b25544432f3d0fddbc3b" ON "reaction" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_72b52e83a89835be1b2b95aa84" ON "reaction" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_b58c2c0e374c57e48dbddc93e1" ON "reaction" ("employeeId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes from the final "reaction" table.
		console.log('Step 1: Dropping existing indexes from "reaction"...');
		await queryRunner.query(`DROP INDEX "IDX_b58c2c0e374c57e48dbddc93e1"`);
		await queryRunner.query(`DROP INDEX "IDX_72b52e83a89835be1b2b95aa84"`);
		await queryRunner.query(`DROP INDEX "IDX_dc28f2b25544432f3d0fddbc3b"`);
		await queryRunner.query(`DROP INDEX "IDX_910d87dc5f24fdc66b90c4b23e"`);
		await queryRunner.query(`DROP INDEX "IDX_f27bb1170c29785595c6ea142a"`);
		await queryRunner.query(`DROP INDEX "IDX_0f320e545c0e01268d5094c433"`);
		await queryRunner.query(`DROP INDEX "IDX_0617390fab6cec8855f601b293"`);
		await queryRunner.query(`DROP INDEX "IDX_6cbd023426eaa8c22a894ba7c3"`);

		// Step 2: Rename the current "reaction" table to "temporary_reaction".
		console.log('Step 2: Renaming "reaction" to "temporary_reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" RENAME TO "temporary_reaction"`);

		// Step 3: Create a new "reaction" table with the old schema.
		console.log('Step 3: Creating new "reaction" table with old schema (with "creatorId")...');
		await queryRunner.query(`
			CREATE TABLE "reaction" (
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
				"emoji"           varchar NOT NULL,
				"creatorId"       varchar,
				"actorType"       integer,
				"employeeId"      varchar,
				CONSTRAINT "FK_58350b19ecd6a1e287a09d36a2e" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_0f320e545c0e01268d5094c4339" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_f27bb1170c29785595c6ea142a8" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 4: Copy data from the old "temporary_reaction" table into the "reaction" table.
		console.log('Step 4: Copying data from the existing "temporary_reaction" table into "reaction"...');
		await queryRunner.query(`
			INSERT INTO "reaction" (
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
				"emoji",
				"actorType",
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
				"emoji",
				"actorType",
				"employeeId"
			FROM "temporary_reaction"
		`);

		// Step 5: Update "creatorId" from "employeeId" using employee table mapping
		console.log('Step 5: Updating "creatorId" from "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "reaction"
			SET "creatorId" = (
				SELECT e."userId"
				FROM "employee" e
				WHERE e."id" = "reaction"."employeeId"
				LIMIT 1
			)
			WHERE "employeeId" IS NOT NULL
		`);

		// Step 6: Drop the old "reaction" table and rename the temporary table to it.
		console.log('Step 6: Dropping the old "temporary_reaction" table and renaming the "reaction" table to it...');
		await queryRunner.query(`DROP TABLE "temporary_reaction"`);
		await queryRunner.query(`ALTER TABLE "reaction" RENAME TO "temporary_reaction"`);

		// Step 7: Recreating "reaction" table with the new columns.
		console.log('Step 7: Recreating "reaction" table with the new columns...');
		await queryRunner.query(`
			CREATE TABLE "reaction" (
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
				"emoji"           varchar NOT NULL,
				"creatorId"       varchar,
				CONSTRAINT "FK_58350b19ecd6a1e287a09d36a2e" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_0f320e545c0e01268d5094c4339" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_f27bb1170c29785595c6ea142a8" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 8: Copy data from the old "temporary_reaction" table into the "reaction" table.
		console.log('Step 8: Copying data from the existing "temporary_reaction" table into "reaction"...');
		await queryRunner.query(`
			INSERT INTO "reaction" (
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
				"emoji",
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
				"emoji",
				"creatorId"
			FROM "temporary_reaction"
		`);

		// Step 9: Dropping the old "temporary_reaction" table.
		console.log('Step 9: Dropping the old "temporary_reaction" table...');
		await queryRunner.query(`DROP TABLE "temporary_reaction"`);

		// Step 10: Create final indexes on the new "reaction" table.
		console.log('Step 10: Creating indexes on the new "reaction" table...');
		await queryRunner.query(`CREATE INDEX "IDX_dc28f2b25544432f3d0fddbc3b" ON "reaction" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_910d87dc5f24fdc66b90c4b23e" ON "reaction" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f27bb1170c29785595c6ea142a" ON "reaction" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0f320e545c0e01268d5094c433" ON "reaction" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0617390fab6cec8855f601b293" ON "reaction" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_6cbd023426eaa8c22a894ba7c3" ON "reaction" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_58350b19ecd6a1e287a09d36a2" ON "reaction" ("creatorId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "creatorId".
		console.log('Step 1: Dropping foreign key constraint "creatorId" from "reaction"...');
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP FOREIGN KEY \`FK_58350b19ecd6a1e287a09d36a2e\``);

		// Step 2: Drop the index on "creatorId".
		console.log('Step 2: Dropping index "creatorId" from "reaction"...');
		await queryRunner.query(`DROP INDEX \`IDX_58350b19ecd6a1e287a09d36a2\` ON \`reaction\``);

		// Step 3: Add new columns "actorType" and "employeeId".
		console.log('Step 3: Adding new columns "actorType" and "employeeId" to "reaction"...');
		// Here, we set actorType's default value to 1 (i.e. ActorTypeEnum.User).
		await queryRunner.query(`ALTER TABLE \`reaction\` ADD \`actorType\` int NULL`);
		await queryRunner.query(`ALTER TABLE \`reaction\` ADD \`employeeId\` varchar(255) NULL`);

		// Step 4: Copy data from "creatorId" to "employeeId" using employee mapping.
		console.log('Step 4: Copying data from "creatorId" to "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`reaction\` r
			JOIN \`employee\` e ON r.\`creatorId\` = e.\`userId\`
			SET r.\`employeeId\` = e.\`id\`, r.\`actorType\` = 1
			WHERE r.\`creatorId\` IS NOT NULL
		`);

		// Step 5: Drop the old "creatorId" column.
		console.log('Step 5: Dropping column "creatorId" from "reaction"...');
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP COLUMN \`creatorId\``);

		// Step 6: Create new indexes on "actorType" and "employeeId".
		console.log('Step 6: Creating indexes on "actorType" and "employeeId" in "reaction"...');
		await queryRunner.query(`CREATE INDEX \`IDX_72b52e83a89835be1b2b95aa84\` ON \`reaction\` (\`actorType\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_b58c2c0e374c57e48dbddc93e1\` ON \`reaction\` (\`employeeId\`)`);

		// Step 7: Add foreign key constraint on "employeeId" referencing "employee"(id).
		console.log('Step 7: Adding foreign key constraint on "employeeId" referencing "employee"(id)...');
		await queryRunner.query(
			`ALTER TABLE \`reaction\`
			ADD CONSTRAINT \`FK_b58c2c0e374c57e48dbddc93e1e\`
			FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`)
			ON DELETE CASCADE
			ON UPDATE CASCADE`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "employeeId".
		console.log('Step 1: Dropping foreign key constraint on "employeeId" from "reaction"...');
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP FOREIGN KEY \`FK_b58c2c0e374c57e48dbddc93e1e\``);

		// Step 2: Drop indexes on "employeeId" and "actorType".
		console.log('Step 2: Dropping indexes on "employeeId" and "actorType" from "reaction"...');
		await queryRunner.query(`DROP INDEX \`IDX_b58c2c0e374c57e48dbddc93e1\` ON \`reaction\``);
		await queryRunner.query(`DROP INDEX \`IDX_72b52e83a89835be1b2b95aa84\` ON \`reaction\``);

		// Step 3: Add back the old column "creatorId".
		console.log('Step 3: Adding column "creatorId" back to "reaction"...');
		await queryRunner.query(`ALTER TABLE \`reaction\` ADD \`creatorId\` varchar(255) NULL`);

		// Step 4: Copy data from "employeeId" to "creatorId" using employee mapping.
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`reaction\` r
			JOIN \`employee\` e ON r.\`employeeId\` = e.\`id\`
			LEFT JOIN \`user\` u ON e.\`userId\` = u.\`id\`
			SET r.\`creatorId\` = e.\`userId\`
			WHERE r.\`employeeId\` IS NOT NULL
			AND e.\`userId\` IS NOT NULL
			AND u.\`id\` IS NOT NULL
		`);

		// Step 5: Drop the new columns "employeeId" and "actorType".
		console.log('Step 5: Dropping columns "employeeId" and "actorType" from "reaction"...');
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP COLUMN \`employeeId\``);
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP COLUMN \`actorType\``);

		// Step 6: Recreate the index on the restored "creatorId" column.
		console.log('Step 6: Creating index on "creatorId" in "reaction"...');
		await queryRunner.query(`CREATE INDEX \`IDX_58350b19ecd6a1e287a09d36a2\` ON \`reaction\` (\`creatorId\`)`);

		// Step 7: Re-add the original foreign key constraint on "creatorId" referencing "user"(id).
		console.log('Step 7: Adding foreign key constraint on "creatorId" referencing "user"(id)...');
		await queryRunner.query(
			`ALTER TABLE \`reaction\`
			ADD CONSTRAINT \`FK_58350b19ecd6a1e287a09d36a2e\`
			FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`)
			ON DELETE CASCADE
			ON UPDATE NO ACTION`
		);
	}
}
