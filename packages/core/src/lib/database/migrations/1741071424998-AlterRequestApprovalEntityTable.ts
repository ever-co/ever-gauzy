import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterRequestApprovalEntityTable1741071424998 implements MigrationInterface {
	name = 'AlterRequestApprovalEntityTable1741071424998';

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
		// Step 1: Copy data from "createdBy" to "createdByUserId"
		console.log('Step 1: Copying data from createdBy to createdByUserId');
		await queryRunner.query(`UPDATE "request_approval" SET "createdByUserId" = "createdBy"::uuid`);

		// Step 2: Drop the old "createdBy" column.
		console.log('Step 2: Dropping column createdBy');
		await queryRunner.query(`ALTER TABLE "request_approval" DROP COLUMN "createdBy"`);

		// Step 3: Drop the old "createdByName" column.
		console.log('Step 3: Dropping column createdByName');
		await queryRunner.query(`ALTER TABLE "request_approval" DROP COLUMN "createdByName"`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Re-add the "createdByName" column.
		console.log('Step 1: Adding column createdByName');
		await queryRunner.query(`ALTER TABLE "request_approval" ADD "createdByName" character varying`);

		// Step 2: Re-add the "createdBy" column.
		console.log('Step 2: Adding column createdBy');
		await queryRunner.query(`ALTER TABLE "request_approval" ADD "createdBy" character varying`);

		// Step 3: Copy data from "createdByUserId" to "createdBy", casting UUID to text.
		console.log('Step 3: Copying data from createdByUserId to createdBy with casting to text');
		await queryRunner.query(`UPDATE "request_approval" SET "createdBy" = "createdByUserId"::text`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes.
		console.log('Step 1: Dropping existing indexes');
		await queryRunner.query(`DROP INDEX "IDX_d383e220a98ca0c1413bc00e0d"`);
		await queryRunner.query(`DROP INDEX "IDX_95a94c342eb56b844616d6bb29"`);
		await queryRunner.query(`DROP INDEX "IDX_26bb3420001d31337393ed05bc"`);
		await queryRunner.query(`DROP INDEX "IDX_c63fafc733ff8ab37dede8ffec"`);
		await queryRunner.query(`DROP INDEX "IDX_8343741e7929043b2a7de89f73"`);
		await queryRunner.query(`DROP INDEX "IDX_9feaa23ed7bc47d51315e304bb"`);
		await queryRunner.query(`DROP INDEX "IDX_db152600f88a9a4888df0b626e"`);
		await queryRunner.query(`DROP INDEX "IDX_c77295d7f5d6086c815de3c120"`);
		await queryRunner.query(`DROP INDEX "IDX_2cfc197cc78c994f77574af388"`);

		// Step 2: Create temporary table.
		console.log('Step 2: Creating "temporary_request_approval" table');
		await queryRunner.query(`
			CREATE TABLE "temporary_request_approval" (
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"tenantId" varchar,
				"organizationId" varchar,
				"name" varchar NOT NULL,
				"status" integer,
				"min_count" integer,
				"requestId" varchar,
				"requestType" varchar,
				"approvalPolicyId" varchar,
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"deletedAt" datetime,
				"archivedAt" datetime,
				"createdByUserId" varchar,
				"updatedByUserId" varchar,
				"deletedByUserId" varchar,
				CONSTRAINT "FK_d383e220a98ca0c1413bc00e0d2" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_95a94c342eb56b844616d6bb29e" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_26bb3420001d31337393ed05bc3" FOREIGN KEY ("approvalPolicyId") REFERENCES "approval_policy" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_8343741e7929043b2a7de89f739" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_9feaa23ed7bc47d51315e304bb5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_2cfc197cc78c994f77574af3887" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 3: Copy data from the old table to the temporary table and update the createdByUserId.
		console.log('Step 3: Copying data to "temporary_request_approval" and updating the createdByUserId');
		await queryRunner.query(`
			UPDATE "temporary_request_approval"
			SET "createdByUserId" = (
				SELECT "createdBy"
				FROM "request_approval"
				WHERE "request_approval"."id" = "temporary_request_approval"."id"
			)
		`);

		// Step 4: Copy data from the old table to the temporary table.
		console.log('Step 4: Copying data from "request_approval" to "temporary_request_approval"');
		await queryRunner.query(`
			INSERT INTO "temporary_request_approval" (
			  "id",
				"createdAt",
				"updatedAt",
				"tenantId",
				"organizationId",
				"name",
				"status",
				"min_count",
				"requestId",
				"requestType",
				"approvalPolicyId",
				"isActive",
				"isArchived",
				"deletedAt",
				"archivedAt",
				"createdByUserId",
				"updatedByUserId",
				"deletedByUserId"
			)
			SELECT
				"id",
				"createdAt",
				"updatedAt",
				"tenantId",
				"organizationId",
				"name",
				"status",
				"min_count",
				"requestId",
				"requestType",
				"approvalPolicyId",
				"isActive",
				"isArchived",
				"deletedAt",
				"archivedAt",
				"createdByUserId",
				"updatedByUserId",
				"deletedByUserId"
			FROM "request_approval"
		`);

		// Step 5: Drop the original request_approval table.
		console.log('Step 5: Dropping original "request_approval" table');
		await queryRunner.query(`DROP TABLE "request_approval"`);

		// Step 6: Rename temporary_request_approval to request_approval.
		console.log('Step 6: Renaming "temporary_request_approval" to "request_approval"');
		await queryRunner.query(`ALTER TABLE "temporary_request_approval" RENAME TO "request_approval"`);

		// Step 7: Recreate indexes on the new request_approval table.
		console.log('Step 7: Recreating indexes on "request_approval"');
		await queryRunner.query(
			`CREATE INDEX "IDX_d383e220a98ca0c1413bc00e0d" ON "request_approval" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_95a94c342eb56b844616d6bb29" ON "request_approval" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_26bb3420001d31337393ed05bc" ON "request_approval" ("approvalPolicyId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c63fafc733ff8ab37dede8ffec" ON "request_approval" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8343741e7929043b2a7de89f73" ON "request_approval" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_9feaa23ed7bc47d51315e304bb" ON "request_approval" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_db152600f88a9a4888df0b626e" ON "request_approval" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_c77295d7f5d6086c815de3c120" ON "request_approval" ("isArchived") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_2cfc197cc78c994f77574af388" ON "request_approval" ("updatedByUserId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes.
		console.log('Step 1: Dropping existing indexes');
		await queryRunner.query(`DROP INDEX "IDX_2cfc197cc78c994f77574af388"`);
		await queryRunner.query(`DROP INDEX "IDX_c77295d7f5d6086c815de3c120"`);
		await queryRunner.query(`DROP INDEX "IDX_db152600f88a9a4888df0b626e"`);
		await queryRunner.query(`DROP INDEX "IDX_9feaa23ed7bc47d51315e304bb"`);
		await queryRunner.query(`DROP INDEX "IDX_8343741e7929043b2a7de89f73"`);
		await queryRunner.query(`DROP INDEX "IDX_c63fafc733ff8ab37dede8ffec"`);
		await queryRunner.query(`DROP INDEX "IDX_26bb3420001d31337393ed05bc"`);
		await queryRunner.query(`DROP INDEX "IDX_95a94c342eb56b844616d6bb29"`);
		await queryRunner.query(`DROP INDEX "IDX_d383e220a98ca0c1413bc00e0d"`);

		// Step 2: Rename the current request_approval table to temporary_request_approval.
		console.log('Step 2: Renaming "request_approval" to "temporary_request_approval"');
		await queryRunner.query(`ALTER TABLE "request_approval" RENAME TO "temporary_request_approval"`);

		// Step 3: Create the new request_approval table with legacy columns re-added.
		console.log('Step 3: Creating new "request_approval" table with legacy columns');
		await queryRunner.query(`
			CREATE TABLE "request_approval" (
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"tenantId" varchar,
				"organizationId" varchar,
				"name" varchar NOT NULL,
				"status" integer,
				"createdBy" varchar,
				"createdByName" varchar,
				"min_count" integer,
				"requestId" varchar,
				"requestType" varchar,
				"approvalPolicyId" varchar,
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"deletedAt" datetime,
				"archivedAt" datetime,
				"createdByUserId" varchar,
				"updatedByUserId" varchar,
				"deletedByUserId" varchar,
				CONSTRAINT "FK_d383e220a98ca0c1413bc00e0d2" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_95a94c342eb56b844616d6bb29e" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_26bb3420001d31337393ed05bc3" FOREIGN KEY ("approvalPolicyId") REFERENCES "approval_policy" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_8343741e7929043b2a7de89f739" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_9feaa23ed7bc47d51315e304bb5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_2cfc197cc78c994f77574af3887" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 4: Copy data from the old table to the temporary table and update the createdByUserId.
		console.log('Step 4: Copying data to "temporary_request_approval" and updating the createdByUserId');
		await queryRunner.query(`
			UPDATE "request_approval"
			SET "createdBy" = (
				SELECT "createdByUserId"
				FROM "temporary_request_approval"
				WHERE "temporary_request_approval"."id" = "request_approval"."id"
			)
		`);

		// Step 5: Copy data from the temporary_request_approval table into the new request_approval table.
		console.log('Step 5: Copying data from "temporary_request_approval" to new "request_approval"');
		await queryRunner.query(`
			INSERT INTO "request_approval" (
				"id",
				"createdAt",
				"updatedAt",
				"tenantId",
				"organizationId",
				"name",
				"status",
				"min_count",
				"requestId",
				"requestType",
				"approvalPolicyId",
				"isActive",
				"isArchived",
				"deletedAt",
				"archivedAt",
				"createdByUserId",
				"updatedByUserId",
				"deletedByUserId"
			)
			SELECT
				"id",
				"createdAt",
				"updatedAt",
				"tenantId",
				"organizationId",
				"name",
				"status",
				"min_count",
				"requestId",
				"requestType",
				"approvalPolicyId",
				"isActive",
				"isArchived",
				"deletedAt",
				"archivedAt",
				"createdByUserId",
				"updatedByUserId",
				"deletedByUserId"
			FROM "temporary_request_approval"
		`);

		// Step 6: Drop the temporary_request_approval table.
		console.log('Step 6: Dropping "temporary_request_approval" table');
		await queryRunner.query(`DROP TABLE "temporary_request_approval"`);

		// Step 7: Recreate indexes on the new request_approval table.
		console.log('Step 7: Recreating indexes on "request_approval"');
		await queryRunner.query(
			`CREATE INDEX "IDX_2cfc197cc78c994f77574af388" ON "request_approval" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c77295d7f5d6086c815de3c120" ON "request_approval" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_db152600f88a9a4888df0b626e" ON "request_approval" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9feaa23ed7bc47d51315e304bb" ON "request_approval" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8343741e7929043b2a7de89f73" ON "request_approval" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c63fafc733ff8ab37dede8ffec" ON "request_approval" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_26bb3420001d31337393ed05bc" ON "request_approval" ("approvalPolicyId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_95a94c342eb56b844616d6bb29" ON "request_approval" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d383e220a98ca0c1413bc00e0d" ON "request_approval" ("deletedByUserId") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Copy data from "createdBy" to "createdByUserId"
		console.log('Step 1: Copying data from createdBy to createdByUserId');
		await queryRunner.query(`UPDATE \`request_approval\` SET \`createdByUserId\` = \`createdBy\``);

		// Step 2: Drop the "createdBy" column
		console.log('Step 2: Dropping column createdBy');
		await queryRunner.query(`ALTER TABLE \`request_approval\` DROP COLUMN \`createdBy\``);

		// Step 3: Drop the "createdByName" column
		console.log('Step 3: Dropping column createdByName');
		await queryRunner.query(`ALTER TABLE \`request_approval\` DROP COLUMN \`createdByName\``);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Adding column "createdByName"
		console.log('Step 1: Adding column "createdByName"');
		await queryRunner.query(`ALTER TABLE \`request_approval\` ADD \`createdByName\` varchar(255) NULL`);

		// Step 2: Adding column "createdBy"
		console.log('Step 2: Adding column "createdBy"');
		await queryRunner.query(`ALTER TABLE \`request_approval\` ADD \`createdBy\` varchar(255) NULL`);

		// Step 3: Copy data from "createdByUserId" to "createdBy"
		console.log('Step 3: Copy data from "createdByUserId" to "createdBy"');
		await queryRunner.query(`UPDATE \`request_approval\` SET \`createdBy\` = \`createdByUserId\``);
	}
}
