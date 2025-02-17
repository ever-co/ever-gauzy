import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterResourceLinkEntityTable1739782998215 implements MigrationInterface {
	name = 'AlterResourceLinkEntityTable1739782998215';

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
		// Step 1: Drop the old foreign key constraint
		console.log(`Step 1: Drop the old foreign key constraint`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_df91a85b49f78544da67aa9d9ad"`);

		// Step 2: Drop the index associated with the old creatorId
		console.log('Step 2: Dropping index "creatorId" from "resource_link"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_df91a85b49f78544da67aa9d9a"`);

		// Step 3: Add new column "employeeId" of type uuid.
		console.log('Step 3: Adding new column "employeeId" to "resource_link"...');
		await queryRunner.query(`ALTER TABLE "resource_link" ADD "employeeId" uuid`);

		// Step 4: Copy data from "creatorId" to "employeeId" via employee table mapping
		console.log('Step 4: Copying data from "creatorId" to "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "resource_link" rl
			SET "employeeId" = (
				SELECT e."id"
				FROM "employee" e
				WHERE e."userId" = rl."creatorId"
				LIMIT 1
			)
			WHERE rl."creatorId" IS NOT NULL
		`);

		// Step 5: Drop the old "creatorId" column.
		console.log('Step 5: Dropping column "creatorId" from "resource_link"...');
		await queryRunner.query(`ALTER TABLE "resource_link" DROP COLUMN "creatorId"`);

		// Step 6: Recreate the index on "employeeId" in "resource_link".
		console.log('Step 6: Recreate the index on "employeeId" in "resource_link"...');
		await queryRunner.query(`CREATE INDEX "IDX_32a8e7615f4c28255bb50af109" ON "resource_link" ("employeeId")`);

		// Step 7: Add a new foreign key constraint for the employeeId column
		console.log('Step 7: Adding foreign key constraint for "employeeId"...');
		await queryRunner.query(
			`ALTER TABLE "resource_link"
			ADD CONSTRAINT "FK_32a8e7615f4c28255bb50af1098"
			FOREIGN KEY ("employeeId") REFERENCES "employee"("id")
			ON DELETE CASCADE
			ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "employeeId"
		console.log('Step 1: Dropping the foreign key constraint on "employeeId"');
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_32a8e7615f4c28255bb50af1098"`);

		// Step 2: Drop the index associated with the "employeeId"
		console.log('Step 2: Dropping index "employeeId" from "resource_link"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_32a8e7615f4c28255bb50af109"`);

		// Step 3: Add new column "employeeId" of type uuid.
		console.log('Step 3: Adding new column "creatorId" to "resource_link"...');
		await queryRunner.query(`ALTER TABLE "resource_link" ADD "creatorId" uuid`);

		// Step 4: Copy data from "employeeId" to "creatorId" via employee table mapping
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "resource_link" rl
			SET "creatorId" = (
				SELECT e."userId"
				FROM "employee" e
				WHERE e."id" = rl."employeeId"
				LIMIT 1
			)
			WHERE rl."employeeId" IS NOT NULL
		`);

		// Step 5: Drop the new column "employeeId".
		console.log('Step 5: Dropping column "employeeId" from "resource_link"...');
		await queryRunner.query(`ALTER TABLE "resource_link" DROP COLUMN "employeeId"`);

		// Step 6: Recreate the index for "creatorId"
		console.log('Step 6: Creating index on "creatorId"');
		await queryRunner.query(`CREATE INDEX "IDX_df91a85b49f78544da67aa9d9a" ON "resource_link" ("creatorId")`);

		// Step 7: Add the original foreign key constraint for "creatorId"
		console.log('Step 7: Adding the foreign key constraint for "creatorId"');
		await queryRunner.query(
			`ALTER TABLE "resource_link"
			ADD CONSTRAINT "FK_df91a85b49f78544da67aa9d9ad"
			FOREIGN KEY ("creatorId") REFERENCES "user"("id")
			ON DELETE CASCADE
			ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes from the current "resource_link" table.
		console.log('Step 1: Dropping existing indexes from "resource_link"...');
		await queryRunner.query(`DROP INDEX "IDX_df91a85b49f78544da67aa9d9a"`);
		await queryRunner.query(`DROP INDEX "IDX_61dc38c01dfd2fe25cd934a0d1"`);
		await queryRunner.query(`DROP INDEX "IDX_ada8b0cf4463e653a756fc6db2"`);
		await queryRunner.query(`DROP INDEX "IDX_b3caaf70dcd98d572c0fe09c59"`);
		await queryRunner.query(`DROP INDEX "IDX_64d90b997156b7de382fd8a88f"`);
		await queryRunner.query(`DROP INDEX "IDX_2efdd5f6dc5d0c483edbc932ff"`);
		await queryRunner.query(`DROP INDEX "IDX_e891dad6f91b8eb04a47f42a06"`);

		// Step 2: Create the temporary table "temporary_resource_link" with extra columns.
		console.log('Step 2: Creating temporary table "temporary_resource_link" with new columns...');
		await queryRunner.query(`
			CREATE TABLE "temporary_resource_link" (
				"deletedAt" datetime,
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"archivedAt" datetime,
				"tenantId" varchar,
				"organizationId" varchar,
				"entity" varchar NOT NULL,
				"entityId" varchar NOT NULL,
				"title" varchar NOT NULL,
				"url" text NOT NULL,
				"metaData" text,
				"creatorId" varchar,
				"employeeId" varchar,
				CONSTRAINT "FK_b3caaf70dcd98d572c0fe09c59f" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_64d90b997156b7de382fd8a88f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_32a8e7615f4c28255bb50af1098" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 3: Copy data from the old "resource_link" table into "temporary_resource_link".
		console.log('Step 3: Copying data from "resource_link" into "temporary_resource_link"...');
		await queryRunner.query(`
			INSERT INTO "temporary_resource_link" (
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
				"title",
				"url",
				"metaData",
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
				"title",
				"url",
				"metaData",
				"creatorId"
			FROM "resource_link"
		`);

		// Step 4: Copy data from "creatorId" to "employeeId" using employee mapping.
		console.log('Step 4: Updating "employeeId" from "creatorId"...');
		await queryRunner.query(`
			UPDATE "temporary_resource_link"
			SET "employeeId" = (
				SELECT e."id"
				FROM "employee" e
				WHERE e."userId" = "temporary_resource_link"."creatorId"
				LIMIT 1
			)
			WHERE "creatorId" IS NOT NULL
		`);

		// Step 5: Drop the old "resource_link" table and rename the temporary table.
		console.log('Step 5: Dropping the old "resource_link" table and renaming the temporary table...');
		await queryRunner.query(`DROP TABLE "resource_link"`);
		await queryRunner.query(`ALTER TABLE "temporary_resource_link" RENAME TO "resource_link"`);

		// Step 6: Create the temporary table "temporary_resource_link" with the extended schema.
		console.log('Step 6: Creating temporary table "temporary_resource_link" with extended schema...');
		await queryRunner.query(
			`CREATE TABLE "temporary_resource_link" (
				"deletedAt" datetime,
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"archivedAt" datetime,
				"tenantId" varchar,
				"organizationId" varchar,
				"entity" varchar NOT NULL,
				"entityId" varchar NOT NULL,
				"title" varchar NOT NULL,
				"url" text NOT NULL,
				"metaData" text,
				"employeeId" varchar,
				CONSTRAINT "FK_b3caaf70dcd98d572c0fe09c59f" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_64d90b997156b7de382fd8a88f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_32a8e7615f4c28255bb50af1098" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)`
		);

		// Step 7: Copy data from the existing "resource_link" table into "temporary_resource_link".
		console.log('Step 7: Copying data from "resource_link" into "temporary_resource_link"...');
		await queryRunner.query(`
			INSERT INTO "temporary_resource_link"(
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
				"title",
				"url",
				"metaData",
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
				"title",
				"url",
				"metaData",
				"employeeId"
			FROM "resource_link"
		`);

		// Step 8: Drop the old "resource_link" table and rename the new clean table.
		console.log(
			'Step 8: Dropping old "resource_link" table and renaming "temporary_resource_link" to "resource_link"...'
		);
		await queryRunner.query(`DROP TABLE "resource_link"`);
		await queryRunner.query(`ALTER TABLE "temporary_resource_link" RENAME TO "resource_link"`);

		// Step 9: Create final indexes on the new "resource_link" table.
		console.log('Step 9: Creating indexes on the new "resource_link" table...');
		await queryRunner.query(`CREATE INDEX "IDX_61dc38c01dfd2fe25cd934a0d1" ON "resource_link" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ada8b0cf4463e653a756fc6db2" ON "resource_link" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_b3caaf70dcd98d572c0fe09c59" ON "resource_link" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_64d90b997156b7de382fd8a88f" ON "resource_link" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2efdd5f6dc5d0c483edbc932ff" ON "resource_link" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_e891dad6f91b8eb04a47f42a06" ON "resource_link" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_32a8e7615f4c28255bb50af109" ON "resource_link" ("employeeId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes from the final "resource_link" table.
		console.log('Step 1: Dropping existing indexes from "resource_link"...');
		await queryRunner.query(`DROP INDEX "IDX_32a8e7615f4c28255bb50af109"`);
		await queryRunner.query(`DROP INDEX "IDX_e891dad6f91b8eb04a47f42a06"`);
		await queryRunner.query(`DROP INDEX "IDX_2efdd5f6dc5d0c483edbc932ff"`);
		await queryRunner.query(`DROP INDEX "IDX_64d90b997156b7de382fd8a88f"`);
		await queryRunner.query(`DROP INDEX "IDX_b3caaf70dcd98d572c0fe09c59"`);
		await queryRunner.query(`DROP INDEX "IDX_ada8b0cf4463e653a756fc6db2"`);
		await queryRunner.query(`DROP INDEX "IDX_61dc38c01dfd2fe25cd934a0d1"`);

		// Step 2: Rename the current "resource_link" table to "temporary_resource_link".
		console.log('Step 2: Renaming "resource_link" to "temporary_resource_link"...');
		await queryRunner.query(`ALTER TABLE "resource_link" RENAME TO "temporary_resource_link"`);

		// Step 3: Create the new "resource_link" table with the restored schema.
		console.log('Step 3: Creating new "resource_link" table with restored schema...');
		await queryRunner.query(
			`CREATE TABLE "resource_link" (
				"deletedAt" datetime,
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"archivedAt" datetime,
				"tenantId" varchar,
				"organizationId" varchar,
				"entity" varchar NOT NULL,
				"entityId" varchar NOT NULL,
				"title" varchar NOT NULL,
				"url" text NOT NULL,
				"metaData" text,
				"creatorId" varchar,
				"employeeId" varchar,
				CONSTRAINT "FK_df91a85b49f78544da67aa9d9ad" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_b3caaf70dcd98d572c0fe09c59f" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_64d90b997156b7de382fd8a88f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)`
		);

		// Step 4: Insert data into the new "resource_link" table from "temporary_resource_link".
		console.log('Step 4: Inserting data into "resource_link" from "temporary_resource_link"...');
		await queryRunner.query(
			`INSERT INTO "resource_link"(
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
				"title",
				"url",
				"metaData",
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
				"title",
				"url",
				"metaData",
				"employeeId"
			FROM "temporary_resource_link"`
		);

		// Step 5: Update "creatorId" from "employeeId" using employee table mapping
		console.log('Step 5: Updating "creatorId" from "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "resource_link"
			SET "creatorId" = (
				SELECT e."userId"
				FROM "employee" e
				WHERE e."id" = "resource_link"."employeeId"
				LIMIT 1
			)
			WHERE "employeeId" IS NOT NULL
		`);

		// Step 6: Drop the old "resource_link" table and rename the temporary table.
		console.log(
			'Step 6: Dropping the old "temporary_resource_link" table and renaming the "resource_link" table...'
		);
		await queryRunner.query(`DROP TABLE "temporary_resource_link"`);
		await queryRunner.query(`ALTER TABLE "resource_link" RENAME TO "temporary_resource_link"`);

		// Step 7: Create the new "resource_link" table with the restored original schema.
		console.log('Step 7: Creating new "resource_link" table with restored schema (including "creatorId")...');
		await queryRunner.query(`
			CREATE TABLE "resource_link" (
				"deletedAt" datetime,
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"archivedAt" datetime,
				"tenantId" varchar,
				"organizationId" varchar,
				"entity" varchar NOT NULL,
				"entityId" varchar NOT NULL,
				"title" varchar NOT NULL,
				"url" text NOT NULL,
				"metaData" text,
				"creatorId" varchar,
				CONSTRAINT "FK_df91a85b49f78544da67aa9d9ad" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_b3caaf70dcd98d572c0fe09c59f" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_64d90b997156b7de382fd8a88f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 8: Copy data from "temporary_resource_link" into the new "resource_link" table.
		console.log('Step 8: Inserting data into "resource_link" from "temporary_resource_link"...');
		await queryRunner.query(`
			INSERT INTO "resource_link" (
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
				"title",
				"url",
				"metaData",
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
				"title",
				"url",
				"metaData",
				"creatorId"
			FROM
				"temporary_resource_link"
		`);

		// Step 9: Dropping the old "temporary_resource_link" table.
		console.log('Step 9: Dropping the old "temporary_resource_link" table...');
		await queryRunner.query(`DROP TABLE "temporary_resource_link"`);

		// Step 10: Create final indexes on the new "resource_link" table.
		console.log('Step 10: Creating indexes on the new "resource_link" table...');
		await queryRunner.query(`CREATE INDEX "IDX_e891dad6f91b8eb04a47f42a06" ON "resource_link" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_2efdd5f6dc5d0c483edbc932ff" ON "resource_link" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_64d90b997156b7de382fd8a88f" ON "resource_link" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b3caaf70dcd98d572c0fe09c59" ON "resource_link" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ada8b0cf4463e653a756fc6db2" ON "resource_link" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_61dc38c01dfd2fe25cd934a0d1" ON "resource_link" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_df91a85b49f78544da67aa9d9a" ON "resource_link" ("creatorId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the old foreign key constraint
		console.log(`Step 1: Dropping the old foreign key constraint`);
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP FOREIGN KEY \`FK_df91a85b49f78544da67aa9d9ad\``);

		// Step 2: Drop the index associated with the old creatorId
		console.log('Step 2: Dropping index "creatorId" from "resource_link"...');
		await queryRunner.query(`DROP INDEX \`IDX_df91a85b49f78544da67aa9d9a\` ON \`resource_link\``);

		// Step 3: Add new column "employeeId" to "resource_link"
		console.log('Step 3: Adding new column "employeeId" to "resource_link"...');
		await queryRunner.query(`ALTER TABLE \`resource_link\` ADD \`employeeId\` varchar(255) NULL`);

		// Step 4: Copy data from "creatorId" to "employeeId" via employee table mapping
		console.log('Step 4: Copying data from "creatorId" to "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`resource_link\` rl
			JOIN \`employee\` e ON rl.\`creatorId\` = e.\`userId\`
			SET rl.\`employeeId\` = e.\`id\`
			WHERE rl.\`creatorId\` IS NOT NULL
		`);

		// Step 5: Drop the "creatorId" column from "resource_link"
		console.log('Step 5: Dropping the "creatorId" column from "resource_link"...');
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP COLUMN \`creatorId\``);

		// Step 6: Create a new index for the "employeeId" column
		console.log('Step 6: Creating new index for "employeeId"...');
		await queryRunner.query(
			`CREATE INDEX \`IDX_32a8e7615f4c28255bb50af109\` ON \`resource_link\` (\`employeeId\`)`
		);

		// Step 7: Add foreign key constraint for "employeeId"
		console.log('Step 7: Adding foreign key constraint for "employeeId"...');
		await queryRunner.query(
			`ALTER TABLE \`resource_link\`
			ADD CONSTRAINT \`FK_32a8e7615f4c28255bb50af1098\`
			FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`)
			ON DELETE CASCADE
			ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "employeeId"
		console.log('Step 1: Dropping the foreign key constraint on "employeeId"');
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP FOREIGN KEY \`FK_32a8e7615f4c28255bb50af1098\``);

		// Step 2: Drop the index associated with "employeeId"
		console.log('Step 2: Dropping index "employeeId" from "resource_link"');
		await queryRunner.query(`DROP INDEX \`IDX_32a8e7615f4c28255bb50af109\` ON \`resource_link\``);

		// Step 3: Add new column "creatorId" to "resource_link"
		console.log('Step 3: Adding new column "creatorId" to "resource_link"...');
		await queryRunner.query(`ALTER TABLE \`resource_link\` ADD \`creatorId\` varchar(255) NULL`);

		// Step 4: Copy data from "employeeId" back to "creatorId" via employee table mapping
		console.log('Step 4: Copying data from "employeeId" back to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`resource_link\` rl
			JOIN \`employee\` e ON rl.\`employeeId\` = e.\`id\`
			SET rl.\`creatorId\` = e.\`userId\`
			WHERE rl.\`employeeId\` IS NOT NULL
		`);

		// Step 5: Drop the new column "employeeId" from "resource_link"
		console.log('Step 5: Dropping column "employeeId" from "resource_link"...');
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP COLUMN \`employeeId\``);

		// Step 6: Recreate the old index on "creatorId"
		console.log('Step 6: Recreating index for "creatorId"');
		await queryRunner.query(`CREATE INDEX \`IDX_df91a85b49f78544da67aa9d9a\` ON \`resource_link\` (\`creatorId\`)`);

		// Step 7: Add back the old foreign key constraint
		console.log('Step 7: Recreating foreign key for "creatorId"');
		await queryRunner.query(
			`ALTER TABLE \`resource_link\`
			ADD CONSTRAINT \`FK_df91a85b49f78544da67aa9d9ad\`
			FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`)
			ON DELETE CASCADE
			ON UPDATE NO ACTION`
		);
	}
}
